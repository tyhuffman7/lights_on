import type { Market } from "../arb/types.ts";
export class ReconciliationScheduler {
  last = new Map<string, number>();
  nextAt = 0;
  take(
    markets: Market[],
    now: number,
    limit: number,
    intervalMs: number,
    suspicious = new Set<string>(),
  ) {
    if (now < this.nextAt) return [];
    this.nextAt = now + intervalMs;
    const unique = [
      ...new Map(markets.map((m) => [m.venue + ":" + m.id, m])).values(),
    ];
    unique.sort((a, b) => {
      const ak = a.venue + ":" + a.id,
        bk = b.venue + ":" + b.id;
      // Suspicion advances one interval without starving the oldest healthy books.
      return (
        (this.last.get(ak) ?? -1e15) -
          (suspicious.has(ak) ? intervalMs : 0) -
          ((this.last.get(bk) ?? -1e15) -
            (suspicious.has(bk) ? intervalMs : 0)) || ak.localeCompare(bk)
      );
    });
    const taken = unique.slice(0, limit);
    for (const m of taken) this.last.set(m.venue + ":" + m.id, now);
    return taken;
  }
}
