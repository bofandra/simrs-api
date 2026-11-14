/**
 * HOSNEX M10 RIS synthetic form workflow (FR-018, US-MED-02, partial WF-06).
 * Process-memory only: no DICOM acquisition, real study UID, PACS viewer,
 * legal sign, patient PHI, persistence, downstream clinical or FHIR actions.
 */
export const RADIOLOGY_DEMO_IDS=Object.freeze([
  '00100000-0000-4000-8000-000000000001',
  '00100000-0000-4000-8000-000000000002'
]);
const EPISODE='d091ae84-9548-4a24-8191-4106bc504111';
const PATIENT='af7b7648-1a67-4589-96d0-a970c983b111';
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=(status,code,message,details=[])=>({status,code,message,details});
const flags=()=>({
  module:'M10',mock:true,simulated:true,persisted:false,realWorldEffect:false,
  stateScope:'process-memory',draftOnly:true,legalSignature:false,
  signed:false,published:false,pacsAvailable:false,viewerAvailable:false,
  dicomAcquired:false,readOnly:false
});
function checkString(value,field,errors,min=2,max=2000){
  if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)
    errors.push({field,message:`Wajib ${min}-${max} karakter`});
}
const seed=(id,index,modality,exam,accession,priority)=>({
  id,episodeId:EPISODE,patientId:PATIENT,version:1,
  accessionNumber:accession,exam,modality,priority,
  indication:'Indikasi untuk pasien simulasi; bukan order klinis tervalidasi',
  orderOrigin:'seed-only',cpoeLinked:false,orderId:null,
  status:'placed',scheduledAt:'',technician:'',identityChecked:false,
  contraindicationChecked:false,
  acquisitionNote:'',operator:'',performedAt:'',
  studyReference:null,report:{findings:'',impression:'',recommendation:'',
    critical:false,communication:'',radiologist:''},
  reportSaved:false,qaReviewed:false,reviewer:'',history:[],
  label:`Order radiologi fiktif ${index}`
});
export function createRadiologyDemoStore(loadSyntheticCpoeOrders=()=>[]){
  const records=new Map([
    [RADIOLOGY_DEMO_IDS[0],seed(RADIOLOGY_DEMO_IDS[0],1,'DX','Thorax PA',
      'DEMO-ACSN-0001','Routine')],
    [RADIOLOGY_DEMO_IDS[1],seed(RADIOLOGY_DEMO_IDS[1],2,'CT','CT Kepala tanpa kontras',
      'DEMO-ACSN-0002','Urgent')]
  ]);
  const dedupe=new Map();
  // Bridge to the SAME process-memory CPOE order store. No fabricated external
  // PACS records or duplicate RAD orders; IDs and encounter/patient must match.
  const refreshCpoe=()=>{
    for(const order of loadSyntheticCpoeOrders()){
      if(!order||order.category!=='RAD'||!['THX','CTH','USG'].includes(order.serviceCode)||
         !order.id||!order.encounterId||!order.patientId||records.has(order.id))continue;
      const exam=order.serviceCode==='THX'?'Thorax PA':
        order.serviceCode==='CTH'?'CT Kepala tanpa kontras':'USG Abdomen';
      const modality=order.serviceCode==='THX'?'DX':order.serviceCode==='CTH'?'CT':'US';
      const row=seed(order.id,records.size+1,modality,exam,
        'DEMO-ACSN-'+order.id.slice(0,8).toUpperCase(),
        order.urgency==='urgent'?'Urgent':'Routine');
      row.patientId=order.patientId;
      row.episodeId=order.encounterId;
      row.orderId=order.id;
      row.orderOrigin='synthetic-cpoe';
      row.cpoeLinked=true;
      row.indication=order.indication;
      row.label='CPOE sintetis • '+exam;
      records.set(row.id,row);
    }
  };
  const snapshot=id=>{
    refreshCpoe();
    const record=records.get(id);
    return record?{...flags(),...copy(record)}:null;
  };
  const list=()=>{refreshCpoe();return {...flags(),items:[...records.values()].map(r=>({
    id:r.id,episodeId:r.episodeId,patientId:r.patientId,
    accessionNumber:r.accessionNumber,label:r.label,exam:r.exam,modality:r.modality,
    priority:r.priority,status:r.status,version:r.version,
    orderOrigin:r.orderOrigin,cpoeLinked:r.cpoeLinked,orderId:r.orderId
  }))};};
  const save=(id,section,body,key)=>{
    refreshCpoe();
    const current=records.get(id);
    if(!current)return fail(404,'RADIOLOGY_ORDER_NOT_FOUND','Order radiologi sintetis tidak ditemukan');
    if(!['schedule','acquisition-note','report','qa-review'].includes(section))
      return fail(404,'UNKNOWN_RADIOLOGY_ACTION','Aksi M10 tidak dikenal');
    if(typeof key!=='string'||key.length<8)
      return fail(400,'IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key minimal 8 karakter');
    if(!body||!Number.isInteger(body.expectedVersion)||body.expectedVersion<1)
      return fail(422,'EXPECTED_VERSION_REQUIRED','Versi dokumen positif wajib tersedia');
    const fingerprint=JSON.stringify(body);
    const lookup=id+':'+section+':'+key;
    const seen=dedupe.get(lookup);
    if(seen){
      if(seen.fingerprint!==fingerprint)
        return fail(409,'IDEMPOTENCY_REUSE_CONFLICT','Retry dengan key sama membawa payload berbeda');
      return {status:200,data:{...copy(seen.data),idempotentReplay:true}};
    }
    if(body.expectedVersion!==current.version)
      return fail(412,'STALE_VERSION','Order M10 sudah berubah, muat ulang untuk lanjut');
    if(current.qaReviewed)
      return fail(409,'QA_REVIEW_LOCKED','Draf telah direview untuk QA saja, tidak dapat diubah');
    const errors=[];
    const next=copy(current);
    if(section==='schedule'){
      if(current.status!=='placed')
        return fail(409,'INVALID_TRANSITION','Jadwal hanya dari status placed');
      checkString(body.technician,'technician',errors,2,120);
      if(typeof body.scheduledAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(body.scheduledAt)||
         !Number.isFinite(Date.parse(body.scheduledAt))||!/[zZ]|[+-]\d\d:\d\d$/.test(body.scheduledAt))
        errors.push({field:'scheduledAt',message:'Waktu ISO 8601 dengan zona waktu wajib diisi'});
      if(body.identityChecked!==true)
        errors.push({field:'identityChecked',message:'Checklist identitas pasien demo wajib'});
      if(body.contraindicationChecked!==true)
        errors.push({field:'contraindicationChecked',message:'Checklist kontraindikasi demo wajib'});
      if(errors.length)return fail(422,'SCHEDULE_VALIDATION_ERROR','Penjadwalan contoh tidak valid',errors);
      next.technician=body.technician.trim();next.scheduledAt=body.scheduledAt;
      next.identityChecked=true;next.contraindicationChecked=true;
      next.status='scheduled-demo';
    }
    if(section==='acquisition-note'){
      if(current.status!=='scheduled-demo')
        return fail(409,'SCHEDULE_REQUIRED','Penjadwalan demo wajib sebelum catatan akuisisi');
      checkString(body.operator,'operator',errors,2,120);
      checkString(body.acquisitionNote,'acquisitionNote',errors,5,1000);
      if(body.identityChecked!==true)
        errors.push({field:'identityChecked',message:'Konfirmasi identitas simulasi wajib'});
      if(errors.length)return fail(422,'ACQUISITION_NOTE_VALIDATION_ERROR','Catatan simulasi invalid',errors);
      next.operator=body.operator.trim();next.acquisitionNote=body.acquisitionNote.trim();
      next.performedAt='2026-11-14T10:00:00+07:00';
      next.status='acquisition-note-demo';
      // Explicitly no StudyInstanceUID or DICOM, even after this stage.
      next.studyReference=null;
    }
    if(section==='report'){
      if(!['acquisition-note-demo','report-draft'].includes(current.status))
        return fail(409,'ACQUISITION_NOTE_REQUIRED','Catatan pemeriksaan simulasi wajib tersedia');
      const report=body.report;
      if(!report||typeof report!=='object'||Array.isArray(report))
        return fail(422,'REPORT_REQUIRED','Isi draf laporan diperlukan');
      checkString(report.findings,'findings',errors,5,2000);
      checkString(report.impression,'impression',errors,5,2000);
      checkString(report.radiologist,'radiologist',errors,2,120);
      if(typeof report.recommendation!=='string'||report.recommendation.length>1000)
        errors.push({field:'recommendation',message:'Rekomendasi harus teks maksimal 1000 karakter'});
      if(typeof report.critical!=='boolean')
        errors.push({field:'critical',message:'Penanda critical harus boolean'});
      if(typeof report.communication!=='string'||report.communication.length>500||
         (report.critical===true&&report.communication.trim().length<8))
        errors.push({field:'communication',message:'Catatan komunikasi wajib bila critical, maksimal 500 karakter'});
      if(errors.length)return fail(422,'REPORT_VALIDATION_ERROR','Draft ekspertise fiktif tidak valid',errors);
      next.report={
        findings:report.findings.trim(),impression:report.impression.trim(),
        recommendation:report.recommendation.trim(),critical:report.critical,
        communication:report.communication.trim(),radiologist:report.radiologist.trim()
      };
      next.reportSaved=true;next.status='report-draft';
    }
    if(section==='qa-review'){
      if(current.status!=='report-draft'||!current.reportSaved)
        return fail(409,'REPORT_DRAFT_REQUIRED','Simpan laporan draft terlebih dahulu');
      checkString(body.reviewer,'reviewer',errors,2,120);
      if(body.acknowledged!==true)
        errors.push({field:'acknowledged',message:'Akui bahwa review bukan sign resmi'});
      if(errors.length)return fail(422,'QA_REVIEW_VALIDATION_ERROR','Review QA tidak valid',errors);
      next.qaReviewed=true;next.reviewer=body.reviewer.trim();
      next.status='qa-reviewed-demo';
    }
    next.version++;
    next.history.push({
      version:next.version,section,at:'2026-11-14T10:00:00+07:00',
      actor:section==='qa-review'?next.reviewer:section==='report'?next.report.radiologist:
        section==='schedule'?next.technician:next.operator,
      label:section==='schedule'?'Jadwal contoh':section==='acquisition-note'?
        'Catatan pemeriksaan fiktif; bukan DICOM':section==='report'?
        'Ekspertise draft tanpa signature':'Review QA tanpa otorisasi klinis'
    });
    records.set(id,next);
    const data={...snapshot(id),idempotentReplay:false};
    dedupe.set(lookup,{fingerprint,data});
    return {status:200,data};
  };
  return {ids:RADIOLOGY_DEMO_IDS,list,snapshot,save};
}
