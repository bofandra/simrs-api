import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
const root='/__demo/medical-records/episodes';
let counter=0;
const bodySummary={
  course:'Pasien demo mengalami gejala sintetis sejak pagi',
  diagnosis:'Diagnosis contoh hipertensi esensial I10',
  treatment:'Terapi observasi untuk pengujian saja',
  condition:'Kondisi akhir stabil dalam data dummy',
  followUp:'Rencana kontrol poliklinik contoh'
};
const bodyCoding={
  primary:'I10',secondary:['E78.5'],
  evidence:'Bukti simulasi tanpa rekam medis nyata',
  coder:'Coder QA'
};
async function withServer(fn){
  const server=createMockServer();server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
async function request(base,path,method='GET',body,opts={}){
  const headers={'X-Organization-Id':opts.tenant??'DEMO-RS-001',
    ...(method==='GET'?{}:{'Content-Type':'application/json',
      'Idempotency-Key':opts.key??'m05-test-'+String(++counter)}),
    ...(opts.scenario?{'X-Demo-Scenario':opts.scenario}:{})};
  const response=await fetch(base+path,{method,headers,
    ...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json(),headers:response.headers};
}
test('M05 complete draft -> coding -> QA review with shared IGD stage and no legal sign',()=>withServer(async base=>{
  const catalog=await request(base,root);
  assert.equal(catalog.status,200);
  assert.equal(catalog.body.items.length,1);
  const id=catalog.body.items[0].episodeId;
  const initial=await request(base,root+'/'+id);
  assert.equal(initial.body.version,1);
  assert.equal(initial.body.summarySaved,false);
  assert.equal(initial.body.legalSignature,false);
  assert.equal(initial.body.draftOnly,true);
  const premature=await request(base,root+'/'+id+'/coding','PATCH',{expectedVersion:1,coding:bodyCoding});
  assert.equal(premature.status,409);
  assert.equal(premature.body.code,'SUMMARY_DRAFT_REQUIRED');
  const saved=await request(base,root+'/'+id+'/summary','PATCH',{expectedVersion:1,summary:bodySummary},
    {key:'summary-save-unique-0001'});
  assert.equal(saved.status,200);
  assert.equal(saved.body.version,2);
  assert.equal(saved.body.summarySaved,true);
  assert.equal(saved.body.persisted,false);
  const retry=await request(base,root+'/'+id+'/summary','PATCH',{expectedVersion:1,summary:bodySummary},
    {key:'summary-save-unique-0001'});
  assert.equal(retry.status,200);
  assert.equal(retry.body.idempotentReplay,true);
  const changed=await request(base,root+'/'+id+'/summary','PATCH',{
    expectedVersion:1,summary:{...bodySummary,course:'Perjalanan diubah'}},
    {key:'summary-save-unique-0001'});
  assert.equal(changed.status,409);
  assert.equal(changed.body.code,'IDEMPOTENCY_REUSE_CONFLICT');
  const readList=await request(base,'/__demo/p0-read-models/M05');
  const readDetail=await request(base,'/__demo/p0-read-models/M05/'+readList.body.items[0].id);
  assert(readDetail.body.record.checklist.some(x=>x.label.includes('resume M05')&&x.done));
  const invalidCode=await request(base,root+'/'+id+'/coding','PATCH',{
    expectedVersion:2,coding:{...bodyCoding,primary:'INVALID-ICD'}});
  assert.equal(invalidCode.status,422);
  assert.equal(invalidCode.body.code,'CODING_VALIDATION_ERROR');
  const coding=await request(base,root+'/'+id+'/coding','PATCH',{expectedVersion:2,coding:bodyCoding});
  assert.equal(coding.status,200);
  assert.equal(coding.body.version,3);
  const reviewBlocked=await request(base,root+'/'+id+'/review','POST',{
    expectedVersion:3,reviewer:'Reviewer Demo',acknowledged:true});
  assert.equal(reviewBlocked.status,409);
  assert.equal(reviewBlocked.body.code,'TRIAGE_CONTEXT_REQUIRED');
  const triage=await request(base,'/__demo/clinical-workspaces/M03');
  const proceed=await request(base,'/__demo/clinical-workspaces/M03/'+id+'/actions/triage','POST',
    {expectedVersion:triage.body.items[0].version},{key:'medical-triage-0001'});
  assert.equal(proceed.status,200);
  const reviewed=await request(base,root+'/'+id+'/review','POST',{
    expectedVersion:3,reviewer:'Reviewer Demo',acknowledged:true});
  assert.equal(reviewed.status,200);
  assert.equal(reviewed.body.version,4);
  assert.equal(reviewed.body.reviewedDemo,true);
  assert.equal(reviewed.body.signed,false);
  assert.equal(reviewed.body.codingVerified,false);
  assert.equal(reviewed.body.exported,false);
  assert.equal(reviewed.body.history.length,3);
  const locked=await request(base,root+'/'+id+'/coding','PATCH',{expectedVersion:4,coding:bodyCoding});
  assert.equal(locked.status,409);
  assert.equal(locked.body.code,'REVIEWED_DRAFT_LOCKED');
  const persisted=await request(base,root+'/'+id);
  assert.equal(persisted.body.coding.primary,'I10');
  assert.equal(persisted.body.version,4);
  assert.equal(persisted.headers.get('X-SIMRS-Mock'),'true');
  assert.equal(persisted.headers.get('X-SIMRS-Demo-State'),'process-memory');
  assert.equal(persisted.headers.get('X-SIMRS-State-Persisted'),'false');
  assert.equal((await request(base,'/healthz')).body.operations,200);
}));
test('M05 validation, stale write, tenant, simulated failures and no fake legal signing',()=>withServer(async base=>{
  const id=(await request(base,root)).body.items[0].episodeId;
  const invalid=await request(base,root+'/'+id+'/summary','PATCH',{
    expectedVersion:1,summary:{...bodySummary,condition:''}});
  assert.equal(invalid.status,422);
  assert.equal(invalid.body.code,'SUMMARY_VALIDATION_ERROR');
  const saved=await request(base,root+'/'+id+'/summary','PATCH',{
    expectedVersion:1,summary:bodySummary});
  assert.equal(saved.status,200);
  const stale=await request(base,root+'/'+id+'/summary','PATCH',{
    expectedVersion:1,summary:bodySummary});
  assert.equal(stale.status,412);
  assert.equal(stale.body.code,'STALE_VERSION');
  const denied=await request(base,root,'GET',undefined,{tenant:'REAL-HOSPITAL'});
  assert.equal(denied.status,403);
  const failed=await request(base,root+'/'+id,'GET',undefined,{scenario:'error'});
  assert.equal(failed.status,500);
  const fakeSign=await request(base,root+'/'+id+'/sign','POST',{expectedVersion:2});
  assert.equal(fakeSign.status,405);
  const wrong=await request(base,root+'/00000000-0000-4000-8000-000000000000');
  assert.equal(wrong.status,404);
  const readOnly=await request(base,'/__demo/p0-read-models/M05','PATCH',{expectedVersion:2});
  assert.equal(readOnly.status,405);
}));
