import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
process.env.SIMRS_CONTRACT_VERSION='3.5';
const {createMockServer}=await import('../mock-server.mjs');
const overlay=JSON.parse(readFileSync(new URL('../contracts/v3.5/partial-operations.json',import.meta.url),'utf8'));
const placeholder='11111111-1111-4111-8111-111111111111';
function validField(schema,name){
 if(schema.const!==undefined)return schema.const;
 if(schema.enum?.length)return schema.enum[0];
 if(schema.type==='boolean')return true;
 if(schema.type==='integer'||schema.type==='number')return Math.max(schema.minimum??0,1);
 if(schema.type==='string')return schema.format==='date'?'2026-11-14':schema.format==='date-time'?'2026-11-14T08:00:00+07:00':schema.pattern?'2026-11':'DEMO-'+name;
 if(schema.type==='array')return [validField(schema.items,name)];
 if(schema.type==='object'){let obj={};for(const f of schema.required??[])obj[f]=validField(schema.properties[f],f);return obj;}
 return null;
}
test('v3.5 21 distinct HOSNEX partial action contracts have nonpersistent HTTP mock response and negative examples',async()=>{
 const server=createMockServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  let health=await fetch(origin+'/healthz');assert.equal((await health.json()).operations,268);
  for(const op of overlay.operations){
   const body={};for(const key of op.requestSchema.required)body[key]=validField(op.requestSchema.properties[key],key);
   const path=op.path.replace('{id}',placeholder).replace('{stage}','signIn');
   let res=await fetch(origin+path,{method:op.method,headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001','Idempotency-Key':'v35-'+op.operationId},body:JSON.stringify(body)});
   // setQueue now requires a real synthetic queue ticket created by M01, so arbitrary ID yields 404.
   // Other v3.5 operations remain review-only contract previews.
   assert.equal(res.status,op.operationId==='setQueue'?404:op.successStatus,op.operationId);
   if(op.operationId!=='setQueue'){
     assert.equal(res.headers.get('x-simrs-state-persisted'),'false',op.operationId);
     let dto=await res.json();assert.equal(dto.operationId,op.operationId);
     assert.equal(dto.mock,true);assert.equal(dto.persisted,false);assert.equal(dto.realWorldEffect,false);
   }
   let sample=await fetch(origin+'/__mock/contract/operations/'+op.operationId,{method:'POST',headers:{'X-Organization-Id':'DEMO-RS-001','Content-Type':'application/json'},body:'{}'});
   assert.equal(sample.status,200);assert.equal((await sample.json()).persisted,false);
  }
  let r=await fetch(origin+'/api/v1/portal/me/consent',{method:'PATCH',headers:{'Content-Type':'application/json','X-Organization-Id':'DEMO-RS-001','Idempotency-Key':'p35bad001'},body:'{}'});
  assert.equal(r.status,422);
  r=await fetch(origin+'/__mock/contract/operations');assert.equal((await r.json()).total,268);
 }finally{server.close();await once(server,'close');}
});
