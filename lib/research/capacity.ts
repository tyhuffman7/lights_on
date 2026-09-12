import type { Mapping } from "./types.ts";
import { isVerified } from "./mappings.ts";
import { reviewQueue, type ResearchActivity } from "./review.ts";
export class CapacityScheduler {
  selected = new Set<string>();
  exploration = new Set<string>();
  epoch = -1;
  select(
    mappings: Mapping[],
    cap: number,
    fraction = 0.2,
    rotationMs = 900000,
    now = Date.now(),
    activity: Record<string, ResearchActivity> = {},
    paperPriority: ReadonlySet<string> = new Set(),
    paperSettlementDeadline: number | null = null,
  ) {
    const open = mappings.filter(
      (m) =>
        m.active &&
        m.pair.a.open &&
        m.pair.b.open &&
        [m.pair.a, m.pair.b].every((x) => Date.parse(x.closeAt) > now),
    );
    const eligible = paperSettlementDeadline === null ? open : open.filter(m =>
      [m.pair.a,m.pair.b].every(x => Date.parse(x.closeAt) <= paperSettlementDeadline));
    const excludedByPaperHorizon = open.length - eligible.length;
    const priority = (m: Mapping) => isVerified(m) || paperPriority.has(m.id);
    const epoch = Math.floor(now / rotationMs),
      rotate = epoch !== this.epoch;
    const scores = new Map(
      reviewQueue(eligible, activity, now).map((r) => [r.id, r.score]),
    );
    const ranked = [...eligible].sort(
      (a, b) =>
        Number(priority(b)) - Number(priority(a)) ||
        (Number(this.selected.has(b.id) && !this.exploration.has(b.id)) -
          Number(this.selected.has(a.id) && !this.exploration.has(a.id))) *
          10 ||
        scores.get(b.id)! - scores.get(a.id)! ||
        a.id.localeCompare(b.id),
    );
    const a = new Set<string>(),
      b = new Set<string>(),
      selected = new Set<string>(),
      exploration = new Set<string>();
    const add = (m: Mapping, limit: number, explore = false) => {
      if (selected.has(m.id)) return true;
      if (
        a.size + Number(!a.has(m.pair.a.id)) > limit ||
        b.size + Number(!b.has(m.pair.b.id)) > limit
      )
        return false;
      a.add(m.pair.a.id);
      b.add(m.pair.b.id);
      selected.add(m.id);
      if (explore) exploration.add(m.id);
      return true;
    };
    // Verified pairs take precedence; reserve 20% for unbiased rotating exploration when possible.
    for (const m of ranked.filter(priority)) add(m, cap);
    const priorityCap = Math.max(1, Math.floor(cap * (1 - fraction)));
    for (const m of ranked)
      if (this.selected.has(m.id) && !this.exploration.has(m.id))
        add(m, priorityCap);
    const categories = new Map<string, Mapping[]>();
    for (const m of ranked.filter((m) => !priority(m))) {
      const key = m.pair.a.identity?.competition ?? m.pair.a.category;
      const list = categories.get(key) ?? [];
      list.push(m);
      categories.set(key, list);
    }
    // Round-robin across categories prevents one large futures class monopolizing priority slots.
    let more = true;
    while (more) {
      more = false;
      for (const list of categories.values()) {
        const m = list.shift();
        if (m) {
          more = true;
          add(m, priorityCap);
        }
      }
    }
    const pool = eligible
      .filter((m) => !selected.has(m.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!rotate)
      for (const m of pool) if (this.exploration.has(m.id)) add(m, cap, true);
    const offset = pool.length
      ? (epoch * Math.max(1, Math.floor(cap * fraction))) % pool.length
      : 0;
    for (let i = 0; i < pool.length; i++)
      add(pool[(i + offset) % pool.length], cap, true);
    this.selected = selected;
    this.exploration = exploration;
    this.epoch = epoch;
    return {
      eligible: eligible.length,
      excludedByPaperHorizon,
      paperSettlementDeadline,
      selected: selected.size,
      deferred: eligible.length - selected.size,
      selectedIds: [...selected],
      explorationIds: [...exploration],
      explorationMappings: exploration.size,
      explorationFraction: fraction,
      nextRotationAt: (epoch + 1) * rotationMs,
      subscribed: { kalshi: [...a], poly: [...b] },
      utilization: { kalshi: a.size / cap, poly: b.size / cap },
      deferredReasons: eligible
        .filter((m) => !selected.has(m.id))
        .map((m) => ({
          id: m.id,
          reason: "PAIR_CAPACITY_OR_EXPLORATION_ROTATION",
        })),
    };
  }
}
