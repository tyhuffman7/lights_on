import { Depth, sizes } from "./sizing.ts";
import type { Level, Pair, Side, Fill } from "../arb/types.ts";
import { feeSchedule, feeBounds, integer } from "./fees.ts";
import type { FeeSchedule } from "./fees.ts";
import { fresh } from "./books.ts";
import type {
  StreamBook,
  ResearchConfig,
  SizeQuote,
  Evaluation,
} from "./types.ts";
export function fill(
  levels: Level[],
  q: number,
  schedule: FeeSchedule,
  sell = false,
): (Fill & { feeUpper: number }) | null {
  integer(q, 1, 1000000);
  let left = q,
    cost = 0;
  const used: Level[] = [];
  for (const l of [...levels].sort((a, b) =>
    sell ? b.price - a.price : a.price - b.price,
  )) {
    integer(l.price, 1, 9999);
    if (!Number.isFinite(l.quantity) || l.quantity < 0)
      throw new Error("Invalid depth");
    const n = Math.min(left, Math.floor(l.quantity));
    if (!n) continue;
    used.push({ price: l.price, quantity: n });
    cost += n * l.price;
    left -= n;
    if (!left) break;
  }
  if (left) return null;
  const fees = feeBounds(used, schedule);
  return {
    quantity: q,
    cost,
    fees: fees.estimated,
    feeUpper: fees.upper,
    levels: used,
  };
}
export function evaluate(
  pair: Pair,
  a: StreamBook,
  b: StreamBook,
  c: ResearchConfig,
  mono: number,
  wall: number,
  verified: boolean,
): Evaluation[] {
  const common: string[] = [];
  if (!verified) common.push("MAPPING_UNVERIFIED");
  if (
    !a.open ||
    !b.open ||
    !pair.a.open ||
    !pair.b.open ||
    [pair.a, pair.b].some(
      (m) =>
        !Number.isFinite(Date.parse(m.closeAt)) ||
        Date.parse(m.closeAt) <= wall,
    )
  )
    common.push("MARKET_CLOSED");
  if (!fresh(a, mono, wall, c.maxAgeMs) || !fresh(b, mono, wall, c.maxAgeMs))
    common.push("BOOK_STALE");
  if (
    [pair.a, pair.b].some(
      (m) => !m.category || /sport|unknown/i.test(m.category),
    )
  )
    common.push("CATEGORY_EXCLUDED");
  const minimumKnown = [pair.a, pair.b].every(
    (m) => Number.isFinite(m.minQty) && m.minQty > 0,
  );
  if (!minimumKnown) common.push("UNKNOWN_MINIMUM_QUANTITY");
  const afee = feeSchedule(pair.a),
    bfee = feeSchedule(pair.b);
  if (!afee || !bfee) common.push("UNKNOWN_FEES");
  return (["yes", "no"] as Side[]).map((aSide) => {
    const bSide: Side = pair.inverted ? aSide : aSide === "yes" ? "no" : "yes";
    const quantity = (ls: Level[]) =>
      ls.reduce((n, l) => n + Math.floor(l.quantity), 0);
    const maxQuantity = Math.min(quantity(a[aSide]), quantity(b[bSide]));
    const reasons = [...common],
      curve: SizeQuote[] = [];
    // Explicit numerical support limit; never silently truncate and call it full depth.
    if (maxQuantity > 1000000) reasons.push("UNSUPPORTED_QUANTITY");
    const runSizing = () =>
      minimumKnown && afee && bfee && maxQuantity > 0 && maxQuantity <= 1000000
        ? sizes(
            new Depth(a[aSide], afee),
            new Depth(b[bSide], bfee),
            Math.max(1, Math.ceil(pair.a.minQty), Math.ceil(pair.b.minQty)),
            maxQuantity,
            c,
          )
        : {
            best: null,
            bestGross: null,
            bankroll: Object.fromEntries(c.bankrolls.map((x) => [x, null])),
            curve: [],
            probes: 0,
          };
    let sized: ReturnType<typeof sizes>;
    try {
      sized = runSizing();
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "SIZING_WORK_LIMIT")
        throw error;
      reasons.push("SIZING_WORK_LIMIT");
      sized = {
        best: null,
        bestGross: null,
        bankroll: Object.fromEntries(c.bankrolls.map((x) => [x, null])),
        curve: [],
        probes: 8192,
      };
    }
    const { best, bestGross, bankroll } = sized;
    curve.push(...sized.curve);
    if (!best) reasons.push("DEPTH_GONE");
    else if (best.profit < c.minProfit || best.roi < c.minRoi)
      reasons.push("EDGE_BELOW_THRESHOLD");
    return {
      pairId: pair.id,
      aSide,
      bSide,
      orientation: `kalshi_${aSide}+pm_us_${bSide}`,
      verified,
      reasons,
      curve,
      best,
      bestGross,
      maxQuantity,
      bankroll,
    };
  });
}
