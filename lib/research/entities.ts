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
  // NFL roster names checked against https://www.nfl.com/teams/ on 2026-09-12.
  // Never alias bare Los Angeles or New York: each city has two teams.
  {"id": "NFL:ARIZONA", "scope": "nfl", "name": "Arizona Cardinals", "aliases": ["Arizona", "Cardinals"]},
  {"id": "NFL:ATLANTA", "scope": "nfl", "name": "Atlanta Falcons", "aliases": ["Atlanta", "Falcons"]},
  {"id": "NFL:BALTIMORE", "scope": "nfl", "name": "Baltimore Ravens", "aliases": ["Baltimore", "Ravens"]},
  {"id": "NFL:BUFFALO", "scope": "nfl", "name": "Buffalo Bills", "aliases": ["Buffalo", "Bills"]},
  {"id": "NFL:CAROLINA", "scope": "nfl", "name": "Carolina Panthers", "aliases": ["Carolina", "Panthers"]},
  {"id": "NFL:CHICAGO", "scope": "nfl", "name": "Chicago Bears", "aliases": ["Chicago", "Bears"]},
  {"id": "NFL:DALLAS", "scope": "nfl", "name": "Dallas Cowboys", "aliases": ["Dallas", "Cowboys"]},
  {"id": "NFL:DENVER", "scope": "nfl", "name": "Denver Broncos", "aliases": ["Denver", "Broncos"]},
  {"id": "NFL:DETROIT", "scope": "nfl", "name": "Detroit Lions", "aliases": ["Detroit", "Lions"]},
  {"id": "NFL:GREEN_BAY", "scope": "nfl", "name": "Green Bay Packers", "aliases": ["Green Bay", "Packers"]},
  {"id": "NFL:HOUSTON", "scope": "nfl", "name": "Houston Texans", "aliases": ["Houston", "Texans"]},
  {"id": "NFL:INDIANAPOLIS", "scope": "nfl", "name": "Indianapolis Colts", "aliases": ["Indianapolis", "Colts"]},
  {"id": "NFL:JACKSONVILLE", "scope": "nfl", "name": "Jacksonville Jaguars", "aliases": ["Jacksonville", "Jaguars"]},
  {"id": "NFL:KANSAS_CITY", "scope": "nfl", "name": "Kansas City Chiefs", "aliases": ["Kansas City", "Chiefs"]},
  {"id": "NFL:LAS_VEGAS", "scope": "nfl", "name": "Las Vegas Raiders", "aliases": ["Las Vegas", "Raiders"]},
  {"id": "NFL:LOS_ANGELES_C", "scope": "nfl", "name": "Los Angeles Chargers", "aliases": ["Los Angeles C", "Chargers"]},
  {"id": "NFL:LOS_ANGELES_R", "scope": "nfl", "name": "Los Angeles Rams", "aliases": ["Los Angeles R", "Rams"]},
  {"id": "NFL:MIAMI", "scope": "nfl", "name": "Miami Dolphins", "aliases": ["Miami", "Dolphins"]},
  {"id": "NFL:MINNESOTA", "scope": "nfl", "name": "Minnesota Vikings", "aliases": ["Minnesota", "Vikings"]},
  {"id": "NFL:NEW_ENGLAND", "scope": "nfl", "name": "New England Patriots", "aliases": ["New England", "Patriots"]},
  {"id": "NFL:NEW_ORLEANS", "scope": "nfl", "name": "New Orleans Saints", "aliases": ["New Orleans", "Saints"]},
  {"id": "NFL:NEW_YORK_G", "scope": "nfl", "name": "New York Giants", "aliases": ["New York G", "Giants"]},
  {"id": "NFL:NEW_YORK_J", "scope": "nfl", "name": "New York Jets", "aliases": ["New York J", "Jets"]},
  {"id": "NFL:PHILADELPHIA", "scope": "nfl", "name": "Philadelphia Eagles", "aliases": ["Philadelphia", "Eagles"]},
  {"id": "NFL:PITTSBURGH", "scope": "nfl", "name": "Pittsburgh Steelers", "aliases": ["Pittsburgh", "Steelers"]},
  {"id": "NFL:SAN_FRANCISCO", "scope": "nfl", "name": "San Francisco 49ers", "aliases": ["San Francisco", "49ers"]},
  {"id": "NFL:SEATTLE", "scope": "nfl", "name": "Seattle Seahawks", "aliases": ["Seattle", "Seahawks"]},
  {"id": "NFL:TAMPA_BAY", "scope": "nfl", "name": "Tampa Bay Buccaneers", "aliases": ["Tampa Bay", "Buccaneers"]},
  {"id": "NFL:TENNESSEE", "scope": "nfl", "name": "Tennessee Titans", "aliases": ["Tennessee", "Titans"]},
  {"id": "NFL:WASHINGTON", "scope": "nfl", "name": "Washington Commanders", "aliases": ["Washington", "Commanders"]},
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
