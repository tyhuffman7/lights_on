import { normalizeText, type Identity } from "./identity.ts";
export type Entity = {
  id: string;
  scope: string;
  name: string;
  aliases: string[];
  venueIds?: Record<string, string[]>;
};
// Reviewed seed identities. Catalog aliases augment candidate identity only, never settlement proof.
export const entities: Entity[] = [
  {
    id: "NFL:CLE",
    scope: "nfl",
    name: "Cleveland Browns",
    aliases: ["Browns", "CLE", "Cleveland"],
  },
  {
    id: "NFL:CIN",
    scope: "nfl",
    name: "Cincinnati Bengals",
    aliases: ["Bengals", "CIN", "Cincinnati"],
  },
  {
    id: "NBA:CLE",
    scope: "nba",
    name: "Cleveland Cavaliers",
    aliases: ["Cavaliers", "Cavs", "CLE", "Cleveland"],
  },
  {
    id: "MLB:CLE",
    scope: "mlb",
    name: "Cleveland Guardians",
    aliases: ["Guardians", "CLE", "Cleveland"],
  },
  { id: "NCAAF:OHIO", scope: "cfb", name: "Ohio Bobcats", aliases: ["Ohio"] },
  {
    id: "ATP:CARLOS_ALCARAZ",
    scope: "atp",
    name: "Carlos Alcaraz",
    aliases: ["Carlos Alcaraz Garfia"],
  },
  { id: "CRYPTO:BTC", scope: "crypto", name: "Bitcoin", aliases: ["BTC"] },
  {
    id: "CRYPTO:ETH",
    scope: "crypto",
    name: "Ethereum",
    aliases: ["ETH", "Ether"],
  },
];
export const competitionScope = (s?: string) =>
  ({ ncaaf: "cfb", ncaamb: "cbb", ncaawb: "wcbb" })[normalizeText(s)] ??
  normalizeText(s);
export class EntityRegistry {
  aliases = new Map<string, Set<string>>();
  ids = new Map<string, Set<string>>();
  constructor(rows: Entity[] = entities) {
    for (const row of rows) this.add(row);
  }
  private put(index: Map<string, Set<string>>, key: string, id: string) {
    const values = index.get(key) ?? new Set<string>();
    values.add(id);
    index.set(key, values);
  }
  add(row: Entity) {
    const scope = competitionScope(row.scope);
    if (!scope) return;
    for (const alias of [row.name, ...row.aliases])
      if (normalizeText(alias))
        this.put(this.aliases, scope + ":" + normalizeText(alias), row.id);
    for (const [venue, ids] of Object.entries(row.venueIds ?? {}))
      for (const id of ids)
        this.put(this.ids, scope + ":" + venue + ":" + id, row.id);
  }
  resolve(name: string, scope?: string, venue?: string, venueId?: string) {
    if (!scope) return undefined;
    const scoped = competitionScope(scope);
    const ids =
      venue && venueId
        ? this.ids.get(scoped + ":" + venue + ":" + venueId)
        : undefined;
    if (ids) return ids.size === 1 ? [...ids][0] : undefined;
    if (
      name.startsWith(scoped.toUpperCase() + ":") ||
      entities.some(
        (e) => e.id === name && competitionScope(e.scope) === scoped,
      )
    )
      return name;
    const aliases = this.aliases.get(scoped + ":" + normalizeText(name));
    return aliases?.size === 1 ? [...aliases][0] : undefined;
  }
  normalize(i: Identity): Identity {
    const scope = competitionScope(i.competition);
    const resolve = (n?: string) => {
      if (!n) return undefined;
      const metadata = i.aliases?.find(
        (a) => normalizeText(a.name) === normalizeText(n),
      );
      return (
        this.resolve(n, scope, metadata?.venue, metadata?.venueId) ??
        normalizeText(n)
      );
    };
    const id = (prefix: string, value: string) =>
      value.startsWith(prefix + ":")
        ? value
        : prefix +
          ":" +
          normalizeText(value).replaceAll(" ", "_").toUpperCase();
    const g = i.general;
    const general = g
      ? {
          ...g,
          person: g.person ? id("PERSON", g.person) : undefined,
          event: g.event ? id("EVENT", g.event) : undefined,
          company: g.ticker
            ? "COMPANY:" + g.ticker.toUpperCase()
            : g.company
              ? id("COMPANY", g.company)
              : undefined,
          asset: g.asset
            ? (this.resolve(g.asset, "crypto") ?? id("ASSET", g.asset))
            : undefined,
          jurisdiction: g.jurisdiction
            ? id("LOCATION", g.jurisdiction)
            : undefined,
          indicator: g.indicator ? id("INDICATOR", g.indicator) : undefined,
        }
      : undefined;
    return {
      ...i,
      general,
      competition: scope || undefined,
      participants: [...new Set(i.participants.map((n) => resolve(n)!))].sort(),
      home: resolve(i.home),
      away: resolve(i.away),
      participant: resolve(i.participant),
      outcome: resolve(i.outcome),
    };
  }
}
export function catalogEntities(identities: (Identity | undefined)[]) {
  const registry = new EntityRegistry();
  for (const i of identities)
    for (const team of i?.aliases ?? []) {
      if (!i?.competition) continue;
      const id =
        registry.resolve(team.name, i.competition) ??
        competitionScope(i.competition).toUpperCase() +
          ":" +
          normalizeText(team.name).replaceAll(" ", "_").toUpperCase();
      const parts = normalizeText(team.name).split(" ");
      registry.add({
        id,
        scope: i.competition,
        name: team.name,
        venueIds:
          team.venue && team.venueId
            ? { [team.venue]: [team.venueId] }
            : undefined,
        aliases: [
          ...team.aliases,
          parts.slice(0, -1).join(" "),
          ...(parts.length > 2
            ? [parts.slice(0, -1).join(" ") + " " + parts.at(-1)![0]]
            : []),
        ],
      });
    }
  return registry;
}
