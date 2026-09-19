import {test} from 'node:test';import assert from 'node:assert/strict';
import {catalogEntities} from '../lib/research/entities.ts';
const identities=['den broncos','kc chiefs'].map((name,i)=>({sports:true,competition:'nfl',participants:[name],aliases:[{name,venue:'poly',venueId:String(i),aliases:i?['kansas city chiefs','chiefs','kc chiefs','kc']:['denver broncos','broncos','den broncos','den']}]}));
test('Published shortened NFL names reuse canonical teams without making full names ambiguous',()=>{
 const r=catalogEntities(identities);
 for(const n of ['denver','denver broncos','den broncos'])assert.equal(r.resolve(n,'nfl'),'NFL:DENVER');
 for(const n of ['kansas city','kansas city chiefs','kc chiefs'])assert.equal(r.resolve(n,'nfl'),'NFL:KANSAS_CITY');
 assert.notEqual(r.resolve('den broncos','nfl'),r.resolve('kc chiefs','nfl'));
 assert.equal(r.resolve('kc chiefs','cfb'),undefined);
});
