import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHosnexV32Spec} from './compose-hosnex-v32.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const v31=read('openapi-v3.1.json'),v32=read('contracts/v3.2/hosnex-p0-overlay.json');
const v33=read('contracts/v3.3/p0-gap-operations.json');
const baseString=JSON.stringify(v31);
const s32=buildHosnexV32Spec(v31,v32);
const s33=buildHosnexV32Spec(s32,v33);
const list=s=>Object.entries(s.paths).flatMap(([path,v])=>Object.entries(v).filter(([m,x])=>['get','post','patch','put','delete'].includes(m)).map(([m,x])=>({path,method:m.toUpperCase(),...x})));
const oldOps=list(s32), newOps=list(s33);
assert.equal(JSON.stringify(v31),baseString,'v3.1 immutable');
assert.equal(oldOps.length,200);assert.equal(newOps.length,213);
assert.equal(new Set(newOps.map(x=>x.operationId)).size,213);
for(const o of oldOps)assert.equal(JSON.stringify(s33.paths[o.path][o.method.toLowerCase()]),JSON.stringify(s32.paths[o.path][o.method.toLowerCase()]),'v3.2 contract changed '+o.operationId);
const p0=read('contracts/v3.2/hosnex-p0-closure-backlog.json').unmappedP0;
assert.equal(p0.length,15);assert.equal(v33.operations.length,13);
assert.equal(v33.deferredExternal.length,2);
for(const entry of p0){
  if(entry.decision==='delegate-to-patient-OIDC'){
    assert(v33.deferredExternal.some(x=>x.frontendAction===entry.action&&x.status==='EXTERNAL_AUTH_BOUNDARY'));
    continue;
  }
  const x=v33.operations.find(x=>x.operationId===entry.action&&x.frontendActions.includes(entry.action));
  assert(x,'P0 unmapped: '+entry.action);
  assert.equal(x.method+' '+x.path,entry.endpoint);
  const op=s33.paths[x.path][x.method.toLowerCase()];
  assert.equal(op.operationId,x.operationId);
  assert.equal(op['x-contract-status'],'review-only');
  assert.deepEqual(op.requestBody.content['application/json'].schema,x.requestSchema);
  assert.deepEqual(op.responses[String(x.successStatus)].content['application/json'].schema,x.responseSchema);
  for(const k of ['expectedVersion','actorId','reason'])assert(x.requestSchema.required.includes(k));
  for(const k of ['simulated','persisted','realWorldEffect'])assert(x.responseSchema.required.includes(k));
}
console.log('PASS: 200 unchanged + 13 unique, review-only mock P0 = 213. Two CH01 OIDC delegated.');
