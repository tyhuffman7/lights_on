import {test} from 'node:test';import assert from 'node:assert/strict';
import {observedSizeAdmission} from '../lib/arb/maker-size-admission.ts';
import {MakerActivity} from '../lib/arb/maker-activity.ts';
const input={price:7700,quantity:5,hedgeLevels:[{price:1800,quantity:5}],hedgeStep:.01,makerRate:175,hedgeRate:600,reserve:200};
test('Recent tiny CCSU size fails documented PM fees despite a profitable full-size plan',()=>{
 const tiny=observedSizeAdmission({...input,sizes:[.04]});assert.equal(tiny.eligible,false);assert.equal(tiny.minimumProfit,-80);
 assert.equal(observedSizeAdmission({...input,sizes:[5]}).eligible,true);
 assert.equal(observedSizeAdmission({...input,sizes:[5,.04]}).eligible,false,'large volume must not hide tiny-size losses');
});
test('Admission rejects missing activity, unhedgeable steps, insufficient depth and bounded-work overflow',()=>{
 assert.equal(observedSizeAdmission({...input,sizes:[]}).eligible,false);
 assert.equal(observedSizeAdmission({...input,hedgeStep:1,sizes:[.25]}).eligible,false);
 assert.equal(observedSizeAdmission({...input,hedgeLevels:[],sizes:[1]}).eligible,false);
 assert.equal(observedSizeAdmission({...input,sizes:Array.from({length:33},(_,i)=>(i+1)/100)}).reason,'TOO_MANY_DISTINCT_SIZES');
});
test('Size economics caps public size at requested quantity and preserves source inputs',()=>{
 const data={...input,sizes:[100,100,5]},before=structuredClone(data),r=observedSizeAdmission(data);
 assert.equal(r.eligible,true);assert.equal(r.distinctSizes,1);assert.deepEqual(data,before);
});
test('Activity size evidence uses the same side, price and time filters as volume',()=>{
 const a=new MakerActivity(),now=10000;
 for(const [id,quantity,side,price] of [['tiny',.04,'yes',7700],['large',5,'yes',7700],['wrong-side',3,'no',7700],['too-expensive',2,'yes',7800]] as const)a.observe({id,marketId:'K',side,quantity,price,at:now},now);
 assert.deepEqual(a.sizes('K','yes',7700,now),[.04,5]);assert.equal(a.volume('K','yes',7700,now),5.04);
 assert.deepEqual(a.sizes('K','yes',7700,now+60000),[]);
});
