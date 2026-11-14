/**
 * Synthetic ED -> inpatient bed -> nursing read/workflow model for HOSNEX.
 * Process-memory only, demo personas and IDs, NO EHR/clinical persistence.
 * This namespace is NOT part of the candidate production OpenAPI.
 */
const ORG='DEMO-RS-001';
const encounterId='d091ae84-9548-4a24-8191-4106bc504111';
const patientId='af7b7648-1a67-4589-96d0-a970c983b111';
const bedId='dd2b1d6b-3a93-4e44-b543-302e029c4111';
const now='2026-11-14T09:00:00+07:00';
const definitions=Object.freeze({
  M03:{title:'IGD & Triase',label:'Penilaian awal hingga permintaan rawat inap',
    steps:[['waiting','triage','triaged'],['triaged','reassess','reassessed'],
      ['reassessed','request-admission','admission-requested']]},
  M04:{title:'Rawat Inap & Bed',label:'Reservasi, admisi, pemindahan ke bangsal',
    steps:[['pending','reserve-bed','reserved'],['reserved','admit-bed','admitted']]},
  M06:{title:'Keperawatan',label:'Asesmen awal dan serah terima SBAR',
    steps:[['pending','assess','assessed'],['assessed','handover','handed-over']]}
});
const validModules=Object.keys(definitions);
const makeStage=status=>({status,version:1,history:[]});
export function createClinicalWorkspaceStore(){
  const stages={M03:makeStage('waiting'),M04:makeStage('pending'),M06:makeStage('pending')};
  const replay=new Map();
  const available=(module)=>{
    if(module==='M04') return stages.M03.status==='admission-requested';
    if(module==='M06') return stages.M04.status==='admitted';
    return true;
  };
  const toRecord=(module)=>{
    const definition=definitions[module],stage=stages[module];
    return {
      id:encounterId,module,patientId,encounterId,bedId,
      title:'Pasien Sintetis IGD — A',secondary:'MRN-DEMO-IGD-001',
      location:module==='M03'?'IGD Triase':module==='M04'?'Bangsal Demo A':'Nurse Station Demo A',
      status:stage.status,version:stage.version,
      context:definition.label,actions:definition.steps.filter(step=>step[0]===stage.status).map(step=>step[1]),
      history:stage.history.map(x=>({...x})),
      ...(module==='M03'&&stage.triageDetails?{triageDetails:structuredClone(stage.triageDetails)}:{})
    };
  };
  const flags=(module)=>({mock:true,simulated:true,persisted:false,realWorldEffect:false,
    stateScope:'process-memory',module,organizationId:ORG});
  const catalog=()=>validModules.map(module=>({module,title:definitions[module].title,available:available(module),
    state:stages[module].status}));
  const list=(module)=>({ ...flags(module),title:definitions[module].title,
    items:available(module)?[toRecord(module)]:[],total:available(module)?1:0,
    blockedBy:available(module)?null:(module==='M04'?'M03 request-admission':'M04 admit-bed') });
  const detail=(module,id)=>id!==encounterId||!available(module)?null:{...flags(module),record:toRecord(module)};
  const apply=(module,id,action,body,key)=>{
    if(!definitions[module]||id!==encounterId||!available(module))
      return {status:404,code:'DEMO_RECORD_NOT_FOUND',message:'Record sintetis tidak tersedia'};
    if(!key || key.length<8) return {status:400,code:'IDEMPOTENCY_KEY_REQUIRED',message:'Idempotency-Key minimal 8 karakter'};
    if(!body || !Number.isInteger(body.expectedVersion) || body.expectedVersion<1)
      return {status:422,code:'EXPECTED_VERSION_REQUIRED',message:'expectedVersion wajib integer positif'};
    const idemKey=module+'/'+id+'/'+key;
    const payload=JSON.stringify({action,body});
    const previous=replay.get(idemKey);
    if(previous){
      if(previous.payload!==payload)return {status:409,code:'IDEMPOTENCY_REUSE_CONFLICT',message:'Payload retry berbeda'};
      return {status:200,data:{...previous.data,idempotentReplay:true}};
    }
    const stage=stages[module];
    if(body.expectedVersion!==stage.version)return {status:412,code:'STALE_VERSION',message:'Versi record berubah; muat ulang worklist'};
    const step=definitions[module].steps.find(row=>row[1]===action);
    if(!step)return {status:422,code:'UNKNOWN_DEMO_ACTION',message:'Transisi tidak dikenal untuk modul'};
    if(stage.status!==step[0])return {status:409,code:'INVALID_TRANSITION',message:'Tindakan tidak sesuai status sekarang'};
    // Optional v3.5 HOSNEX DTO: validated without coupling the legacy mock
    // triage workflow to real patients, FHIR or a production triage endpoint.
    if(module==='M03'&&action==='triage'&&body.triage!==undefined){
      const t=body.triage;
      if(!t || typeof t!=='object' || Array.isArray(t) ||
         t.encounterId!==encounterId || t.patientId!==patientId)
        return {status:422,code:'TRIAGE_IDENTITY_MISMATCH',message:'Encounter dan pasien harus berasal dari detail IGD sintetis'};
      if(typeof t.complaint!=='string'||!t.complaint.trim()||
         !Number.isInteger(t.atsLevel)||t.atsLevel<1||t.atsLevel>5)
        return {status:422,code:'TRIAGE_REQUIRED_FIELDS',message:'Keluhan dan tingkat ATS 1–5 wajib'};
      if(t.overrideReason!==undefined&&(typeof t.overrideReason!=='string'||t.overrideReason.trim().length<3))
        return {status:422,code:'TRIAGE_OVERRIDE_REASON_INVALID',message:'Alasan override ATS harus jelas'};
      if(!t.vitals||typeof t.vitals!=='object'||Array.isArray(t.vitals)||
         Object.values(t.vitals).some(v=>typeof v!=='number'||!Number.isFinite(v)))
        return {status:422,code:'TRIAGE_VITALS_INVALID',message:'Tanda vital hanya angka finit pada mock'};
      stage.triageDetails={
        complaint:t.complaint.trim(),atsLevel:t.atsLevel,
        ...(t.overrideReason?{overrideReason:t.overrideReason.trim()}:{}),
        vitals:structuredClone(t.vitals)
      };
    }
    stage.status=step[2];stage.version++;
    stage.history.push({action,status:stage.status,version:stage.version,at:now,actor:'DEMO-STAFF'});
    const data={...flags(module),record:toRecord(module),transition:action,idempotentReplay:false};
    replay.set(idemKey,{payload,data});
    return {status:200,data};
  };
  return {catalog,list,detail,apply,validModule:module=>Boolean(definitions[module])};
}
