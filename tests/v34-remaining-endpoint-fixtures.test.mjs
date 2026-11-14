import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
process.env.SIMRS_CONTRACT_VERSION='3.4';
const {createMockServer}=await import('../mock-server.mjs');
const overlay=JSON.parse(readFileSync(new URL('../contracts/v3.4/remaining-action-operations.json',import.meta.url),'utf8'));
const uid='11111111-1111-4111-8111-111111111111';
const extra={
 reviewSafetyIncident:{reviewDecision:'ACCEPT',reviewNote:'QA review'},
 addSafetyAction:{ownerId:uid,dueDate:'2026-11-14',actionDescription:'QA action'},
 completeSafetyAction:{completionNote:'QA completion'},
 publishSafetyMeasure:{reportingPeriod:'2026-11',numerator:2,denominator:5},
 updateStaffProfile:{changes:{displayName:'Petugas Demo'}},deactivateStaff:{effectiveDate:'2026-11-14'},
 reviewStaffCredential:{decision:'APPROVE'},revokeStaffCredential:{effectiveDate:'2026-11-14'},
 assessStaffCredentials:{credentialType:'STR',evidenceNote:'Dokumen dummy'},
 createAsset:{assetTag:'DEV-001',assetName:'Alat Demo',assetCategory:'Device',locationId:uid},
 updateAssetDetails:{changes:{assetName:'Device Dummy'}},
 reportAssetCondition:{conditionCode:'GOOD',observedAt:'2026-11-14T08:00:00+07:00'},
 scheduleAssetWork:{plannedAt:'2026-11-14T08:00:00+07:00',workType:'MAINTENANCE'},
 startAssetWork:{startedAt:'2026-11-14T08:00:00+07:00'},
 saveNutritionMenu:{mealType:'LUNCH',menuItems:['Nasi dummy']},
 transitionMeal:{targetState:'PREPARED'},relabelMeal:{labelCode:'DIET-A'},rejectMeal:{rejectionCode:'DAMAGED'},
 receiveBloodUnit:{unitCode:'DUMMY001',bloodType:'O+',expiresAt:'2026-12-14T08:00:00+07:00'},
 crossmatchBlood:{patientId:uid,requestId:uid,result:'COMPATIBLE'},
 issueBlood:{patientId:uid,requestId:uid,issuedUnits:1},
 monitorBlood:{observedAt:'2026-11-14T08:00:00+07:00',vitalSigns:{temperatureC:37,pulseBpm:80}},
 rescheduleSurgery:{scheduledAt:'2026-11-14T08:00:00+07:00'},
 readySurgery:{checklistComplete:true},saveSurgeryNote:{operativeNote:'Dummy operative note'},
 saveRadiologyResults:{findings:'Dummy findings',impression:'Dummy impression'},
 publishRadiology:{reviewerId:uid},reviseRadiology:{revisionReason:'Typo dummy',revisedText:'Revised mock report'}
};
test('v3.4 exposes 34 explicitly nonpersistent domain-shaped REST response fixtures',async()=>{
 const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/healthz');assert.equal((await r.json()).operations,247);
  for(const op of overlay.operations){
   const input={actorId:uid,expectedVersion:1,reason:'Simulasi QA tidak nyata',...(extra[op.operationId]||{})};
   r=await fetch(base+op.path.replace('{id}',uid),{method:op.method,headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001','Idempotency-Key':'v34-'+op.operationId},body:JSON.stringify(input)});
   assert.equal(r.status,op.successStatus,op.operationId);
   assert.equal(r.headers.get('x-simrs-state-persisted'),'false');
   const result=await r.json();
   assert.equal(result.operationId,op.operationId);assert.equal(result.mock,true);
   assert.equal(result.simulated,true);assert.equal(result.persisted,false);assert.equal(result.realWorldEffect,false);
   r=await fetch(base+'/__mock/contract/operations/'+op.operationId,{method:'POST',headers:{'X-Organization-Id':'DEMO-RS-001','Content-Type':'application/json'},body:'{}'});
   assert.equal(r.status,200);assert.equal((await r.json()).persisted,false);
  }
  const c=await fetch(base+'/__mock/contract/operations');assert.equal((await c.json()).total,247);
  r=await fetch(base+'/api/v1/quality/incidents/'+uid+'/close',{method:'POST',headers:{'X-Organization-Id':'DEMO-RS-001','Idempotency-Key':'invalid-v34','Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,422);
 }finally{server.close();await once(server,'close');}
});
