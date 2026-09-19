type Obj = Record<string, any>;
// Some PM-US total contracts omit teams. Resolve the parent event, then verify
// membership and schedule before using its team identities. Slugs alone prove nothing.
export class PolyEventContexts {
  private cache = new Map<string, { at: number; data: Promise<Obj> }>();
  private request: (url: string) => Promise<Obj>;
  private now: () => number;
  constructor(request: (url: string) => Promise<Obj>, now = Date.now) { this.request = request; this.now = now; }
  async enrich(m: Obj): Promise<Obj> {
    if(m.category==='sports'&&m.sportsMarketType==='tennis_match_winner'&&/^aec-atp-/.test(m.slug??''))return this.tennis(m);
    if (m.sportsMarketType !== 'football_team_full_game_total' || m.category !== 'sports') return m;
    const parts = String(m.slug).match(/^tsc-(cfb)-([a-z0-9]+)-([a-z0-9]+)-(20\d\d-\d\d-\d\d)-total-\d+pt5$/);
    if (!parts) return m;
    const eventSlug = parts.slice(1, 5).join('-');
    const url = 'https://gateway.polymarket.us/v1/events/slug/' + eventSlug;
    let cached = this.cache.get(eventSlug);
    if (!cached || this.now() - cached.at >= 60000) {
      if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
      cached = { at: this.now(), data: this.request(url).then(d => {
        const e = d.event;
        if (!e || e.slug !== eventSlug || !Array.isArray(e.markets)) throw Error('Event context unavailable');
        return { slug: e.slug, startTime: e.startTime, teams: e.teams,
          members: new Map(e.markets.map((x: Obj) => [x.slug, { id: x.id, line: x.line, gameStartTime: x.gameStartTime }])) };
      }) };
      this.cache.set(eventSlug, cached);
    }
    try {
      const e = await cached.data, member = e.members.get(m.slug), teams = e.teams;
      if (!member || String(member.id) !== String(m.id) || member.line !== m.line || member.gameStartTime !== m.gameStartTime || e.startTime !== m.gameStartTime || !Array.isArray(teams) || teams.length !== 2) return m;
      if (teams.some(t => t.league !== 'cfb' || !t.id || !t.safeName || !t.name) || teams[0].id === teams[1].id) return m;
      if (JSON.stringify(teams.map(t => t.abbreviation).sort()) !== JSON.stringify([parts[2], parts[3]].sort())) return m;
      return { ...m, eventTeams: teams.map(t => ({ id: t.id, league: t.league, safeName: t.safeName, name: t.name, alias: t.alias, abbreviation: t.abbreviation, displayAbbreviation: t.displayAbbreviation })),
        eventContext: { source: url, eventSlug, marketId: String(m.id) } };
    } catch { return m; } // Missing context remains unapproved; never invent teams.
  }
  private async tennis(m:Obj):Promise<Obj>{
    const match=String(m.slug).match(/^aec-(atp-[a-z0-9]+-[a-z0-9]+-(20\d\d)-\d\d-\d\d)$/);
    if(!match)return m;
    const eventSlug=match[1],url='https://gateway.polymarket.us/v1/events/slug/'+eventSlug;
    try{
      let cached=this.cache.get(eventSlug);
      if(!cached||this.now()-cached.at>=60000){
        if(this.cache.size>=128)this.cache.delete(this.cache.keys().next().value!);
        cached={at:this.now(),data:this.request(url).then(d=>d.event)};this.cache.set(eventSlug,cached);
      }
      const e=await cached.data,member=e?.markets?.find((x:Obj)=>x.slug===m.slug),state=e?.eventState?.tennisState;
      if(e?.slug!==eventSlug||!member||String(member.id)!==String(m.id)||member.gameStartTime!==m.gameStartTime||e.startTime!==m.gameStartTime||e.seriesSlug!=='atp-'+match[2]||!String(m.gameStartTime).startsWith(match[2]+'-'))return m;
      if(e.eventState?.type!=='tennis'||String(e.eventState.eventId)!==String(e.id)||!/^Challenger [A-Za-z0-9 .'-]+(?: \([A-Za-z0-9 .'-]+\))?$/.test(state?.tournamentName??'')||!/^Round of (128|64|32|16)$/i.test(state?.round??''))return m;
      const teams=e.teams,sides=m.marketSides?.map((x:Obj)=>x.team);
      if(!Array.isArray(teams)||teams.length!==2||!sides||sides.length!==2||teams.some((t:Obj)=>t.league!=='atp'||!t.id)||new Set(teams.map((t:Obj)=>t.id)).size!==2||JSON.stringify(teams.map((t:Obj)=>String(t.id)).sort())!==JSON.stringify(sides.map((t:Obj)=>String(t?.id)).sort()))return m;
      return {...m,tennisContext:{tournament:state.tournamentName,round:state.round,year:match[2],source:url,eventSlug,marketId:String(m.id)}};
    }catch{return m;}
  }

}
