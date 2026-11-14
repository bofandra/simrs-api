/**
 * HOSNEX M05 medical documentation mock: draft only, no legal signature.
 * The synthetic episode and values exist only in Node process memory.
 */
export const EPISODE_ID='d091ae84-9548-4a24-8191-4106bc504111';
const PATIENT_ID='af7b7648-1a67-4589-96d0-a970c983b111';
const summaryKeys=['course','diagnosis','treatment','condition','followUp'];
const codes=['I10','E11.9','J06.9','K30','E78.5','M54.5','K80.2','A91','S61.0'];
const flags=()=>({
  module:'M05',mock:true,simulated:true,persisted:false,
  realWorldEffect:false,stateScope:'process-memory',
  draftOnly:true,legalSignature:false
});
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=(status,code,message,details=[])=>({status,code,message,details});
const checkText=(v,min,max,name,errors)=>{
  if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)
    errors.push({field:name,message:'Panjang wajib '+min+' sampai '+max+' karakter'});
};
export function createMedicalDraftStore(clinical){
  const current={
    episodeId:EPISODE_ID,patientId:PATIENT_ID,version:1,
    summary:{course:'',diagnosis:'',treatment:'',condition:'',followUp:''},
    coding:{primary:'',secondary:[],evidence:'',coder:''},
    summarySaved:false,codingSaved:false,reviewedDemo:false,reviewer:'',history:[]
  };
  const dedupe=new Map();
  const triageReady=()=>clinical.list('M03').items[0]?.status!=='waiting';
  const snapshot=()=>({...flags(),...copy(current),clinicalContext:{
    triageStatus:clinical.list('M03').items[0]?.status??'unknown',
    triageReady:triageReady()
  },signed:false,codingVerified:false,exported:false});
  const catalog=()=>({...flags(),items:[{
    episodeId:EPISODE_ID,patientId:PATIENT_ID,
    title:'Pasien Sintetis IGD — A',mrn:'MRN-DEMO-IGD-001',
    status:current.reviewedDemo?'reviewed-demo':current.summarySaved||current.codingSaved?
      'draft-in-progress':'not-started',version:current.version
  }]});
  const save=(episodeId,section,body,key)=>{
    if(episodeId!==EPISODE_ID)return fail(404,'DEMO_EPISODE_NOT_FOUND','Episode fiktif tidak ditemukan');
    if(!['summary','coding','review'].includes(section))
      return fail(404,'UNKNOWN_SECTION','Bagian dokumen mock tidak dikenal');
    if(typeof key!=='string'||key.length<8)
      return fail(400,'IDEMPOTENCY_KEY_REQUIRED','Kunci permintaan minimum 8 karakter');
    if(!body||!Number.isInteger(body.expectedVersion)||body.expectedVersion<1)
      return fail(422,'EXPECTED_VERSION_REQUIRED','Versi harus bilangan positif');
    const dedupeKey=section+':'+key,payload=JSON.stringify(body),previous=dedupe.get(dedupeKey);
    if(previous){
      if(previous.payload!==payload)return fail(409,'IDEMPOTENCY_REUSE_CONFLICT','Isi retry berbeda');
      return {status:200,data:{...copy(previous.data),idempotentReplay:true}};
    }
    if(body.expectedVersion!==current.version)
      return fail(412,'STALE_VERSION','Dokumen sudah berubah; muat ulang');
    if(current.reviewedDemo)
      return fail(409,'REVIEWED_DRAFT_LOCKED','Draf sudah ditinjau secara sintetis');
    const errors=[];
    if(section==='summary'){
      const data=body.summary;
      if(!data||typeof data!=='object'||Array.isArray(data))
        return fail(422,'SUMMARY_REQUIRED','Data resume belum tersedia');
      const summary={};
      for(const k of summaryKeys){
        checkText(data[k],3,2000,k,errors);
        summary[k]=typeof data[k]==='string'?data[k].trim():'';
      }
      if(errors.length)return fail(422,'SUMMARY_VALIDATION_ERROR','Kelima bagian resume belum valid',errors);
      current.summary=summary;current.summarySaved=true;
    }
    if(section==='coding'){
      if(!current.summarySaved)return fail(409,'SUMMARY_DRAFT_REQUIRED','Simpan resume draf lebih dulu');
      const data=body.coding;
      if(!data||typeof data!=='object'||Array.isArray(data))
        return fail(422,'CODING_REQUIRED','Form koding tidak tersedia');
      if(!codes.includes(data.primary))errors.push({field:'primary',message:'Diagnosis utama harus dari katalog contoh'});
      if(!Array.isArray(data.secondary)||data.secondary.length>8||
        data.secondary.some(v=>!codes.includes(v)||v===data.primary)||
        new Set(data.secondary).size!==data.secondary.length)
        errors.push({field:'secondary',message:'Diagnosis sekunder duplikat atau tidak valid'});
      checkText(data.evidence,5,2000,'evidence',errors);
      checkText(data.coder,2,120,'coder',errors);
      if(errors.length)return fail(422,'CODING_VALIDATION_ERROR','Draf koding invalid',errors);
      current.coding={primary:data.primary,secondary:[...data.secondary],
        evidence:data.evidence.trim(),coder:data.coder.trim()};
      current.codingSaved=true;
    }
    if(section==='review'){
      if(!current.summarySaved||!current.codingSaved)
        return fail(409,'DRAFTS_INCOMPLETE','Resume dan koding draf belum tersimpan');
      if(!triageReady())
        return fail(409,'TRIAGE_CONTEXT_REQUIRED','Triase IGD M03 sintetis belum dilakukan');
      checkText(body.reviewer,2,120,'reviewer',errors);
      if(body.acknowledged!==true)
        errors.push({field:'acknowledged',message:'Harus mengakui review hanya QA'});
      if(errors.length)return fail(422,'REVIEW_VALIDATION_ERROR','Review demo tidak lengkap',errors);
      current.reviewedDemo=true;current.reviewer=body.reviewer.trim();
    }
    current.version+=1;
    current.history.push({
      version:current.version,section,at:'2026-11-14T10:00:00+07:00',
      actor:section==='review'?current.reviewer:section==='coding'?current.coding.coder:'Petugas DEMO',
      label:section==='review'?'Review QA saja, bukan signature medis':
        section==='coding'?'Koding ICD-10 draf, bukan verifikasi legal':'Resume draf, belum final'
    });
    const data={...snapshot(),idempotentReplay:false};
    dedupe.set(dedupeKey,{payload,data});
    return {status:200,data};
  };
  return {episodeId:EPISODE_ID,catalog,snapshot,save};
}
