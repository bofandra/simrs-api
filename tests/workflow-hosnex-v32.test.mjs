import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
const unitId='25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
let seq=0;
const syntheticNow='2026-11-14T09:00:00+07:00';
async function withServer(fn){
  const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await fn('http://127.0.0.1:'+server.address().port);}finally{server.close();await once(server,'close');}
}
async function send(base,path,body,method='POST',other={}){
  const headers={'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001',
    'Idempotency-Key':'hosnex-e2e-'+String(++seq).padStart(7,'0'),
    'If-Match':String(body?.expectedVersion??1),...other};
  const res=await fetch(base+path,{method,headers,body:JSON.stringify(body)});
  return {status:res.status,data:await res.json(),headers:res.headers};
}
async function get(base,path){
  const res=await fetch(base+path,{headers:{'X-Organization-Id':'DEMO-RS-001'}});
  return {status:res.status,data:await res.json(),headers:res.headers};
}
test('v3.2 overlay is discoverable as 199 review-only operations without altering v3.1',async()=>withServer(async base=>{
  const h=await get(base,'/healthz');assert.equal(h.status,200);assert.equal(h.data.operations,199);
  const spec=await get(base,'/openapi.json');
  assert.equal(spec.data.info.version,'3.2.0-draft.0');
  assert.equal(spec.data['x-overlay-status'],'PROPOSAL_ONLY');
  assert.equal(spec.data.paths['/api/v1/registrations'].post.operationId,'createRegistration');
  assert.equal(spec.data.paths['/api/v1/encounters/{id}/drafts/clinical'].patch.operationId,'saveCompositeEncounterDraft');
  const overlay=Object.values(spec.data.paths).flatMap(v=>Object.values(v)).filter(v=>v?.['x-contract-status']==='review-only');
  assert.equal(overlay.length,19);
  const old=await get(base,'/openapi-v3.1.json');assert.equal(old.data.info.version,'3.1.0-candidate.1');
}));
test('same patient and encounter propagate across HTTP registration, clinical, lab and pharmacy demo',async()=>withServer(async base=>{
  let r=await send(base,'/api/v1/patients',{
    identifiers:[{system:'MRN',value:'DEMO-2026-001'}],name:'Pasien E2E Sintetis',birthDate:'1990-02-01',
    gender:'female',addresses:[{province:'32',district:'3275',subDistrict:'327503',village:'3275031001',line:'Jalan Simulasi No. 1'}],contactPhones:[]
  });
  assert.equal(r.status,201);const patientId=r.data.patientId;assert(r.data.mrn);
  const filtered=await get(base,'/api/v1/patients?q=Pasien%20E2E');
  assert.equal(filtered.status,200);
  assert.equal(filtered.data.items.length,1);
  assert.equal(filtered.data.items[0].patientId,patientId);
  const noMatch=await get(base,'/api/v1/patients?q=string-yang-tidak-ada');
  assert.equal(noMatch.data.items.length,0);
  const notFound=await send(base,'/api/v1/registrations',
    {patientId:'11111111-1111-4111-8111-111111111111',serviceType:'RJ',unitId,payer:{type:'SELF_PAY'}});
  assert.equal(notFound.status,422);assert.equal(notFound.data.code,'UNKNOWN_PATIENT');

  r=await send(base,'/api/v1/registrations',{patientId,serviceType:'RJ',unitId,payer:{type:'SELF_PAY'}});
  assert.equal(r.status,201);const {registrationId,encounterId,queueTicketId,queueNumber}=r.data;
  assert(registrationId && encounterId && queueTicketId && queueNumber);
  const worklist=await get(base,'/api/v1/outpatient/worklist?unitId='+unitId);
  assert.equal(worklist.status,200);
  assert(worklist.data.items.some(x=>x.encounterId===encounterId && x.patientName==='Pasien E2E Sintetis'));
  const chart=await get(base,'/api/v1/encounters/'+encounterId+'/chart');
  assert.equal(chart.status,200);assert.equal(chart.data.patient.id,patientId);
  assert.equal(chart.data.patient.mrn,r.data.mrn??filtered.data.items[0].mrn);
  const draft=await send(base,'/api/v1/encounters/'+encounterId+'/drafts/clinical',
    {expectedVersion:1,clinicalNote:{subjective:'Gejala demo'},observations:[],proposedOrders:[],proposedPrescriptions:[]},'PATCH');
  assert.equal(draft.status,200);assert.equal(draft.data.version,2);
  const stale=await send(base,'/api/v1/encounters/'+encounterId+'/drafts/clinical',
    {expectedVersion:1,clinicalNote:{subjective:'Stale'},observations:[],proposedOrders:[],proposedPrescriptions:[]},'PATCH');
  assert.equal(stale.status,412);
  // Saving a draft must NOT create lab orders or pharmacy prescriptions.
  assert.equal((await get(base,'/api/v1/laboratory/orders')).data.items.length,0);
  assert.equal((await get(base,'/api/v1/pharmacy/prescriptions')).data.items.length,0);

  const note=await send(base,'/api/v1/clinical/notes',{encounterId,noteType:'SOAP',
    subjective:'Keluhan sintetis',objective:'Pemeriksaan demo',assessment:'Simulasi',plan:'Periksa lab dan tulis resep'});
  assert.equal(note.status,201);
  const sign=await send(base,'/api/v1/clinical/notes/'+note.data.id+'/sign',
    {version:1,signatureContext:'mock only'});
  assert.equal(sign.status,200);assert.equal(sign.data.status,'signed');

  const order=await send(base,'/api/v1/orders',{encounterId,serviceCode:'HB',category:'LAB',
    urgency:'routine',indication:'Demo',targetUnitId:unitId});
  assert.equal(order.status,201);
  const labList=await get(base,'/api/v1/laboratory/orders');
  assert(labList.data.items.some(x=>x.encounterId===encounterId && x.id===order.data.id));
  const accepted=await send(base,'/api/v1/laboratory/orders/'+order.data.id+'/accept',
    {acceptedAt:syntheticNow,expectedVersion:1});
  assert.equal(accepted.status,200);
  const specimen=await send(base,'/api/v1/laboratory/orders/'+order.data.id+'/specimens',
    {specimenType:{system:'https://example.invalid/specimens',code:'EDTA'},barcode:'E2E-LAB-0001'});
  assert.equal(specimen.status,201);
  const collected=await send(base,'/api/v1/laboratory/specimens/'+specimen.data.id+'/collect',
    {barcode:'E2E-LAB-0001',collectedAt:syntheticNow,collectorId:unitId,expectedVersion:1});
  assert.equal(collected.status,200);
  const received=await send(base,'/api/v1/laboratory/specimens/'+specimen.data.id+'/receive',
    {barcode:'E2E-LAB-0001',receivedAt:syntheticNow,condition:'good',receiverId:unitId});
  assert.equal(received.status,200);
  const result=await send(base,'/api/v1/laboratory/orders/'+order.data.id+'/results',
    {observations:[{analyteCode:'718-7',value:13.4,unit:'g/dL'}],method:'demo',analyzerId:'DEMO'});
  assert.equal(result.status,201);
  const premature=await send(base,'/api/v1/laboratory/reports/'+result.data.id+'/release',{expectedVersion:1});
  assert.equal(premature.status,422);assert.equal(premature.data.code,'REPORT_NOT_VERIFIED');
  const verified=await send(base,'/api/v1/laboratory/reports/'+result.data.id+'/verify',
    {resultVersion:1,verifier:'DEMO-ATLM'});
  assert.equal(verified.status,200);
  const released=await send(base,'/api/v1/laboratory/reports/'+result.data.id+'/release',
    {expectedVersion:1});
  assert.equal(released.status,200);assert.equal(released.data.status,'released');

  const rx=await send(base,'/api/v1/pharmacy/prescriptions',{encounterId,
    items:[{drugId:'DEMO-DRUG',dose:'1 tab',route:'PO',frequency:'1x daily',duration:'3 days'}],indication:'DEMO'});
  assert.equal(rx.status,201);
  const before=await send(base,'/api/v1/pharmacy/dispenses',
    {prescriptionId:rx.data.id,items:[{lotId:'DEMO-LOT',qty:1}],receiver:'DEMO'});
  assert.equal(before.status,422);assert.equal(before.data.code,'PRESCRIPTION_REVIEW_REQUIRED');
  const review=await send(base,'/api/v1/pharmacy/prescriptions/'+rx.data.id+'/review',
    {decision:'approved',clarification:'-',pharmacistId:unitId});
  assert.equal(review.status,200);
  const dispense=await send(base,'/api/v1/pharmacy/dispenses',
    {prescriptionId:rx.data.id,items:[{lotId:'DEMO-LOT',qty:1}],receiver:'DEMO'});
  assert.equal(dispense.status,201);assert.deepEqual(dispense.data.stockMovementIds,[]);
  const finalChart=await get(base,'/api/v1/encounters/'+encounterId+'/chart');
  assert.equal(finalChart.data.labReports[0].id,result.data.id);
  assert(finalChart.data.prescriptions.some(p=>p.id===rx.data.id && p.status==='dispensed'));
  const complete=await send(base,'/api/v1/encounters/'+encounterId+'/complete',
    {checklist:'complete',disposition:'home',summaryId:'DEMO'});
  assert.equal(complete.status,200);assert.equal(complete.data.status,'completed');
}));
test('unimplemented portal mutation does not generate false success',async()=>withServer(async base=>{
  const r=await send(base,'/api/v1/portal/me/appointments',
    {unitId,practitionerId:unitId,slotId:unitId,payer:'SELF_PAY'});
  assert.equal(r.status,501);assert.equal(r.data.code,'SCENARIO_NOT_IMPLEMENTED');
}));
