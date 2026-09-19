// Candidate identity is deliberately separate from settlement-equivalence proof.
// These public metadata/text hints may block or rank pairs, never verify them.
const nflGameDateFormatter = new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"});
export type Identity = {
  sports: boolean;
  season?: string;
  sport?: string;
  general?: {
    person?: string;
    event?: string;
    company?: string;
    ticker?: string;
    asset?: string;
    jurisdiction?: string;
    indicator?: string;
    window?: string;
  };

  competition?: string;
  eventAt?: string;
  eventDate?: string;
  eventKey?: string;
  tennisContext?: {tournament:string;round:string;year:string;source:string};
  eventContext?: { source: string; eventSlug: string; marketId: string };
  participants: string[];
  home?: string;
  away?: string;
  participant?: string;
  marketType?: string;
  line?: number;
  propType?: string;
  period?: string;
  outcome?: string;
  entities: string[];
  numbers: string[];
  units?: string;
  location?: string;
  aliases?: {
    name: string;
    aliases: string[];
    venue?: string;
    venueId?: string;
  }[];
};
export const normalizeText = (x: unknown) =>
  String(x ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function categoryName(s: string) {
  const n = normalizeText(s);
  return (
    (
      {
        entertainment: "culture",
        elections: "politics",
        sport: "sports",
        financials: "economics",
        finance: "economics",
        macro: "economics",
      } as Record<string, string>
    )[n] ?? n
  );
}
const months = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
export function scheduledTime(text: string): string | undefined {
  const m = text.match(
    /(?:scheduled (?:for |on )?)([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})(?:\s+at\s+(\d{1,2}):(\d\d)\s*(AM|PM)\s*(EDT|EST|CDT|CST|PDT|PST|UTC|GMT))?/i,
  );
  if (!m) return undefined;
  const month = months.indexOf(m[1].slice(0, 3).toLowerCase());
  if (month < 0) return undefined;
  const date = `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  if (!m[4]) return date;
  const hour = (Number(m[4]) % 12) + (m[6].toUpperCase() === "PM" ? 12 : 0);
  const offset = (
    {
      EDT: 4,
      EST: 5,
      CDT: 5,
      CST: 6,
      PDT: 7,
      PST: 8,
      UTC: 0,
      GMT: 0,
    } as Record<string, number>
  )[m[7].toUpperCase()];
  return new Date(
    Date.UTC(Number(m[3]), month, Number(m[2]), hour + offset, Number(m[5])),
  ).toISOString();
}
function type(text: string) {
  if (/first inning run|\bKX[A-Z]*RFI\b/i.test(text)) return "prop";
  if (/spread|handicap/i.test(text)) return "spread";
  if (/total|over.?under/i.test(text)) return "total";
  if (
    /prop|passing|rushing|receiving|home runs?|touchdowns?|strikeouts/i.test(
      text,
    )
  )
    return "prop";
  if (/future|champion|pennant|mvp|award|season/i.test(text)) return "future";
  if (/moneyline|winner|wins?\b|game|match/i.test(text)) return "winner";
  return undefined;
}
// Explicit integer-yard payout clauses only; alternative thresholds stay separate.
// This extracts candidate identity, never approval of cancellation/stat-correction rules.
export function footballYardProp(rules: string) {
  const m = rules.match(
    /\bif (.+?) records (?:(at least) )?(\d+)(\+)? (rushing and receiving|passing|rushing|receiving) yards(?: combined)? in the (.+?) (?:vs\.?|versus) (.+?) (?:pro football|professional football) game (?:originally )?scheduled for/i,
  );
  if (!m || (!m[2] && !m[4])) return null;
  const minimum = Number(m[3]);
  if (!Number.isSafeInteger(minimum) || minimum < 1 || minimum > 1000)
    return null;
  return {
    player: normalizeText(m[1]),
    line: minimum - 0.5,
    statistic: normalizeText(m[5] + " yards"),
    participants: [normalizeText(m[6]), normalizeText(m[7])],
  };
}
export function identity(
  venue: "kalshi" | "poly",
  m: Record<string, any>,
  series?: Record<string, any>,
): Identity {
  const text = [m.title, m.question, m.yes_sub_title].filter(Boolean).join(" "),
    rules = String(m.rules_primary ?? m.description ?? "");
  const sports =
    categoryName(String(m.category ?? series?.category ?? "")) === "sports";
  const sides = m.marketSides ?? [],
    long = sides.find((s: any) => s.long === true);
  const teams = sides.map((s: any) => s.team ?? s.player).filter(Boolean);
  if (!teams.length && Array.isArray(m.eventTeams)) teams.push(...m.eventTeams);
  if (!teams.length && m.player && typeof m.player === "object")
    teams.push(m.player);
  const teamName = (t: any) => t.safeName || t.name;
  let competition = normalizeText(
    m.league ??
      teams[0]?.league ??
      (venue === "poly"
        ? String(m.slug).split("-")[1]
        : String(m.ticker).match(
            /^KX(NFL|MLB|NBA|NHL|WNBA|ATP|WTA|NCAAF|NCAAMB|NCAAWB|EPL|MLS|UFC|KBO|NPB)/,
          )?.[1]),
  );
  competition =
    ({ ncaaf: "cfb", ncaamb: "cbb", ncaawb: "wcbb" } as Record<string, string>)[
      competition
    ] ?? competition;
  const rawType =
    venue === "poly"
      ? [m.sportsMarketTypeV2, m.sportsMarketType, m.marketType]
          .filter(Boolean)
          .join(" ")
      : String(m.ticker ?? "").split("-")[0];
  const marketType = type(rawType + " " + text + " " + (series?.title ?? ""));
  const scheduled = venue === "kalshi" ? scheduledTime(rules) : m.gameStartTime;
  const slugDate = String(m.slug ?? "").match(/\b(20\d\d-\d\d-\d\d)\b/)?.[1];
  let eventDate = scheduled?.slice(0, 10) ?? slugDate;
  const eventAt =
    scheduled?.includes("T") && Number.isFinite(Date.parse(scheduled))
      ? new Date(scheduled).toISOString()
      : undefined;
  // NFL evening kickoff may be the next UTC day. Use the written game date
  // only when it agrees with the timestamp's Eastern calendar date. Preserve
  // eventAt for timestamp comparisons; a contradictory clause is not repaired.
  const supportedNflGameDate = footballYardProp(rules) || (
    m.sportsMarketType === "football_team_full_game_winner" &&
    /^This market will settle to the winner of .+ professional football game scheduled for /i.test(rules)
  );
  if (venue === "poly" && competition === "nfl" && eventAt && supportedNflGameDate) {
    const written = scheduledTime(rules);
    const eastern = nflGameDateFormatter.format(new Date(eventAt));
    if (written && written === eastern) eventDate = written;
  }
  // League labels delimit team names in these published full-game templates.
  // Bind the delimiter to the series; never strip a league-like team suffix globally.
  const regionalBaseball = venue === 'kalshi' && (
    (competition === 'kbo' && String(m.ticker).startsWith('KXKBOGAME-')) ||
    (competition === 'npb' && String(m.ticker).startsWith('KXNPBGAME-'))
  ) ? rules.match(/^If .+? wins the (.+?) vs (.+?) (Korea KBO|Japan NPB) game originally scheduled for /) : null;
  const regionalTeams = regionalBaseball && regionalBaseball[3] === (competition === 'kbo' ? 'Korea KBO' : 'Japan NPB') ? regionalBaseball : null;
  const versus = regionalTeams ??
    rules.match(
      /(?:wins? the |following market refers to the )(.+?)\s+(?:vs\.?|versus|at)\s+(.+?)\s+(?:professional|college|men.s|women.s|baseball|football|basketball|hockey|tennis|game|match)/i,
    ) ??
    String(m.question ?? text).match(
      /^(.+?)\s+(?:vs\.?|versus|@)\s+(.+?)(?:\s*[·:(]|$)/i,
    );
  let participants = [
    ...new Set<string>(teams.map((t: any) => normalizeText(teamName(t)))),
  ];
  if (participants.length < 2 && versus)
    participants = [normalizeText(versus[1]), normalizeText(versus[2])];
  const chosen = normalizeText(
    (long?.team ? teamName(long.team) : undefined) ??
      (venue === "kalshi" ? m.yes_sub_title : long?.description),
  );
  const threshold = text.match(
    /(?:above|below|over|under|at least|exceed(?:s)?)\s*\$?(-?\d+(?:\.\d+)?)/i,
  );
  const line =
    typeof m.line === "number"
      ? m.line
      : typeof m.floor_strike === "number"
        ? m.floor_strike
        : threshold
          ? Number(threshold[1])
          : undefined;
  const totalRule = venue === 'kalshi' && String(m.ticker).startsWith('KXNCAAFTOTAL-')
    ? rules.match(/^If the teams collectively score more than (\d+\.5) points in the (.+?) vs (.+?) college football game originally scheduled for /i)
    : venue === 'poly' && m.sportsMarketType === 'football_team_full_game_total'
      ? rules.match(/^This market will settle to Yes if .+? and .+? combine for over (\d+\.5) points in the (.+?) vs (.+?) College Football game scheduled for /i)
      : null;
  const gameTotal = totalRule && line === Number(totalRule[1]);
  if (gameTotal && participants.length < 2)
    participants = [normalizeText(totalRule[2]), normalizeText(totalRule[3])];
  const yardProp =
    sports && marketType === "prop" ? footballYardProp(rules) : null;
  // Do not accept contradictory structured thresholds.
  const compatibleYardProp =
    yardProp &&
    (line === undefined ||
      line === yardProp.line ||
      (venue === "poly" && line === yardProp.line + 0.5))
      ? yardProp
      : null;
  if (compatibleYardProp) participants = compatibleYardProp.participants;
  const periodMatch = (text + " " + rules.slice(0, 250)).match(
    /\b(first half|second half|1st half|2nd half|first quarter|first inning|first set|set \d|game \d|period \d)\b/i,
  );
  const segment = (rawType + " " + (m.slug ?? "") + " " + text).match(
    /(?:inning[_ ]?(\d+)|-(i|q|s)(\d+)(?:-|$)|-([12])h(?:-|$)|\b(\d+)(?:st|nd|rd|th) inning\b)/i,
  );
  const segmentPeriod = segment
    ? segment[1] || segment[6]
      ? "inning " + (segment[1] ?? segment[6])
      : segment[4]
        ? segment[4] === "1"
          ? "first half"
          : "second half"
        : ({ i: "inning", q: "quarter", s: "set" } as Record<string, string>)[
            segment[2]
          ] +
          " " +
          segment[3]
    : undefined;
  return {
    sports,
    tennisContext: tennisMatchContext(venue,m,rules),
    ...(gameTotal && m.eventContext ? { eventContext: m.eventContext } : {}),
    season: m.season ? String(m.season) : undefined,
    sport:
      normalizeText(m.sport) ||
      (
        {
          nfl: "football",
          cfb: "football",
          nba: "basketball",
          cbb: "basketball",
          wcbb: "basketball",
          wnba: "basketball",
          mlb: "baseball",
          kbo: "baseball",
          npb: "baseball",
          nhl: "hockey",
          atp: "tennis",
          wta: "tennis",
          ufc: "mma",
        } as Record<string, string>
      )[competition],
    general: sports
      ? undefined
      : {
          person:
            typeof m.person === "string" ? normalizeText(m.person) : undefined,
          event:
            typeof m.eventName === "string"
              ? normalizeText(m.eventName)
              : undefined,
          company:
            typeof m.company === "string"
              ? normalizeText(m.company)
              : undefined,
          ticker:
            typeof m.stockTicker === "string"
              ? m.stockTicker.toUpperCase()
              : undefined,
          asset:
            typeof m.asset === "string" ? normalizeText(m.asset) : undefined,
          jurisdiction:
            typeof m.jurisdiction === "string"
              ? normalizeText(m.jurisdiction)
              : undefined,
          indicator:
            typeof m.indicator === "string"
              ? normalizeText(m.indicator)
              : undefined,
          window:
            typeof m.observationWindow === "string"
              ? m.observationWindow
              : undefined,
        },
    competition: competition || undefined,
    eventAt,
    eventDate,
    participants,
    home:
      normalizeText(
        participants.length > 1
          ? teamName(teams.find((t: any) => t.ordering === "home") ?? {})
          : undefined,
      ) || undefined,
    away:
      normalizeText(
        participants.length > 1
          ? teamName(teams.find((t: any) => t.ordering === "away") ?? {})
          : undefined,
      ) || undefined,
    participant:
      compatibleYardProp?.player ??
      (participants.length === 1 ? participants[0] : undefined),
    marketType,
    line: compatibleYardProp?.line ?? line,
    period:
      segmentPeriod ??
      (periodMatch
        ? normalizeText(periodMatch[1])
            .replace(/1st/, "first")
            .replace(/2nd/, "second")
            .replace(/first inning/, "inning 1")
        : sports
          ? "full event"
          : undefined),
    propType:
      compatibleYardProp?.statistic ??
      (marketType === "prop" ? normalizeText(rawType) : undefined),
    outcome:
      (gameTotal ? 'over' : undefined) ?? compatibleYardProp?.player ??
      (chosen && !["yes", "no", "unknown long"].includes(chosen)
        ? chosen
        : undefined),
    entities: [],
    numbers: [...text.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((x) => x[0]),
    units: gameTotal ? 'points' : text
      .match(/\b(percent|degrees|dollars|points|runs|yards|goals)\b/i)?.[1]
      .toLowerCase(),
    aliases: teams.map((t: any) => ({
      name: normalizeText(teamName(t)),
      venue,
      venueId:
        t.id || t.teamId || t.playerId
          ? String(t.id ?? t.teamId ?? t.playerId)
          : undefined,
      aliases: [
        t.name,
        t.alias,
        t.safeName,
        t.abbreviation,
        t.displayAbbreviation,
      ]
        .filter(Boolean)
        .map(normalizeText),
    })),
    eventKey:
      marketType === "future"
        ? normalizeText(m.question ?? series?.title ?? text)
        : undefined,
  };
}

const jurisdictions =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Sweden|Spanish|Spain|Kenya|Kenyan|Israel|India|France|United Kingdom|Germany|Canada|Australia|Japan|China|Brazil"
    .split("|")
    .sort((a, b) => b.length - a.length);
export function generalHints(m: {
  title: string;
  outcome: string;
  category: string;
}) {
  const text = normalizeText(m.title)
    .replace(/ethereum/g, "eth")
    .replace(/bitcoin/g, "btc")
    .replace(/\beliminat(?:e|ed|ing)\b/g, "elimination")
    .replace(/\bqualifiers?\b/g, "qualify")
    .replace(/\bplayoffs?\b/g, "playoffs")
    .replace(/\brelegat(?:e|ed|ion)\b/g, "relegation")
    .replace(/\bpromot(?:e|ed|ion)\b/g, "promotion");
  let location = jurisdictions.find((j) =>
    (" " + text + " ").includes(" " + normalizeText(j) + " "),
  );
  const districtCode = m.title.match(/\b([A-Z]{2})[- ](\d{1,2}|AL)\b/);
  const states =
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
      " ",
    );
  const stateNames =
    "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split(
      "|",
    );
  if (districtCode && states.includes(districtCode[1]))
    location = stateNames[states.indexOf(districtCode[1])];
  let subject = normalizeText(m.outcome);
  if (["yes", "no", "unknown long", "unknown short", ""].includes(subject)) {
    const named = m.title.includes("·")
      ? m.title.split("·")[0]
      : m.title.match(
          /^Will (.+?) (?:win|finish|have|be|receive|reach|announce)\b/i,
        )?.[1];
    subject = normalizeText(named ?? "");
  }
  if (
    /^(the |who |what |when |over |under |at least |more than )/.test(
      subject,
    ) ||
    /\d/.test(subject) ||
    subject.split(" ").length > 8
  )
    subject = "";
  const placement =
    m.title.match(/#(\d+)\b/)?.[1] ??
    (/\btop .*netflix/.test(text) ? "1" : undefined) ??
    text.match(/\btop (\d+)\b/)?.[1] ??
    text.match(/\b(\d+)(?:st|nd|rd|th)? place\b/)?.[1] ??
    (/\b(?:runner up|second place)\b/.test(text) ? "2" : undefined) ??
    (/\bthird place\b/.test(text) ? "3" : undefined);
  const concepts = [
    "governor",
    "senate",
    "house",
    "president",
    "attorney general",
    "margin of victory",
    "seats",
    "price",
    "album equivalent units",
    "daytime",
    "supporting",
    "lead",
    "comedy",
    "drama",
    "actor",
    "actress",
    "director",
    "adapted screenplay",
    "original screenplay",
    "best picture",
    "makeup",
    "hairstyling",
    "animated",
    "documentary",
    "costume",
    "visual effects",
    "production design",
    "sound",
    "nominees",
    "nominations",
    "tour",
    "announce",
    "state house",
    "state senate",
    "qualify",
    "undefeated",
    "regular season champion",
    "person of the decade",
    "relegation",
    "promotion",
    "playoffs",
    "finals",
    "quarterfinal",
    "semifinal",
    "final qualifiers",
    "best regular",
    "worst regular",
    "elimination",
    "endorse",
    "nominee",
    "perform",
    "seed",
    "sacks",
    "touchdowns",
    "leader",
    "writing",
    "directing",
    "appear",
    "candidate list",
    "google",
    "spotify",
    "netflix",
    "billboard",
    "declare",
    "largest",
    "smallest",
  ].filter((c) => text.includes(c));
  const numbers = [...text.matchAll(/\b\d+(?: \d+)?\b/g)].map((m) => m[0]);
  const years = [...text.matchAll(/\b20\d\d\b/g)].map((m) => m[0]);
  const assets = ["btc", "eth"].filter((a) => text.includes(a));
  const district = districtCode
    ? districtCode[1] +
      ":" +
      (districtCode[2] === "AL" ? "at-large" : String(Number(districtCode[2])))
    : text.match(/\b(\d+)(?:st|nd|rd|th)? district\b/)?.[1];
  return {
    subject,
    placement,
    location: location ? normalizeText(location) : undefined,
    concepts,
    numbers,
    years,
    assets,
    district,
  };
}

// Ranking identity comes from the payout clause, not the administrative close date.
// Missing fields remain unknown; these hints can reject candidates, never verify them.
export function netflixChart(rules: string) {
  const clause = rules.split(/\n/)[0];
  if (!/netflix/i.test(clause)) return null;
  const rank = clause.match(/#(\d+)\b/);
  const date = clause.match(
    /chart published on ([A-Za-z]+) (\d{1,2}),? (20\d{2})/i,
  );
  const month = date ? months.indexOf(date[1].slice(0, 3).toLowerCase()) : -1;
  const descriptor = clause
    .split(/netflix/i)
    .slice(1)
    .join("netflix")
    .split(/chart/i)[0];
  const region = /\b(?:US|United States)\b/i.test(descriptor)
    ? "us"
    : /\bGlobal\b/i.test(descriptor)
      ? "global"
      : undefined;
  const format = /\bMovies?\b/i.test(descriptor)
    ? "movie"
    : /\b(?:Shows?|TV)\b/i.test(descriptor)
      ? "show"
      : undefined;
  const language = /non[- ]english/i.test(descriptor)
    ? "non-english"
    : /\benglish\b/i.test(descriptor)
      ? "english"
      : undefined;
  return {
    rank: rank ? Number(rank[1]) : undefined,
    region,
    format,
    language,
    published:
      date && month >= 0
        ? `${date[3]}-${String(month + 1).padStart(2, "0")}-${date[2].padStart(2, "0")}`
        : undefined,
  };
}

// A shared person's name is insufficient when wealth estimates use different publishers.
export function netWorthSource(rules: string) {
  const primary = rules.split(/\n/)[0];
  if (!/net[ -]worth/i.test(primary)) return undefined;
  const sources = [
    ["forbes", /\bForbes\b/i],
    ["bloomberg", /\bBloomberg\b/i],
  ] as const;
  const found = sources.filter(([, pattern]) => pattern.test(primary));
  return found.length === 1 ? found[0][0] : undefined;
}

// Candidate exclusion only: election year is not the announcement deadline.
// Equal calendar boundaries do not prove equivalent time zones or settlement rules.
export function announcementDeadline(rules: string): string | undefined {
  const primary = rules.split(/\n/)[0];
  if (!/announc/i.test(primary) || !/presiden/i.test(primary)) return undefined;
  const match = primary.match(
    /\b(before|by|on or before)\s+(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  );
  if (!match) return undefined;
  const month = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].indexOf(match[2].slice(0, 3).toLowerCase());
  const date = new Date(Date.UTC(Number(match[4]), month, Number(match[3])));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== Number(match[3]))
    return undefined;
  if (match[1].toLowerCase() === "before")
    date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Explicit office-service exceptions only. Unknown or contradictory text is not proof.
export function interimService(
  rules: string,
): "included" | "excluded" | undefined {
  const clauses =
    rules.match(
      /(?:Acting or interim|Interim or acting)(?: service| [A-Za-z ]{1,60})? (?:counts|will count|will qualify|will not qualify|does not count|do not count)\b/gi,
    ) ?? [];
  const values = new Set(
    clauses.map((c) =>
      /not/.test(c.toLowerCase())
        ? ("excluded" as const)
        : ("included" as const),
    ),
  );
  return values.size === 1 ? [...values][0] : undefined;
}

// Popular votes, election seat control, and loss of current control are distinct
// payout predicates. These hints exclude conflicts; they never approve a match.
export function chamberControlEvent(
  rules: string,
): "loss-during-term" | "election-result" | "house-popular-vote" | undefined {
  const primary = rules.split(/\n/)[0];
  if (/most (?:valid )?votes for (?:U\.?S\.?|United States) Representatives?/i.test(primary))
    return "house-popular-vote";
  if (!/House of Representatives|Senate/i.test(primary)) return undefined;
  if (/loses? (?:majority )?control/i.test(primary) && /before/i.test(primary))
    return "loss-during-term";
  if (/wins? control/i.test(primary) && /election/i.test(primary))
    return "election-result";
  return undefined;
}

// Explicit primary payout predicates only. These exclusions do not establish
// settlement equivalence when a clause is missing or uses an unknown template.
export function electionStage(rules: string): "primary" | "presidential-election" | undefined {
  const primary = rules.split(/\n/)[0];
  if (/\bwins? the primary to select\b/i.test(primary)) return "primary";
  if (/\bwins? the \d{4} [^.\n]*presidential election\b/i.test(primary)) return "presidential-election";
  return undefined;
}
export function meetingPredicate(rules: string) {
  const primary = rules.split(/\n/)[0];
  if (!/\bmeets?\b/i.test(primary)) return {};
  const calls = /\bmeets? \(including phone calls\)/i.test(primary);
  const inPerson = /\bmeets? in person\b/i.test(primary);
  const mode = calls ? "calls-included" : inPerson ? "in-person" : undefined;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthIndex = (name: string) => /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i.test(name) ? months.indexOf(name.toLowerCase().slice(0,3)) : -1;
  const monthly = primary.match(/\bin ([A-Za-z]+) (20\d{2})(?=,|\.|$)/i);
  const issuance = primary.match(/\bbetween Contract Issuance and ([A-Za-z]+) (\d{1,2}), (20\d{2}), 11:59 PM ET/i);
  let window: string | undefined;
  if (monthly) {
    const month = monthIndex(monthly[1]);
    if (month >= 0) window = `month:${monthly[2]}-${month+1}`;
  } else if (issuance) {
    const month = monthIndex(issuance[1]), day = Number(issuance[2]), year = Number(issuance[3]);
    if (month >= 0 && day >= 1 && day <= new Date(Date.UTC(year, month+1, 0)).getUTCDate())
      window = `issuance:${year}-${month+1}-${day}:23:59ET`;
  }
  return {mode, window};
}


function tennisMatchContext(venue:string,m:Record<string,any>,rules:string):Identity['tennisContext']{
 if(venue==='kalshi'&&String(m.ticker).startsWith('KXATPCHALLENGERMATCH-')){
  const r=rules.match(/^If .+ wins the .+ vs .+ professional tennis match in the (20\d\d) ATP (Challenger [A-Za-z0-9 .'-]+?(?: \([A-Za-z0-9 .'-]+\))?) (Round Of (?:128|64|32|16)) after a ball has been played, then the market resolves to Yes\./i);
  if(r)return {year:r[1],tournament:normalizeText(r[2]),round:normalizeText(r[3]),source:'kalshi-primary-rules'};
 }
 const c=m.tennisContext;
 if(venue==='poly'&&c&&c.source==='https://gateway.polymarket.us/v1/events/slug/'+c.eventSlug&&'aec-'+c.eventSlug===m.slug&&c.marketId===String(m.id))return {year:c.year,tournament:normalizeText(c.tournament),round:normalizeText(c.round),source:c.source};
 return undefined;
}
