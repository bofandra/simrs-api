import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const backlog=read('contracts/v3.2/hosnex-p0-closure-backlog.json');
const original=read('contracts/hosnex-action-coverage.json');
const overlay=read('contracts/v3.2/hosnex-p0-overlay.json');
test('P0 unresolved requirements remain visible and are not claimed implemented',()=>{
 const p0=original.actions.filter(a=>a.priority==='P0');
 assert.equal(p0.length,65);
 assert.equal(backlog.totalP0Actions,65);
 assert.equal(backlog.composedCandidateOperations,199);
 assert.equal(backlog.proposedAdditions,overlay.operations.length);
 assert.equal(backlog.counts.existingCandidate+backlog.counts.existingPartial+
  backlog.counts.coveredByV32Proposal+backlog.counts.missingNoProposal,65);
 assert.equal(backlog.unmappedP0.length,15);
 assert.equal(backlog.proposalBacklinks.length,16);
 assert.equal(backlog.status,'REVIEW_BACKLOG_NOT_APPROVED');
 const overlayIds=new Set(overlay.operations.map(o=>o.operationId));
 for(const row of backlog.proposalBacklinks){
  assert(row.operationIds.every(id=>overlayIds.has(id)));
 }
 for(const row of backlog.unmappedP0){
  assert(p0.some(a=>a.frontendAction===row.action && a.status==='missing'));
  assert.equal(row.status,'NOT_IN_COMPOSED_OPENAPI');
  assert.equal(row.mustHave.length,5);
  assert(row.decision);
 }
 assert.equal(backlog.unmappedP0.filter(r=>r.decision==='delegate-to-patient-OIDC').length,2);
});
