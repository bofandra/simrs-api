import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const audit = read('contracts/hosnex-action-coverage.json');
const draft = read('contracts/v3.2/hosnex-p0-overlay.json');
const current = [...read('contracts/operations.json').operations, ...read('contracts/v3.1/expansions.json').operations];

test('all audited Hosnex actions are distinct and crosswalk uses known operations', () => {
  const names = audit.actions.map(a => a.frontendAction);
  assert.equal(names.length, 116);
  assert.equal(new Set(names).size, names.length);
  const statuses = ['candidate', 'partial', 'missing'];
  const ids = new Set(current.map(a => a.operationId));
  assert.equal(ids.size, 180);
  for (const a of audit.actions) {
    assert.match(a.frontendAction, /^[A-Za-z][A-Za-z0-9]*$/);
    assert.match(a.module, /^(M\d\d|CH01)$/);
    assert(statuses.includes(a.status));
    assert(a.note.length > 12);
    assert(a.existingOperationIds.every(id => ids.has(id)), a.frontendAction);
    assert.equal(a.status === 'missing', a.existingOperationIds.length === 0);
  }
  for (const status of statuses) {
    assert.equal(audit.counts[status], audit.actions.filter(a => a.status === status).length);
  }
  assert.equal(Object.values(audit.counts).reduce((a,b) => a+b,0),116);
});

test('P0 addendum is additive, typed, traceable, and explicitly not production', () => {
  assert.equal(draft.status,'PROPOSAL_ONLY');
  assert.equal(draft.info.version,'3.2.0-draft.0');
  assert.equal(draft.operations.length,19);
  const originalIds = new Set(current.map(o=>o.operationId));
  const routeMethod = new Set(current.map(o=>o.method+' '+o.path));
  const newIds = new Set();
  for(const op of draft.operations) {
    assert.equal(op.reviewRequired,true);
    assert(!originalIds.has(op.operationId),'duplicate operationId '+op.operationId);
    assert(!newIds.has(op.operationId),'duplicate overlay operationId '+op.operationId);
    newIds.add(op.operationId);
    assert(!routeMethod.has(op.method+' '+op.path), 'existing path/method conflict '+op.operationId);
    routeMethod.add(op.method+' '+op.path);
    assert(['GET','POST','PATCH'].includes(op.method));
    assert.match(op.path,/^\/api\/v1\//);
    assert(op.permission?.includes('.'));
    assert(op.frontendActions.length>0);
    assert(op.notes.length>=30);
    if(op.method==='GET')assert.equal(op.requestSchema,null);
    else assert(op.requestSchema?.required?.length>=1);
    for(const [name,schema] of Object.entries(op.responseSchema.properties || {})){
      if(op.responseSchema.required.includes(name))assert(op.responseExample[name]!==undefined,op.operationId+' response missing '+name);
      assert(schema.type||schema.$ref,op.operationId+': '+name);
    }
  }
  assert.equal(draft.amendments.length,5);
  assert(draft.amendments.every(a=>originalIds.has(a.operationId)));
});
