import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHosnexV32Spec} from './compose-hosnex-v32.mjs';
const read=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const base=read('openapi-v3.1.json');
const overlay=read('contracts/v3.2/hosnex-p0-overlay.json');
const baseBefore=JSON.stringify(base);
const spec=buildHosnexV32Spec(base,overlay);
assert.equal(JSON.stringify(base),baseBefore,'v3.1 source must not mutate');
assert.equal(spec.openapi,'3.1.0');
assert.equal(spec.info.version,'3.2.0-draft.0');
assert.equal(spec['x-overlay-status'],'PROPOSAL_ONLY');
assert.equal(overlay.operations.length,19);
const ops=Object.entries(spec.paths).flatMap(([path,verbs])=>Object.entries(verbs).filter(([method,v])=>['get','post','put','patch','delete'].includes(method)).map(([method,v])=>({path,method,operation:v})));
const baseOps=Object.entries(base.paths).flatMap(([path,verbs])=>Object.entries(verbs).filter(([method,v])=>['get','post','put','patch','delete'].includes(method)).map(([method,v])=>({path,method,operation:v})));
assert.equal(baseOps.length,180);
assert.equal(ops.length,199);
assert.equal(new Set(ops.map(x=>x.operation.operationId)).size,199);
for(const {path,method,operation} of baseOps){
 const corresponding=spec.paths[path][method];
 assert.equal(JSON.stringify(corresponding),JSON.stringify(operation),'Existing v3.1 op changed: '+operation.operationId);
}
for(const {operationId,method,path,frontendActions,requestSchema,responseSchema,permission} of overlay.operations){
 const op=spec.paths[path][method.toLowerCase()];
 assert(op,'overlay endpoint missing: '+operationId);
 assert.equal(op.operationId,operationId);
 assert.equal(op['x-contract-status'],'review-only');
 assert.equal(op['x-permission'],permission);
 assert.deepEqual(op['x-hosnex-frontend-actions'],frontendActions);
 assert.deepEqual(op.responses[method==='POST'?201:200].content['application/json'].schema,responseSchema);
 if(method==='GET')assert.equal(op.requestBody,undefined);
 else assert.deepEqual(op.requestBody.content['application/json'].schema,requestSchema);
 for(const m of path.matchAll(/\{([^}]+)\}/g)){
   assert(op.parameters.some(p=>p.in==='path'&&p.name===m[1]&&p.required));
 }
}
console.log('PASS: 180 preserved + 19 review-only proposals = 199 valid operationIds');
