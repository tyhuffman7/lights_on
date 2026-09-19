import {test} from 'node:test';import assert from 'node:assert/strict';import {market} from '../lib/arb/adapters.ts';
const metadata={slug:'pending-example',closed:true,active:true,archived:false,description:'Example rules',endDate:'2026-10-01T00:00:00Z',marketSides:[{long:true,description:'Yes',tradable:false},{long:false,description:'No',tradable:false}]};
test('Closed PM market without a published settlement remains closed and unpaid; other errors propagate',async()=>{
 const original=globalThis.fetch;let status=404,metadataStatus=200;
 globalThis.fetch=async input=>new Response(JSON.stringify(String(input).endsWith('/settlement')?{message:'Settlement not found'}:{market:metadata}),{status:String(input).endsWith('/settlement')?status:metadataStatus});
 try{const m=await market('poly','pending-example');assert.equal(m.open,false);assert.equal(m.settlement,null);assert.equal(m.id,'pending-example');status=500;await assert.rejects(market('poly','pending-example'),/HTTP 500/);metadataStatus=404;await assert.rejects(market('poly','pending-example'),/HTTP 404/);}finally{globalThis.fetch=original;}
});
