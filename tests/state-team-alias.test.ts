import {test} from 'node:test';import assert from 'node:assert/strict';
import {catalogEntities} from '../lib/research/entities.ts';
const teamIdentity=(name:string):any=>({sports:true,competition:'cfb',participants:[name],aliases:[{name,venue:'poly',venueId:name,aliases:[]}]});
test('State abbreviations apply across authoritative team identities, within league scope',()=>{
 const names=['Weber State','Central Connecticut State','Kent State','Michigan State'];
 const r=catalogEntities(names.map(teamIdentity));
 for(const name of names){assert.ok(r.resolve(name,'cfb'));assert.equal(r.resolve(name.replace(/State$/,'St'),'cfb'),r.resolve(name,'cfb'));assert.equal(r.resolve(name.replace(/State$/,'St'),'nfl'),undefined);}
});
test('State suffix aliases do not expand Saint prefixes or override ambiguous aliases',()=>{
 const r=catalogEntities(['Weber State','Saint Francis'].map(teamIdentity));
 assert.equal(r.resolve('State Francis','cfb'),undefined);
 r.add({id:'CFB:OTHER',scope:'cfb',name:'Other team',aliases:['Weber St']});
 assert.equal(r.resolve('Weber St','cfb'),undefined);
 assert.ok(r.resolve('Weber State','cfb'));
});
