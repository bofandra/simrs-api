import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createDemoSessions, DemoProblem, forms, workflows } from '../demo/session.mjs';

process.env.SIMRS_CONTRACT_VERSION = '3.5';
const { createMockServer } = await import('../mock-server.mjs');
const valuesFor = step => Object.fromEntries(step.fields.map(field => [field.id, field.example ?? field.options?.[0] ?? true]));

for (const workflow of workflows) {
  test(workflow.id + ' simulates the complete sequence and validates prerequisites', () => {
    const store = createDemoSessions();
    const initial = store.start(workflow.id, 'admin', 'start-case-1');
    let current = initial;
    let index = 0;
    while (current.current) {
      const step = workflow.steps.find(item => item.id === current.current);
      const key = 'demo-command-' + ++index;
      const request = { actor: step.role, key, expectedVersion: current.version, values: valuesFor(step), correlationId: 'demo-test-123' };
      assert.equal(store.read(initial.id, step.workspace, step.role).patient.id, initial.patient.id);
      for (const failure of step.failure ?? []) {
        assert.throws(() => store.execute(initial.id, step.id, { ...request, values: { ...request.values, [failure.field]: failure.value } }),
          err => err instanceof DemoProblem && err.status === 409);
        assert.equal(store.read(initial.id, 'guide', 'admin').version, current.version);
      }
      current = store.execute(initial.id, step.id, request);
      assert.equal(current.episodeId, initial.episodeId);
      assert.equal(current.history.at(-1).command, step.id);
      assert.equal(current.version, request.expectedVersion + 1);
      assert.equal(store.execute(initial.id, step.id, request).replay, true);
      assert.ok(current.evidence.every(item => item.episodeId === initial.episodeId));
    }
    assert.equal(current.version, index + 1);
  });
}

test('workflow preserves rejected decisions while allowing correction and reroute', () => {
  const store = createDemoSessions();
  for (const [workflowId, command, change, recovery] of [
    ['WF-08', 'receive-claim-ack', { ack: 'Ditolak' }, 'correct-rejected-claim'],
    ['WF-09', 'accept-referral', { response: 'Ditolak' }, 'reroute-referral'],
  ]) {
    const workflow = workflows.find(item => item.id === workflowId);
    let state = store.start(workflowId, 'admin', 'start-' + workflowId);
    let found = false;
    while (state.current) {
      const step = workflow.steps.find(item => item.id === state.current);
      const values = { ...valuesFor(step), ...(step.id === command ? change : {}) };
      state = store.execute(state.id, step.id, { actor: step.role, key: 'id-' + step.id, expectedVersion: state.version, values });
      found ||= step.id === recovery;
    }
    assert.equal(found, true);
    assert.ok(state.history.some(event => event.command === recovery));
  }
});

test('all forms have an assigned audience and read model', () => {
  assert.equal(new Set(forms.map(form => form.id)).size, 97);
  const store = createDemoSessions();
  const { id } = store.start('forms', 'admin', 'start-forms-a');
  for (const form of forms) {
    const role = form.roles[0];
    const initial = store.read(id, form.module, role);
    const row = initial.forms.find(item => item.id === form.id);
    assert.ok(row, form.id);
    assert.equal(row.canWrite, !form.readOnly, form.id);
    assert.throws(() => store.read(id, form.module, 'unknown'), { status: 403 });
  }
});

test('HTTP sessions persist in Node, enforce command versions and isolate cases', async t => {
  const server = createMockServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port + '/__demo/sessions';
  const headers = { 'X-Organization-Id': 'DEMO-RS-001', 'X-Demo-Staff-Id': 'admission', 'Content-Type': 'application/json' };
  const create = async (workflowId, key) => fetch(base, { method: 'POST', headers: { ...headers, 'Idempotency-Key': key }, body: JSON.stringify({ workflowId }) });
  const response = await create('WF-01', 'start-appt-01');
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('X-SIMRS-Mock'), 'true');
  const initial = await response.json();
  const run = (path, body, extra = {}) => fetch(base + '/' + initial.id + '/commands/' + path, {
    method: 'POST', headers: { ...headers, 'If-Match': String(body.expectedVersion), 'Idempotency-Key': 'demo-action-1', ...extra },
    body: JSON.stringify(body),
  });
  const body = { expectedVersion: 1, values: { identified: true } };
  assert.equal((await run('find-patient', body, { 'X-Organization-Id': 'UNRELATED' })).status, 403);
  assert.equal((await run('find-patient', body, { 'X-Demo-Staff-Id': 'lab' })).status, 403);
  assert.equal((await run('book-appointment', body)).status, 409);
  assert.equal((await run('find-patient', { ...body, expectedVersion: 2 })).status, 412);
  assert.equal((await run('find-patient', body)).status, 200);
  assert.equal((await run('find-patient', body)).headers.get('X-Idempotent-Replay'), 'true');
  assert.equal((await run('find-patient', { ...body, values: { identified: false } })).status, 409);
  const read = await fetch(base + '/' + initial.id + '/workspaces/M01', { headers });
  const saved = await read.json();
  assert.equal(saved.current, 'book-appointment');
  assert.equal(saved.episodeId, initial.episodeId);
  assert.equal(saved.version, 2);
  const separate = await (await create('WF-01', 'start-appt-02')).json();
  assert.notEqual(separate.episodeId, initial.episodeId);
  assert.equal(separate.version, 1);
});

test('portal revocation blocks guardian content and does not leak identity in response', () => {
  const store = createDemoSessions();
  let state = store.start('forms', 'patient', 'start-portal');
  const run = (command, values) => store.execute(state.id, command, { actor: 'patient', key: 'demo-' + command, expectedVersion: state.version, values });
  assert.equal(store.read(state.id, 'CH01', 'guardian').patient.id, '');
  state = run('portal-grant', {});
  assert.equal(store.read(state.id, 'CH01', 'guardian').portal.documents.length, 1);
  state = run('portal-revoke', { reason: 'Berakhir' });
  const revoked = store.read(state.id, 'CH01', 'guardian');
  assert.equal(revoked.portal.authorized, false);
  assert.deepEqual(revoked.portal.documents, []);
  assert.equal(revoked.patient.id, '');
  assert.equal(revoked.forms.length, 0);
});
