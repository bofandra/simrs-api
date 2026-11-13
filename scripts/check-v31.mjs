import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const load=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const base=load('openapi.json');
const spec=load('openapi-v3.1.json');
const legacy=load('contracts/operations.json').operations;
const added=load('contracts/v3.1/expansions.json').operations;
const domain=load('contracts/v3.1/domain-schemas.json').schemas;
const states=load('contracts/v3.1/state-machines.json').stateMachines;
const work=load('contracts/v3.1/workflows.json').workflows;
const trace=load('contracts/v3.1/traceability.json').operations;
const http=['get','post','patch','put','delete'];
const readOps=s=>Object.entries(s.paths).flatMap(([path,verbs])=>Object.entries(verbs)
  .filter(([verb])=>http.includes(verb)).map(([verb,operation])=>({path,verb,...operation})));
const ops=readOps(spec);
const opmap=new Map(ops.map(o=>[o.operationId,o]));
function resolve(ref){
  const key=ref.$ref?.split('/').at(-1);
  const result=spec.components.schemas[key];
  assert(result,'Unresolved reference: '+ref.$ref);
  return result;
}
function validate(s,data,path='$',depth=0){
  assert(depth<20,'Schema nesting too deep '+path);
  if(!s)return;
  if(s.$ref)return validate(resolve(s),data,path,depth+1);
  if(s.enum)assert(s.enum.includes(data),'Invalid enum at '+path+': '+JSON.stringify(data));
  if(Array.isArray(s.type)){assert(s.type.some(t=>t==='null'&&data===null||t==='string'&&typeof data==='string'), 'Invalid union at '+path);return}
  if(s.type==='object'){
    assert(data!==null&&typeof data==='object'&&!Array.isArray(data),'Object expected at '+path);
    for(const k of s.required||[])assert(data[k]!==undefined&&data[k]!==null,'Missing '+path+'.'+k);
    for(const [k,v] of Object.entries(s.properties||{}))if(data[k]!==undefined)validate(v,data[k],path+'.'+k,depth+1);
  }else if(s.type==='array'){assert(Array.isArray(data),'Array expected at '+path);for(let i=0;i<data.length;i++)validate(s.items,data[i],path+'['+i+']',depth+1)}
  else if(s.type==='integer')assert(Number.isInteger(data),'Integer expected at '+path);
  else if(s.type==='number')assert(typeof data==='number','Number expected at '+path);
  else if(s.type==='boolean')assert(typeof data==='boolean','Boolean expected at '+path);
  else if(s.type==='string'){assert(typeof data==='string','String expected at '+path);if(s.format==='uuid')assert(/^[a-f0-9-]{36}$/i.test(data),'UUID expected at '+path);if(s.minLength)assert(data.length>=s.minLength,'Minimum length at '+path)}
}
assert.equal(spec.openapi,'3.1.0');
assert.equal(spec.info.version,'3.1.0-candidate.1');
assert.equal(ops.length,178);
assert.equal(new Set(ops.map(o=>o.operationId)).size,178);
assert.equal(legacy.length,106);
assert.equal(added.length,72);
assert.equal(Object.keys(domain).length,47);
assert.equal(trace.length,178);
assert.equal(states.length,11);
assert.equal(work.length,12);
for(const original of legacy){
 const present=opmap.get(original.operationId);
 assert(present,'Missing original '+original.operationId);
 assert.equal(present.path,original.path);
 assert.equal(present.verb,original.method.toLowerCase());
}
for(const entry of added){
 const op=opmap.get(entry.operationId);
 assert(op,'Missing new '+entry.operationId);
 assert.equal(op.path,entry.path);
 assert.equal(op.verb,entry.method.toLowerCase());
 assert.equal(op['x-contract-status'],'proposed-v3.1; FE/BE and clinical review required');
 assert.deepEqual(op['x-forms'],entry.forms);
 assert.deepEqual(op['x-fr'],entry.fr);
 const responseStatus=Object.keys(op.responses).find(k=>/^2\d\d$/.test(k));
 assert(responseStatus,'Success response missing '+entry.operationId);
 const payload=op.responses[responseStatus].content['application/json'];
 assert(payload?.schema&&payload?.example!==undefined,'Success response schema/example missing '+entry.operationId);
 validate(payload.schema,payload.example,'response:'+entry.operationId);
 for(const status of ['400','401','403','404','409','422','429','500','503'])assert(op.responses[status],status+' missing '+entry.operationId);
 if(op.verb==='patch'||op.verb==='post'){
   const content=op.requestBody?.content?.['application/json'];
   assert(content?.schema&&content?.example!==undefined,'Request schema/example missing '+entry.operationId);
   validate(content.schema,content.example,'request:'+entry.operationId);
   assert(op.parameters.some(p=>p.$ref?.includes('IdempotencyKey')),'Idempotency missing '+entry.operationId);
 }
 if(op.verb==='get'&&op.parameters.some(p=>p.name==='cursor')){
   assert(payload.schema.properties?.items&&payload.schema.properties?.pageInfo,'Pagination envelope missing '+entry.operationId);
 }
}
for(const row of trace)assert(opmap.has(row.operationId),'Missing traced operation '+row.operationId);
for(const s of states){
 for(const t of s.transitions){assert(opmap.has(t.operationId),'Unknown transition operation '+t.operationId);assert(s.states.includes(t.from)&&s.states.includes(t.to),'Invalid machine state in '+s.resource)}
}
for(const wf of work)for(const step of wf.steps)assert(opmap.has(step),'Workflow references absent operation '+wf.workflowId+' -> '+step);
for(const row of ops) {
 const success=Object.keys(row.responses).find(k=>/^2/.test(k));
 assert(success,'Success response not specified for '+row.operationId);
 assert(row['x-permission'],'Permission missing '+row.operationId);
 assert(Array.isArray(row['x-fr'])&&Array.isArray(row['x-us'])&&Array.isArray(row['x-forms'])&&Array.isArray(row['x-workflows']),'Traceability metadata missing '+row.operationId);
}
const uniqueStatus=new Map(ops.filter(o=>o.tags.includes('M09')||o.tags.includes('M11')).map(o=>[o.operationId,Object.keys(o.responses).find(c=>/^2/.test(c))]));
assert(uniqueStatus.has('releaseLabReport'));
assert.equal(opmap.get('verifyLabReport').responses['200'].content['application/json'].example.status,'verified');
assert.equal(opmap.get('createServiceOrder').responses['201'].content['application/json'].example.status,'placed');
assert.equal(opmap.get('signClinicalNote').responses['200'].content['application/json'].example.status,'signed');
assert.equal(opmap.get('dispensePrescription').responses['201'].content['application/json'].example.status,'dispensed');
console.log('PASS: 178 operations (106 original preserved + 72 proposed), 47 typed domain schemas, 11 state machines, 12 traceability workflows.');
console.log('PASS: request/response schema examples, permission/error/pagination contracts, core lifecycle status expectations.');
