import type { Level } from "../arb/types.ts";
import { fee, feeBounds, integer } from "./fees.ts";
import type { FeeSchedule } from "./fees.ts";
import type { SizeQuote, ResearchConfig } from "./types.ts";

// Prefix depth makes the pruning bounds logarithmic; exact candidate quotes
// materialize consumed levels. Only selected quotes are retained in evidence. Search bounds use unrounded fees, never sampled guesses.
export class Depth {
  levels: Level[];
  ends: number[] = [];
  costs = [0];
  upper = [0];
  raw = [0];
  schedule: FeeSchedule;
  constructor(levels: Level[], schedule: FeeSchedule) {
    this.schedule = schedule;
    this.levels = [...levels]
      .sort((a, b) => a.price - b.price)
      .map((l) => {
        integer(l.price, 1, 9999);
        if (!Number.isFinite(l.quantity) || l.quantity < 0)
          throw new Error("Invalid depth");
        return { price: l.price, quantity: Math.floor(l.quantity) };
      })
      .filter((l) => l.quantity > 0);
    for (const l of this.levels) {
      this.ends.push((this.ends.at(-1) ?? 0) + l.quantity);
      this.costs.push(this.costs.at(-1)! + l.quantity * l.price);
      this.upper.push(
        this.upper.at(-1)! +
          l.quantity * fee(1, l.price, schedule.rate, schedule.rounding),
      );
      this.raw.push(
        this.raw.at(-1)! +
          (l.quantity * l.price * (10000 - l.price) * schedule.rate) / 1e8,
      );
    }
  }
  at(q: number) {
    let lo = 0,
      hi = this.ends.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ends[mid] < q) lo = mid + 1;
      else hi = mid;
    }
    const l = this.levels[lo],
      n = q - (this.ends[lo - 1] ?? 0);
    return {
      cost: this.costs[lo] + n * l.price,
      upper:
        this.upper[lo] +
        n * fee(1, l.price, this.schedule.rate, this.schedule.rounding),
      raw:
        this.raw[lo] +
        (n * l.price * (10000 - l.price) * this.schedule.rate) / 1e8,
    };
  }
  fill(q: number) {
    let left = q;
    const used: Level[] = [];
    for (const l of this.levels) {
      const n = Math.min(left, l.quantity);
      used.push({ price: l.price, quantity: n });
      left -= n;
      if (!left) break;
    }
    const f = feeBounds(used, this.schedule);
    return {
      quantity: q,
      cost: this.at(q).cost,
      fees: f.estimated,
      feeUpper: f.upper,
      levels: used,
    };
  }
}
export function sizes(
  a: Depth,
  b: Depth,
  min: number,
  max: number,
  c: ResearchConfig,
  balances?: Record<string, { a: number; b: number }>,
) {
  const memo = new Map<number, SizeQuote>();
  const quote = (q: number) => {
    let x = memo.get(q);
    if (x) return x;
    if (memo.size >= 8192) throw new Error("SIZING_WORK_LIMIT");
    const af = a.fill(q),
      bf = b.fill(q),
      cost = af.cost + bf.cost,
      fees = af.fees + bf.fees,
      feeUpper = af.feeUpper + bf.feeUpper,
      reserve = q * c.reserve,
      payout = q * 10000,
      outlay = cost + feeUpper + reserve;
    x = {
      quantity: q,
      aFill: af,
      bFill: bf,
      aVwap: af.cost / q,
      bVwap: bf.cost / q,
      cost,
      fees,
      feeUpper,
      reserve,
      payout,
      outlay,
      grossProfit: payout - cost,
      feeProfit: payout - cost - fees,
      profit: payout - outlay,
      roi: ((payout - outlay) / outlay) * 100,
    };
    memo.set(q, x);
    return x;
  };
  const qualifies = (q: SizeQuote) =>
    q.profit >= c.minProfit && q.roi >= c.minRoi;
  const better = (a: SizeQuote | null, b: SizeQuote) =>
    !a ||
    (qualifies(b) && !qualifies(a)) ||
    (qualifies(b) === qualifies(a) &&
      (b.profit > a.profit ||
        (b.profit === a.profit && b.quantity < a.quantity)))
      ? b
      : a;
  const points = [...new Set([min - 1, ...a.ends, ...b.ends, max])]
    .filter((x) => x >= min - 1 && x <= max)
    .sort((a, b) => a - b);
  const relaxed = (q: number) => {
    const x = a.at(q),
      y = b.at(q);
    return q * 10000 - x.cost - y.cost - x.upper - y.raw - q * c.reserve;
  };
  function search(cap: number): SizeQuote | null {
    let best: SizeQuote | null = null;
    const visit = (lo: number, hi: number) => {
      if (lo > hi) return;
      const l = quote(lo),
        h = quote(hi);
      best = better(better(best, l), h);
      if (hi - lo < 2) return;
      // One order-rounded PM fee differs by at most half a cent. The tiny
      // outward tolerance covers floating point in this pruning bound only;
      // all retained quotes use canonical exact integer fee math.
      const bound = Math.max(relaxed(lo), relaxed(hi)) + 50 + 0.0001;
      const roiBound =
        Math.max(
          (1 + c.minRoi / 100) * (relaxed(lo) + 50) -
            (c.minRoi / 100) * lo * 10000,
          (1 + c.minRoi / 100) * (relaxed(hi) + 50) -
            (c.minRoi / 100) * hi * 10000,
        ) + 0.0001;
      const possible = bound >= c.minProfit && roiBound >= 0;
      if (
        best &&
        ((qualifies(best) && !possible) ||
          ((qualifies(best) || !possible) &&
            (bound < best.profit ||
              (bound < best.profit + 1 && lo >= best.quantity))))
      )
        return;
      // Exact monotonic special case: with zero PM rate the bound is linear,
      // and qualification is a linear inequality on this depth segment.
      if (b.schedule.rate === 0) {
        // Profit and ROI are separate affine inequalities. Their intersection
        // can qualify in the interior even when neither endpoint qualifies.
        for (const feasible of [
          (q: number) => quote(q).profit >= c.minProfit,
          (q: number) => quote(q).roi >= c.minRoi,
        ]) {
          if (feasible(lo) === feasible(hi)) continue;
          let x = lo,
            y = hi;
          const start = feasible(lo);
          while (y - x > 1) {
            const m = (x + y) >> 1;
            if (feasible(m) === start) x = m;
            else y = m;
          }
          best = better(better(best, quote(x)), quote(y));
        }
        return;
      }
      const mid = (lo + hi) >> 1;
      visit(lo + 1, mid);
      visit(mid + 1, hi - 1);
    };
    for (let i = 1; i < points.length; i++)
      visit(Math.max(min, points[i - 1] + 1), Math.min(cap, points[i]));
    return best;
  }
  const best = max >= min ? search(max) : null;
  let bestGross: SizeQuote | null = null;
  for (const p of points)
    for (const q of [p, p + 1])
      if (q >= min && q <= max) {
        const x = quote(q);
        if (
          !bestGross ||
          x.grossProfit > bestGross.grossProfit ||
          (x.grossProfit === bestGross.grossProfit && q < bestGross.quantity)
        )
          bestGross = x;
      }
  const bankroll: Record<string, SizeQuote | null> = {};
  for (const cash of c.bankrolls) {
    const balance = balances?.[cash] ?? { a: cash / 2, b: cash / 2 };
    const affordable = (q: number) => {
      const x = quote(q);
      return (
        x.outlay <= balance.a + balance.b &&
        x.aFill.cost + x.aFill.feeUpper + Math.ceil(x.reserve / 2) <=
          balance.a &&
        x.bFill.cost + x.bFill.feeUpper + Math.floor(x.reserve / 2) <= balance.b
      );
    };
    let lo = min - 1,
      hi = max + 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (affordable(mid)) lo = mid;
      else hi = mid;
    }
    bankroll[cash] = lo >= min ? search(lo) : null;
  }
  let bestFee: SizeQuote | null = null;
  const feeVisit = (lo: number, hi: number) => {
    if (lo > hi) return;
    for (const n of [lo, hi]) {
      const q = quote(n);
      if (
        !bestFee ||
        q.feeProfit > bestFee.feeProfit ||
        (q.feeProfit === bestFee.feeProfit && q.quantity < bestFee.quantity)
      )
        bestFee = q;
    }
    if (hi - lo < 2) return;
    const relaxedFee = (n: number) =>
      n * 10000 - a.at(n).cost - b.at(n).cost - a.at(n).raw - b.at(n).raw;
    const bound = Math.max(relaxedFee(lo), relaxedFee(hi)) + 50 + 0.0001;
    if (
      bestFee &&
      (bound < bestFee.feeProfit ||
        (bound < bestFee.feeProfit + 1 && lo >= bestFee.quantity))
    )
      return;
    if (a.schedule.rate === 0 && b.schedule.rate === 0) return;
    const mid = (lo + hi) >> 1;
    feeVisit(lo + 1, mid);
    feeVisit(mid + 1, hi - 1);
  };
  for (let i = 1; i < points.length; i++)
    feeVisit(Math.max(min, points[i - 1] + 1), points[i]);
  // Persist a compact selection, not the internal branch-and-bound probes.
  const selected = [
    best,
    bestGross,
    bestFee,
    ...Object.values(bankroll),
  ].filter((q): q is SizeQuote => !!q);
  const curve = [
    ...new Map(selected.map((q) => [q.quantity, q])).values(),
  ].sort((a, b) => a.quantity - b.quantity);
  return { best, bestGross, bankroll, curve, probes: memo.size };
}
