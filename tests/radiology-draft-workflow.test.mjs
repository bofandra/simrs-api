import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
const root='/__demo/radiology/orders';
let seq=0;
async function withServer(run){
  const server=createMockServer();server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{await run('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
async function req(base,path,method='GET',body,opts={}){
  const headers={
    'X-Organization-Id':opts.tenant??'DEMO-RS-001',
    ...(method==='GET'?{}:{'Content-Type':'application/json','Idempotency-Key':opts.key??'m10-'+(++seq)+'-unique'}),
    ...(opts.scenario?{'X-Demo-Scenario':opts.scenario}:{})
  };
  const res=await fetch(base+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:await res.json(),headers:res.headers};
}
const report={
  findings:'Temuan fiktif, bukan interpretasi dari gambar DICOM',
  impression:'Hanya laporan dummy untuk validasi form',
  recommendation:'Contoh rekomendasi QA',critical:false,
  communication:'',radiologist:'Radiolog DEMO'
};
test('M10 F-M10-01 and F-M10-02: schedule -> acquisition note -> report draft -> QA review',()=>
  withServer(async base=>{
    const items=(await req(base,root)).body.items;
    assert.equal(items.length,2);
    const id=items[0].id;
    const first=await req(base,root+'/'+id);
    assert.equal(first.body.version,1);
    assert.equal(first.body.cpoeLinked,false);
    assert.equal(first.body.studyReference,null);
    assert.equal(first.body.viewerAvailable,false);
    const blocked=await req(base,root+'/'+id+'/report','PATCH',{expectedVersion:1,report});
    assert.equal(blocked.status,409);
    const schedule={
      expectedVersion:1,technician:'Radiografer DEMO',
      scheduledAt:'2026-11-15T09:30:00+07:00',
      identityChecked:true,contraindicationChecked:true
    };
    const invalid=await req(base,root+'/'+id+'/schedule','PATCH',
      {...schedule,identityChecked:false});
    assert.equal(invalid.status,422);
    assert.equal(invalid.body.code,'SCHEDULE_VALIDATION_ERROR');
    const scheduled=await req(base,root+'/'+id+'/schedule','PATCH',schedule,
      {key:'radiology-schedule-unique-1000'});
    assert.equal(scheduled.status,200);
    assert.equal(scheduled.body.version,2);
    assert.equal(scheduled.body.status,'scheduled-demo');
    const retry=await req(base,root+'/'+id+'/schedule','PATCH',schedule,
      {key:'radiology-schedule-unique-1000'});
    assert.equal(retry.body.idempotentReplay,true);
    const changedRetry=await req(base,root+'/'+id+'/schedule','PATCH',
      {...schedule,technician:'DIFFERENT'},{key:'radiology-schedule-unique-1000'});
    assert.equal(changedRetry.status,409);
    const stale=await req(base,root+'/'+id+'/acquisition-note','PATCH',
      {expectedVersion:1,operator:'DEMO',identityChecked:true,acquisitionNote:'Demo acara'});
    assert.equal(stale.status,412);
    const noted=await req(base,root+'/'+id+'/acquisition-note','PATCH',{
      expectedVersion:2,operator:'Operator DEMO',identityChecked:true,
      acquisitionNote:'Catatan QC teknik simulasi tanpa gambar di PACS'
    });
    assert.equal(noted.status,200);
    assert.equal(noted.body.version,3);
    assert.equal(noted.body.status,'acquisition-note-demo');
    assert.equal(noted.body.dicomAcquired,false);
    assert.equal(noted.body.studyReference,null);
    const noCriticalCommunication=await req(base,root+'/'+id+'/report','PATCH',{
      expectedVersion:3,report:{...report,critical:true,communication:''}
    });
    assert.equal(noCriticalCommunication.status,422);
    assert.equal(noCriticalCommunication.body.code,'REPORT_VALIDATION_ERROR');
    const saved=await req(base,root+'/'+id+'/report','PATCH',{expectedVersion:3,report});
    assert.equal(saved.status,200);
    assert.equal(saved.body.version,4);
    assert.equal(saved.body.reportSaved,true);
    assert.equal(saved.body.signed,false);
    assert.equal(saved.body.published,false);
    assert.equal(saved.body.studyReference,null);
    const reviewed=await req(base,root+'/'+id+'/qa-review','POST',{
      expectedVersion:4,reviewer:'Reviewer QA',acknowledged:true
    });
    assert.equal(reviewed.status,200);
    assert.equal(reviewed.body.qaReviewed,true);
    assert.equal(reviewed.body.status,'qa-reviewed-demo');
    assert.equal(reviewed.body.version,5);
    assert.equal(reviewed.body.legalSignature,false);
    assert.equal(reviewed.body.history.length,4);
    const frozen=await req(base,root+'/'+id+'/report','PATCH',{expectedVersion:5,report});
    assert.equal(frozen.status,409);
    const readback=await req(base,root+'/'+id);
    assert.equal(readback.body.report.findings,report.findings);
    assert.equal(readback.body.persisted,false);
    assert.equal(readback.headers.get('X-SIMRS-State-Persisted'),'false');
    assert.equal(readback.headers.get('X-SIMRS-Mock'),'true');
    assert.equal((await req(base,'/healthz')).body.operations,200);
  }));
test('M10 WF-06 gaps remain explicit: no PACS/viewer/legal sign, tenant and errors',()=>
  withServer(async base=>{
    const id=(await req(base,root)).body.items[0].id;
    const wrongTenant=await req(base,root,'GET',undefined,{tenant:'NOT-DEMO'});
    assert.equal(wrongTenant.status,403);
    const failure=await req(base,root,'GET',undefined,{scenario:'error'});
    assert.equal(failure.status,500);
    const missing=await req(base,root+'/00000000-0000-4000-8000-000000000000');
    assert.equal(missing.status,404);
    const viewer=await req(base,root+'/'+id+'/viewer');
    assert.equal(viewer.status,501);
    assert.equal(viewer.body.code,'NO_REAL_DICOM_VIEWER');
    const sign=await req(base,root+'/'+id+'/sign','POST',{expectedVersion:1});
    assert.equal(sign.status,405);
    const study=await req(base,root+'/'+id+'/study','POST',{expectedVersion:1});
    assert.equal(study.status,405);
    const readOnly=await req(base,'/__demo/p0-read-models/M10','PATCH',{expectedVersion:1});
    assert.equal(readOnly.status,405);
    const state=await req(base,root+'/'+id);
    assert.equal(state.body.version,1,'All negative requests are side-effect free');
  }));
