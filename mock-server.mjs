/**
 * SIMRS v3.0 SYNTHETIC MOCK ONLY. No production integration, no persistent PHI.
 * Uses Node 20+ core APIs; safe for contract development, never for real users.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(HERE, 'openapi.json'), 'utf8'));
const operations = Object.entries(spec.paths).flatMap(([template, verbs]) =>
  Object.entries(verbs).filter(([verb]) => ['get', 'post', 'put', 'patch', 'delete'].includes(verb))
    .map(([verb, detail]) => ({ template, verb: verb.toUpperCase(), detail,
      pattern: new RegExp('^' + template.replace(/\{[^}]+\}/g, '[^/]+') + '$') })));
const defaultOrg = 'DEMO-RS-001';
const patientId = 'd2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1';
const encounterId = '85ba4e38-9d86-41ce-9b6e-7f8af4d19768';
const unitId = '25d6f4b1-f3ad-48c6-919f-409fb68e0d0c';
const clone = x => JSON.parse(JSON.stringify(x));
const state = () => ({
  patients: [{ patientId, mrn: 'DEMO-MRN-001', name: 'Pasien Simulasi A',
    fullName: 'Pasien Simulasi A', matchScore: 1, identifiers: [{ system: 'MRN', value: 'DEMO-MRN-001' }] }],
  registrations: [], notes: [], orders: [], labResults: [], prescriptions: [],
  charges: [], payments: [], encounters: [{ id: encounterId, patientId, status: 'in-progress', unitId }],
  idempotency: new Map()
});
function json(res, status, value, correlationId, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-SIMRS-Mock': 'true',
    'X-Correlation-ID': correlationId,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'X-SIMRS-Mock, X-Correlation-ID',
    ...extra
  });
  res.end(JSON.stringify(value, null, 2));
}
function problem(code, message, correlationId, details = [], retryable = false) {
  return { code, message, details, correlationId, retryable };
}
function resolveSchema(schema) {
  if (!schema) return {};
  if (schema.$ref) return spec.components.schemas[schema.$ref.split('/').at(-1)] || {};
  return schema;
}
function validate(schema, value, path = '$') {
  schema = resolveSchema(schema);
  const errors = [];
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return [{ field: path, reason: 'OBJECT_REQUIRED' }];
    for (const name of schema.required || [])
      if (value[name] === undefined || value[name] === null || value[name] === '')
        errors.push({ field: path + '.' + name, reason: 'REQUIRED' });
    for (const [name, sub] of Object.entries(schema.properties || {}))
      if (value[name] !== undefined && value[name] !== null)
        errors.push(...validate(sub, value[name], path + '.' + name));
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return [{ field: path, reason: 'ARRAY_REQUIRED' }];
    if (schema.minItems && value.length < schema.minItems)
      errors.push({ field: path, reason: 'MIN_ITEMS' });
    for (let i = 0; i < value.length; i++) errors.push(...validate(schema.items, value[i], path + '[' + i + ']'));
  } else if (schema.type === 'integer' && !Number.isInteger(value)) {
    errors.push({ field: path, reason: 'INTEGER_REQUIRED' });
  } else if (schema.type === 'number' && typeof value !== 'number') {
    errors.push({ field: path, reason: 'NUMBER_REQUIRED' });
  } else if (schema.type === 'string' && typeof value !== 'string') {
    errors.push({ field: path, reason: 'STRING_REQUIRED' });
  } else if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ field: path, reason: 'ENUM_INVALID' });
  }
  if (schema.enum && !schema.enum.includes(value) && !errors.some(e => e.field === path))
    errors.push({ field: path, reason: 'ENUM_INVALID' });
  return errors;
}
function pathId(url) {
  const segments = url.pathname.split('/');
  return segments.at(-1) || '';
}
function successResponse(detail) {
  const code = Object.keys(detail.responses).find(k => /^2\d\d$/.test(k));
  const schema = detail.responses[code]?.content?.['application/json'];
  return { status: Number(code), sample: clone(schema?.example ?? {}) };
}
function applyScenario(operationId, body, output, db, requestPath) {
  const id = randomUUID();
  switch (operationId) {
    case 'searchPatients':
      return db.patients.map(p => ({ patientId: p.patientId, matchScore: p.matchScore || 1,
        identifiers: p.identifiers, fullName: p.fullName, mrn: p.mrn }));
    case 'createPatient': {
      const patient = { patientId: id, mrn: 'DEMO-MRN-' + String(db.patients.length + 1).padStart(3, '0'),
        name: body.name, fullName: body.name, matchScore: 1, identifiers: body.identifiers || [] };
      db.patients.push(patient);
      return { patientId: id, mrn: patient.mrn, possibleMatches: [] };
    }
    case 'listOutpatientWorklist':
      return db.encounters.map(e => ({ id: e.id, encounterId: e.id, patientId: e.patientId,
        patientName: 'Pasien Simulasi A', status: e.status, unitId: e.unitId }));
    case 'getEncounterChart': {
      const idFromPath = requestPath.split('/')[4];
      const e = db.encounters.find(x => x.id === idFromPath);
      if (!e) return null;
      return { encounter: { id: e.id, status: e.status, class: 'outpatient', period: {},
          unitVisits: [{ unitId: e.unitId, status: 'active' }] },
        patient: { id: e.patientId, mrn: 'DEMO-MRN-001', fullName: 'Pasien Simulasi A',
          allergies: [], risks: [] },
        notes: db.notes.filter(n => n.encounterId === e.id),
        observations: [], diagnoses: [], orders: db.orders.filter(o => o.encounterId === e.id),
        prescriptions: db.prescriptions.filter(p => p.encounterId === e.id), careTeam: [] };
    }
    case 'createRegistration': {
      const encounter = { id: randomUUID(), patientId: body.patientId, status: 'arrived',
        unitId: body.unitId };
      db.encounters.push(encounter);
      const reg = { registrationId: id, encounterId: encounter.id, queueTicketId: randomUUID(),
        status: 'ACTIVE' };
      db.registrations.push(reg);
      return reg;
    }
    case 'createClinicalNote': {
      const note = { id, encounterId: body.encounterId, noteType: body.noteType,
        subjective: body.subjective, objective: body.objective,
        assessment: body.assessment, plan: body.plan, status: 'draft', version: 1 };
      db.notes.push(note);
      return { id, status: 'draft', version: 1 };
    }
    case 'signClinicalNote': {
      const noteId = requestPath.split('/')[5];
      const note = db.notes.find(n => n.id === noteId);
      if (!note) return { __error: [404, 'NOTE_NOT_FOUND', 'Catatan demo tidak ditemukan'] };
      if (note.status !== 'draft') return { __error: [409, 'NOTE_ALREADY_SIGNED', 'Dokumen demo sudah signed'] };
      note.status = 'signed';
      return { id: noteId, status: 'signed', signedAt: new Date().toISOString() };
    }
    case 'createServiceOrder': {
      const order = { id, encounterId: body.encounterId,
        category: body.category || 'LAB', serviceCode: body.serviceCode, status: 'placed' };
      db.orders.push(order);
      return { id, status: 'placed' };
    }
    case 'listLabOrders':
      return db.orders.filter(o => o.category === 'LAB').map(o => ({ id: o.id,
        orderId: o.id, encounterId: o.encounterId, status: o.status, serviceCode: o.serviceCode }));
    case 'submitLabResults': {
      const result = { id, orderId: requestPath.split('/')[5], status: 'draft',
        observations: body.observations || [] };
      db.labResults.push(result);
      return { id, status: 'draft' };
    }
    case 'verifyLabReport': {
      const reportId = requestPath.split('/')[5];
      const result = db.labResults.find(r => r.id === reportId);
      if (!result) return { __error: [404, 'REPORT_NOT_FOUND', 'Hasil demo tidak ditemukan'] };
      if (result.status === 'verified') return { __error: [409, 'REPORT_ALREADY_VERIFIED', 'Sudah diverifikasi dalam demo'] };
      result.status = 'verified';
      return { id: result.id, status: 'verified' };
    }
    case 'createPrescription': {
      db.prescriptions.push({ id, encounterId: body.encounterId, status: 'ordered',
        items: body.items || [] });
      return { id, status: 'ordered' };
    }
    case 'createCharge': {
      db.charges.push({ id, encounterId: body.encounterId,
        sourceEventId: body.sourceEventId, status: 'draft' });
      return { id, amount: 0, status: 'draft' };
    }
    case 'allocatePayment': {
      db.payments.push({ id, invoiceId: body.invoiceId, amount: body.amount || body.amountMinorUnits,
        status: 'simulated' });
      return { id, allocatedAmount: 0, status: 'simulated' };
    }
    case 'completeOutpatientEncounter': {
      const target = requestPath.split('/')[4];
      const encounter = db.encounters.find(x => x.id === target);
      if (!encounter) return { __error: [404, 'ENCOUNTER_NOT_FOUND', 'Encounter demo tidak ditemukan'] };
      if (!db.notes.some(n => n.encounterId === target && n.status === 'signed'))
        return { __error: [422, 'MISSING_SIGNED_NOTE', 'Resume/CPPT belum signed (simulasi)'] };
      if (encounter.status === 'completed') return { __error: [409, 'ALREADY_COMPLETED', 'Encounter demo sudah selesai'] };
      encounter.status = 'completed';
      return { id: target, status: 'completed', completedAt: new Date().toISOString() };
    }
    default:
      return output;
  }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 65536) { reject(new Error('PAYLOAD_TOO_LARGE')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('INVALID_JSON')); } });
    req.on('error', reject);
  });
}
export function createMockServer() {
  const db = state();
  return createServer(async (req, res) => {
    const correlationId = /^[a-zA-Z0-9-]{8,128}$/.test(String(req.headers['x-correlation-id'] || ''))
      ? req.headers['x-correlation-id'] : randomUUID();
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, If-Match, X-Correlation-ID, X-Organization-Id, X-Demo-Scenario',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'X-SIMRS-Mock': 'true' });
      res.end(); return;
    }
    if (url.pathname === '/healthz') {
      return json(res, 200, { service: 'simrs-api', mode: 'synthetic-mock',
        operations: operations.length, status: 'ok' }, correlationId);
    }
    if (url.pathname === '/openapi.json' || url.pathname === '/contracts/operations.json') {
      return json(res, 200, url.pathname === '/openapi.json' ? spec :
        JSON.parse(readFileSync(join(HERE, 'contracts/operations.json'), 'utf8')), correlationId);
    }
    if (url.pathname === '/' || url.pathname === '/docs' || url.pathname === '/docs/') {
      const html = readFileSync(join(HERE, 'docs/index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html.replace('src="../openapi.json"', 'src="/openapi.json"')); return;
    }
    const operation = operations.find(o => o.verb === req.method && o.pattern.test(url.pathname));
    if (!operation) return json(res, 404, problem('NOT_FOUND', 'Endpoint demo tidak ditemukan', correlationId), correlationId);
    if (req.headers['x-organization-id'] && req.headers['x-organization-id'] !== defaultOrg)
      return json(res, 403, problem('TENANT_SCOPE_DENIED', 'Scope organisasi demo tidak cocok', correlationId), correlationId);
    const scenario = req.headers['x-demo-scenario'];
    const forced = { forbidden: 403, conflict: 409, invalid: 422, error: 500 }[scenario];
    if (forced) return json(res, forced, problem('DEMO_' + String(scenario).toUpperCase(),
      'Forced synthetic scenario: ' + scenario, correlationId), correlationId);
    let body = {};
    if (req.method !== 'GET') {
      const key = req.headers['idempotency-key'];
      if (!key || String(key).length < 8) return json(res, 400,
        problem('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key minimal 8 karakter', correlationId), correlationId);
      if (operation.detail.parameters.some(p => p.$ref?.endsWith('/IfMatch')) &&
          !['1', '"1"'].includes(req.headers['if-match']))
        return json(res, 412, problem('STALE_VERSION', 'If-Match demo harus 1 atau "1"', correlationId), correlationId);
      try { body = await readBody(req); }
      catch (err) return json(res, 400,
        problem('INVALID_BODY', 'JSON tidak valid atau terlalu besar', correlationId), correlationId);
      const dto = operation.detail.requestBody?.content?.['application/json']?.schema;
      const fieldErrors = validate(dto, body);
      if (fieldErrors.length) return json(res, 422,
        problem('VALIDATION_ERROR', 'Field kontrak tidak valid (simulasi)', correlationId, fieldErrors), correlationId);
      const dedupeKey = req.method + ':' + url.pathname + ':' + key;
      const previous = db.idempotency.get(dedupeKey);
      if (previous) {
        if (previous.payload !== JSON.stringify(body))
          return json(res, 409, problem('IDEMPOTENCY_REUSE_CONFLICT',
            'Kunci idempotensi sudah digunakan dengan payload berbeda', correlationId), correlationId);
        return json(res, previous.status, previous.result, correlationId, { 'X-Idempotent-Replay': 'true' });
      }
      const { status, sample } = successResponse(operation.detail);
      let result = applyScenario(operation.detail.operationId, body, sample, db, url.pathname);
      if (result?.__error) {
        const [code, errorCode, message] = result.__error;
        return json(res, code, problem(errorCode, message, correlationId), correlationId);
      }
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        if ('correlationId' in (sample || {})) result.correlationId = correlationId;
      }
      db.idempotency.set(dedupeKey, { payload: JSON.stringify(body), status, result });
      return json(res, status, result, correlationId);
    }
    const { status, sample } = successResponse(operation.detail);
    const result = applyScenario(operation.detail.operationId, {}, sample, db, url.pathname);
    if (result === null) return json(res, 404,
      problem('NOT_FOUND', 'Objek demo tidak ada dalam scope', correlationId), correlationId);
    return json(res, status, result, correlationId);
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4010);
  createMockServer().listen(port, '127.0.0.1', () =>
    console.log('SIMRS synthetic API mock: http://127.0.0.1:' + port + '/docs (106 operations)'));
}
