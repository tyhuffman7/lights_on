import {test} from 'node:test';import assert from 'node:assert/strict';
import {identity} from '../lib/research/identity.ts';
const raw={category:'sports',slug:'astatc-nfl-den-kc-2026-09-14-recyd-xavwor-gte75',title:'Xavier Worthy 75+ receiving yards',sportsMarketType:'football_player_receiving_yards',gameStartTime:'2026-09-15T00:15:00Z',description:'This market will settle to Yes if Xavier Worthy records at least 75 receiving yards in the Denver Broncos vs Kansas City Chiefs professional football game scheduled for Sep 14, 2026. Overtime is included if played.'};
test('NFL evening yardage uses a corroborated written game date and preserves UTC kickoff',()=>{
 const i=identity('poly',raw);assert.equal(i.eventDate,'2026-09-14');assert.equal(i.eventAt,'2026-09-15T00:15:00.000Z');assert.equal(i.participant,'xavier worthy');
});
test('No arbitrary previous-day shift for contradictory dates, other sports or missing timestamps',()=>{
 assert.equal(identity('poly',{...raw,description:raw.description.replace('Sep 14','Sep 13')}).eventDate,'2026-09-15');
 assert.equal(identity('poly',{...raw,gameStartTime:'2026-09-15T12:15:00Z'}).eventDate,'2026-09-15');
 assert.equal(identity('poly',{...raw,league:'cfb'}).eventDate,'2026-09-15');
 assert.equal(identity('poly',{...raw,slug:'unknown',gameStartTime:undefined}).eventDate,undefined);
});
test('NFL winter kickoff date uses standard time, with no change to afternoon dates',()=>{
 const winter={...raw,slug:'astatc-nfl-den-kc-2026-12-14-recyd-xavwor-gte75',description:raw.description.replace('Sep 14','Dec 14')};
 assert.equal(identity('poly',{...winter,gameStartTime:'2026-12-15T04:30:00Z'}).eventDate,'2026-12-14');
 assert.equal(identity('poly',{...raw,gameStartTime:'2026-09-14T20:15:00Z'}).eventDate,'2026-09-14');
});

test('NFL full-game winner uses corroborated local game date, never slug alone',()=>{
 const winner={...raw,slug:'aec-nfl-den-kc-2026-09-14',sportsMarketType:'football_team_full_game_winner',title:'Who will win Denver Broncos vs Kansas City Chiefs?',description:'This market will settle to the winner of the Denver Broncos vs Kansas City Chiefs professional football game scheduled for Sep 14, 2026. Overtime is included if played.'};
 const i=identity('poly',winner);assert.equal(i.eventDate,'2026-09-14');assert.equal(i.eventAt,'2026-09-15T00:15:00.000Z');
 assert.equal(identity('poly',{...winner,description:winner.description.replace('Sep 14','Sep 13')}).eventDate,'2026-09-15');
 assert.equal(identity('poly',{...winner,description:'Unknown game rules'}).eventDate,'2026-09-15');
 assert.equal(identity('poly',{...winner,league:'cfb'}).eventDate,'2026-09-15');
 assert.equal(identity('poly',{...winner,sportsMarketType:'football_team_first_half_winner'}).eventDate,'2026-09-15');
});
