import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
process.env.SIMRS_CONTRACT_VERSION='3.3';
const {createMockServer}=await import('../mock-server.mjs');
const overlay=JSON.parse(readFileSync(new URL('../contracts/v3.3/p0-gap-operations.json',import.meta.url),'utf8'));
const uuid='11111111-1111-4111-8111-111111111111';
test('v3.3 adds 13 P0 review-only REST response fixtures, no live effects',async()=>{
 const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/healthz');assert.equal((await r.json()).operations,213);
  r=await fetch(base+'/__mock/contract/operations');const meta=await r.json();
  assert.equal(meta.total,213);assert.equal(meta.items.length,213);
  for(const op of overlay.operations){
    const path=op.path.replace('{id}',uuid);
    const body={actorId:uuid,expectedVersion:1,reason:'Simulasi QA kontrak saja'};
    if(op.operationId==='setInventoryMinimum')Object.assign(body,{minimumQty:3,unit:'pcs'});
    if(op.operationId==='saveMorbidityCoding')body.diagnoses=[{code:'A00',type:'PRIMARY'}];
    if(op.operationId==='acknowledgeClaim')body.acknowledgementReference='DEMO-ACK-001';
    r=await fetch(base+path,{method:op.method,headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001','Idempotency-Key':'p0-'+op.operationId+'-1'},body:JSON.stringify(body)});
    assert.equal(r.status,op.successStatus,op.operationId);
    assert.equal(r.headers.get('x-simrs-state-persisted'),'false',op.operationId);
    const payload=await r.json();
    assert.equal(payload.operationId,op.operationId);
    assert.equal(payload.targetId,uuid);
    assert.equal(payload.mock,true);assert.equal(payload.persisted,false);assert.equal(payload.realWorldEffect,false);
    r=await fetch(base+'/__mock/contract/operations/'+op.operationId,{method:'POST',headers:{'X-Organization-Id':'DEMO-RS-001','Content-Type':'application/json'},body:'{}'});
    assert.equal(r.status,200);const fixture=await r.json();assert.equal(fixture.operationId,op.operationId);assert.equal(fixture.persisted,false);
  }
  for(const scenario of ['forbidden','conflict','invalid','error']){
    const status={forbidden:403,conflict:409,invalid:422,error:500}[scenario];
    r=await fetch(base+'/api/v1/claims/'+uuid+'/ready',{method:'POST',headers:{'X-Organization-Id':'DEMO-RS-001','X-Demo-Scenario':scenario},body:'{}'});
    assert.equal(r.status,status);
  }
  r=await fetch(base+'/api/v1/claims/'+uuid+'/ready',{method:'POST',headers:{'X-Organization-Id':'DEMO-RS-001','Idempotency-Key':'invalidpayload-01','Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,422);
 } finally{server.close();await once(server,'close');}
});
