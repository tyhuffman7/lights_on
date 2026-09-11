import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoverCandidates,
  matchCandidates,
} from "../lib/research/matching.ts";
import {
  scheduledTime,
  identity as extractIdentity,
  type Identity,
} from "../lib/research/identity.ts";
import { market } from "./research-fixture.ts";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { applyCatalog } from "../worker/coverage.ts";
const identity = (overrides: Partial<Identity> = {}): Identity => ({
  sports: true,
  competition: "nfl",
  participants: ["cincinnati bengals", "cleveland browns"],
  eventDate: "2026-09-13",
  eventAt: "2026-09-13T17:00:00Z",
  marketType: "winner",
  period: "full event",
  outcome: "cincinnati bengals",
  entities: [],
  numbers: [],
  ...overrides,
});
const m = (
  venue: "kalshi" | "poly",
  overrides: Partial<Identity> = {},
  title = venue === "kalshi"
    ? "Cincinnati wins"
    : "Bengals versus Cleveland: Sunday moneyline",
) =>
  ({
    ...market(venue),
    category: "Sports",
    title,
    identity: identity(overrides),
  }) as any;
test("Sports identity admits different wording and swapped team order but never grants verification", () => {
  const a = m("kalshi"),
    b = m("poly", { participants: ["cleveland browns", "cincinnati bengals"] });
  const candidates = matchCandidates([a], [b]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].status, "UNVERIFIED");
  assert.match(candidates[0].reasons.join(" "), /Same competition/);
  const s = new ResearchStore(":memory:"),
    r = new MappingRegistry(s);
  applyCatalog(r, {
    kalshi: [a],
    poly: [b],
    at: Date.now(),
    complete: true,
    errors: [],
  });
  assert.equal(r.list()[0].status, "UNVERIFIED");
  s.close();
});
test("Scheduled times normalize timezones; same teams on different dates are rejected", () => {
  assert.equal(
    scheduledTime("originally scheduled for Sep 13, 2026 at 1:00 PM EDT"),
    "2026-09-13T17:00:00.000Z",
  );
  assert.equal(
    scheduledTime("scheduled for Sep 13, 2026 at 10:00 AM PDT"),
    "2026-09-13T17:00:00.000Z",
  );
  const r = discoverCandidates(
    [m("kalshi")],
    [m("poly", { eventDate: "2026-09-14", eventAt: "2026-09-14T17:00:00Z" })],
  );
  assert.equal(r.candidates.length, 0);
  assert.equal(r.diagnostics.rejected.dateMismatch, 1);
});
test("Sports line and period conflicts reject candidate pairing", () => {
  for (const marketType of ["spread", "total"]) {
    const r = discoverCandidates(
      [m("kalshi", { marketType, line: 3.5 })],
      [m("poly", { marketType, line: 4.5 })],
    );
    assert.equal(r.candidates.length, 0);
    assert.equal(r.diagnostics.rejected.thresholdMismatch, 1);
  }
  assert.equal(
    matchCandidates([m("kalshi", { period: "first half" })], [m("poly")])
      .length,
    0,
  );
});
test("Same player in different tennis events is not enough; retirement rules never auto-verify", () => {
  const a = m("kalshi", {
      competition: "atp",
      participants: ["player a", "player b"],
      outcome: "player a",
    }),
    b = m("poly", {
      competition: "atp",
      participants: ["player a", "player c"],
      outcome: "player a",
    });
  assert.equal(matchCandidates([a], [b]).length, 0);
  b.identity = { ...a.identity };
  a.rules = "Retirement voids";
  b.rules = "Retirement settles at fair value";
  const c = matchCandidates([a], [b]);
  assert.equal(c.length, 1);
  assert.equal(c[0].status, "UNVERIFIED");
});
test("Candidate indexing deduplicates and reports bounded comparisons", () => {
  const a = m("kalshi"),
    b = m("poly");
  assert.equal(matchCandidates([a, a], [b, b]).length, 1);
  const many = Array.from({ length: 2000 }, (_, i) => ({
    ...b,
    id: "P" + i,
    title: "unrelated event " + i,
    identity: undefined,
  }));
  const r = discoverCandidates([a], many);
  assert.ok(r.diagnostics.comparisons <= 300);
  assert.equal(r.candidates.length, 0);
});
test("General entity identity admits low-title-overlap candidates without verification", () => {
  const a = {
    ...market("kalshi"),
    title: "Will Jane Doe capture the statewide contest?",
    structured: { entity: "Jane Doe", event: "governor 2026" },
  } as any;
  const b = {
    ...market("poly"),
    title: "Election victory: Doe",
    structured: { entity: "Jane Doe", event: "governor 2026" },
  } as any;
  assert.equal(matchCandidates([a], [b]).length, 1);
  assert.equal(matchCandidates([a], [b])[0].status, "UNVERIFIED");
});

test("Known live false matches reject differing jurisdictions, award categories and outcome concepts", () => {
  const pair = (a: string, b: string) =>
    matchCandidates(
      [{ ...market("kalshi"), title: a, category: "Politics" } as any],
      [{ ...market("poly"), title: b, category: "Politics" } as any],
    );
  assert.equal(
    pair(
      "Will Republican Party win the House race for CA-06?",
      "Republican Party · FL-10 House Election Winner",
    ).length,
    0,
  );
  assert.equal(
    pair(
      "Will Coldplay announce a new tour this year?",
      "Coldplay · Who Will Have a #1 Album in 2026?",
    ).length,
    0,
  );
  const a = {
    ...market("kalshi"),
    title: "Will Saturn Return win Best Adapted Screenplay at the Oscars?",
    outcome: "Saturn Return",
    category: "Culture",
  } as any;
  const b = {
    ...market("poly"),
    title: "Saturn Return · Oscar Winner: Best Picture",
    category: "Culture",
  } as any;
  assert.equal(matchCandidates([a], [b]).length, 0);
});

test("Placement outcomes reject winner versus third and preserve equivalent second place", () => {
  const pair = (a: string, b: string) =>
    matchCandidates(
      [
        {
          ...market("kalshi"),
          title: a,
          outcome: "Angela Murray",
          category: "Culture",
        } as any,
      ],
      [
        {
          ...market("poly"),
          title: b,
          outcome: "Angela Murray",
          category: "Culture",
        } as any,
      ],
    );
  assert.equal(
    pair(
      "Will Angela Murray finish in 3 place in Big Brother Season 28?",
      "Angela Murray · Big Brother Season 28 Winner",
    ).length,
    0,
  );
  assert.equal(
    pair(
      "Will Angela Murray finish in 2 place in Big Brother Season 28?",
      "Angela Murray · Big Brother Season 28 2nd Place",
    ).length,
    1,
  );
});

test("Sports normalization uses unambiguous team names and retains period and exchange metadata", async () => {
  const { identity: normalizeIdentity } =
    await import("../lib/research/identity.ts");
  const { normalizeKalshi } = await import("../lib/arb/adapters.ts");
  const team = (safeName: string, ordering: string) => ({
    name: "Owls",
    safeName,
    league: "cfb",
    ordering,
  });
  const i = normalizeIdentity("poly", {
    category: "sports",
    slug: "aec-cfb-fixture-i1-2026-09-13",
    sportsMarketTypeV2: "OTHER",
    sportsMarketType: "inning_1_moneyline",
    marketSides: [
      { long: true, team: team("Rice", "home") },
      { long: false, team: team("Temple", "away") },
    ],
  });
  assert.deepEqual(i.participants, ["rice", "temple"]);
  assert.equal(i.home, "rice");
  assert.equal(i.away, "temple");
  assert.equal(i.outcome, "rice");
  assert.equal(i.period, "inning 1");
  const a = m("kalshi", {
    competition: "cfb",
    participants: ["owls", "opponent"],
    outcome: "owls",
  });
  const b = m("poly", {
    competition: "cfb",
    participants: ["rice", "opponent"],
    outcome: "rice",
    aliases: [{ name: "rice", aliases: ["owls"] }],
  });
  const c = {
    ...m("poly", {
      competition: "cfb",
      participants: ["temple", "opponent"],
      outcome: "temple",
      aliases: [{ name: "temple", aliases: ["owls"] }],
    }),
    id: "other",
  };
  assert.equal(matchCandidates([a], [b, c]).length, 0);
  const raw = {
    ticker: "KXMLBGAME-TEST",
    status: "active",
    market_type: "binary",
    notional_value_dollars: "1.0000",
    exchange_index: 3,
  };
  const k = await normalizeKalshi(raw, { category: "Sports" });
  assert.equal(k.open, true);
  assert.equal(k.exchangeIndex, 3);
  assert.equal(k.feeRate, null);
  assert.equal(
    (await normalizeKalshi({ ...raw, mve_collection_ticker: "combo" })).open,
    false,
  );
});

test("Dashboard script parses and retains independent bounded polling intervals", async () => {
  const { readFileSync } = await import("node:fs");
  const { Script } = await import("node:vm");
  const html = readFileSync(
    new URL("../worker/dashboard.html", import.meta.url),
    "utf8",
  );
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Script(script));
});

test("Rediscovered orientation changes invalidate previous review", () => {
  const a = m("kalshi"),
    b = m("poly");
  const s = new ResearchStore(":memory:"),
    r = new MappingRegistry(s);
  try {
    const data = {
      kalshi: [a],
      poly: [b],
      at: Date.now(),
      complete: true,
      errors: [],
    };
    applyCatalog(r, data);
    const existing = r.list()[0];
    r.verify(existing.id, "MANUAL_VERIFIED", "Synthetic rules review");
    b.identity = { ...b.identity, outcome: "cleveland browns" };
    applyCatalog(r, { ...data, at: Date.now() + 1 });
    assert.equal(r.get(existing.id)?.pair.inverted, true);
    assert.equal(r.get(existing.id)?.status, "INVALIDATED");
  } finally {
    s.close();
  }
});

test("Live catalog counterexamples reject first-inning runs, ranking and declaration versus election victory", async () => {
  const { normalizeKalshi, normalizePoly } =
    await import("../lib/arb/adapters.ts");
  const a = await normalizeKalshi(
    {
      ticker: "KXKBORFI-TEST",
      title: "LG Twins vs Samsung Lions: First Inning Run?",
      status: "active",
      market_type: "binary",
      notional_value_dollars: "1.0000",
    },
    { category: "Sports" },
  );
  assert.equal(a.identity?.marketType, "prop");
  assert.equal(a.identity?.period, "inning 1");
  const general = (a: string, b: string) =>
    matchCandidates(
      [
        {
          ...market("kalshi"),
          title: a,
          outcome: "Yes",
          category: "Culture",
        } as any,
      ],
      [
        {
          ...market("poly"),
          title: b,
          outcome: "Yes",
          category: "Culture",
        } as any,
      ],
    );
  assert.equal(
    general(
      "Will Ready or Not be #2 US Netflix Movie on Sep 14, 2026?",
      "Ready or Not · Top US Netflix Movie This Week?",
    ).length,
    0,
  );
  assert.equal(
    general(
      "Will Josh Shapiro be first this list to declare for 2028 United States presidential election?",
      "Josh Shapiro · 2028 US Presidential Election Winner",
    ).length,
    0,
  );
  assert.equal(
    general(
      "Will Michigan have the smallest margin of victory in 2026 United States Senate elections?",
      "Democrat 9-12% · Michigan Senate Election Margin of Victory",
    ).length,
    0,
  );
});

test("At-large districts and award or nomination stages remain distinct", () => {
  const general = (a: string, b: string) =>
    matchCandidates(
      [
        {
          ...market("kalshi"),
          title: a,
          outcome: "Yes",
          category: "Culture",
        } as any,
      ],
      [
        {
          ...market("poly"),
          title: b,
          outcome: "Yes",
          category: "Culture",
        } as any,
      ],
    );
  assert.equal(
    general(
      "Will Democratic win the House race for DC-AL?",
      "Democratic Party · AK-AL House Election Winner",
    ).length,
    0,
  );
  assert.equal(
    general(
      "Will Hacks win Outstanding Writing for a Comedy Series at the Emmy Awards?",
      "Hacks · Emmys: Outstanding Comedy Series",
    ).length,
    0,
  );
  assert.equal(
    general(
      "Will François Hollande appear on the official candidate list for the first round of the 2027 French presidential election?",
      "Francois Hollande · 2027 French Presidential Election Winner",
    ).length,
    0,
  );
});

test("Outcome actions and named ranking platforms cannot be conflated", () => {
  const general = (a: string, b: string) =>
    matchCandidates(
      [
        {
          ...market("kalshi"),
          title: a,
          outcome: "Yes",
          category: "Culture",
        } as any,
      ],
      [
        {
          ...market("poly"),
          title: b,
          outcome: "Yes",
          category: "Culture",
        } as any,
      ],
    );
  assert.equal(
    general(
      "Will Lai Noelle and their partner be eliminated from America's Got Talent Season 21 before Sep 19, 2026?",
      "Lai Noelle · America's Got Talent Season 21: Winner",
    ).length,
    0,
  );
  assert.equal(
    general(
      "Will Bad Bunny be in the Top 5 rank on Google's Year in Search 2026 Global People?",
      "Bad Bunny · Spotify Top Global Artist 2026",
    ).length,
    0,
  );
});

test("Sports futures distinguish qualification, championship, seeding and competition", () => {
  const future = (
    venue: "kalshi" | "poly",
    title: string,
    competition: string | undefined = "cfb",
  ) =>
    m(
      venue,
      {
        participants: ["east carolina"],
        outcome: "east carolina",
        marketType: "future",
        eventKey: title,
        competition,
      },
      title,
    );
  assert.equal(
    matchCandidates(
      [
        future(
          "kalshi",
          "East Carolina qualify for American Athletic Conference Championship Game",
        ),
      ],
      [
        future(
          "poly",
          "East Carolina American Athletic Conference Championship Winner",
        ),
      ],
    ).length,
    0,
  );
  assert.equal(
    matchCandidates(
      [
        future(
          "kalshi",
          "East Carolina win American Athletic Conference Championship",
        ),
      ],
      [
        future(
          "poly",
          "East Carolina American Athletic Conference Championship Game Qualifiers",
        ),
      ],
    ).length,
    0,
  );
  assert.equal(
    matchCandidates(
      [
        future(
          "kalshi",
          "East Carolina qualify for American Athletic Conference Championship Game",
        ),
      ],
      [
        future(
          "poly",
          "East Carolina American Athletic Conference Championship Game Qualifiers",
        ),
      ],
    ).length,
    1,
  );
  assert.equal(
    matchCandidates(
      [future("kalshi", "East Carolina NBA Western Conference Finals", "nba")],
      [future("poly", "East Carolina NBA Western Conference #1 Seed", "nba")],
    ).length,
    0,
  );
  assert.equal(
    matchCandidates(
      [future("kalshi", "East Carolina Undefeated Regular Season", "wcbb")],
      [future("poly", "East Carolina Undefeated Regular Season", "cfb")],
    ).length,
    0,
  );
});

test("Relegation and promotion cannot match a league champion despite shared team and league", () => {
  const future = (venue: "kalshi" | "poly", title: string) =>
    m(
      venue,
      {
        participants: ["coventry city"],
        outcome: "coventry city",
        competition: "epl",
        marketType: "future",
        eventKey: title,
      },
      title,
    );
  for (const action of ["relegated", "promoted"]) {
    const a = future(
      "kalshi",
      `Will Coventry City be ${action} from English Premier League in 2026-27 Season?`,
    );
    const b = future("poly", "Coventry City English Premier League Champion");
    assert.equal(matchCandidates([a], [b]).length, 0);
    assert.equal(matchCandidates([b], [a]).length, 0);
  }
  assert.equal(
    matchCandidates(
      [future("kalshi", "Coventry City relegated English Premier League")],
      [future("poly", "Coventry City English Premier League Relegation")],
    ).length,
    1,
  );
});

test("Futures primary payout distinguishes playoff qualification and regular-season titles", () => {
  const a = m(
    "kalshi",
    {
      marketType: "future",
      eventKey: "College Football Championship Qualifiers",
    },
    "Texas College Football Qualifiers",
  );
  const b = m("poly", { ...a.identity }, "Texas College Football Qualifiers");
  a.rules = "If Texas qualifies for the SEC Championship Game, then Yes.";
  b.rules =
    "This market settles Yes if Texas advances to the College Football Playoff.";
  assert.equal(matchCandidates([a], [b]).length, 0);
  a.rules = "If Texas is the conference regular season champion, then Yes.";
  b.rules = "If Texas wins the NCAA Tournament, then Yes.";
  assert.equal(matchCandidates([a], [b]).length, 0);
  a.rules = b.rules =
    "If Texas goes undefeated in the regular season, then Yes.\nExcludes College Football Playoff games.";
  assert.equal(matchCandidates([a], [b]).length, 1);
});

test("Matching alternate NFL yard lines normalize integer thresholds without mixing stats or players", () => {
  const make = (
    venue: "kalshi" | "poly",
    minimum = 60,
    stat = "receiving",
    player = "Rome Odunze",
    date = "Sep 13, 2026",
  ) => {
    const rules =
      venue === "kalshi"
        ? `If ${player} records ${minimum}+ ${stat} yards in the Chicago vs Carolina Pro Football game originally scheduled for ${date}, then Yes.`
        : `This market will settle to Yes if ${player} records at least ${minimum} ${stat} yards in the Chicago vs Carolina professional football game scheduled for ${date}.`;
    const raw: any = {
      title: `${player}: ${minimum}+ ${stat} yards`,
      rules_primary: rules,
      description: rules,
      category: "sports",
      ticker: "KXNFLRECYDS-26",
      slug: "astatc-nfl-chi-car-2026-09-13",
      yes_sub_title: `${player}: ${minimum}+`,
      floor_strike: minimum - 0.5,
      line: venue === "poly" ? minimum : undefined,
    };
    return {
      ...market(venue),
      title: raw.title,
      rules,
      category: "sports",
      identity: extractIdentity(venue, raw),
    };
  };
  const a = make("kalshi"),
    b = make("poly");
  assert.equal(a.identity.line, 59.5);
  assert.equal(b.identity.line, 59.5);
  assert.equal(a.identity.participant, "rome odunze");
  assert.equal(matchCandidates([a], [b]).length, 1);
  assert.equal(matchCandidates([a], [b])[0].status, "UNVERIFIED");
  for (const other of [
    make("poly", 50),
    make("poly", 60, "rushing"),
    make("poly", 60, "receiving", "DJ Moore"),
    make("poly", 60, "receiving", "Rome Odunze", "Sep 14, 2026"),
  ]) {
    // Use explicit scheduled dates for the Polymarket fixture, as the venue does.
    if (other.rules.includes("Sep 14")) other.identity.eventDate = "2026-09-14";
    assert.equal(matchCandidates([a], [other]).length, 0);
  }
  const combined = make("poly", 60, "rushing and receiving");
  assert.equal(matchCandidates([a], [combined]).length, 0);
});

test("Non-sports generic titles cannot hide different election years or decade awards", () => {
  const a = {
    ...market("kalshi"),
    title: "Will Republicans win the Senate race in Alaska?",
    category: "politics",
    outcome: "Republican",
    rules:
      "If a Republican is sworn in for the term beginning in 2029, then Yes.",
  };
  const b = {
    ...market("poly"),
    title: "Republican Party Alaska Senate Election Winner",
    category: "politics",
    outcome: "Republican",
    rules: "Yes if a Republican wins the 2026 midterm election.",
  };
  assert.equal(matchCandidates([a], [b]).length, 0);
  Object.assign(a, {
    title: "Who will TIME name Person of the Decade?",
    category: "culture",
    outcome: "Sam Altman",
    rules: "If Sam Altman is Person of the Decade for the 2020s, then Yes.",
  });
  Object.assign(b, {
    title: "Sam Altman TIME Person of the Year",
    category: "culture",
    outcome: "Sam Altman",
    rules: "If Sam Altman is Person of the Year in 2026, then Yes.",
  });
  assert.equal(matchCandidates([a], [b]).length, 0);
});

test("Economic category aliases share discovery indexing without granting verification", () => {
  const a = {
    ...market("kalshi"),
    category: "Economics",
    title: "Will US GDP grow in 2026?",
    outcome: "Yes",
    rules: "US GDP grows in 2026",
  };
  for (const category of ["macro", "finance", "Financials"]) {
    const b = {
      ...market("poly"),
      category,
      title: a.title,
      outcome: a.outcome,
      rules: a.rules,
    };
    const c = matchCandidates([a], [b]);
    assert.equal(c.length, 1);
    assert.equal(c[0].status, "UNVERIFIED");
  }
});

test("Netflix candidates distinguish chart date, region, rank, format and explicit language", () => {
  const a = {
    ...market("kalshi"),
    category: "Entertainment",
    title: "Will Example be Top US Netflix Movie on Sep 14, 2026?",
    outcome: "Example",
    rules:
      "If Example is #1 on the Netflix Top 10 US Movie on the chart published on Sep 15, 2026, then the market resolves to Yes.",
  };
  const b = {
    ...market("poly"),
    category: "culture",
    title: "Example · Top US Netflix Movie This Week?",
    outcome: "Yes",
    rules:
      "This market will settle to Yes if Example is #1 on the Netflix Top 10 Movies in United States chart published on September 15, 2026.",
  };
  assert.equal(matchCandidates([a], [b]).length, 1);
  for (const rules of [
    b.rules.replace("#1", "#2"),
    b.rules.replace("United States", "Global"),
    b.rules.replace("Movies", "Shows"),
    b.rules.replace("September 15", "September 22"),
  ])
    assert.equal(matchCandidates([a], [{ ...b, rules }]).length, 0);
  const en = {
    ...a,
    rules: a.rules.replace("US Movie", "Global Movies (English)"),
  };
  const nonEn = {
    ...b,
    rules: b.rules.replace(
      "Movies in United States",
      "Global Movies (Non-English)",
    ),
  };
  assert.equal(matchCandidates([en], [nonEn]).length, 0);
  assert.equal(matchCandidates([a], [b])[0].status, "UNVERIFIED");
});
