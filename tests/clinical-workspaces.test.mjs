import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
const basePath='/__demo/clinical-workspaces';
const org='DEMO-RS-001';
async function withServer(fn){
  const server=createMockServer();
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
async function get(base,path){
  const r=await fetch(base+path,{headers:{'X-Organization-Id':org}});
  return {status:r.status,body:await r.json(),headers:r.headers};
}
async function post(base,module,id,action,version,key='demo-idempotency-001',scenario){
  const r=await fetch(base+basePath+'/'+module+'/'+id+'/actions/'+action,{
    method:'POST',headers:{'Content-Type':'application/json','X-Organization-Id':org,
      'Idempotency-Key':key,...(scenario?{'X-Demo-Scenario':scenario}:{})},
    body:JSON.stringify({expectedVersion:version})
  });
  return {status:r.status,body:await r.json(),headers:r.headers};
}
test('M03 -> M04 -> M06 shared demo episode has versioned transitions and no persistence',()=>withServer(async base=>{
  const catalog=await get(base,basePath);
  assert.equal(catalog.status,200);assert.equal(catalog.body.items.length,3);
  let ed=await get(base,basePath+'/M03'),ward=await get(base,basePath+'/M04'),nurse=await get(base,basePath+'/M06');
  assert.equal(ed.body.total,1);assert.equal(ward.body.total,0);assert.equal(nurse.body.total,0);
  assert.equal(ed.headers.get('x-simrs-demo-state'),'process-memory');
  assert.equal(ed.headers.get('x-simrs-state-persisted'),'false');
  const id=ed.body.items[0].id;
  assert.equal((await get(base,basePath+'/M04/'+id)).status,404);
  let key=0;
  for(const [module,action,status] of [
    ['M03','triage','triaged'],['M03','reassess','reassessed'],['M03','request-admission','admission-requested'],
    ['M04','reserve-bed','reserved'],['M04','admit-bed','admitted'],
    ['M06','assess','assessed'],['M06','handover','handed-over']
  ]){
    const before=await get(base,basePath+'/'+module);
    assert.equal(before.status,200);
    const current=before.body.items[0];
    assert(current, module+' must be unlocked');
    const response=await post(base,module,id,action,current.version,'demo-seq-'+(++key));
    assert.equal(response.status,200,action);
    assert.equal(response.body.record.status,status);
    assert.equal(response.body.record.version,current.version+1);
    assert.equal(response.body.realWorldEffect,false);
    assert.equal(response.body.persisted,false);
    assert.equal(response.body.stateScope,'process-memory');
    if(action==='triage'){
      const replay=await post(base,module,id,action,current.version,'demo-seq-'+key);
      assert.equal(replay.status,200);assert.equal(replay.body.idempotentReplay,true);
      const stale=await post(base,module,id,'reassess',current.version,'stale-version-1');
      assert.equal(stale.status,412);
    }
  }
  ward=await get(base,basePath+'/M04');nurse=await get(base,basePath+'/M06');
  assert.equal(ward.body.items[0].encounterId,id);
  assert.equal(nurse.body.items[0].encounterId,id);
  assert.equal(nurse.body.items[0].history.length,2);
  assert.deepEqual(nurse.body.items[0].actions,[]);
}));
test('mock denies other tenant, invalid module, wrong state and forced error',()=>withServer(async base=>{
  const tenant=await fetch(base+basePath+'/M03');
  assert.equal(tenant.status,403);
  const invalid=await get(base,basePath+'/M99');assert.equal(invalid.status,404);
  const first=await get(base,basePath+'/M03');const id=first.body.items[0].id;
  const wrong=await post(base,'M03',id,'request-admission',1,'wrong-transition');
  assert.equal(wrong.status,409);
  const malformed=await post(base,'M03',id,'triage',0,'bad-version');
  assert.equal(malformed.status,422);
  const err=await post(base,'M03',id,'triage',1,'forced-error','error');
  assert.equal(err.status,500);
  assert.equal((await get(base,basePath+'/M03')).body.items[0].status,'waiting');
  assert.equal((await get(base,'/healthz')).body.operations,200);
  assert.equal((await get(base,'/__mock/contract/operations')).body.total,200);
}));
