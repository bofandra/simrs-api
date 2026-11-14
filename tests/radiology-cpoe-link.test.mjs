import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
let n=0;
const unit='25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
async function request(base,path,method='GET',body,role='admin',key){
  const headers={'X-Organization-Id':'DEMO-RS-001','X-Demo-Staff-Id':role,
    ...(method==='GET'?{}:{'Content-Type':'application/json',
      'Idempotency-Key':key??'m10-test-'+(++n)+'-unique',
      'If-Match':String(body?.expectedVersion??body?.version??1)})};
  const r=await fetch(base+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  return {status:r.status,data:await r.json()};
}
test('RAD CPOE is linked to RIS mock by order and encounter, with demo role gates',async()=>{
 const server=createMockServer();server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const patient=await request(base,'/api/v1/patients','POST',{
   name:'Synthetic test patient',birthDate:'1995-01-01',gender:'female',
   identifiers:[{system:'MRN',value:'RAD-DEMO'}],contactPhones:[]
  });
  assert.equal(patient.status,201);
  const reg=await request(base,'/api/v1/registrations','POST',{
   patientId:patient.data.patientId,serviceType:'RJ',unitId:unit,payer:{type:'SELF_PAY'}
  });
  assert.equal(reg.status,201);
  const encounterId=reg.data.encounterId;
  const note=await request(base,'/api/v1/clinical/notes','POST',{
   encounterId,noteType:'SOAP',subjective:'Mock',objective:'Mock',assessment:'Mock',plan:'RAD'
  });
  assert.equal(note.status,201);
  assert.equal((await request(base,'/api/v1/clinical/notes/'+note.data.id+'/sign',
   'POST',{version:1,signatureContext:'mock'})).status,200);
  const order={encounterId,category:'RAD',serviceCode:'THX',
    urgency:'routine',indication:'Mock thorax',targetUnitId:unit};
  assert.equal((await request(base,'/api/v1/orders','POST',order,'radiographer')).status,403);
  const first=await request(base,'/api/v1/orders','POST',order,'doctor','rad-link-001');
  assert.equal(first.status,201);
  const retry=await request(base,'/api/v1/orders','POST',order,'doctor','rad-link-001');
  assert.equal(retry.data.id,first.data.id);
  const root='/__demo/radiology/orders';
  assert.equal((await request(base,root,'GET',undefined,'cashier')).status,403);
  const list=await request(base,root,'GET',undefined,'radiographer');
  assert.equal(list.status,200);
  assert.equal(list.data.items.length,3);
  const linked=list.data.items.find(x=>x.id===first.data.id);
  assert.equal(linked.cpoeLinked,true);
  assert.equal(linked.patientId,patient.data.patientId);
  assert.equal(linked.episodeId,encounterId);
  const detail=await request(base,root+'/'+first.data.id,'GET',undefined,'radiology');
  assert.equal(detail.data.orderId,first.data.id);
  assert.equal(detail.data.orderOrigin,'synthetic-cpoe');
  const schedule={expectedVersion:1,scheduledAt:'2026-11-15T09:30:00+07:00',
    technician:'QA Operator',identityChecked:true,contraindicationChecked:true};
  assert.equal((await request(base,root+'/'+first.data.id+'/schedule','PATCH',schedule,'doctor')).status,403);
  assert.equal((await request(base,root+'/'+first.data.id+'/schedule','PATCH',schedule,'radiographer')).status,200);
  assert.equal((await request(base,root+'/'+first.data.id+'/report','PATCH',
    {expectedVersion:2,report:{}},'radiographer')).status,403);
  assert.equal((await request(base,root+'/'+first.data.id+'/viewer','GET',undefined,'radiology')).status,501);
  assert.equal((await request(base,root+'/'+first.data.id+'/sign','POST',
    {expectedVersion:2},'radiology')).status,405);
  const final=await request(base,root+'/'+first.data.id,'GET',undefined,'doctor');
  assert.equal(final.data.dicomAcquired,false);
  assert.equal(final.data.signed,false);
  assert.equal(final.data.persisted,false);
  assert.equal((await request(base,'/healthz')).data.operations,200);
 }finally{server.close();await once(server,'close');}
});
