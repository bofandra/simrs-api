import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';

process.env.SIMRS_CONTRACT_VERSION='3.5';
const {createMockServer}=await import('../mock-server.mjs');
const root='/__demo/clinical-workspaces/M03';
async function withServer(fn){
  const srv=createMockServer();srv.listen(0,'127.0.0.1');await once(srv,'listening');
  try{await fn('http://127.0.0.1:'+srv.address().port);}
  finally{srv.close();await once(srv,'close');}
}
test('M03 typed triage DTO from HOSNEX is validated, linked and RAM-only',()=>withServer(async base=>{
 const h={'X-Organization-Id':'DEMO-RS-001','Content-Type':'application/json'};
 const list=await fetch(base+root,{headers:h});assert.equal(list.status,200);
 const [episode]=(await list.json()).items;
 assert(episode?.encounterId&&episode?.patientId);
 const url=base+root+'/'+episode.id+'/actions/triage';
 const triage={encounterId:episode.encounterId,patientId:episode.patientId,
   complaint:'Keluhan fiktif untuk QA',atsLevel:3,vitals:{sbp:120,hr:85,spo2:98}};
 const send=async(body,key)=>fetch(url,{
   method:'POST',headers:{...h,'Idempotency-Key':key},body:JSON.stringify(body)
 });
 let r=await send({expectedVersion:1,triage:{...triage,patientId:'bad-local-id'}},'triage-wrong-id-001');
 assert.equal(r.status,422);
 r=await send({expectedVersion:1,triage:{...triage,complaint:' '}},'triage-empty-complaint');
 assert.equal(r.status,422);
 r=await send({expectedVersion:1,triage:{...triage,atsLevel:0}},'triage-invalid-ats');
 assert.equal(r.status,422);
 assert.equal((await (await fetch(base+root,{headers:h})).json()).items[0].status,'waiting');
 const payload={expectedVersion:1,triage};
 r=await send(payload,'triage-typed-001');assert.equal(r.status,200);
 assert.equal(r.headers.get('X-SIMRS-State-Persisted'),'false');
 const ok=await r.json();
 assert.equal(ok.record.status,'triaged');assert.equal(ok.record.version,2);
 assert.deepEqual(ok.record.triageDetails,{complaint:triage.complaint,atsLevel:3,vitals:triage.vitals});
 assert.equal(ok.realWorldEffect,false);assert.equal(ok.persisted,false);
 r=await send(payload,'triage-typed-001');assert.equal(r.status,200);
 assert.equal((await r.json()).idempotentReplay,true);
 r=await send({...payload,triage:{...triage,complaint:'Changed'}},'triage-typed-001');assert.equal(r.status,409);
 const record=(await (await fetch(base+root+'/'+episode.id,{headers:h})).json()).record;
 assert.equal(record.triageDetails.atsLevel,3);
 assert.equal(record.history.length,1);
}));
