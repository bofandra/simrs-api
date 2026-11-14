import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.SIMRS_CONTRACT_VERSION='3.2';
const { createMockServer } = await import('../mock-server.mjs');
import {actionCatalog,mockActionCoverage,simulateHosnexAction} from '../mock-hosnex-actions.mjs';

const withServer=async(run)=>{
  const server=createMockServer();
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await run('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
};

test('all 116 audited frontend actions have deterministic, clearly nonpersistent mock responses',()=>{
  assert.deepEqual(mockActionCoverage,{total:116,candidate:27,partial:29,missing:60});
  assert.equal(actionCatalog.length,116);
  assert.equal(new Set(actionCatalog.map(x=>x.action)).size,116);
  for(const action of actionCatalog){
    const result=simulateHosnexAction(action.action);
    assert(result);
    assert.equal(result.mock,true);
    assert.equal(result.simulated,true);
    assert.equal(result.persisted,false);
    assert.equal(result.realWorldEffect,false);
    assert.equal(result.action,action.action);
    assert.equal(result.module,action.module);
    assert(result.fixture.id);
    assert(result.fixture.status);
    assert.deepEqual(result,simulateHosnexAction(action.action),
      'same audited action must receive stable fixture data: '+action.action);
  }
  assert.equal(simulateHosnexAction('neverExists'),null);
});

test('mock-only endpoint provides catalog, fixtures and negative scenarios without state changes',()=>withServer(async base=>{
  const catalog=await fetch(base+'/__mock/hosnex/actions');
  assert.equal(catalog.status,200);
  assert.equal(catalog.headers.get('x-simrs-mock'),'true');
  assert.equal(catalog.headers.get('x-simrs-state-persisted'),'false');
  const before=await catalog.json();
  assert.equal(before.actions.length,116);
  const scoped=await fetch(base+'/__mock/hosnex/actions?module=M09');
  assert.equal((await scoped.json()).actions.length,8);
  const initialPatient=await fetch(base+'/api/v1/patients');
  const initialPatients=(await initialPatient.json()).items.length;
  for(const action of actionCatalog){
    const response=await fetch(base+'/__mock/hosnex/actions/'+encodeURIComponent(action.action),{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001'},
      body:JSON.stringify({synthetic:true})
    });
    assert.equal(response.status,200,action.action);
    assert.equal(response.headers.get('x-simrs-scenario'),'fixture');
    assert.equal(response.headers.get('x-simrs-state-persisted'),'false');
    const result=await response.json();
    assert.equal(result.action,action.action);
    assert.equal(result.realWorldEffect,false);
  }
  const afterPatient=await fetch(base+'/api/v1/patients');
  assert.equal((await afterPatient.json()).items.length,initialPatients,
    'fixture commands must never create real or even stateful demo patients');
  for(const [scenario,status] of Object.entries({forbidden:403,conflict:409,invalid:422,error:500})){
    const result=await fetch(base+'/__mock/hosnex/actions/register',{
      method:'POST',headers:{'Content-Type':'application/json',
        'X-Organization-Id':'DEMO-RS-001','X-Demo-Scenario':scenario},body:'{}'});
    assert.equal(result.status,status);
    assert.equal(result.headers.get('x-simrs-state-persisted'),'false');
    assert.match((await result.json()).code,/^MOCK_/);
  }
  const outsider=await fetch(base+'/__mock/hosnex/actions/register',{
    method:'POST',headers:{'Content-Type':'application/json','X-Organization-Id':'ANOTHER-RS'},body:'{}'});
  assert.equal(outsider.status,403);
  const unknown=await fetch(base+'/__mock/hosnex/actions/notARealAction',{
    method:'POST',headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001'},body:'{}'});
  assert.equal(unknown.status,404);
}));

test('all 200 candidate operationIds provide explicit stateless OpenAPI fixtures',()=>withServer(async base=>{
  const r=await fetch(base+'/__mock/contract/operations');
  assert.equal(r.status,200);
  assert.equal(r.headers.get('x-simrs-state-persisted'),'false');
  const catalog=await r.json();
  assert.equal(catalog.total,200);
  assert.equal(catalog.items.length,200);
  assert.equal(new Set(catalog.items.map(x=>x.operationId)).size,200);
  const lab=await fetch(base+'/__mock/contract/operations?module=M09');
  const labData=await lab.json();
  assert(labData.items.length>0);
  assert(labData.items.every(x=>x.module==='M09'));
  const before=await fetch(base+'/api/v1/patients');
  const patientCount=(await before.json()).items.length;
  for(const op of catalog.items){
    const response=await fetch(base+'/__mock/contract/operations/'+encodeURIComponent(op.operationId),{
      method:'POST',headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001'},
      body:'{"fixture":true}'
    });
    assert.equal(response.status,200,op.operationId);
    assert.equal(response.headers.get('x-simrs-state-persisted'),'false');
    const result=await response.json();
    assert.equal(result.operationId,op.operationId);
    assert.equal(result.mock,true);
    assert.equal(result.persisted,false);
    assert.equal(result.realWorldEffect,false);
    assert(result.fixture!==undefined,'Missing sample fixture '+op.operationId);
  }
  const after=await fetch(base+'/api/v1/patients');
  assert.equal((await after.json()).items.length,patientCount,
    '200 mock contract calls must never modify synthetic patient store');
  const bad=await fetch(base+'/__mock/contract/operations/createPatient',{
    method:'POST',headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001',
      'X-Demo-Scenario':'invalid'},body:'{}'});
  assert.equal(bad.status,422);
  assert.equal((await bad.json()).code,'MOCK_INVALID');
}));
