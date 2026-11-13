import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('../openapi.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../contracts/operations.json',import.meta.url)));
assert.equal(spec.openapi,'3.1.0');
assert.equal(catalog.operations.length,106);
const found=Object.entries(spec.paths).flatMap(([path,verbs])=>Object.entries(verbs)
  .filter(([method])=>['get','post','put','patch','delete'].includes(method))
  .map(([method,operation])=>({path,method:method.toUpperCase(),...operation})));
assert.equal(found.length,106);
assert.equal(new Set(found.map(x=>x.operationId)).size,106);
for(const c of catalog.operations){
  const op=found.find(x=>x.operationId===c.operationId);
  assert(op,'Missing '+c.operationId);
  assert.equal(op.path,c.path); assert.equal(op.method,c.method);
  assert.equal(op['x-permission'],c.permission);
  assert(op.responses[String(c.successStatus)]);
  for(const status of [400,401,403,404,409,422,429,500])assert(op.responses[String(status)],'Missing '+status+' in '+c.operationId);
  if(op.method==='POST')assert(op.requestBody?.content?.['application/json']?.schema,'Missing DTO for '+c.operationId);
}
assert.equal(new Set(found.flatMap(x=>x.tags)).size,22);
console.log('PASS: 106 PRD v3.0 operations, 22 tags, operationId/method/path/permission/status/DTO checks');
