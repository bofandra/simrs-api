import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.1';
const {createMockServer}=await import('../mock-server.mjs');
const patientId='d2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1';
const encounterId='85ba4e38-9d86-41ce-9b6e-7f8af4d19768';
const unitId='25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
let sequence=0;
function opt(body,extras={}){
 return {method:'POST',headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001',
   'Idempotency-Key':'v31-test-'+String(++sequence).padStart(5,'0'),'If-Match':'1',...extras},body:JSON.stringify(body)};
}
async function withServer(fn){
 const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 try{await fn('http://127.0.0.1:'+server.address().port)}
 finally{server.close();await once(server,'close')}
}
async function request(url,opts){const r=await fetch(url,opts);return {status:r.status,data:await r.json(),mock:r.headers.get('X-SIMRS-Mock')}}
test('v3.1 has 178 HTTP mock operations and paginated read collections',async()=>withServer(async base=>{
 const health=await request(base+'/healthz');
 assert.equal(health.status,200);assert.equal(health.data.operations,178);
 assert.equal(health.data.mode,'synthetic-mock');
 const spec=await request(base+'/openapi.json');assert.equal(spec.data.info.version,'3.1.0-candidate.1');
 const patients=await request(base+'/api/v1/patients?q=demo');
 assert.equal(patients.status,200);assert(Array.isArray(patients.data.items));
 assert.equal(patients.data.pageInfo.hasMore,false);
 const patient=await request(base+'/api/v1/patients/'+patientId);
 assert.equal(patient.status,200);assert.equal(patient.data.mrn,'DEMO-MRN-001');
 assert.equal(patient.mock,'true');
}));
test('WF-05: order → accepted → specimen → collected → received → verified → released (demo)',async()=>withServer(async base=>{
 const order=await request(base+'/api/v1/orders',opt({encounterId,serviceCode:'HB',category:'LAB',urgency:'routine',indication:'Data sintetis',targetUnitId:unitId}));
 assert.equal(order.status,201);const orderId=order.data.id;
 const accept=await request(base+'/api/v1/laboratory/orders/'+orderId+'/accept',opt({acceptedAt:'2026-11-13T08:00:00+07:00',expectedVersion:1}));
 assert.equal(accept.status,200);
 const code={system:'https://example.invalid/specimens',code:'EDTA'};
 const specimen=await request(base+'/api/v1/laboratory/orders/'+orderId+'/specimens',opt({specimenType:code,barcode:'DEMO-SPEC-001'}));
 assert.equal(specimen.status,201);const specimenId=specimen.data.id;
 const badCollect=await request(base+'/api/v1/laboratory/specimens/'+specimenId+'/collect',opt({barcode:'WRONG',collectedAt:'2026-11-13T08:02:00+07:00',collectorId:unitId,expectedVersion:1}));
 assert.equal(badCollect.status,422);assert.equal(badCollect.data.code,'SPECIMEN_BARCODE_MISMATCH');
 const collect=await request(base+'/api/v1/laboratory/specimens/'+specimenId+'/collect',opt({barcode:'DEMO-SPEC-001',collectedAt:'2026-11-13T08:02:00+07:00',collectorId:unitId,expectedVersion:1}));
 assert.equal(collect.status,200);
 const recv=await request(base+'/api/v1/laboratory/specimens/'+specimenId+'/receive',opt({barcode:'DEMO-SPEC-001',receivedAt:'2026-11-13T08:03:00+07:00',condition:'good',receiverId:unitId}));
 assert.equal(recv.status,200);
 const result=await request(base+'/api/v1/laboratory/orders/'+orderId+'/results',opt({observations:[{analyteCode:'718-7',value:13.4,unit:'g/dL'}],method:'demo',analyzerId:'DEMO-ANALYZER'}));
 assert.equal(result.status,201);const reportId=result.data.id;
 const premature=await request(base+'/api/v1/laboratory/reports/'+reportId+'/release',opt({expectedVersion:1}));
 assert.equal(premature.status,422);assert.equal(premature.data.code,'REPORT_NOT_VERIFIED');
 const verify=await request(base+'/api/v1/laboratory/reports/'+reportId+'/verify',opt({resultVersion:1,verifier:'DEMO-VALIDATOR'}));
 assert.equal(verify.status,200);
 const release=await request(base+'/api/v1/laboratory/reports/'+reportId+'/release',opt({expectedVersion:1}));
 assert.equal(release.status,200);assert.equal(release.data.status,'released');
 const rerelease=await request(base+'/api/v1/laboratory/reports/'+reportId+'/release',opt({expectedVersion:1}));
 assert.equal(rerelease.status,422);
 const read=await request(base+'/api/v1/laboratory/reports/'+reportId);
 assert.equal(read.status,200);assert.equal(read.data.status,'released');
}));
test('WF-07: simulated dispensing requires pharmacist review; no real stock movements',async()=>withServer(async base=>{
 const rx=await request(base+'/api/v1/pharmacy/prescriptions',opt({encounterId,items:[{drugId:'DEMO-DRUG',dose:'1 tablet',route:'PO',frequency:'1x/day',duration:'3d'}],indication:'DEMO-ONLY'}));
 assert.equal(rx.status,201);const id=rx.data.id;
 const before=await request(base+'/api/v1/pharmacy/dispenses',opt({prescriptionId:id,items:[{lotId:'LOT-1',qty:1}],receiver:'SIMULASI'}));
 assert.equal(before.status,422);assert.equal(before.data.code,'PRESCRIPTION_REVIEW_REQUIRED');
 const review=await request(base+'/api/v1/pharmacy/prescriptions/'+id+'/review',opt({decision:'approved',clarification:'-',pharmacistId:unitId}));
 assert.equal(review.status,200);assert.equal(review.data.status,'reviewed');
 const dispense=await request(base+'/api/v1/pharmacy/dispenses',opt({prescriptionId:id,items:[{lotId:'LOT-1',qty:1}],receiver:'SIMULASI'}));
 assert.equal(dispense.status,201);assert.deepEqual(dispense.data.stockMovementIds,[]);
 const again=await request(base+'/api/v1/pharmacy/dispenses',opt({prescriptionId:id,items:[{lotId:'LOT-1',qty:1}],receiver:'SIMULASI'}));
 assert.equal(again.status,422);
 const list=await request(base+'/api/v1/pharmacy/dispenses');
 assert.equal(list.status,200);assert.equal(list.data.items.length,1);
}));
test('tenant mock scoping and forced negative scenarios',async()=>withServer(async base=>{
 const a=await request(base+'/api/v1/patients',{headers:{'X-Organization-Id':'OTHER-RS'}});
 assert.equal(a.status,403);
 const b=await request(base+'/api/v1/patients',{headers:{'X-Demo-Scenario':'forbidden'}});
 assert.equal(b.status,403);assert.equal(b.mock,'true');
 const c=await request(base+'/api/v1/clinical/notes/11111111-1111-4111-8111-111111111111',{method:'PATCH',
   headers:{'Content-Type':'application/json','Idempotency-Key':'v31-patch-001'},body:JSON.stringify({expectedVersion:1,subjective:'Demo'})});
 assert.equal(c.status,412);
}));
