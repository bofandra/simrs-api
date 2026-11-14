import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const {createMockServer}=await import('../mock-server.mjs');
const api='/__demo/p0-read-models';
const extra=['M07','M08','M10','M12','M15','M17','M18','M19','M20'];
async function withServer(fn){
  const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
async function request(base,path,init={}){
  const {headers:custom,...rest}=init;
  const response=await fetch(base+path,{
    ...rest,headers:{'X-Organization-Id':'DEMO-RS-001',...custom}
  });
  return {status:response.status,body:await response.json(),headers:response.headers};
}
test('all nine additional modules have domain-specific read-only detail and no mutations',()=>withServer(async base=>{
  const catalog=await request(base,api);
  assert.equal(catalog.status,200);
  assert.equal(catalog.body.modules.length,14);
  for(const module of extra){
    const list=await request(base,api+'/'+module);
    assert.equal(list.status,200,module);
    assert.equal(list.body.module,module);
    assert.equal(list.body.readOnly,true);
    assert.equal(list.body.persisted,false);
    assert.equal(list.body.realWorldEffect,false);
    assert.equal(list.body.stateScope,'process-memory');
    assert.equal(list.headers.get('X-SIMRS-Mock'),'true');
    assert.equal(list.headers.get('X-SIMRS-State-Persisted'),'false');
    assert.equal(list.headers.get('X-SIMRS-Demo-State'),'process-memory');
    assert(list.body.total>=2,module+' must have meaningful domain-specific examples');
    assert.equal(list.body.total,list.body.items.length);
    const ids=new Set();
    for(const item of list.body.items){
      assert.equal(item.module,module);
      assert.equal(item.readOnly,true);
      assert(!ids.has(item.id),'duplicate ID within module '+module);
      ids.add(item.id);
      const detail=await request(base,api+'/'+module+'/'+item.id);
      assert.equal(detail.status,200);
      assert.equal(detail.body.record.id,item.id);
      assert.equal(detail.body.record.module,module);
      assert.equal(detail.body.record.readOnly,true);
      assert(detail.body.record.fields.length>=3);
      assert(detail.body.record.checklist.length>=2);
    }
    const mutation=await request(base,api+'/'+module+'/'+list.body.items[0].id,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({synthetic:true})
    });
    assert.equal(mutation.status,405,module);
    assert.equal(mutation.body.code,'READ_ONLY_DEMO');
  }
  const specialties=await request(base,api+'/M08');
  assert.equal(specialties.body.total,6);
  const modality=await request(base,api+'/M10');
  assert(modality.body.items.some(x=>x.status==='report-unsigned'));
  const analytics=await request(base,api+'/M20');
  assert.equal(analytics.body.total,3);
  const wrong=await request(base,api+'/M20/00000007-0000-4000-8000-000000000001');
  assert.equal(wrong.status,404,'cross-module ID cannot be resolved');
  assert.equal((await request(base,'/healthz')).body.operations,200);
}));
test('mock analytics reflects clinical stage changes, never a real reporting pipeline',()=>withServer(async base=>{
  const first=(await request(base,api+'/M20')).body.items[0];
  const initial=(await request(base,api+'/M20/'+first.id)).body.record;
  assert.equal(initial.fields.find(x=>x.label==='Admisi bangsal').value,'0');
  const episode=(await request(base,'/__demo/clinical-workspaces/M03')).body.items[0].id;
  let n=0;
  for(const [module,action] of [
    ['M03','triage'],['M03','reassess'],['M03','request-admission'],
    ['M04','reserve-bed'],['M04','admit-bed'],
    ['M06','assess'],['M06','handover']
  ]){
    const data=(await request(base,'/__demo/clinical-workspaces/'+module)).body.items[0];
    const result=await request(base,
      '/__demo/clinical-workspaces/'+module+'/'+episode+'/actions/'+action,{
        method:'POST',headers:{'Content-Type':'application/json',
          'Idempotency-Key':'extended-domain-0000'+(++n)},
        body:JSON.stringify({expectedVersion:data.version})
      });
    assert.equal(result.status,200);
  }
  const after=(await request(base,api+'/M20/'+first.id)).body.record;
  assert.equal(after.fields.find(x=>x.label==='Admisi bangsal').value,'1');
  assert.equal(after.fields.find(x=>x.label==='Handover SBAR').value,'1');
  const qualityId=(await request(base,api+'/M19')).body.items[1].id;
  const quality=(await request(base,api+'/M19/'+qualityId)).body.record;
  assert.equal(quality.fields.find(x=>x.label==='Handover keperawatan').value,'Ya (simulasi)');
}));
test('safe 403/404/405/500 failure paths for extended modules',()=>withServer(async base=>{
  const noOrg=await request(base,api+'/M15',{headers:{'X-Organization-Id':'REAL-RS-01'}});
  assert.equal(noOrg.status,403);
  const fakeModule=await request(base,api+'/M22');assert.equal(fakeModule.status,404);
  const err=await request(base,api+'/M17',{headers:{'X-Demo-Scenario':'error'}});
  assert.equal(err.status,500);
  const denied=await request(base,api+'/M08',{method:'PATCH'});
  assert.equal(denied.status,405);
  const retry=await request(base,api+'/M17');
  assert.equal(retry.status,200);
  assert.equal(retry.body.items[0].status,'calibration-due');
}));
