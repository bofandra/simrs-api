/**
 * HOSNEX contract-design mock responder.
 *
 * This is NOT a production SIMRS API. It never writes PHI, inventory, ledgers,
 * clinical signatures, or database state. A distinct __mock namespace is used
 * so that missing PRD contracts are not mistaken for approved endpoints.
 *
 * Coverage: every action actually present in HOSNEX's audited local store.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const coverage = JSON.parse(readFileSync(fileURLToPath(new URL('./contracts/hosnex-action-coverage.json', import.meta.url)), 'utf8'));
export const actionCatalog = Object.freeze(coverage.actions.map(entry => Object.freeze({
  action:entry.frontendAction,
  module:entry.module,
  priority:entry.priority,
  mapping:entry.status,
  operationIds:entry.existingOperationIds,
  note:entry.note
})));
const actions = new Map(actionCatalog.map(x=>[x.action,x]));
const token = (label) => createHash('sha256').update('hosnex-demo-fixture:'+label).digest('hex').slice(0,12);
const uuid = (label) => {
  const hex=createHash('sha256').update('hosnex-demo-entity:'+label).digest('hex');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
};
const demoId=(label)=>uuid(label);
const statusFor=(action)=>{
  if(/^(cancel|void|revoke|reject)/i.test(action))return 'cancelled';
  if(/^(sign|approve|review|verify|validate)/i.test(action))return 'verified';
  if(/^(publish|release|issue|send|submit)/i.test(action))return 'released';
  if(/^(close|complete|discharge|finish)/i.test(action))return 'completed';
  if(/^(deliver|dispense|pay|post)/i.test(action))return 'processed';
  if(/^(start|perform|begin|collect|receive|accept)/i.test(action))return 'in-progress';
  return 'draft';
};
function sampleFor(action, module){
  const id=demoId(module+'/'+action);
  const common={id,status:statusFor(action),version:1,
    organizationId:'DEMO-RS-001',updatedAt:'2026-11-14T08:00:00+07:00'};
  if(module==='M01')return {...common,patientId:demoId('patient'),registrationId:demoId('registration'),
    encounterId:demoId('encounter'),queueTicketId:demoId('ticket'),queueNumber:'A-001',mrn:'DEMO-MRN-001'};
  if(module==='M02'||module==='M05')return {...common,patientId:demoId('patient'),encounterId:demoId('encounter'),
    documentId:demoId(module+'/note'),signed:false,amendmentOf:null};
  if(module==='M03')return {...common,encounterId:demoId('emergency-encounter'),triageCategory:'yellow',
    reassessmentRequired:false};
  if(module==='M04')return {...common,admissionId:demoId('admission'),bedId:demoId('ward-bed'),unitVisitId:demoId('ward-visit')};
  if(module==='M07')return {...common,surgeryCaseId:demoId('surgery-case'),checklistStatus:'pending'};
  if(module==='M08')return {...common,bloodRequestId:demoId('blood-request'),bloodUnitId:demoId('blood-unit'),
    crossmatchStatus:'not-performed'};
  if(module==='M09')return {...common,orderId:demoId('lab-order'),specimenId:demoId('specimen'),
    reportId:demoId('lab-report'),analyte:'HB',result:null,critical:false};
  if(module==='M10')return {...common,orderId:demoId('radiology-order'),
    studyInstanceUid:'1.2.826.0.1.3680043.8.498.123456',reportId:demoId('radiology-report')};
  if(module==='M11')return {...common,prescriptionId:demoId('prescription'),dispenseId:demoId('dispense'),
    pharmacyReview:'pending',stockMovementIds:[]};
  if(module==='M12')return {...common,dietOrderId:demoId('diet-order'),mealBatchId:demoId('meal-batch')};
  if(module==='M13'||module==='M14')return {...common,invoiceId:demoId('invoice'),
    claimId:demoId('claim'),amountMinorUnits:0,currency:'IDR',transmittedToPayer:false};
  if(module==='M16')return {...common,itemId:demoId('inventory-item'),stockMovementIds:[]};
  if(module==='M17')return {...common,assetId:demoId('asset'),workOrderId:demoId('asset-work-order')};
  if(module==='M18')return {...common,staffId:demoId('staff'),credentialId:demoId('credential')};
  if(module==='M19')return {...common,incidentId:demoId('patient-safety-incident'),
    severity:'not-assessed',actionPlanId:demoId('safety-action')};
  if(module==='M21')return {...common,jobId:demoId('integration-job'),
    sentToSatusehat:false,externalResponse:null};
  if(module==='CH01')return {...common,appointmentId:demoId('appointment'),
    proxyGrantId:demoId('proxy'),disclosedDocuments:[]};
  return common;
}
export function getMockActionCatalog(module){
  return module ? actionCatalog.filter(entry=>entry.module===module) : actionCatalog;
}
export function simulateHosnexAction(name) {
  const action=actions.get(name);
  if(!action)return null;
  return {
    mock:true,simulated:true,persisted:false,realWorldEffect:false,
    responseKind:'HOSNEX_STORE_ACTION_FIXTURE',action:name,module:action.module,
    contractMapping:action.mapping,relatedOperationIds:action.operationIds,
    fixture:sampleFor(name,action.module),
    warnings:[
      'Fiktif: ini hanya contoh respons, bukan bukti perubahan state klinis.',
      ...(action.mapping==='missing' ? ['Belum ada padanan kontrak API; perlu spesifikasi PRD/kontrak.'] : [])
    ]
  };
}
export function isKnownAction(name){return actions.has(name);}
export const mockActionCoverage={total:actionCatalog.length,candidate:coverage.counts.candidate,
  partial:coverage.counts.partial,missing:coverage.counts.missing};
