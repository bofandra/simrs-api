import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHosnexV32Spec} from './compose-hosnex-v32.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const base=read('openapi-v3.1.json');
const b32=read('contracts/v3.2/hosnex-p0-overlay.json');
const b33=read('contracts/v3.3/p0-gap-operations.json');
const b34=read('contracts/v3.4/remaining-action-operations.json');
const s32=buildHosnexV32Spec(base,b32),s33=buildHosnexV32Spec(s32,b33),s34=buildHosnexV32Spec(s33,b34);
const list=s=>Object.entries(s.paths).flatMap(([p,verbs])=>Object.entries(verbs).filter(([v,x])=>['get','post','put','patch','delete'].includes(v)).map(([v,x])=>({path:p,method:v.toUpperCase(),...x})));
const prev=list(s33),current=list(s34);
assert.equal(prev.length,213);assert.equal(current.length,247);
assert.equal(new Set(current.map(x=>x.operationId)).size,247);
assert.equal(b34.operations.length,34);
for(const op of prev)assert.deepEqual(s34.paths[op.path][op.method.toLowerCase()],s33.paths[op.path][op.method.toLowerCase()],'v3.3 operation changed '+op.operationId);
const cov=read('contracts/hosnex-action-coverage.json'),missing=cov.actions.filter(x=>x.status==='missing');
const covered=new Set([...b32.operations,...b33.operations,...b34.operations].flatMap(x=>x.frontendActions));
const unresolved=missing.filter(x=>!covered.has(x.frontendAction)).map(x=>x.frontendAction).sort();
assert.deepEqual(unresolved,['signInPortal','signOutPortal']);
for(const o of b34.operations){
 const op=s34.paths[o.path][o.method.toLowerCase()];
 assert(op,'unavailable '+o.operationId);assert.equal(op.operationId,o.operationId);
 assert.equal(op['x-contract-status'],'review-only');
 assert.deepEqual(op.requestBody.content['application/json'].schema,o.requestSchema);
 assert.deepEqual(op.responses[String(o.successStatus)].content['application/json'].schema,o.responseSchema);
 for(const f of ['actorId','expectedVersion','reason'])assert(o.requestSchema.required.includes(f));
 assert(o.responseSchema.required.includes('realWorldEffect'));
}
console.log('PASS: 200 v3.2 + 13 v3.3 + 34 v3.4 = 247 candidates; all 60 historic missing map to a proposal or declared OIDC boundary. Not a full PRD acceptance.');
