import { forms, staffIds, workspaceRoles } from './forms.mjs';
import { fixtureValues } from './fixture-values.mjs';
import { recordEvidence } from './workflow-evidence.mjs';
import { workflows } from './workflows.mjs';

export const demoVersion = '4.0.0';
export { forms, workflows };
const catalog = new Map(workflows.map(workflow => [workflow.id, workflow]));
const formsById = new Map(forms.map(form => [form.id, form]));
const flags = { mock: true, simulated: true, persisted: false, realWorldEffect: false };
const portalRoles = new Set(workspaceRoles.CH01);
const sessionLimit = 250;
const eventLimit = 250;

export class DemoProblem extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
function fail(status, code, message, details) {
  throw new DemoProblem(status, code, message, details);
}
function canAccess(actor, workspace) {
  return workspace === 'CH01' ? portalRoles.has(actor) :
    staffIds.includes(actor) && (actor === 'admin' || (workspaceRoles[workspace] ?? []).includes(actor));
}
function allowedStep(session, step) {
  if (!step.when) return true;
  const [previous, field, value] = step.when;
  return session.records[previous]?.[field] === value;
}
function pendingStep(session) {
  return session.workflow?.steps.find(step => !session.records[step.id] && allowedStep(session, step));
}
function matchesProgress(session, step) {
  if (!step.when) return true;
  const [previous] = step.when;
  return !session.records[previous] || allowedStep(session, step);
}
function canSeeEvent(workspace, event) {
  if (workspace === 'CH01') return event.workspace === 'CH01';
  return event.workspace !== 'CH01';
}
function formValues(form, session) {
  const existing = session.savedForms[form.id];
  if (existing) return existing;
  const { patient, episodeId } = session;
  const values = {};
  for (const field of form.fields) {
    const label = field.label.toLowerCase();
    const fixture = fixtureValues[form.id]?.[field.label];
    if (fixture !== undefined) values[field.id] = fixture;
    if (/encounterid|nomor kunjungan|identitas kunjungan/.test(label)) values[field.id] = episodeId;
    else if (/patientid|nama lengkap|^pasien$|identitas ibu/.test(label)) values[field.id] = label.includes('id') ? patient.id : patient.name;
    else if (/nomor rm|patient identifier/.test(label)) values[field.id] = patient.mrn;
    else if (label === 'tanggal lahir') values[field.id] = patient.birthDate;
    else if (label === 'kandidat duplikat') values[field.id] = 'Tidak ada kecocokan lain pada skenario ini';
    else if (label === 'authenticatedpatientid') values[field.id] = patient.id;
    else if (label === 'queueticketid') values[field.id] = session.evidence.queue?.id ?? 'Menunggu registrasi';
    else if (label === 'appointmentid' && session.evidence.appointment) values[field.id] = session.evidence.appointment.id;
    else if (label === 'orderid' && session.evidence.order) values[field.id] = session.evidence.order.id;
    else if (label === 'specimenid' && session.evidence.specimen) values[field.id] = session.evidence.specimen.id;
    else if (label === 'invoiceid' && session.evidence.invoice) values[field.id] = session.evidence.invoice.id;
    else if (label === 'claimid' && session.evidence.claim) values[field.id] = session.evidence.claim.id;
    else if (label === 'uid' && session.evidence.imaging) values[field.id] = session.evidence.imaging.id;
    else if (form.id === 'F-M01-04' && session.evidence.queue) {
      if (label === 'nomor') values[field.id] = session.evidence.queue.id;
      if (label === 'waktu panggil') values[field.id] = session.evidence.queue.updatedAt;
      if (label === 'status') values[field.id] = session.evidence.queue.status;
      if (label === 'loket/poli') values[field.id] = session.records['call-queue']?.counter ?? 'Loket 1';
    } else if (form.id === 'F-M16-06' && session.evidence.movement) {
      const stock = 10 - session.records['place-prescription'].quantity;
      if (label === 'on-hand' || label === 'available') values[field.id] = stock + ' unit';
      if (label === 'mutation') values[field.id] = session.evidence.movement.id + ' · ' + session.evidence.movement.status;
    }
  }
  return values;
}
function takeSnapshot(session, workspace, actor) {
  if (workspace !== 'guide' && !canAccess(actor, workspace))
    fail(403, 'DEMO_ROLE_DENIED', 'Akun demo ini tidak memiliki penugasan di workspace tersebut.');
  if (workspace === 'guide' && (!staffIds.includes(actor) || portalRoles.has(actor)))
    fail(403, 'DEMO_ROLE_DENIED', 'Panduan demo tersedia untuk akun petugas.');
  const current = pendingStep(session);
  const portalAuthorized = session.portal.consent && (actor === 'patient' || session.portal.grant);
  const history = workspace === 'CH01' && !portalAuthorized ? [] : session.events.filter(event => canSeeEvent(workspace, event));
  const portal = workspace === 'CH01' ? {
    consent: session.portal.consent, grant: session.portal.grant,
    authorized: session.portal.consent && (actor === 'patient' || session.portal.grant),
    appointment: session.portal.consent && (actor === 'patient' || session.portal.grant) ? session.portal.appointment : null,
    documents: session.portal.consent && (actor === 'patient' || session.portal.grant) ? session.portal.documents : [],
  } : null;
  return {
    ...flags,
    id: session.id, version: session.version, workflowId: session.workflow?.id ?? 'forms',
    patient: workspace === 'CH01' && !portalAuthorized ? { id: '', name: '', mrn: '', birthDate: '' } : session.patient,
    episodeId: workspace === 'CH01' && !portalAuthorized ? '' : session.episodeId, workspace,
    evidence: workspace === 'CH01' ? [] : Object.values(session.evidence),
    current: workspace === 'CH01' ? null : current?.id ?? null,
    progress: workspace === 'CH01' ? [] : (session.workflow?.steps ?? []).filter(step => matchesProgress(session, step)).map(step =>
      ({ id: step.id, status: session.records[step.id] ? 'done' : step === current ? 'active' : 'pending' })),
    records: workspace === 'CH01' ? {} : Object.fromEntries(history.filter(event => event.command in session.records).map(event => [event.command, session.records[event.command]])),
    history,
    forms: forms.filter(form => form.module === workspace && (workspace !== 'CH01' || portalAuthorized)).map(form => ({
      id: form.id, values: formValues(form, session), saved: !!session.savedForms[form.id],
      canWrite: !form.readOnly && (actor === 'admin' || form.roles.includes(actor)),
    })),
    portal,
  };
}

function validateFields(fields, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    fail(422, 'DEMO_VALIDATION', 'Lengkapi data pada formulir.');
  const clean = {};
  const details = [];
  function issue(field, message) {
    details.push({ field: field.id, reason: message });
  }
  for (const field of fields) {
    if (field.readOnly) continue;
    const value = values[field.id];
    const blank = value === undefined || value === null || (typeof value === 'string' && !value.trim());
    if (blank) {
      if (field.required !== false) issue(field, 'Wajib diisi.');
      continue;
    }
    if (field.type === 'confirm' || field.type === 'boolean') {
      if (typeof value !== 'boolean' || (field.type === 'confirm' && !value)) issue(field, 'Perlu dikonfirmasi.');
    } else if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < (field.min ?? 0) ||
          (field.max !== undefined && value > field.max) || (/integer|bpm|money/.test(field.spec ?? '') && !Number.isInteger(value)))
        issue(field, 'Masukkan angka dalam rentang yang diizinkan.');
    } else if (typeof value !== 'string' || value.length > 500) {
      issue(field, 'Gunakan teks hingga 500 karakter.');
    } else if (field.type === 'choice' && !field.options.includes(value)) {
      issue(field, 'Pilih salah satu nilai yang tersedia.');
    } else if (field.type === 'date' || field.type === 'datetime') {
      const pattern = field.type === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      const timestamp = Date.parse(field.type === 'date' ? value + 'T00:00:00Z' : value + ':00Z');
      if (!pattern.test(value) || !Number.isFinite(timestamp) || !new Date(timestamp).toISOString().startsWith(value)) issue(field, 'Pilih tanggal dan waktu yang valid.');
    } else if (field.label === 'NIK' && !/^\d{16}$/.test(value)) {
      issue(field, 'Gunakan 16 digit contoh.');
    }
    clean[field.id] = typeof value === 'string' ? value.trim() : value;
  }
  if (details.length) fail(422, 'DEMO_VALIDATION', 'Periksa isian yang ditandai.', details);
  return clean;
}

function conditionalFields(form, values) {
  const field = label => form.fields.find(item => item.label === label);
  const value = label => values?.[field(label)?.id];
  const required = label => field(label) && { ...field(label), required: true };
  const additional = [];
  if (form.id === 'F-M01-02' && value('payer') === 'BPJS demo' && value('serviceType') === 'RJ') additional.push(required('referralNumber'));
  if (form.id === 'F-M03-03' && ['admit', 'refer'].includes(value('disposition'))) additional.push(required('destination'));
  if (form.id === 'F-M05-04' && /^LAB/i.test(value('orderCode') ?? '')) additional.push(required('specimenType'));
  if (form.id === 'F-M09-03') {
    const numeric = value('numericValue');
    const textual = value('textValue');
    if ((numeric === undefined || numeric === '') && !textual)
      fail(422, 'DEMO_VALIDATION', 'Isi nilai numerik atau hasil teks.', [{ field: field('numericValue').id, reason: 'Isi salah satu jenis hasil.' }]);
  }
  return form.fields.map(item => additional.find(extra => extra?.id === item.id) ?? item);
}
function applyPortal(session, command, actor, values) {
  if (!portalRoles.has(actor)) fail(403, 'DEMO_ROLE_DENIED', 'Gunakan identitas pasien atau wali demo.');
  const portal = session.portal;
  if (actor === 'guardian' && (!portal.consent || !portal.grant))
    fail(403, 'DEMO_PORTAL_SCOPE', 'Pasien belum memberikan kuasa aktif.');
  if (command === 'portal-grant' || command === 'portal-revoke' || command === 'portal-consent') {
    if (actor !== 'patient') fail(403, 'DEMO_PORTAL_SCOPE', 'Keputusan kuasa tersedia untuk pasien pemilik akun.');
    if (command !== 'portal-consent' && !portal.consent) fail(409, 'DEMO_PORTAL_SCOPE', 'Aktifkan persetujuan terlebih dahulu.');
    if (command === 'portal-revoke') {
      const checked = validateFields([{ id: 'reason', label: 'Alasan', type: 'text' }], values);
      if (!portal.grant) fail(409, 'DEMO_PORTAL_SCOPE', 'Kuasa sedang tidak aktif.');
      portal.grant = false;
      return ['Kuasa dicabut', checked];
    }
    if (command === 'portal-grant') {
      portal.grant = true;
      return ['Kuasa wali demo aktif', {}];
    }
    const checked = validateFields([{ id: 'enabled', label: 'Consent', type: 'boolean' }], values);
    portal.consent = checked.enabled;
    if (!portal.consent) portal.grant = false;
    return [portal.consent ? 'Persetujuan portal diaktifkan' : 'Persetujuan portal dicabut', checked];
  }
  if (!portal.consent) fail(403, 'DEMO_PORTAL_SCOPE', 'Persetujuan portal perlu diaktifkan.');
  if (command === 'portal-book') {
    const checked = validateFields([{ id: 'slot', label: 'Jadwal', type: 'choice', options: ['Selasa 09.00 · Poli Penyakit Dalam', 'Kamis 10.00 · Poli Penyakit Dalam'] }], values);
    if (portal.appointment) fail(409, 'DEMO_APPOINTMENT_EXISTS', 'Janji aktif sudah tersedia.');
    portal.appointment = { id: 'J-' + session.id.slice(0, 8).toUpperCase(), slot: checked.slot };
    return ['Janji temu dibuat', checked];
  }
  if (command !== 'portal-cancel' || !portal.appointment) fail(409, 'DEMO_APPOINTMENT_NOT_FOUND', 'Janji aktif tidak ditemukan.');
  portal.appointment = null;
  return ['Janji temu dibatalkan', {}];
}

export function createDemoSessions({ newId = () => crypto.randomUUID(), now = () => new Date().toISOString() } = {}) {
  const sessions = new Map();
  const created = new Map();
  const portalCommands = new Set(['portal-book', 'portal-cancel', 'portal-grant', 'portal-revoke', 'portal-consent']);
  function idempotencyKey(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(value))
      fail(400, 'DEMO_IDEMPOTENCY_REQUIRED', 'Kunci idempotensi demo tidak valid.');
    return value;
  }
  function lookup(id) {
    const session = sessions.get(id);
    if (!session) fail(404, 'DEMO_SESSION_NOT_FOUND', 'Kasus demo sudah tidak tersedia. Mulai kasus baru dari panduan.');
    return session;
  }
  return {
    start(workflowId, actor, key) {
      if (!staffIds.includes(actor)) fail(403, 'DEMO_ROLE_DENIED', 'Identitas demo tidak dikenal.');
      const workflow = catalog.get(workflowId);
      if (!workflow && workflowId !== 'forms') fail(422, 'DEMO_WORKFLOW_UNKNOWN', 'Pilih skenario yang tersedia.');
      const creationKey = actor + ':' + idempotencyKey(key);
      const previous = created.get(creationKey);
      if (previous) {
        if (previous.workflowId !== workflowId) fail(409, 'DEMO_REPLAY_CONFLICT', 'Permintaan ini sudah digunakan untuk skenario lain.');
        return takeSnapshot(lookup(previous.id), portalRoles.has(actor) ? 'CH01' : 'guide', actor);
      }
      const id = newId();
      const suffix = id.slice(0, 8).toUpperCase();
      const session = {
        id, version: 1, workflow,
        patient: { id: newId(), name: 'Pasien Simulasi ' + (workflow?.id.slice(-2) ?? 'QA'), mrn: 'DEMO-' + suffix, birthDate: '1988-04-15' },
        episodeId: newId(), records: {}, savedForms: {}, events: [], evidence: {},
        keys: new Map(), creationKey,
        portal: {
          consent: true, grant: false, appointment: null,
          documents: [{ id: 'DOC-' + suffix, title: 'Ringkasan kunjungan demo sebelumnya', content: 'Dokumen ilustratif yang sudah dirilis untuk pasien demo.' }],
        },
      };
      if (sessions.size >= sessionLimit) {
        const oldest = sessions.keys().next().value;
        created.delete(sessions.get(oldest).creationKey);
        sessions.delete(oldest);
      }
      sessions.set(id, session);
      created.set(creationKey, { id, workflowId });
      return takeSnapshot(session, portalRoles.has(actor) ? 'CH01' : 'guide', actor);
    },
    read(id, workspace, actor) {
      return takeSnapshot(lookup(id), workspace, actor);
    },
    execute(id, command, { actor, key, expectedVersion, values, correlationId }) {
      const session = lookup(id);
      idempotencyKey(key);
      const at = now();
      const form = command.startsWith('save-') ? formsById.get(command.slice(5)) : undefined;
      const step = session.workflow?.steps.find(item => item.id === command);
      const portalAction = portalCommands.has(command);
      const workspace = portalAction ? 'CH01' : step?.workspace ?? form?.module;
      if (!workspace) fail(404, 'DEMO_COMMAND_UNKNOWN', 'Aksi demo tidak tersedia.');
      if (!canAccess(actor, workspace) || (step && step.role !== actor && actor !== 'admin') ||
          (form && (form.readOnly || (actor !== 'admin' && !form.roles.includes(actor)))))
        fail(403, 'DEMO_ROLE_DENIED', 'Aksi ini memerlukan penugasan demo yang sesuai.');
      const canonicalValues = Object.entries(values ?? {}).sort(([a], [b]) => a.localeCompare(b));
      const fingerprint = JSON.stringify([command, expectedVersion, canonicalValues]);
      const replay = session.keys.get(actor + ':' + key);
      if (replay) {
        if (replay !== fingerprint) fail(409, 'DEMO_REPLAY_CONFLICT', 'Kunci percobaan digunakan dengan data berbeda.');
        return { ...takeSnapshot(session, workspace, actor), replay: true };
      }
      if (expectedVersion !== session.version) fail(412, 'DEMO_STALE', 'Data kasus telah berubah. Muat ulang sebelum menyimpan.');
      if (session.events.length >= eventLimit) fail(409, 'DEMO_CASE_LIMIT', 'Riwayat kasus penuh. Mulai kasus baru.');
      let output;
      let clean;
      if (step) {
        if (pendingStep(session) !== step) fail(409, 'DEMO_STEP_LOCKED', 'Selesaikan atau terima langkah sebelumnya terlebih dahulu.');
        clean = validateFields(step.fields, values);
        const invalid = step.failure?.find(issue => clean[issue.field] === issue.value);
        if (invalid) fail(409, 'DEMO_CASE_BLOCKED', invalid.message, [{ field: invalid.field, reason: invalid.message }]);
        if (command === 'receive-payment' && clean.amount !== 50000)
          fail(422, 'DEMO_PAYMENT_AMOUNT', 'Jumlah pembayaran kasus demo harus sesuai alokasi pasien Rp50.000.', [{ field: 'amount', reason: 'Alokasi pasien Rp50.000.' }]);
        if (command === 'place-prescription' && clean.quantity > 10)
          fail(422, 'DEMO_STOCK_INSUFFICIENT', 'Produk demo memiliki stok 10 unit.', [{ field: 'quantity', reason: 'Maksimal 10 unit pada kasus ini.' }]);
        session.records[command] = clean;
        recordEvidence(session, command, clean, at);
        output = step.output;
        if (command === 'book-appointment') session.portal.appointment = { id: session.evidence.appointment.id, slot: clean.slot };
        if (command === 'check-in') session.portal.appointment = null;
        if (command === 'close-encounter') session.portal.documents.push({ id: 'RESUME-' + id.slice(0, 8), title: 'Resume kunjungan simulasi', content: clean.summary });
      } else if (form) {
        clean = validateFields(conditionalFields(form, values), values);
        session.savedForms[form.id] = { ...formValues(form, session), ...clean };
        output = form.title + ' tersimpan sebagai catatan demo';
      } else {
        [output, clean] = applyPortal(session, command, actor, values);
      }
      const reference = workspace + '-' + id.slice(0, 6).toUpperCase() + '-' + String(session.version).padStart(2, '0');
      session.events.push({ command, form: step?.form ?? form?.id ?? 'F-CH01-01', workspace, actor, output, reference, at, correlationId });
      session.version++;
      session.keys.set(actor + ':' + key, fingerprint);
      return { ...takeSnapshot(session, workspace, actor), replay: false };
    },
  };
}
