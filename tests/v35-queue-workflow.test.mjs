import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';

process.env.SIMRS_CONTRACT_VERSION='3.5';
const {createMockServer}=await import('../mock-server.mjs');
const org='DEMO-RS-001';
const patientId='d2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1';
const unitId='25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
const headers={'Content-Type':'application/json','X-Organization-Id':org};
async function post(base,path,body,key,extra={}){
 return fetch(base+path,{method:'POST',headers:{...headers,'Idempotency-Key':key,...extra},body:JSON.stringify(body)});
}
async function withServer(run){
 const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 try{return await run('http://127.0.0.1:'+server.address().port);}
 finally{server.close();await once(server,'close');}
}
test('M01 registration -> stateful mock queue: valid sequence, version, replay, errors, isolated RAM',async()=>{
 let savedTicket;
 await withServer(async base=>{
  const reg=await post(base,'/api/v1/registrations',{
   patientId,unitId,serviceType:'RJ',payer:{type:'SELF_PAY'}
  },'queue-registration-0001');
  assert.equal(reg.status,201);
  const registration=await reg.json();
  const ticket=registration.queueTicketId;savedTicket=ticket;
  assert.ok(ticket);assert.ok(registration.encounterId);
  const route='/api/v1/queue/tickets/'+ticket+'/transitions/preview';
  const read='/__demo/queue/tickets/'+ticket;
  async function snapshot(){
   const response=await fetch(base+read,{headers:{'X-Organization-Id':org}});
   assert.equal(response.status,200);assert.equal(response.headers.get('x-simrs-state-persisted'),'false');
   return response.json();
  }
  assert.deepEqual((({queueStatus,version})=>({queueStatus,version}))(await snapshot()),{queueStatus:'waiting',version:1});
  let response=await post(base,route,{expectedVersion:1,reason:'QA skip',queueStatus:'done'},'queue-invalid-skip');
  assert.equal(response.status,409);assert.equal((await snapshot()).version,1);
  response=await post(base,route,{expectedVersion:0,reason:'QA stale',queueStatus:'called'},'queue-stale');
  assert.equal(response.status,412);assert.equal((await snapshot()).version,1);
  response=await post(base,route,{expectedVersion:1,reason:'QA bad state',queueStatus:'invalid'},'queue-invalid-enum');
  assert.equal(response.status,422);assert.equal((await snapshot()).version,1);
  response=await post(base,route,{expectedVersion:1,reason:'QA forbidden',queueStatus:'called'},'queue-tenant',{'X-Organization-Id':'OTHER-HOSPITAL'});
  assert.equal(response.status,403);assert.equal((await snapshot()).version,1);
  const stages=['called','in-service','done'];
  for(let i=0;i<stages.length;i++){
   const body={expectedVersion:i+1,reason:'QA test step '+i,queueStatus:stages[i]};
   const key='queue-transition-'+(i+1);
   const first=await post(base,route,body,key);
   assert.equal(first.status,201);
   assert.equal(first.headers.get('x-simrs-state-persisted'),'false');
   const dto=await first.json();
   assert.equal(dto.status,'queue-transition-preview');assert.equal(dto.version,i+2);
   assert.equal(dto.mock,true);assert.equal(dto.persisted,false);assert.equal(dto.realWorldEffect,false);
   assert.equal((await snapshot()).queueStatus,stages[i]);
   const replay=await post(base,route,body,key);
   assert.equal(replay.status,201);assert.equal(replay.headers.get('x-idempotent-replay'),'true');
   assert.equal((await snapshot()).version,i+2);
   const conflict=await post(base,route,{...body,reason:'Changed replay'},key);
   assert.equal(conflict.status,409);
  }
  response=await post(base,route,{expectedVersion:4,reason:'QA terminal',queueStatus:'called'},'queue-after-done');
  assert.equal(response.status,409);assert.equal((await snapshot()).queueStatus,'done');
  const fake='11111111-1111-4111-8111-111111111111';
  response=await post(base,'/api/v1/queue/tickets/'+fake+'/transitions/preview',
   {expectedVersion:1,reason:'QA unknown',queueStatus:'called'},'queue-not-found');
  assert.equal(response.status,404);
  response=await fetch(base+read,{method:'PATCH',headers:{...headers,'Idempotency-Key':'patch-denied-001'},body:'{}'});
  assert.equal(response.status,405);
 });
 await withServer(async base=>{
  const res=await fetch(base+'/__demo/queue/tickets/'+savedTicket,{headers:{'X-Organization-Id':org}});
  assert.equal(res.status,404,'Synthetic queue must disappear with restarted Node process');
 });
});
