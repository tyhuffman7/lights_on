import {test} from 'node:test';import assert from 'node:assert/strict';
import {ResearchStore} from '../lib/research/store.ts';import {MappingRegistry} from '../lib/research/mappings.ts';import {Recorder} from '../lib/research/recorder.ts';import {book,config} from './research-fixture.ts';
test('Paper capture persists quiet books without a taker opportunity, only for selected capture keys',()=>{
 const store=new ResearchStore(':memory:');const recorder=new Recorder(store,new MappingRegistry(store),config,'fixture');
 try{
  const a={...book('kalshi','K'),source:'stream'};recorder.update(a);assert.equal(recorder.storage.persisted,0,'default research retention is unchanged');
  recorder.paperCaptureKeys=new Set(['kalshi:K']);
  recorder.update({...a,receivedMono:a.receivedMono+100,receivedAt:a.receivedAt+100});
  recorder.update({...a,receivedMono:a.receivedMono+200,receivedAt:a.receivedAt+200});
  recorder.update({...a,marketId:'other',receivedMono:a.receivedMono+300});
  assert.equal(recorder.storage.persisted,2,'unchanged levels still retain distinct update timestamps');
  const rows=store.db.prepare('select body from book_updates order by id').all();assert.equal(JSON.parse(String(rows[0].body)).receivedAt,a.receivedAt+100);
  recorder.paperCaptureKeys.clear();recorder.update({...a,receivedMono:a.receivedMono+400});assert.equal(recorder.storage.persisted,2);
 }finally{store.close();}
});
