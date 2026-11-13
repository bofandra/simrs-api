import { readFileSync, writeFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const load=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
function compose(base,legacy,exp,domain,trace){
 const x=JSON.parse(JSON.stringify(base)), deep=v=>JSON.parse(JSON.stringify(v));
 const ref=n=>({$ref:"#/components/schemas/"+n});
 const U={type:"string",format:"uuid",example:"11111111-1111-4111-8111-111111111111"};
 const iso="2026-11-13T08:00:00+07:00";
 const tmap=new Map(trace.operations.map(t=>[t.operationId,t]));
 const catalog=new Map(legacy.operations.map(o=>[o.operationId,o]));
 x.openapi="3.1.0";
 x.info.title="SIMRS Baru — Comprehensive API Contract v3.1 (candidate)";
 x.info.version="3.1.0-candidate.1";
 x.info.description="106 PRD v3.0 candidate operations plus 74 proposed lifecycle operations for M01 M02 M05 M09 M11. For FE-BE review only; NOT production. No real clinical, stock, finance, signature or national partner action.";
 x["x-release-status"]="candidate; clinical/FE/BE sign-off required";
 x["x-architecture"]="on-premise Node.js modular monolith, transactional outbox, PostgreSQL, OIDC, async integration adapters";
 x["x-compatibility-warning"]="Existing list GET operations now use page envelope instead of bare arrays; candidate breaking change.";
 x.components.schemas={...x.components.schemas,...deep(domain.schemas)};
 x.components.securitySchemes.patientBearerAuth={type:"http",scheme:"bearer",bearerFormat:"JWT",description:"Separate CH01 audience; proposed, NOT implemented"};
 x.components.headers={ETag:{description:"Optimistic resource version",schema:{type:"string"},example:'"1"'},
  "X-Correlation-ID":{description:"Request/response trace",schema:U},
  "X-SIMRS-Mock":{description:"Synthetic sandbox; never a real operation",schema:{type:"string",enum:["true"]}}};
 const resolve=s=>s?.$ref?x.components.schemas[s.$ref.split("/").pop()]:s;
 function sample(s,k="",depth=0){
  if(depth>10)return null;s=resolve(s)||{};
  if(s.example!==undefined)return deep(s.example);
  if(k==="patientId")return "d2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1";
  if(k==="encounterId")return "85ba4e38-9d86-41ce-9b6e-7f8af4d19768";
  if(k==="fullName"||k==="name")return "Pasien Simulasi A";
  if(k==="mrn")return "DEMO-MRN-001";
  if(k==="system")return "https://example.invalid/terminology";
  if(k==="reason"||k==="changeReason")return "Alasan demo dicatat";
  if(s.enum)return s.enum[0];
  if(s.type==="object"){const a={};for(const z of s.required||[])a[z]=sample(s.properties?.[z],z,depth+1);return a}
  if(s.type==="array")return [sample(s.items,k,depth+1)];
  if(s.type==="integer"||s.type==="number")return Math.max(1,s.minimum||1);
  if(s.type==="boolean")return true;
  if(s.format==="uuid")return U.example;
  if(s.format==="date")return "2026-11-13";
  if(s.format==="date-time")return iso;
  if(Array.isArray(s.type)&&s.type.includes("null"))return null;
  return "DEMO";
 }
 const E={400:"MALFORMED_REQUEST",401:"UNAUTHENTICATED",403:"FORBIDDEN",404:"NOT_FOUND",409:"STATE_CONFLICT",412:"STALE_VERSION",422:"BUSINESS_VALIDATION_FAILED",429:"RATE_LIMITED",500:"INTERNAL_ERROR",503:"DEPENDENCY_UNAVAILABLE"};
 const err=code=>({description:E[code],content:{"application/json":{schema:ref("ProblemV31"),example:{code:E[code],message:"Respons error simulasi "+E[code],details:[],correlationId:"a9f0bc36-b553-41c6-b2f0-d8e970b2ae10",retryable:[429,500,503].includes(+code)}}}});
 const state={reviewPatientMatch:"reviewed",bookAppointment:"booked",callQueue:"called",completeOutpatientEncounter:"completed",createClinicalNote:"draft",signClinicalNote:"signed",recordDiagnosis:"active",createServiceOrder:"placed",createCarePlan:"draft",createReferral:"requested",receiveSpecimen:"received",submitLabResults:"draft",verifyLabReport:"verified",recordCultureAST:"draft",createPrescription:"ordered",reviewPrescription:"reviewed",dispensePrescription:"dispensed",recordMedicationAdministration:"given"};
 for(const [path,vs] of Object.entries(x.paths))for(const [method,o] of Object.entries(vs)){
  if(!["get","post","patch","put","delete"].includes(method))continue;
  const l=tmap.get(o.operationId),orig=catalog.get(o.operationId);
  if(!l||!orig)throw new Error("Missing source trace: "+o.operationId);
  Object.assign(o,{"x-contract-status":"PRD-v3.0-candidate","x-source-provenance":"PRD v3.0 Bab 10.2","x-fr":l.fr,"x-us":l.us,"x-forms":l.forms,"x-workflows":l.workflows,"x-traceability-confidence":l.mappingConfidence,"x-permission":l.permission});
  if(l.module==="CH01")o.security=[{patientBearerAuth:[]}];
  for(const code of Object.keys(E))if(!(method==="get"&&code==="412"))o.responses[code]=err(code);
  const ok=Object.keys(o.responses).find(k=>/^2\d\d$/.test(k));
  const entry=o.responses[ok]?.content?.["application/json"];
  if(method==="get"&&entry?.schema?.type==="array"){
   const old=entry.schema.items;
   entry.schema={type:"object",required:["items","pageInfo"],additionalProperties:false,properties:{items:{type:"array",items:old},pageInfo:ref("PageInfo")}};
   entry.example={items:Array.isArray(entry.example)?entry.example:[],pageInfo:{nextCursor:null,pageSize:20,hasMore:false}};
   for(const [name,schema] of [["cursor",{type:"string"}],["pageSize",{type:"integer",minimum:1,maximum:100,default:20}],["sort",{type:"string"}]])o.parameters.push({name,in:"query",required:false,schema});
   o["x-breaking-change"]="v3.1 list response now uses envelope; migrate existing FE consumer explicitly";
  }
  if(entry?.example?.status==="draft"){
   const explicit=orig.responseSpec.match(/status=([A-Za-z-]+)/)?.[1];
   const st=explicit||state[o.operationId];
   entry.example.status=st||"CONTRACT_REVIEW_REQUIRED";
   o["x-response-state-provenance"]=st?(explicit?"PRD response spec":"PRD module behavior; confirm"):"unresolved; do not consume until finalized";
   if(!st)o["x-contract-gaps"]=["Success status enum/semantic not specified in PRD v3.0; requires review"];
   if(entry.schema?.properties?.status&&st)entry.schema.properties.status={type:"string",enum:[st]};
  }
  o.responses[ok].headers={...o.responses[ok].headers,ETag:{$ref:"#/components/headers/ETag"},"X-Correlation-ID":{$ref:"#/components/headers/X-Correlation-ID"}};
 }
 function typ(s){
  const t={uuid:deep(U),string:{type:"string",minLength:1},int:{type:"integer",minimum:1},number:{type:"number"},bool:{type:"boolean"},date:{type:"string",format:"date"},datetime:{type:"string",format:"date-time"},code:ref("Codeable"),object:{type:"object",additionalProperties:true},"lab-results":{type:"array",minItems:1,items:ref("LabAnalyte")},"medication-items":{type:"array",minItems:1,items:ref("MedicationLine")},"return-lines":{type:"array",minItems:1,items:{type:"object",required:["prescriptionItemId","lotId","quantity"],properties:{prescriptionItemId:deep(U),lotId:deep(U),quantity:{type:"number",exclusiveMinimum:0}}}}};
  if(t[s])return t[s];
  const m=/^enum\(([^)]+)\)$/.exec(s);
  if(m)return {type:"string",enum:m[1].split(",")};
  if(s.endsWith("[]"))return {type:"array",items:typ(s.slice(0,-2))};
  throw Error("Unknown field type "+s);
 }
 function body(fields){
  const schema={type:"object",properties:{},required:[],additionalProperties:false};let d=0,part="",splits=[];
  for(const c of fields){if(c==="(")d++;if(c===")")d--;if(c===","&&d===0){splits.push(part.trim());part=""}else part+=c}if(part)splits.push(part.trim());
  for(const str of splits){
   const m=/^([A-Za-z][A-Za-z0-9_]*):(.+?)([!?])?$/.exec(str);
   if(!m)throw Error("Bad request descriptor "+str);
   const p=m[1],t=m[2],flag=m[3],s=typ(t);
   if(p==="reason"||p==="changeReason"){s.minLength=8;s.maxLength=500}
   schema.properties[p]=s;if(flag==="!")schema.required.push(p);
  }
  return schema;
 }
 function isList(op){return op.startsWith("list")||["getLabTestCatalog","getLabReferenceRanges","getEncounterTimeline","getEncounterCarePlans","getDispensableLines","getPharmacyStockAvailability"].includes(op)}
 function filters(op){
  const f={listScheduleSlots:["unitId","practitionerId","date","status"],listQueueTickets:["unitId","date","status"],listServiceUnits:["serviceType","status"],listClinicalNotes:["encounterId","status","authorId"],listServiceOrders:["encounterId","category","status"],listPrescriptions:["encounterId","status"],listDispenses:["prescriptionId","status"],listMedicationAdministrations:["encounterId","status"],getLabTestCatalog:["q","status"],getPharmacyStockAvailability:["locationId","medicationCode"]};
  return f[op]||[];
 }
 for(const n of exp.operations){
  if(!x.components.schemas[n.resource])throw Error("Missing schema "+n.resource);
  const method=n.method.toLowerCase(),v=x.paths[n.path]||{};
  if(v[method])throw Error("Method collision "+n.path);
  const paged=method==="get"&&isList(n.operationId);
  const responseSchema=paged?{type:"object",required:["items","pageInfo"],additionalProperties:false,properties:{items:{type:"array",items:ref(n.resource)},pageInfo:ref("PageInfo")}}:ref(n.resource);
  const example=paged?{items:[sample(ref(n.resource))],pageInfo:{nextCursor:null,pageSize:20,hasMore:false}}:sample(ref(n.resource));
  if(n.targetState&&example?.status)example.status=n.targetState;
  const created=method==="post"&&/^(create|record|recollect)/.test(n.operationId);
  const success=method==="get"?200:created?201:200;
  const params=[...Array.from(n.path.matchAll(/\{([^}]+)\}/g)).map(m=>({name:m[1],in:"path",required:true,schema:m[1]==="code"?{type:"string"}:deep(U)})),{$ref:"#/components/parameters/CorrelationId"}];
  if(paged){
   for(const name of ["cursor","pageSize","sort",...filters(n.operationId)]){
    params.push({name,in:"query",required:false,schema:name==="pageSize"?{type:"integer",minimum:1,maximum:100,default:20}:name==="date"?{type:"string",format:"date"}:name.endsWith("Id")?deep(U):{type:"string"}});
   }
  }
  const lock=method==="patch"||n.requestFields.includes("expectedVersion");
  const op={tags:[n.module],operationId:n.operationId,summary:n.operationId.replace(/([a-z])([A-Z])/g,"$1 $2"),description:"NEW v3.1 PROPOSAL (not verbatim PRD). "+n.rationale,
   "x-contract-status":"proposed-v3.1; FE/BE and clinical review required",
   "x-source-provenance":"Inferred from PRD v3.0 form/workflow gap",
   "x-module":n.module,"x-permission":n.permission,"x-fr":n.fr,"x-us":n.us,"x-forms":n.forms,"x-workflows":n.workflows,
   "x-target-state":n.targetState,"x-optimistic-lock":lock,"x-idempotency-required":method!=="get","x-simulation-only":true,
   parameters:params,responses:{}};
  if(method!=="get"){
    op.parameters.push({$ref:"#/components/parameters/IdempotencyKey"});
    if(lock)op.parameters.push({$ref:"#/components/parameters/IfMatch"});
    const schema=body(n.requestFields);
    op.requestBody={required:true,content:{"application/json":{schema,example:sample(schema)}}};
  }
  op.responses[String(success)]={description:"Synthetic example (not an actual hospital operation)",headers:{ETag:{$ref:"#/components/headers/ETag"},"X-Correlation-ID":{$ref:"#/components/headers/X-Correlation-ID"}},content:{"application/json":{schema:responseSchema,example}}};
  for(const code of Object.keys(E))if(!(method==="get"&&code==="412"))op.responses[code]=err(code);
  v[method]=op;x.paths[n.path]=v;
 }
 const all=Object.entries(x.paths).flatMap(([path,o])=>Object.entries(o).filter(([m])=>["get","post","patch","put","delete"].includes(m)).map(([m,v])=>({path,method:m,id:v.operationId})));
 if(all.length!==180||new Set(all.map(y=>y.id)).size!==180)throw Error("Expected 180 unique operations, got "+all.length);
 x["x-operation-count"]=all.length;
 x["x-operation-breakdown"]=Object.fromEntries(["get","post","patch","put","delete"].map(m=>[m,all.filter(t=>t.method===m).length]));
 x["x-workflow-coverage"]={designed:["WF-01","WF-02","WF-05","WF-07"],pending:["WF-03","WF-04","WF-06","WF-08","WF-09","WF-10","WF-11","WF-12"]};
 return x;
}
const spec=compose(load('openapi.json'),load('contracts/operations.json'),load('contracts/v3.1/expansions.json'),load('contracts/v3.1/domain-schemas.json'),load('contracts/v3.1/traceability.json'));
const str=JSON.stringify(spec,null,2)+'\n';
if(process.argv.includes('--check')){
if(readFileSync(join(root,'openapi-v3.1.json'),'utf8')!==str){console.error('Contract artifact out of sync; run npm run build:v3.1');process.exit(1)}
console.log('PASS: 178 operations; reproducible OpenAPI v3.1 artifact');
}else{writeFileSync(join(root,'openapi-v3.1.json'),str);console.log('Wrote OpenAPI v3.1: '+spec['x-operation-count']+' operations')}
