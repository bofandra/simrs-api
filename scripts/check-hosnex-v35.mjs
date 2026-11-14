import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHosnexV32Spec} from './compose-hosnex-v32.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const base=read('openapi-v3.1.json');
const overlays=['v3.2/hosnex-p0-overlay.json','v3.3/p0-gap-operations.json','v3.4/remaining-action-operations.json','v3.5/partial-operations.json'].map(x=>read('contracts/'+x));
let prior=base,previous;
const list=s=>Object.entries(s.paths).flatMap(([path,methods])=>Object.entries(methods).filter(([m,x])=>['get','post','put','patch','delete'].includes(m)).map(([method,x])=>({path,method,...x})));
for(let i=0;i<overlays.length;i++){
 const current=buildHosnexV32Spec(prior,overlays[i]);
 if(i===3)previous=prior;
 prior=current;
}
const spec=prior,prev=list(previous),all=list(spec);
assert.equal(prev.length,247);assert.equal(all.length,268);
assert.equal(new Set(all.map(o=>o.operationId)).size,268);
for(const o of prev)assert.deepEqual(spec.paths[o.path][o.method],previous.paths[o.path][o.method],'v3.4 operation changed '+o.operationId);
const partial=read('contracts/hosnex-action-coverage.json').actions.filter(x=>x.status==='partial');
const alignments=read('contracts/v3.5/partial-action-alignment.json').alignments;
assert.equal(partial.length,29);assert.equal(alignments.length,29);
assert.equal(new Set(alignments.map(x=>x.action)).size,29);
assert.equal(overlays[3].operations.length,21);
assert.equal(alignments.filter(x=>x.resolution==='reuse-with-explicit-adapter').length,8);
for(const c of partial){
 const alignment=alignments.find(x=>x.action===c.frontendAction);
 assert(alignment,'Partial action not reconciled '+c.frontendAction);
 assert.equal(alignment.module,c.module);
 assert(alignment.sourceLine>0&&alignment.sourceSignature.includes(c.frontendAction+'('));
 assert.equal(alignment.maturity,'review-only; frontend adapter and stateful acceptance NOT DONE');
 const op=all.find(x=>x.operationId===alignment.operationId);
 assert(op,'Target operation missing '+alignment.operationId);
 if(alignment.resolution==='new-proposed-operation'){
   assert.equal(op['x-contract-status'],'review-only');
   assert(op['x-hosnex-frontend-actions'].includes(c.frontendAction));
   const body=op.requestBody.content['application/json'].schema;
   assert(body.required.includes('expectedVersion'));
   for(const name of ['simulated','persisted','realWorldEffect'])assert(op.responses[Object.keys(op.responses).find(k=>k.length===3 && k[0]==='2' && Number.isInteger(Number(k)))].content['application/json'].schema.required.includes(name));
 } else assert(alignment.mappingNote.length>=20);
}
console.log('PASS: 247 unchanged + 21 v3.5 = 268 candidate operations; all 29 partial actions mapped to 21 distinct semantic proposals or 8 explicit adapter reviews.');
