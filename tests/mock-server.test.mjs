import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMockServer } from '../mock-server.mjs';
async function withServer(fn){
  const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await fn('http://127.0.0.1:'+server.address().port)}finally{server.close();await once(server,'close')}
}
const hdr={'Content-Type':'application/json','Idempotency-Key':'test-key-123456','X-Organization-Id':'DEMO-RS-001'};
const patientId='d2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1';
const unitId='25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
test('health, catalog and all operations exposed',async()=>withServer(async(base)=>{
  const a=await fetch(base+'/healthz');assert.equal(a.status,200);assert.equal((await a.json()).operations,106);
  const b=await fetch(base+'/openapi.json');assert.equal(b.status,200);assert.equal((await b.json()).openapi,'3.1.0');
  assert.equal((await fetch(base+'/docs')).status,200);
}));
test('registration creates consistent encounter, idempotent replay; invalid request blocked',async()=>withServer(async(base)=>{
  const path=base+'/api/v1/registrations';
  const body=JSON.stringify({patientId,serviceType:'RJ',unitId,payer:{type:'SELF_PAY'}});
  const opts={method:'POST',headers:hdr,body};
  let r=await fetch(path,opts);assert.equal(r.status,201);assert.equal(r.headers.get('X-SIMRS-Mock'),'true');
  const data=await r.json();assert(data.encounterId);assert(data.queueTicketId);
  r=await fetch(path,opts);assert.equal(r.status,201);assert.equal(r.headers.get('X-Idempotent-Replay'),'true');
  assert.equal((await r.json()).encounterId,data.encounterId);
  r=await fetch(base+'/api/v1/encounters/'+data.encounterId+'/chart');
  assert.equal(r.status,200);assert.equal((await r.json()).encounter.id,data.encounterId);
  r=await fetch(path,{method:'POST',headers:{...hdr,'Idempotency-Key':'invalid-1234'},body:'{}'});
  assert.equal(r.status,422);assert.equal((await r.json()).code,'VALIDATION_ERROR');
}));
test('tenant scope, If-Match and critical transitions are controlled in mock',async()=>withServer(async(base)=>{
  let r=await fetch(base+'/api/v1/patients',{headers:{'X-Organization-Id':'OTHER'}});
  assert.equal(r.status,403);
  r=await fetch(base+'/api/v1/clinical/notes/11111111-1111-4111-8111-111111111111/sign',
    {method:'POST',headers:hdr,body:JSON.stringify({version:1,signatureContext:'demo'})});
  assert.equal(r.status,412);
  r=await fetch(base+'/api/v1/encounters/85ba4e38-9d86-41ce-9b6e-7f8af4d19768/complete',
    {method:'POST',headers:{...hdr,'If-Match':'1'},body:JSON.stringify({checklist:'complete',disposition:'home',summaryId:'DEMO'})});
  assert.equal(r.status,422);assert.equal((await r.json()).code,'MISSING_SIGNED_NOTE');
}));
test('lab results are visible after creating an order',async()=>withServer(async(base)=>{
  const body=JSON.stringify({encounterId:'85ba4e38-9d86-41ce-9b6e-7f8af4d19768',
    serviceCode:'HB',category:'LAB',urgency:'routine',indication:'Simulated follow-up',targetUnitId:'25d6f4b1-f3ad-48c6-919f-409fb68e0d0c'});
  let r=await fetch(base+'/api/v1/orders',{method:'POST',headers:hdr,body});
  assert.equal(r.status,201);const id=(await r.json()).id;
  r=await fetch(base+'/api/v1/laboratory/orders');
  assert.equal(r.status,200);assert((await r.json()).some(x=>x.id===id));
}));
