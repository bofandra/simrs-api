/**
 * SIMRS v3.0 SYNTHETIC MOCK ONLY. No production integration, no persistent PHI.
 * Uses Node 20+ core APIs; safe for contract development, never for real users.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildHosnexV32Spec } from './scripts/compose-hosnex-v32.mjs';
import { getMockActionCatalog, simulateHosnexAction, mockActionCoverage } from './mock-hosnex-actions.mjs';
import { createClinicalWorkspaceStore } from './mock-clinical-workspaces.mjs';
import { createP0ReadModels } from './mock-p0-read-models.mjs';
import { createMedicalDraftStore } from './mock-medical-drafts.mjs';
import { createRadiologyDemoStore } from './mock-radiology-demo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V35 = process.argv.includes('--v35') || process.env.SIMRS_CONTRACT_VERSION === '3.5';
const V34 = V35 || process.argv.includes('--v34') || process.env.SIMRS_CONTRACT_VERSION === '3.4';
const V33 = V34 || process.argv.includes('--v33') || process.env.SIMRS_CONTRACT_VERSION === '3.3';
const V32 = V33 || process.argv.includes('--v32') || process.env.SIMRS_CONTRACT_VERSION === '3.2';
const V31 = V32 || process.argv.includes('--v31') || process.env.SIMRS_CONTRACT_VERSION === '3.1';
const baselineSpec = JSON.parse(readFileSync(join(HERE, V31 ? 'openapi-v3.1.json' : 'openapi.json'), 'utf8'));
const v32Overlay = V32 ? JSON.parse(readFileSync(join(HERE,'contracts/v3.2/hosnex-p0-overlay.json'),'utf8')) : null;
const v33Overlay = V33 ? JSON.parse(readFileSync(join(HERE,'contracts/v3.3/p0-gap-operations.json'),'utf8')) : null;
const v32Spec = V32 ? buildHosnexV32Spec(baselineSpec,v32Overlay) : baselineSpec;
const v33Spec = V33 ? buildHosnexV32Spec(v32Spec,v33Overlay) : v32Spec;
const v34Overlay = V34 ? JSON.parse(readFileSync(join(HERE,'contracts/v3.4/remaining-action-operations.json'),'utf8')) : null;
const v34Spec = V34 ? buildHosnexV32Spec(v33Spec,v34Overlay) : v33Spec;
const v35Overlay = V35 ? JSON.parse(readFileSync(join(HERE,'contracts/v3.5/partial-operations.json'),'utf8')) : null;
const spec = V35 ? buildHosnexV32Spec(v34Spec,v35Overlay) : v34Spec;
const v35Operations = new Set(v35Overlay?.operations.map(x=>x.operationId) ?? []);
const v33Operations = new Set(v33Overlay?.operations.map(x=>x.operationId) ?? []);
const v34Operations = new Set(v34Overlay?.operations.map(x=>x.operationId) ?? []);
const overlayOperations = new Set([...(v32Overlay?.operations.map(x=>x.operationId) ?? []),...v33Operations,...v34Operations,...v35Operations]);
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
  registrations: [], notes: [], orders: [], labResults: [], prescriptions: [], specimens: [], dispenses: [],
  charges: [], payments: [], clinicalDrafts: [], encounters: [{ id: encounterId, patientId, status: 'in-progress', unitId }],
  idempotency: new Map()
});
function json(res, status, value, correlationId, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-SIMRS-Mock': 'true',
    'X-Correlation-ID': correlationId,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'X-SIMRS-Mock, X-Correlation-ID, X-SIMRS-Demo-State, X-SIMRS-State-Persisted, X-SIMRS-Scenario',
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
/**
 * Pure OpenAPI fixture synthesis. It never invokes stateful applyScenario/applyV31/applyV32.
 * Used ONLY by /__mock/contract/*, never normal /api/v1 paths.
 */
function mockValue(schema, label='id', depth=0) {
  if(depth>5)return null;
  schema=resolveSchema(schema);
  if(schema.enum?.length)return schema.enum[0];
  if(schema.example!==undefined)return clone(schema.example);
  if(schema.type==='array')return schema.minItems>=1?[mockValue(schema.items,label,depth+1)]:[];
  if(schema.type==='object'||schema.properties){
    const out={};
    for(const [key,value] of Object.entries(schema.properties||{})){
      if((schema.required||[]).includes(key)||depth<2)out[key]=mockValue(value,key,depth+1);
    }
    return out;
  }
  if(schema.type==='integer'||schema.type==='number')return schema.minimum??0;
  if(schema.type==='boolean')return false;
  if(schema.type==='string'){
    if(schema.format==='uuid'||/Id$|ID$/i.test(label))return '11111111-1111-4111-8111-111111111111';
    if(schema.format==='date-time')return '2026-11-14T08:00:00+07:00';
    if(schema.format==='date')return '2026-11-14';
    if(schema.format==='email')return 'demo@example.invalid';
    if(schema.format==='uri'||schema.format==='url')return 'https://example.invalid/mock';
    return label==='name'||label==='fullName'?'Pasien Sintetis':('DEMO-'+label.toUpperCase());
  }
  return null;
}
function contractFixture(operation) {
  const detail=operation.detail;
  const {status,sample}=successResponse(detail);
  const code=Object.keys(detail.responses).find(x=>/^2\d\d$/.test(x));
  const schema=detail.responses[code]?.content?.['application/json']?.schema;
  const payload=sample && typeof sample==='object'&&Object.keys(sample).length
    ?sample:mockValue(schema,'response');
  return {
    mock:true,simulated:true,persisted:false,realWorldEffect:false,
    responseKind:'OPENAPI_CONTRACT_FIXTURE',operationId:detail.operationId,
    method:operation.verb,path:operation.template,module:detail.tags?.[0]??'SHARED',
    contractStatus:detail['x-contract-status']??'candidate',
    suggestedHttpStatus:status,fixture:payload??{},
    warnings:['Respons sintetis dari schema/example OpenAPI, bukan eksekusi operasi bisnis.']
  };
}
function applyScenario(operationId, body, output, db, requestPath, search = new URLSearchParams()) {
  const id = randomUUID();
  switch (operationId) {
    case 'searchPatients': {
      const q=String(search.get('q')||search.get('nik')||search.get('mrn')||'').toLowerCase();
      return db.patients.filter(p=>!q||[p.fullName,p.mrn,...p.identifiers.map(i=>i.value)].join(' ').toLowerCase().includes(q))
        .map(p=>({patientId:p.patientId,matchScore:p.matchScore||1,identifiers:p.identifiers,fullName:p.fullName,mrn:p.mrn}));
    }
    case 'createPatient': {
      const patient = { patientId: id, mrn: 'DEMO-MRN-' + String(db.patients.length + 1).padStart(3, '0'),
        name: body.name, fullName: body.name, matchScore: 1, identifiers: body.identifiers || [] };
      db.patients.push(patient);
      return { patientId: id, mrn: patient.mrn, possibleMatches: [] };
    }
    case 'listOutpatientWorklist':
      return db.encounters.filter(e=>!search.get('unitId')||e.unitId===search.get('unitId'))
        .map(e=>({id:e.id,encounterId:e.id,patientId:e.patientId,
          patientName:db.patients.find(p=>p.patientId===e.patientId)?.fullName||'Pasien tidak diketahui',
          status:e.status,unitId:e.unitId}));
    case 'getEncounterChart': {
      const idFromPath = requestPath.split('/')[4];
      const e = db.encounters.find(x => x.id === idFromPath);
      if (!e) return null;
      const p=db.patients.find(x=>x.patientId===e.patientId);
      return {encounter:{id:e.id,status:e.status,class:'outpatient',period:{},
          unitVisits:[{unitId:e.unitId,status:'active'}]},
        patient:{id:e.patientId,mrn:p?.mrn||'',fullName:p?.fullName||'',allergies:[],risks:[]},
        notes:db.notes.filter(n=>n.encounterId===e.id),observations:[],diagnoses:[],
        orders:db.orders.filter(o=>o.encounterId===e.id),
        labReports:db.labResults.filter(r=>r.encounterId===e.id&&r.status==='released'),
        prescriptions:db.prescriptions.filter(rx=>rx.encounterId===e.id),careTeam:[]};
    }
    case 'createRegistration': {
      if(!db.patients.some(p=>p.patientId===body.patientId))
        return {__error:[422,'UNKNOWN_PATIENT','Pasien sintetis tidak ditemukan']};
      const encounter = { id: randomUUID(), patientId: body.patientId, status: 'arrived',
        unitId: body.unitId };
      db.encounters.push(encounter);
      const reg = {registrationId:id,encounterId:encounter.id,patientId:body.patientId,unitId:body.unitId,
        queueTicketId:randomUUID(),queueNumber:'A-'+String(db.registrations.length+1).padStart(3,'0'),
        queueStatus:'waiting',queueVersion:1,
        payer:body.payer,status:'ACTIVE'};
      db.registrations.push(reg);
      return reg;
    }
    case 'createClinicalNote': {
      if(!db.encounters.some(e=>e.id===body.encounterId))
        return {__error:[422,'UNKNOWN_ENCOUNTER','Encounter demo tidak ditemukan']};
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
      if(!db.encounters.some(e=>e.id===body.encounterId))
        return {__error:[422,'UNKNOWN_ENCOUNTER','Encounter demo tidak ditemukan']};
      if(V32 && !db.notes.some(n=>n.encounterId===body.encounterId && n.status==='signed'))
        return {__error:[422,'SIGNED_NOTE_REQUIRED','Order demo hanya bisa terbit setelah catatan SOAP signed (simulasi)']};
      const order = { id, encounterId: body.encounterId,
        category: body.category || 'LAB', serviceCode: body.serviceCode,
        urgency:body.urgency,indication:body.indication,
        targetUnitId:body.targetUnitId,status: 'placed' };
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
      if(!db.encounters.some(e=>e.id===body.encounterId))
        return {__error:[422,'UNKNOWN_ENCOUNTER','Encounter demo tidak ditemukan']};
      if(V32 && !db.notes.some(n=>n.encounterId===body.encounterId && n.status==='signed'))
        return {__error:[422,'SIGNED_NOTE_REQUIRED','Resep demo memerlukan catatan SOAP signed (simulasi)']};
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

/**
 * CONTRACT-EXAMPLE SIMULATIONS ONLY. No real signature, stock mutation, analyzer,
 * dispensing, ledger posting, or national system communication. The demo state
 * covers select WF-01/WF-02/WF-05/WF-07 edges, not production domain execution.
 */
function applyV31(operation, body, output, db, requestPath, search) {
  if (!V31) return applyScenario(operation.detail.operationId, body, output, db, requestPath, search);
  const op = operation.detail.operationId;
  const id = requestPath.split('/').filter(Boolean).find(s => /^[0-9a-f-]{36}$/i.test(s));
  const error = (status, code, message) => ({ __error: [status, code, message] });
  function entity(o, extra) { return { ...(o && typeof o === 'object' && !Array.isArray(o) ? o : {}), ...extra }; }
  switch (op) {
    case 'getPatient': {
      const p = db.patients.find(v => v.patientId === id);
      if (!p) return null;
      return entity(output, {id:p.patientId,mrn:p.mrn,fullName:p.fullName,identifiers:p.identifiers,status:'active'});
    }
    case 'getRegistration': {
      const r = db.registrations.find(v => v.registrationId === id);
      return r ? entity(output,{id:r.registrationId,patientId:r.patientId||patientId,
        encounterId:r.encounterId,queueTicketId:r.queueTicketId,status:'active'}) : null;
    }
    case 'getClinicalNote': {
      const n = db.notes.find(v => v.id === id);
      return n ? entity(output,n) : null;
    }
    case 'listClinicalNotes':
      return db.notes.map(n => entity(output?.items?.[0],n));
    case 'getServiceOrder': {
      const o=db.orders.find(v=>v.id===id);
      return o ? entity(output,o) : null;
    }
    case 'listServiceOrders':
      return db.orders.map(o=>entity(output?.items?.[0],o));
    case 'acceptLabOrder': {
      const o=db.orders.find(v=>v.id===id);
      if (!o) return error(404,'LAB_ORDER_NOT_FOUND','Order demo tidak ditemukan');
      if (o.category!=='LAB') return error(422,'NOT_LAB_ORDER','Order bukan pemeriksaan laboratorium');
      if (o.status!=='placed') return error(409,'ORDER_STATE_CONFLICT','Order demo tidak dalam status placed');
      o.status='accepted';return entity(output,{id:o.id,serviceOrderId:o.id,encounterId:o.encounterId,status:'accepted'});
    }
    case 'getLabOrder': {
      const o=db.orders.find(v=>v.id===id&&v.category==='LAB');
      return o ? entity(output,{id:o.id,serviceOrderId:o.id,encounterId:o.encounterId,status:o.status}) : null;
    }
    case 'createLabSpecimen': {
      const o=db.orders.find(v=>v.id===id&&v.category==='LAB');
      if (!o) return error(404,'LAB_ORDER_NOT_FOUND','Order demo tidak ditemukan');
      if (o.status!=='accepted')return error(422,'LAB_ORDER_NOT_ACCEPTED','Order lab harus accepted sebelum specimen dibuat');
      const found=db.specimens.find(x=>x.barcode===body.barcode);
      if (found)return error(409,'DUPLICATE_SPECIMEN_BARCODE','Barcode spesimen tidak boleh sama');
      const s={id:randomUUID(),labOrderId:id,patientId,barcode:body.barcode,
        specimenType:body.specimenType,status:'ordered',version:1};
      db.specimens.push(s);return entity(output,s);
    }
    case 'getLabSpecimen': {
      const s=db.specimens.find(v=>v.id===id);
      return s?entity(output,s):null;
    }
    case 'listLabOrderSpecimens':
      return db.specimens.filter(s=>s.labOrderId===id).map(s=>entity(output?.items?.[0],s));
    case 'collectLabSpecimen': {
      const s=db.specimens.find(v=>v.id===id);
      if(!s)return error(404,'SPECIMEN_NOT_FOUND','Spesimen demo tidak ditemukan');
      if(s.status!=='ordered')return error(409,'SPECIMEN_STATE_CONFLICT','Spesimen tidak dalam status ordered');
      if(s.barcode!==body.barcode)return error(422,'SPECIMEN_BARCODE_MISMATCH','Barcode salah untuk specimen/order demo');
      s.status='collected';s.collectedAt=body.collectedAt;
      return entity(output,s);
    }
    case 'rejectLabSpecimen': {
      const s=db.specimens.find(v=>v.id===id);
      if(!s)return error(404,'SPECIMEN_NOT_FOUND','Spesimen demo tidak ditemukan');
      if(!['collected','received'].includes(s.status))return error(409,'SPECIMEN_STATE_CONFLICT','Penolakan spesimen hanya dari collected atau received');
      s.status='rejected';s.rejectionReasonCode=body.reasonCode;
      return entity(output,s);
    }
    case 'receiveSpecimen': {
      const s=db.specimens.find(v=>v.id===id);
      if(!s)return error(404,'SPECIMEN_NOT_FOUND','Spesimen demo tidak ditemukan');
      if(s.status!=='collected')return error(422,'SPECIMEN_NOT_COLLECTED','Spesimen belum collected atau sudah rejected');
      if(s.barcode!==body.barcode)return error(422,'SPECIMEN_BARCODE_MISMATCH','Barcode spesimen tidak cocok');
      s.status='received';s.receivedAt=body.receivedAt;return {id,status:'received'};
    }
    case 'submitLabResults': {
      const orderId=id;
      const specimen=db.specimens.find(s=>s.labOrderId===orderId&&s.status==='received');
      if(!specimen)return error(422,'VALID_SPECIMEN_REQUIRED','Hasil hanya bisa dicatat setelah specimen received');
      const existing=db.labResults.find(v=>v.orderId===orderId);
      if(existing)return error(409,'RESULT_ALREADY_CREATED','Draft hasil sudah dibuat');
      const result={id:randomUUID(),orderId,encounterId:db.orders.find(o=>o.id===orderId)?.encounterId,
        specimenId:specimen.id,results:body.observations||[],status:'draft'};
      db.labResults.push(result);return {id:result.id,status:'draft'};
    }
    case 'getLabReport': {
      const r=db.labResults.find(v=>v.id===id);
      return r?entity(output,{id:r.id,labOrderId:r.orderId,encounterId:r.encounterId,
        specimenId:r.specimenId,status:r.status,results:r.results}):null;
    }
    case 'verifyLabReport': {
      const r=db.labResults.find(v=>v.id===id);
      if(!r)return error(404,'REPORT_NOT_FOUND','Laporan lab demo tidak ditemukan');
      if(r.status!=='draft')return error(409,'REPORT_STATE_CONFLICT','Laporan tidak dapat diverifikasi ulang');
      if(db.specimens.find(s=>s.id===r.specimenId)?.status==='rejected')return error(422,'SPECIMEN_REJECTED','Specimen rejected tidak boleh diverifikasi');
      r.status='verified';return {id:r.id,status:'verified'};
    }
    case 'releaseLabReport': {
      const r=db.labResults.find(v=>v.id===id);
      if(!r)return error(404,'REPORT_NOT_FOUND','Laporan lab demo tidak ditemukan');
      if(r.status!=='verified')return error(422,'REPORT_NOT_VERIFIED','Laporan harus verified sebelum release');
      r.status='released';
      return entity(output,{id:r.id,status:'released',labOrderId:r.orderId,encounterId:r.encounterId,
        specimenId:r.specimenId,results:r.results,releasedAt:new Date().toISOString()});
    }
    case 'createPrescriptionDraft': {
      const draft={id:randomUUID(),encounterId:body.encounterId,patientId,items:body.items||[],
        status:'draft',version:1,indication:body.indication||''};
      db.prescriptions.push(draft);return entity(output,draft);
    }
    case 'updatePrescriptionDraft': {
      const draft=db.prescriptions.find(v=>v.id===id);
      if(!draft)return error(404,'PRESCRIPTION_NOT_FOUND','Draft resep demo tidak ditemukan');
      if(draft.status!=='draft')return error(409,'PRESCRIPTION_NOT_DRAFT','Hanya draft resep yang dapat diubah');
      if(body.expectedVersion!==draft.version)return error(412,'STALE_VERSION','Versi draft resep sudah berubah');
      draft.items=body.items||draft.items;draft.indication=body.indication||draft.indication;
      draft.version=(draft.version||1)+1;return entity(output,draft);
    }
    case 'placePrescription': {
      const draft=db.prescriptions.find(v=>v.id===id);
      if(!draft)return error(404,'PRESCRIPTION_NOT_FOUND','Draft resep demo tidak ditemukan');
      if(draft.status!=='draft')return error(409,'PRESCRIPTION_NOT_DRAFT','Hanya draft yang dapat di-place');
      if(body.expectedVersion!==draft.version)return error(412,'STALE_VERSION','Versi draft resep sudah berubah');
      if(!draft.items.length)return error(422,'PRESCRIPTION_ITEMS_REQUIRED','Resep demo tidak memiliki item');
      draft.status='ordered';draft.version=(draft.version||1)+1;
      return entity(output,draft);
    }
    case 'cancelPrescription': {
      const p=db.prescriptions.find(v=>v.id===id);
      if(!p)return error(404,'PRESCRIPTION_NOT_FOUND','Resep demo tidak ditemukan');
      if(!['draft','ordered','reviewed'].includes(p.status))return error(409,'PRESCRIPTION_CANNOT_CANCEL','Resep telah masuk tahap dispensing');
      p.status='cancelled';return entity(output,p);
    }
    case 'getPrescription': {
      const p=db.prescriptions.find(v=>v.id===id);
      return p?entity(output,p):null;
    }
    case 'listPrescriptions':
      return db.prescriptions.map(p=>entity(output?.items?.[0],p));
    case 'reviewPrescription': {
      const p=db.prescriptions.find(v=>v.id===id);
      if(!p)return error(404,'PRESCRIPTION_NOT_FOUND','Resep demo tidak ditemukan');
      if(p.status!=='ordered')return error(409,'PRESCRIPTION_STATE_CONFLICT','Resep demo sudah direview atau ditutup');
      if(!['approved','approve','accepted'].includes(String(body.decision).toLowerCase()))
        return error(422,'PHARMACIST_REVIEW_NOT_APPROVED','Keputusan review bukan approve');
      p.status='reviewed';return {id:p.id,status:'reviewed'};
    }
    case 'dispensePrescription': {
      const p=db.prescriptions.find(v=>v.id===body.prescriptionId);
      if(!p)return error(404,'PRESCRIPTION_NOT_FOUND','Resep demo tidak ditemukan');
      if(p.status!=='reviewed')return error(422,'PRESCRIPTION_REVIEW_REQUIRED','Tidak dapat dispensing sebelum review apoteker');
      p.status='dispensed';
      const row={id:randomUUID(),prescriptionId:p.id,status:'dispensed',lines:body.items||[]};
      db.dispenses.push(row);
      return {id:row.id,status:'dispensed',stockMovementIds:[]}; // synthetic; NO real ledger writes
    }
    case 'getDispense': {
      const d=db.dispenses.find(v=>v.id===id);
      return d?entity(output,d):null;
    }
    case 'listDispenses':
      return db.dispenses.map(d=>entity(output?.items?.[0],d));
    case 'createDispenseReturn': {
      const disp=db.dispenses.find(v=>v.id===id);
      if(!disp)return error(404,'DISPENSE_NOT_FOUND','Catatan dispensing demo tidak ditemukan');
      return entity(output,{id:randomUUID(),dispenseId:id,reason:body.reason,lines:body.lines,status:'pending-review',postedMovementIds:[]});
    }
    default: return applyScenario(op,body,output,db,requestPath,search);
  }
}
function applyV32(operation, body, output, db, requestPath, search) {
  const op=operation.detail.operationId;
  if(!V32 || !overlayOperations.has(op))return applyV31(operation,body,output,db,requestPath,search);
  // v3.5 P0: stateful synthetic queue lifecycle for HOSNEX M01, process RAM only.
  // This is deliberately NOT a real hospital queue or production authority.
  if(V35 && op==='setQueue'){
    const ticketId=requestPath.split('/')[5];
    const reg=db.registrations.find(r=>r.queueTicketId===ticketId);
    if(!reg)return {__error:[404,'QUEUE_TICKET_NOT_FOUND','Tiket antrean demo tidak tersedia']};
    const current=reg.queueStatus??'waiting';
    const version=reg.queueVersion??1;
    if(body.expectedVersion!==version)
      return {__error:[412,'STALE_QUEUE_VERSION','Versi antrean demo sudah berubah']};
    const next={waiting:'called',called:'in-service','in-service':'done',done:null}[current];
    if(body.queueStatus!==next)
      return {__error:[409,'QUEUE_TRANSITION_CONFLICT','Transisi antrean tidak sesuai urutan simulasi']};
    reg.queueStatus=next;
    reg.queueVersion=version+1;
    return {...clone(output),operationId:'setQueue',targetId:ticketId,
      status:'queue-transition-preview',version:reg.queueVersion,
      mock:true,simulated:true,persisted:false,realWorldEffect:false};
  }
  // v3.3–v3.5 candidates other than setQueue remain pure contract previews.
  if((V33 && v33Operations.has(op)) || (V34 && v34Operations.has(op)) || (V35 && v35Operations.has(op)))return {...clone(output),targetId:requestPath.split('/').filter(Boolean).find((part,i,parts)=>parts[i-1]==='jobs'||parts[i-1]==='items'||parts[i-1]==='summaries'||parts[i-1]==='encounters'||parts[i-1]==='claims')||output.targetId,
    mock:true,simulated:true,persisted:false,realWorldEffect:false};
  const error=(status,code,message)=>({__error:[status,code,message]});
  switch(op){
    case 'listUnitPractitioners':
      return {items:[{practitionerId:unitId,displayName:'Dokter Demo Poli'}]};
    case 'checkBPJSEligibility': {
      if(!db.patients.some(p=>p.patientId===body.patientId))
        return error(422,'UNKNOWN_PATIENT','Pasien sintetis tidak ditemukan');
      return {eligibilityCheckId:randomUUID(),status:'ELIGIBLE',checkedAt:new Date().toISOString()};
    }
    case 'getCompositeEncounterDraft': {
      const target=requestPath.split('/')[4];
      if(!db.encounters.some(e=>e.id===target))return error(404,'ENCOUNTER_NOT_FOUND','Encounter tidak ditemukan');
      const existing=db.clinicalDrafts.find(d=>d.encounterId===target);
      const locked=db.notes.some(n=>n.encounterId===target&&n.status==='signed');
      return {encounterId:target,version:existing?.version||1,
        status:locked?'locked':'draft',hasDraft:Boolean(existing),locked};
    }
    case 'saveCompositeEncounterDraft': {
      const target=requestPath.split('/')[4];
      if(!db.encounters.some(e=>e.id===target))return error(404,'ENCOUNTER_NOT_FOUND','Encounter tidak ditemukan');
      if(db.notes.some(n=>n.encounterId===target&&n.status==='signed'))
        return error(409,'SIGNED_NOTE_IMMUTABLE','Draft tidak boleh mengubah catatan signed');
      const previous=db.clinicalDrafts.find(d=>d.encounterId===target);
      const version=previous?.version||1;
      if(body.expectedVersion!==version)return error(412,'STALE_VERSION','Versi draft demo berbeda');
      if(previous){previous.version++;previous.body=structuredClone(body);}
      else db.clinicalDrafts.push({encounterId:target,version:2,body:structuredClone(body)});
      return {encounterId:target,version:version+1,status:'draft'};
    }
    default:
      return error(501,'SCENARIO_NOT_IMPLEMENTED',
        'Operation kontrak v3.2 ini masih proposal; belum ada mock stateful yang valid');
  }
}
function normalizeV31Response(operation, value, status) {
  if (!V31 || value===null || value?.__error)return value;
  const schema=operation.detail.responses[String(status)]?.content?.['application/json']?.schema;
  if(schema?.properties?.items && Array.isArray(value))return {
    items:value,pageInfo:{nextCursor:null,pageSize:20,hasMore:false}};
  return value;
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
  const clinicalWorkspaces = createClinicalWorkspaceStore();
  const medicalDrafts = createMedicalDraftStore(clinicalWorkspaces);
  const radiologyDemo = createRadiologyDemoStore(()=>
    db.orders.filter(o=>o.category==='RAD').map(o=>({
      ...o,patientId:db.encounters.find(e=>e.id===o.encounterId)?.patientId
    })));
  const p0Reads = createP0ReadModels(clinicalWorkspaces,medicalDrafts);
  return createServer(async (req, res) => {
    const correlationId = /^[a-zA-Z0-9-]{8,128}$/.test(String(req.headers['x-correlation-id'] || ''))
      ? req.headers['x-correlation-id'] : randomUUID();
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, If-Match, X-Correlation-ID, X-Organization-Id, X-Demo-Scenario, X-Demo-Staff-Id',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,OPTIONS', 'X-SIMRS-Mock': 'true' });
      res.end(); return;
    }
    // Read-only inspection of synthetic queue state; separate from OpenAPI proposal.
    if(V35 && url.pathname.startsWith('/__demo/queue/tickets/')){
      const queueHeaders={'X-SIMRS-State-Persisted':'false','X-SIMRS-Demo-State':'process-memory'};
      if(req.method!=='GET')
        return json(res,405,problem('METHOD_NOT_ALLOWED','Antrean demo inspector hanya GET',correlationId),correlationId,queueHeaders);
      if(req.headers['x-organization-id']!==defaultOrg)
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Organisasi demo tidak sesuai',correlationId),correlationId,queueHeaders);
      const ticketId=decodeURIComponent(url.pathname.slice('/__demo/queue/tickets/'.length));
      const registration=db.registrations.find(r=>r.queueTicketId===ticketId);
      if(!registration)
        return json(res,404,problem('QUEUE_TICKET_NOT_FOUND','Tiket antrean demo tidak ditemukan',correlationId),correlationId,queueHeaders);
      return json(res,200,{queueTicketId:registration.queueTicketId,registrationId:registration.registrationId,
        encounterId:registration.encounterId,queueNumber:registration.queueNumber,
        queueStatus:registration.queueStatus??'waiting',version:registration.queueVersion??1,
        stateScope:'process-memory',mock:true,simulated:true,persisted:false,realWorldEffect:false},
        correlationId,queueHeaders);
    }
    if (url.pathname === '/healthz') {
      return json(res, 200, { service: 'simrs-api', mode: 'synthetic-mock',
        operations: operations.length, status: 'ok' }, correlationId);
    }
    if (url.pathname === '/openapi.json' || url.pathname === '/openapi-v3.1.json' || url.pathname === '/openapi-v3.2.json' || url.pathname === '/contracts/operations.json') {
      return json(res, 200, url.pathname === '/openapi.json' || url.pathname === '/openapi-v3.2.json' ? spec : url.pathname === '/openapi-v3.1.json' ? JSON.parse(readFileSync(join(HERE,'openapi-v3.1.json'),'utf8')) :
        JSON.parse(readFileSync(join(HERE, 'contracts/operations.json'), 'utf8')), correlationId);
    }
    if (url.pathname === '/' || url.pathname === '/docs' || url.pathname === '/docs/') {
      const html = readFileSync(join(HERE, 'docs/index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html.replace('src="../openapi.json"', 'src="/openapi.json"')); return;
    }
    // M10 draft radiology workflow; does NOT generate DICOM, PACS, real signatures or viewer sessions.
    if(url.pathname==='/__demo/radiology/orders'||
       url.pathname.startsWith('/__demo/radiology/orders/')){
      const headers={'X-SIMRS-Demo-State':'process-memory','X-SIMRS-State-Persisted':'false'};
      if(!V32)return json(res,404,problem('NOT_FOUND','Only available on synthetic v3.2',correlationId),correlationId,headers);
      if(req.headers['x-organization-id']!=='DEMO-RS-001')
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Tenant fiktif M10 tidak cocok',correlationId),correlationId,headers);
      // Spoofable QA persona header, NOT authentication/authorization for production.
      const staff=String(req.headers['x-demo-staff-id']||'');
      const m10Roles={
        admin:['read','schedule','acquisition-note','report','qa-review'],
        radiographer:['read','schedule','acquisition-note'],
        radiology:['read','report','qa-review'],
        doctor:['read'],
        emergency:['read']
      };
      if(!m10Roles[staff]?.includes('read'))
        return json(res,403,problem('DEMO_ROLE_DENIED',
          'Akun demo tidak diizinkan membaca worklist M10',correlationId),correlationId,headers);
      const forced={forbidden:403,conflict:409,invalid:422,error:500}[req.headers['x-demo-scenario']];
      if(forced)return json(res,forced,problem('MOCK_'+String(req.headers['x-demo-scenario']).toUpperCase(),
        'Skenario negatif M10 sintetis',correlationId),correlationId,headers);
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts.length===3&&req.method==='GET')
        return json(res,200,radiologyDemo.list(),correlationId,headers);
      if(parts.length===4&&req.method==='GET'){
        const data=radiologyDemo.snapshot(parts[3]);
        return data?json(res,200,data,correlationId,headers):
          json(res,404,problem('RADIOLOGY_ORDER_NOT_FOUND','Order demo tidak ada',correlationId),correlationId,headers);
      }
      if(parts.length===5&&parts[4]==='viewer'&&req.method==='GET')
        return json(res,501,problem('NO_REAL_DICOM_VIEWER',
          'Viewer PACS/DICOM sengaja tidak disimulasikan sebagai gambar asli',correlationId),correlationId,headers);
      if(parts.length===5&&['schedule','acquisition-note','report','qa-review'].includes(parts[4])&&
         req.method===(parts[4]==='qa-review'?'POST':'PATCH')){
        if(!m10Roles[staff].includes(parts[4]))
          return json(res,403,problem('DEMO_ROLE_DENIED',
            'Profesi demo tidak diizinkan untuk tahap radiologi ini',correlationId),correlationId,headers);
        let body;
        try{body=await readBody(req);}catch{
          return json(res,400,problem('INVALID_BODY','JSON M10 tidak valid',correlationId),correlationId,headers);
        }
        const result=radiologyDemo.save(parts[3],parts[4],body,String(req.headers['idempotency-key']||''));
        return result.data?json(res,result.status,result.data,correlationId,headers):
          json(res,result.status,problem(result.code,result.message,correlationId,result.details||[]),
            correlationId,headers);
      }
      return json(res,405,problem('RADIOLOGY_DEMO_NOT_SUPPORTED',
        'Hanya jadwal, catatan pemeriksaan, draft laporan dan review QA; sign/publish/PACS tidak didukung',
        correlationId),correlationId,headers);
    }
    // M05 draft-only summary/coding/review in synthetic Node process memory.
    if(url.pathname==='/__demo/medical-records/episodes'||
       url.pathname.startsWith('/__demo/medical-records/episodes/')){
      const headers={'X-SIMRS-Demo-State':'process-memory','X-SIMRS-State-Persisted':'false'};
      if(!V32)return json(res,404,problem('NOT_FOUND','Only available on mock v3.2',correlationId),correlationId,headers);
      if(req.headers['x-organization-id']!=='DEMO-RS-001')
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Tenant fiktif tidak cocok',correlationId),correlationId,headers);
      const forced={forbidden:403,conflict:409,invalid:422,error:500}[req.headers['x-demo-scenario']];
      if(forced)return json(res,forced,problem('MOCK_'+String(req.headers['x-demo-scenario']).toUpperCase(),
        'Skenario negatif M05 fiktif',correlationId),correlationId,headers);
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts.length===3&&req.method==='GET')
        return json(res,200,medicalDrafts.catalog(),correlationId,headers);
      if(parts.length===4&&req.method==='GET'){
        if(parts[3]!==medicalDrafts.episodeId)return json(res,404,
          problem('DEMO_EPISODE_NOT_FOUND','Episode tidak ditemukan',correlationId),correlationId,headers);
        return json(res,200,medicalDrafts.snapshot(),correlationId,headers);
      }
      if(parts.length===5&&parts[3]===medicalDrafts.episodeId&&
        ['summary','coding','review'].includes(parts[4])&&
        req.method===(parts[4]==='review'?'POST':'PATCH')){
        let body;
        try{body=await readBody(req);}catch{
          return json(res,400,problem('INVALID_BODY','JSON draf tidak valid',correlationId),correlationId,headers);
        }
        const result=medicalDrafts.save(parts[3],parts[4],body,String(req.headers['idempotency-key']||''));
        return result.data?json(res,result.status,result.data,correlationId,headers):
          json(res,result.status,problem(result.code,result.message,correlationId,result.details||[]),
            correlationId,headers);
      }
      return json(res,405,problem('MEDICAL_DEMO_ROUTE_READONLY',
        'Hanya draft resume, coding dan review QA yang tersedia',correlationId),correlationId,headers);
    }
    // Additional HOSNEX P0 context: strictly read-only; never accept stock/payment/
    // claims submissions or national interoperability dispatch from this namespace.
    if(url.pathname==='/__demo/p0-read-models' || url.pathname.startsWith('/__demo/p0-read-models/')){
      const marker={'X-SIMRS-Demo-State':'process-memory','X-SIMRS-State-Persisted':'false'};
      if(!V32)return json(res,404,problem('NOT_FOUND','Requires v3.2 mock',correlationId),correlationId,marker);
      if(req.headers['x-organization-id']!=='DEMO-RS-001')
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Only fictitious demo organization',correlationId),correlationId,marker);
      if(req.method!=='GET')return json(res,405,problem('READ_ONLY_DEMO',
        'Mutasi, pembayaran, klaim, inventori dan FHIR dispatch tidak diizinkan',correlationId),correlationId,marker);
      const forced={forbidden:403,conflict:409,invalid:422,error:500}[req.headers['x-demo-scenario']];
      if(forced)return json(res,forced,problem('MOCK_'+String(req.headers['x-demo-scenario']).toUpperCase(),
        'Injected synthetic error',correlationId),correlationId,marker);
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts.length===2)return json(res,200,{mock:true,simulated:true,persisted:false,
        realWorldEffect:false,readOnly:true,stateScope:'process-memory',modules:p0Reads.modules},correlationId,marker);
      const module=parts[2],id=parts[3];
      if(!p0Reads.validModule(module))return json(res,404,
        problem('UNKNOWN_DEMO_MODULE','Module has no P0 read model',correlationId),correlationId,marker);
      if(parts.length===3)return json(res,200,p0Reads.list(module),correlationId,marker);
      if(parts.length===4){
        const result=p0Reads.detail(module,id);
        return result?json(res,200,result,correlationId,marker):
          json(res,404,problem('DEMO_RECORD_NOT_FOUND','No matching demo record',correlationId),correlationId,marker);
      }
      return json(res,404,problem('NOT_FOUND','Unknown demo route',correlationId),correlationId,marker);
    }
    // Process-memory demo of P0 handoff. Not a production API and not a pure fixture.
    if(url.pathname.startsWith('/__demo/clinical-workspaces')){
      if(!V32)return json(res,404,problem('NOT_FOUND','Clinical workspaces require v3.2 mock',correlationId),correlationId);
      if(req.headers['x-organization-id']!=='DEMO-RS-001')
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Hanya organisasi fiktif DEMO-RS-001',correlationId),correlationId,
          {'X-SIMRS-Demo-State':'process-memory'});
      const parts=url.pathname.split('/').filter(Boolean);
      const module=parts[2],id=parts[3];
      const headers={'X-SIMRS-Demo-State':'process-memory','X-SIMRS-State-Persisted':'false'};
      if(parts.length===2&&req.method==='GET')
        return json(res,200,{mock:true,simulated:true,persisted:false,realWorldEffect:false,
          stateScope:'process-memory',items:clinicalWorkspaces.catalog()},correlationId,headers);
      if(!clinicalWorkspaces.validModule(module))
        return json(res,404,problem('UNKNOWN_DEMO_MODULE','Workspace tidak didukung',correlationId),correlationId,headers);
      if(parts.length===3&&req.method==='GET')
        return json(res,200,clinicalWorkspaces.list(module),correlationId,headers);
      if(parts.length===4&&req.method==='GET'){
        const data=clinicalWorkspaces.detail(module,id);
        return data?json(res,200,data,correlationId,headers)
          :json(res,404,problem('DEMO_RECORD_NOT_FOUND','Record belum tersedia',correlationId),correlationId,headers);
      }
      if(parts.length===6&&parts[4]==='actions'&&req.method==='POST'){
        const forced={forbidden:403,conflict:409,invalid:422,error:500}[req.headers['x-demo-scenario']];
        if(forced)return json(res,forced,problem('MOCK_'+String(req.headers['x-demo-scenario']).toUpperCase(),
          'Skenario gagal fiktif',correlationId),correlationId,headers);
        let body;
        try{body=await readBody(req);}catch{
          return json(res,400,problem('INVALID_BODY','Payload JSON tidak valid',correlationId),correlationId,headers);
        }
        const result=clinicalWorkspaces.apply(module,id,parts[5],body,String(req.headers['idempotency-key']||''));
        return result.data?json(res,result.status,result.data,correlationId,headers)
          :json(res,result.status,problem(result.code,result.message,correlationId),correlationId,headers);
      }
      return json(res,404,problem('NOT_FOUND','Rute demo tidak tersedia',correlationId),correlationId,headers);
    }
    // Tooling-only mock response gateway: every audited FE action has a sample.
    // This namespace is deliberately OUTSIDE OpenAPI. No actual business state is written.
    if(url.pathname==='/__mock/hosnex/actions' && req.method==='GET'){
      const module=url.searchParams.get('module') || '';
      return json(res,200,{mode:'fixtures-only',mock:true,persisted:false,
        coverage:mockActionCoverage,actions:getMockActionCatalog(module)},correlationId,
        {'X-SIMRS-Scenario':'fixture','X-SIMRS-State-Persisted':'false'});
    }
    if(url.pathname.startsWith('/__mock/hosnex/actions/') && req.method==='POST'){
      if(!V32)return json(res,404,problem('NOT_FOUND','Only available in v3.2 demo',correlationId),correlationId);
      if(req.headers['x-organization-id']!=='DEMO-RS-001')
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Gunakan organisasi fiktif DEMO-RS-001',correlationId),correlationId);
      const action=decodeURIComponent(url.pathname.slice('/__mock/hosnex/actions/'.length));
      const mock=simulateHosnexAction(action);
      if(!mock)return json(res,404,problem('UNKNOWN_HOSNEX_ACTION','Aksi tidak tercatat di audit HOSNEX',correlationId),correlationId);
      const scenario=String(req.headers['x-demo-scenario']||'success');
      if(['forbidden','conflict','invalid','error'].includes(scenario)){
        const status={forbidden:403,conflict:409,invalid:422,error:500}[scenario];
        return json(res,status,problem('MOCK_'+scenario.toUpperCase(),
          'Skenario negatif fiktif untuk '+action,correlationId),correlationId,
          {'X-SIMRS-Scenario':scenario,'X-SIMRS-State-Persisted':'false'});
      }
      if(scenario!=='success')return json(res,400,problem('UNKNOWN_SCENARIO',
        'Skenario demo harus success/forbidden/conflict/invalid/error',correlationId),correlationId);
      try {await readBody(req);}catch{return json(res,400,
        problem('INVALID_BODY','Payload JSON tidak valid',correlationId),correlationId);}
      return json(res,200,mock,correlationId,
        {'X-SIMRS-Scenario':'fixture','X-SIMRS-State-Persisted':'false'});
    }
    if(url.pathname==='/__mock/contract/operations' && req.method==='GET'){
      if(!V32)return json(res,404,problem('NOT_FOUND','Contract fixtures require v3.2',correlationId),correlationId);
      const module=url.searchParams.get('module');
      const list=operations.filter(o=>!module||o.detail.tags?.includes(module));
      return json(res,200,{mock:true,persisted:false,total:operations.length,
        items:list.map(o=>({operationId:o.detail.operationId,method:o.verb,
          path:o.template,module:o.detail.tags?.[0]??'SHARED',
          contractStatus:o.detail['x-contract-status']??'candidate'}))},correlationId,
        {'X-SIMRS-Scenario':'fixture','X-SIMRS-State-Persisted':'false'});
    }
    if(url.pathname.startsWith('/__mock/contract/operations/') && req.method==='POST'){
      if(!V32)return json(res,404,problem('NOT_FOUND','Contract fixtures require v3.2',correlationId),correlationId);
      if(req.headers['x-organization-id']!=='DEMO-RS-001')
        return json(res,403,problem('DEMO_TENANT_REQUIRED','Gunakan organisasi dummy',correlationId),correlationId);
      const id=decodeURIComponent(url.pathname.slice('/__mock/contract/operations/'.length));
      const op=operations.find(o=>o.detail.operationId===id);
      if(!op)return json(res,404,problem('UNKNOWN_OPERATION_ID','OperationId tidak ditemukan pada kontrak',correlationId),correlationId);
      const scenario=String(req.headers['x-demo-scenario']||'success');
      if(['forbidden','conflict','invalid','error'].includes(scenario)){
        const status={forbidden:403,conflict:409,invalid:422,error:500}[scenario];
        return json(res,status,problem('MOCK_'+scenario.toUpperCase(),
          'Skenario gagal sintetis untuk '+id,correlationId),correlationId,
          {'X-SIMRS-Scenario':scenario,'X-SIMRS-State-Persisted':'false'});
      }
      if(scenario!=='success')return json(res,400,
        problem('UNKNOWN_SCENARIO','Skenario tidak didukung',correlationId),correlationId);
      try{await readBody(req);}catch{return json(res,400,
        problem('INVALID_BODY','Payload JSON mock tidak valid',correlationId),correlationId);}
      return json(res,200,contractFixture(op),correlationId,
        {'X-SIMRS-Scenario':'fixture','X-SIMRS-State-Persisted':'false'});
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
          !/^(?:"?[1-9][0-9]*"?)$/.test(String(req.headers['if-match'] || '')))
        return json(res, 412, problem('STALE_VERSION', 'If-Match wajib integer positif sebagai demo version', correlationId), correlationId);
      try { body = await readBody(req); }
      catch (err) { return json(res, 400,
        problem('INVALID_BODY', 'JSON tidak valid atau terlalu besar', correlationId), correlationId); }
      if (body.expectedVersion !== undefined && operation.detail.parameters.some(p => p.$ref?.endsWith('/IfMatch'))) {
        const version = String(req.headers['if-match']).replaceAll('"','');
        if (version !== String(body.expectedVersion))
          return json(res, 412, problem('STALE_VERSION', 'If-Match berbeda dari expectedVersion pada request', correlationId), correlationId);
      }
      // Test-only RBAC for RAD CPOE: source of truth remains Node process memory.
      // Header is intentionally non-security-grade and MUST NOT gate real PHI.
      if(operation.detail.operationId==='createServiceOrder'&&body.category==='RAD'){
        if(!['admin','doctor','emergency'].includes(String(req.headers['x-demo-staff-id']||'')))
          return json(res,403,problem('DEMO_ORDER_ROLE_DENIED',
            'Hanya dokter pengirim sintetis boleh membuat order radiologi demo',correlationId),correlationId);
        if(!['THX','CTH','USG'].includes(body.serviceCode))
          return json(res,422,problem('UNSUPPORTED_RADIOLOGY_CODE',
            'CPOE demo hanya mendukung THX/CTH/USG',correlationId),correlationId);
      }
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
        return json(res, previous.status, previous.result, correlationId, { 'X-Idempotent-Replay': 'true',...(((V33 && v33Operations.has(operation.detail.operationId)) || (V34 && v34Operations.has(operation.detail.operationId)) || (V35 && v35Operations.has(operation.detail.operationId))) ? {'X-SIMRS-State-Persisted':'false','X-SIMRS-Scenario':'contract-preview'} : {}) });
      }
      const { status, sample } = successResponse(operation.detail);
      let result = applyV32(operation, body, sample, db, url.pathname, url.searchParams);
      if (result?.__error) {
        const [code, errorCode, message] = result.__error;
        return json(res, code, problem(errorCode, message, correlationId), correlationId);
      }
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        if ('correlationId' in (sample || {})) result.correlationId = correlationId;
      }
      result = normalizeV31Response(operation,result,status);
      db.idempotency.set(dedupeKey, { payload: JSON.stringify(body), status, result });
      return json(res, status, result, correlationId, ((V33 && v33Operations.has(operation.detail.operationId)) || (V34 && v34Operations.has(operation.detail.operationId)) || (V35 && v35Operations.has(operation.detail.operationId))) ? {'X-SIMRS-State-Persisted':'false','X-SIMRS-Scenario':'contract-preview'} : {});
    }
    const { status, sample } = successResponse(operation.detail);
    const response=applyV32(operation,{},sample,db,url.pathname,url.searchParams);
    if(response?.__error){const [code,errorCode,message]=response.__error;
      return json(res,code,problem(errorCode,message,correlationId),correlationId);}
    const result = normalizeV31Response(operation,response,status);
    if (result === null) return json(res, 404,
      problem('NOT_FOUND', 'Objek demo tidak ada dalam scope', correlationId), correlationId);
    return json(res, status, result, correlationId);
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4010);
  createMockServer().listen(port, '127.0.0.1', () =>
    console.log('SIMRS synthetic API mock: http://127.0.0.1:' + port + '/docs (' + operations.length + ' operations; '+(V35?'v3.5':V34?'v3.4':V33?'v3.3':V32?'v3.2':V31?'v3.1':'v3.0')+')'));
}
