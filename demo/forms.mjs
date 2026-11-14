import catalog from './forms-v4.json' with { type: 'json' };

export const workspaceRoles = {
  M01: ['admission'], M02: ['doctor', 'nurse', 'admission'], M03: ['emergency'],
  M04: ['bed', 'nurse', 'doctor', 'emergency'], M05: ['doctor', 'nurse', 'emergency', 'quality', 'lab', 'claims', 'specialty', 'radiology', 'pharmacy', 'operating', 'integrator'],
  M06: ['nurse'], M07: ['operating'], M08: ['specialty'], M09: ['lab', 'doctor', 'emergency', 'specialty'],
  M10: ['radiographer', 'radiology', 'doctor', 'emergency'], M11: ['pharmacy', 'doctor', 'nurse'],
  M12: ['nutrition', 'nurse'], M13: ['cashier'], M14: ['claims'], M15: ['accounting'],
  M16: ['warehouse', 'pharmacy'], M17: ['assets'], M18: ['hr'], M19: ['quality'],
  M20: ['analytics', 'accounting'], M21: ['admin', 'integrator'], CH01: ['patient', 'guardian'],
};
export const staffIds = ['admin', ...new Set(Object.values(workspaceRoles).flat().filter(role => role !== 'admin'))];
const formRoles = {
  'F-M02-02': ['doctor'], 'F-M02-03': ['doctor'],
  'F-M04-01': ['bed'], 'F-M04-02': ['bed'], 'F-M04-04': ['doctor'],
  'F-M05-02': ['nurse', 'doctor'], 'F-M05-08': ['doctor', 'quality'],
  'F-M10-01': ['radiographer'], 'F-M10-02': ['radiology'], 'F-M10-03': ['doctor', 'radiology'],
  'F-M11-01': ['doctor'], 'F-M11-02': ['pharmacy'], 'F-M11-03': ['pharmacy'], 'F-M11-04': ['nurse'],
  'F-M16-06': ['warehouse', 'pharmacy'],
  'F-M21-01': ['admin'], 'F-M21-02': ['admin'], 'F-M21-03': ['admin'], 'F-M21-04': ['admin'],
};
const readOnlyForms = new Set(['F-M01-04', 'F-M01-05', 'F-M02-01', 'F-M04-01', 'F-M10-03', 'F-M13-01', 'F-M16-01', 'F-M16-06', 'F-M20-02', 'F-M20-03', 'F-M20-04', 'F-CH01-01']);
const choices = {
  'F-M01-01:sex': ['Laki-laki', 'Perempuan'],
  'F-M01-02:serviceType': ['RJ', 'IGD', 'RI'],
  'F-M01-02:payer': ['Umum', 'BPJS demo', 'Asuransi demo'],
  'F-M01-03:status': ['Tersedia', 'Dipesan', 'Penuh'],
  'F-M03-01:arrivalMode': ['Datang sendiri', 'Ambulans demo', 'Rujukan demo'],
  'F-M03-01:triagePriority': ['ATS 1', 'ATS 2', 'ATS 3', 'ATS 4', 'ATS 5'],
  'F-M04-01:class': ['Kelas 1', 'Kelas 2', 'Kelas 3'],
  'F-M04-03:status': ['Dirawat', 'Siap pulang'],
  'F-M04-04:bedReleaseStatus': ['Menunggu', 'Pembersihan'],
  'F-M09-03:abnormalFlag': ['Normal demo', 'Abnormal demo', 'Kritis demo'],
  'F-M13-03:paymentMethod': ['Tunai demo', 'Transfer demo'],
  'F-M16-03:inspectionStatus': ['Diterima', 'Ditolak'],
  'F-M16-05:itemCategory': ['Obat', 'BMHP', 'Barang umum'],
  'F-M16-07:status': ['Disetujui', 'Parsial', 'Ditolak'],
  'F-M17-04:status siap': ['Siap', 'Perlu tindak lanjut'],
};
const countPattern = /decimal|integer|score|bpm|percent|number\+unit|money|\bkg\b|\bcm\b|^C$|^\/min/i;
function prepareField(formId, field) {
  const { label, spec } = field;
  const readOnly = /read-only|\boutput\b/.test(spec);
  const required = !readOnly && !/opsional|jika|conditional|\?| or /.test(spec) && !(formId === 'F-M09-03' && label === 'textValue');
  const options = choices[formId + ':' + label] ??
    (/^[a-z][a-z-]*(\/[a-z][a-z-]*){1,5}$/.test(spec.split(' ')[0]) &&
     !/enum\/code|text\/reference|date\/datetime|identifier\/code|date\/plan|unit\/organization|month\/date|system\+code/.test(spec)
      ? spec.split(' ')[0].split('/') : undefined);
  let type = 'text';
  if (options) type = 'choice';
  else if (spec === 'boolean') type = 'boolean';
  else if (spec.startsWith('datetime')) type = 'datetime';
  else if (spec.startsWith('date') || spec.startsWith('month/date')) type = 'date';
  else if (countPattern.test(spec) && !spec.includes('[]') && !spec.includes(' or ')) type = 'number';
  const max = /percent/.test(spec) ? 100 : /pain|painScore/i.test(label) ? 10 : undefined;
  return { ...field, type, options, readOnly, required, max, min: /positive/.test(spec) ? 1 : 0 };
}
export const forms = catalog.forms.map(form => ({
  ...form, fields: form.fields.map(field => prepareField(form.id, field)),
  roles: formRoles[form.id] ?? workspaceRoles[form.module],
  readOnly: readOnlyForms.has(form.id),
}));
