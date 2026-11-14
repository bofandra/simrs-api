import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const r=read('contracts/prd-v4/requirements.json'),a=read('contracts/prd-v4/operations.json');
assert.equal(r.baseline.version,'4.0');
for(const [k,n,id] of [['modules',22,'id'],['frs',84,'id'],['uss',76,'id'],['forms',97,'id'],['workflows',12,'id']]){
 assert.equal(r[k].length,n,k+' count');assert.equal(new Set(r[k].map(x=>x[id])).size,n,k+' unique');
}
assert.equal(a.operationIds.length,268);assert.equal(new Set(a.operationIds.map(x=>x.operationId)).size,268);
const ids=new Set(a.operationIds.map(x=>x.operationId));
const sources=[read('contracts/operations.json'),read('contracts/v3.1/expansions.json'),read('contracts/v3.2/hosnex-p0-overlay.json'),read('contracts/v3.3/p0-gap-operations.json'),read('contracts/v3.4/remaining-action-operations.json'),read('contracts/v3.5/partial-operations.json')];
const live=sources.flatMap(x=>x.operations);assert.equal(live.length,268);
for(const x of live){assert(ids.has(x.operationId),'PRD v4 operation missing '+x.operationId);const meta=a.operationIds.find(y=>y.operationId===x.operationId);assert.equal(meta.method,x.method.toUpperCase());assert.equal(meta.path,x.path);assert.equal(meta.module,x.module)}
const fids=new Set(r.frs.map(x=>x.id)),uids=new Set(r.uss.map(x=>x.id)),mods=new Set(r.modules.map(x=>x.id));
for(const row of r.forms){assert(mods.has(row.module),'invalid form module '+row.id);for(const f of row.relatedFRModuleCandidates)assert(fids.has(f),'unknown FR '+f);for(const u of row.relatedUSModuleCandidates)assert(uids.has(u),'unknown US '+u)}
for(const row of a.operationIds){assert(mods.has(row.module),'invalid API module '+row.operationId);assert.equal(row.contractStatus,'candidate');assert.equal(row.uat,'not-verified')}
console.log('PASS PRD v4 inventory: 22 modules, 84 FR, 76 US, 97 forms, 12 WF, 268 API candidates; no UAT implied.');
