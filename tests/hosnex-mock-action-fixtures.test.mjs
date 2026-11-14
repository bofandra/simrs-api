import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMockServer } from '../mock-server.mjs';
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
