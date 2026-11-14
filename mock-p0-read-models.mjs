/**
 * Five safe P0/P1 synthetic read models supporting HOSNEX's global API mode.
 * No real PHI, billing, insurer, inventory, SATUSEHAT or database operations.
 * Read-only snapshots are assembled from the shared synthetic clinical episode.
 */
import {buildExtendedReadModels,EXTRA_READ_MODULES,EXTRA_TITLES} from './mock-extended-read-models.mjs';
export const P0_READ_MODULES = Object.freeze(['M05','M13','M14','M16','M21',...EXTRA_READ_MODULES]);
const EPISODE='d091ae84-9548-4a24-8191-4106bc504111';
const PATIENT='af7b7648-1a67-4589-96d0-a970c983b111';
const INVENTORY_A='8f8e0111-cbee-44f7-b929-217cf9410601';
const INVENTORY_B='8f8e0222-cbee-44f7-b929-217cf9410602';
const labels={
  M05:'Rekam Medis — kelengkapan berkas',
  M13:'Billing — simulasi tagihan',
  M14:'Penjamin dan Klaim — kesiapan berkas',
  M16:'Inventori — stok contoh',
  M21:'SATUSEHAT — pratinjau FHIR',
  ...EXTRA_TITLES
};
const check=(label,done)=>({label,done:Boolean(done)});
const field=(label,value)=>({label,value:String(value)});
const flags=module=>({
  module,organizationId:'DEMO-RS-001',mock:true,simulated:true,
  persisted:false,realWorldEffect:false,readOnly:true,stateScope:'process-memory'
});
function snapshot(clinical,medicalDrafts){
  const ed=clinical.list('M03').items[0];
  const ward=clinical.list('M04').items[0];
  const nurse=clinical.list('M06').items[0];
  const triaged=['triaged','reassessed','admission-requested'].includes(ed.status);
  const admitted=ward?.status==='admitted';
  const nursingDone=nurse?.status==='handed-over';
  const notes=[
    {
      id:'cf210111-64aa-4ea0-813c-7bf489010001',title:'Resume episode IGD (simulasi)',
      subtitle:'Tidak memiliki tanda tangan klinis/legal',
      status:triaged?'review-needed':'awaiting-triage',
      fields:[field('Encounter ID',EPISODE),field('Pasien','Pasien Sintetis IGD — A'),
        field('Ringkasan','Contoh alur IGD; tidak berisi catatan medis nyata')],
      checklist:[check('Triase IGD telah dicatat dalam simulasi',triaged),
        check('Permintaan rawat inap sintetis tersedia',ed.status==='admission-requested')]
    },
    {
      id:'cf210222-64aa-4ea0-813c-7bf489010002',title:'Catatan serah terima SBAR (simulasi)',
      subtitle:'Belum menjadi dokumen pasien yang sah',
      status:nursingDone?'review-needed':'incomplete',
      fields:[field('Encounter ID',EPISODE),field('Pasien','Pasien Sintetis IGD — A'),
        field('Sumber data','Tahap keperawatan dalam RAM Node')],
      checklist:[check('Pasien sudah diadmisi ke bangsal (demo)',admitted),
        check('Serah terima SBAR disimulasikan',nursingDone)]
    }
  ];
  const clinicalDraft=medicalDrafts?.snapshot?.();
  if(clinicalDraft){
    notes[0].status=clinicalDraft.reviewedDemo?'reviewed-demo':
      clinicalDraft.summarySaved?'summary-draft-saved':notes[0].status;
    notes[0].checklist.push(check('Draf resume M05 sudah disimpan',clinicalDraft.summarySaved));
    notes[0].checklist.push(check('Draf ICD-10 sudah disimpan',clinicalDraft.codingSaved));
    notes[0].checklist.push(check('Review QA (bukan tanda tangan legal)',clinicalDraft.reviewedDemo));
    notes[0].fields.push(field('Versi draf M05',clinicalDraft.version));
  }
  const readyForReview=triaged&&admitted&&nursingDone;
  const billing=[{
    id:'ae140111-999a-46c1-b6ce-129031090001',
    title:'Pratinjau biaya episode rawat inap',subtitle:'DEMO-INVOICE-0001 · bukan tagihan sah',
    status:'estimate-only',
    fields:[field('Encounter ID',EPISODE),field('Akomodasi contoh','Rp450.000'),
      field('Pelayanan contoh','Rp200.000'),field('Total simulasi','Rp650.000'),
      field('Pembayaran','Tidak tersedia; tidak ada debit/kredit')],
    checklist:[check('Nominal hanya data dummy',true),check('Pembayaran nyata telah dilakukan',false)]
  }];
  const claims=[{
    id:'ae150111-999a-46c1-b6ce-129031090002',
    title:'Draft berkas penjamin sintetis',subtitle:'DEMO-CLAIM-0001 · tidak pernah dikirim ke penjamin',
    status:readyForReview?'review-only':'missing-supporting-documents',
    fields:[field('Encounter ID',EPISODE),field('Jenis penjamin','Contoh saja — bukan verifikasi eligibilitas'),
      field('Status pengajuan','Belum diajukan; tidak tersedia API BPJS nyata')],
    checklist:[check('Triase fiktif tercatat',triaged),
      check('Admisi bangsal fiktif selesai',admitted),
      check('SBAR fiktif selesai',nursingDone),
      check('Verifikasi eligibilitas BPJS nyata',false)]
  }];
  const inventory=[
    {
      id:INVENTORY_A,title:'Sarung tangan nitril ukuran M',
      subtitle:'DEMO-SKU-NIT-M · angka stok fiktif',status:'sample-stock-only',
      fields:[field('SKU','DEMO-SKU-NIT-M'),field('Stok contoh','120 kotak'),field('Lokasi','Gudang Demo A'),
        field('Batch','DUMMY-BATCH-001')],
      checklist:[check('Data dummy inventori',true),check('Mutasi stok produksi tersedia',false)]
    },
    {
      id:INVENTORY_B,title:'Kasa steril',
      subtitle:'DEMO-SKU-KAS-01 · angka stok fiktif',status:'sample-low-stock',
      fields:[field('SKU','DEMO-SKU-KAS-01'),field('Stok contoh','8 pak'),field('Batas simulasi','12 pak'),
        field('Lokasi','Gudang Demo A')],
      checklist:[check('Peringatan stok rendah contoh',true),check('Distribusi/release stok produksi tersedia',false)]
    }
  ];
  const interoperability=[{
    id:'f4110001-1234-4ac4-801e-20ffae001111',
    title:'FHIR Bundle pratinjau fiktif',subtitle:'Patient / Encounter / Observation · tidak dikirim',
    status:'never-submitted',
    fields:[field('Encounter ID',EPISODE),field('Patient ID',PATIENT),
      field('Resource demo','Patient, Encounter, Observation'),
      field('Format','FHIR-inspired example (bukan resource validasi nasional)'),
      field('Pengiriman SATUSEHAT','DILARANG — dry-run UI saja')],
    checklist:[check('Patient ID sintetis tersedia',true),
      check('Tahap IGD sintetis selesai',ed.status==='admission-requested'),
      check('Mapping FHIR terverifikasi terhadap profil SATUSEHAT',false),
      check('Transmisi SATUSEHAT nyata',false)]
  }];
  const data={M05:notes,M13:billing,M14:claims,M16:inventory,M21:interoperability,
    ...buildExtendedReadModels(clinical)};
  return Object.fromEntries(Object.entries(data).map(([module,records])=>[module,
    records.map(record=>({
      ...record,module,readOnly:true,
      encounterId:Object.hasOwn(record,'encounterId')?record.encounterId:(module==='M16'?null:EPISODE),
      patientId:Object.hasOwn(record,'patientId')?record.patientId:(module==='M16'?null:PATIENT),
      checklist:record.checklist.map(x=>({...x})),fields:record.fields.map(x=>({...x}))
    }))
  ]));
}
export function createP0ReadModels(clinical,medicalDrafts){
  const validModule=module=>P0_READ_MODULES.includes(module);
  const list=module=>{
    const items=snapshot(clinical,medicalDrafts)[module];
    return {...flags(module),title:labels[module],
      total:items.length,items:items.map(({id,title,subtitle,status,module,encounterId,readOnly})=>
        ({id,title,subtitle,status,module,encounterId,readOnly}))};
  };
  const detail=(module,id)=>{
    const record=snapshot(clinical,medicalDrafts)[module].find(x=>x.id===id);
    return record?{...flags(module),record}:null;
  };
  return {validModule,list,detail,modules:P0_READ_MODULES};
}
