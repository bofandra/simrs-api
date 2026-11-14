import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.5';
const {createMockServer}=await import('../mock-server.mjs');
const pat='d2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1';
const unit='25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
const at='2026-11-14T09:00:00+07:00';
async function withServer(fn){
 const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 try{await fn('http://127.0.0.1:'+server.address().port);}
 finally{server.close();await once(server,'close');}
}
test('M09 v3.5 saveLabResults is stateful only for draft/received synthetic LAB and respects versions',()=>withServer(async base=>{
 let seq=0;
 const request=async(method,path,body,options={})=>{
  const headers={'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001',
   'Idempotency-Key':options.idem||'lab-v35-e2e-'+(++seq),
   ...(options.version!==undefined?{'If-Match':String(options.version)}:{})};
  return fetch(base+path,{method,headers,body:JSON.stringify(body)});
 };
 const post=(path,body,options={})=>request('POST',path,body,options);
 const check=async(response,code,label)=>{assert.equal(response.status,code,label);return response.json();};
 const reg=await check(await post('/api/v1/registrations',{
   patientId:pat,serviceType:'RJ',unitId:unit,payer:{type:'SELF_PAY'}
 }),201,'registration');
 const note=await check(await post('/api/v1/clinical/notes',{
   encounterId:reg.encounterId,noteType:'SOAP',subjective:'Mock',
   objective:'Mock',assessment:'Mock',plan:'Mock'
 }),201,'note');
 await check(await post('/api/v1/clinical/notes/'+note.id+'/sign',{
   version:1,signatureContext:'DEMO',signReason:'QA'
 },{version:1}),200,'sign demo note');
 const order=await check(await post('/api/v1/orders',{
   encounterId:reg.encounterId,serviceCode:'HB',category:'LAB',
   urgency:'routine',indication:'QA only',targetUnitId:unit
 }),201,'LAB order');
 await check(await post('/api/v1/laboratory/orders/'+order.id+'/accept',{
   acceptedAt:at,expectedVersion:1
 },{version:1}),200,'accept LAB');
 const barcode='DEMO-M09-DRAFT-001';
 const specimen=await check(await post('/api/v1/laboratory/orders/'+order.id+'/specimens',{
   specimenType:{system:'https://example.invalid/specimens',code:'EDTA'},barcode
 }),201,'specimen');
 await check(await post('/api/v1/laboratory/specimens/'+specimen.id+'/collect',{
   barcode,collectedAt:at,collectorId:unit,expectedVersion:1
 },{version:1}),200,'collect specimen');
 await check(await post('/api/v1/laboratory/specimens/'+specimen.id+'/receive',{
   barcode,receivedAt:at,condition:'good',receiverId:unit
 }),200,'receive specimen');
 const draft=await check(await post('/api/v1/laboratory/orders/'+order.id+'/results',{
   observations:[{analyteCode:'718-7',value:13.4,unit:'g/dL'}],
   method:'DEMO',analyzerId:'SIM-ANALYZER'
 }),201,'create LAB draft');
 const savePath='/api/v1/laboratory/orders/'+order.id+'/result-drafts';
 const payload={expectedVersion:1,reason:'QA koreksi hasil',serviceCode:'HB',
   values:{'718-7':'13.8'},note:'Hanya hasil sintetis'};
 let response=await request('PATCH',savePath,{...payload,expectedVersion:0});
 assert.equal(response.status,412,'reject stale result version');
 response=await request('PATCH',savePath,{...payload,values:{'OTHER':'13.8'}});
 assert.equal(response.status,422,'reject unknown analyte');
 response=await request('PATCH',savePath,{...payload,values:{'718-7':'infinite'}});
 assert.equal(response.status,422,'reject nonnumeric');
 response=await request('PATCH',savePath,{...payload,serviceCode:'WRONG'});
 assert.equal(response.status,422,'reject mismatched service code');
 response=await request('PATCH',savePath,payload,{idem:'lab-draft-save-001'});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('X-SIMRS-State-Persisted'),'false');
 const saved=await response.json();
 assert.deepEqual({operationId:saved.operationId,targetId:saved.targetId,status:saved.status,version:saved.version},
  {operationId:'saveLabResults',targetId:order.id,status:'lab-results-draft-preview',version:2});
 assert.equal(saved.mock,true);assert.equal(saved.persisted,false);
 response=await request('PATCH',savePath,payload,{idem:'lab-draft-save-001'});
 assert.equal(response.status,200);assert.equal(response.headers.get('X-Idempotent-Replay'),'true');
 response=await request('PATCH',savePath,{...payload,note:'Different'}, {idem:'lab-draft-save-001'});
 assert.equal(response.status,409);
 const reportPath='/api/v1/laboratory/reports/'+draft.id;
 let report=await check(await fetch(base+reportPath,{headers:{'X-Organization-Id':'DEMO-RS-001'}}),200,'read draft');
 assert.equal(report.version,2);assert.equal(report.status,'draft');
 assert.equal(report.results.find(x=>x.analyteCode==='718-7')?.value,13.8);
 response=await post(reportPath+'/verify',{resultVersion:1,verifier:'DEMO-ATLM'},{version:1});
 assert.equal(response.status,412,'verification must use latest result version');
 await check(await post(reportPath+'/verify',{resultVersion:2,verifier:'DEMO-ATLM'},{version:2}),200,'verify updated draft');
 response=await request('PATCH',savePath,{...payload,expectedVersion:2});
 assert.equal(response.status,409,'verified LAB report immutable');
 await check(await post(reportPath+'/release',{expectedVersion:2},{version:2}),200,'release updated LAB');
 report=await check(await fetch(base+reportPath,{headers:{'X-Organization-Id':'DEMO-RS-001'}}),200,'read released');
 assert.equal(report.status,'released');assert.equal(report.version,2);
 assert.equal(report.results.find(x=>x.analyteCode==='718-7')?.value,13.8);
}));
