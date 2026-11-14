import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
const source='/__demo/p0-read-models';
const headers={'X-Organization-Id':'DEMO-RS-001'};
async function withServer(fn){
  const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
async function request(base,path,init={}){
  const {headers:extraHeaders,...rest}=init;
  const response=await fetch(base+path,{...rest,headers:{...headers,...extraHeaders}});
  return {status:response.status,body:await response.json(),headers:response.headers};
}
test('five P0 module read models serve list/detail, synthetic flags and no real operations',()=>withServer(async base=>{
  const modules=['M05','M13','M14','M16','M21'];
  const catalog=await request(base,source);
  assert.equal(catalog.status,200);
  assert.equal(catalog.body.modules.length,14);
  assert.deepEqual(catalog.body.modules.slice(0,5),modules);
  for(const module of modules){
    const list=await request(base,source+'/'+module);
    assert.equal(list.status,200,module);
    assert.equal(list.body.module,module);
    assert.equal(list.body.readOnly,true);
    assert.equal(list.body.persisted,false);
    assert.equal(list.body.realWorldEffect,false);
    assert.equal(list.headers.get('X-SIMRS-Mock'),'true');
    assert.equal(list.headers.get('X-SIMRS-Demo-State'),'process-memory');
    assert.equal(list.headers.get('X-SIMRS-State-Persisted'),'false');
    assert(list.body.total>=1);
    for(const item of list.body.items){
      const detail=await request(base,source+'/'+module+'/'+item.id);
      assert.equal(detail.status,200);
      assert.equal(detail.body.record.id,item.id);
      assert.equal(detail.body.record.readOnly,true);
      assert.equal(detail.body.record.fields.length>=3,true);
      assert.equal(detail.body.record.checklist.length>=2,true);
      assert.equal(detail.body.record.module,module);
    }
  }
  const invoice=await request(base,source+'/M13');
  assert.equal(invoice.body.items[0].status,'estimate-only');
  const claim=await request(base,source+'/M14');
  assert.equal(claim.body.items[0].status,'missing-supporting-documents');
  const inventory=await request(base,source+'/M16');
  assert.equal(inventory.body.items.length,2);
  const fhir=await request(base,source+'/M21');
  assert.equal(fhir.body.items[0].status,'never-submitted');
  assert.equal((await request(base,'/healthz')).body.operations,200);
}));
test('claim completeness follows simulated clinical states but never becomes submitted',()=>withServer(async base=>{
  const id=(await request(base,'/__demo/clinical-workspaces/M03')).body.items[0].id;
  let seq=0;
  async function move(module,action){
    const before=await request(base,'/__demo/clinical-workspaces/'+module);
    const version=before.body.items[0].version;
    const transition=await request(base,'/__demo/clinical-workspaces/'+module+'/'+id+'/actions/'+action,{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'p0-integrated-'+(++seq)},
      body:JSON.stringify({expectedVersion:version})
    });
    assert.equal(transition.status,200,action);
  }
  for(const [module,action] of [
    ['M03','triage'],['M03','reassess'],['M03','request-admission'],
    ['M04','reserve-bed'],['M04','admit-bed'],['M06','assess'],['M06','handover']
  ])await move(module,action);
  const claim=await request(base,source+'/M14');
  assert.equal(claim.body.items[0].status,'review-only');
  const detail=await request(base,source+'/M14/'+claim.body.items[0].id);
  assert.equal(detail.body.record.checklist.filter(c=>c.done).length,3);
  assert.equal(detail.body.record.checklist.at(-1).done,false);
  assert.equal(detail.body.record.fields.find(f=>f.label==='Status pengajuan').value.startsWith('Belum diajukan'),true);
}));
test('read models fail closed for mutation, wrong tenant, unknown routes and forced error',()=>withServer(async base=>{
  const one=await request(base,source+'/M16');
  const target=source+'/M16/'+one.body.items[0].id;
  assert.equal((await request(base,target,{method:'POST',
    headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
  assert.equal((await request(base,source+'/M99')).status,404);
  assert.equal((await request(base,source+'/M16/bad-record')).status,404);
  assert.equal((await request(base,source,{headers:{'X-Organization-Id':'OTHER'}})).status,403);
  assert.equal((await request(base,source+'/M05',{headers:{'X-Demo-Scenario':'error'}})).status,500);
  assert.equal((await request(base,source+'/M16')).body.items[0].status,'sample-stock-only');
}));
