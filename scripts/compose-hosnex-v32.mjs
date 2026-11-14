/**
 * Compose the HOSNEX v3.2 review overlay over the immutable v3.1 candidate.
 * This intentionally does not claim a server implementation or production approval.
 * Keep all 180 original operationIds/methods/paths unchanged.
 */
export function buildHosnexV32Spec(base, overlay) {
  if (base.openapi !== '3.1.0') throw new Error('OpenAPI v3.1 source required');
  if (overlay.status !== 'PROPOSAL_ONLY') throw new Error('Only a review overlay is supported');
  const spec=structuredClone(base);
  const existingIds=new Set(Object.values(spec.paths).flatMap(methods=>Object.values(methods).filter(x=>x?.operationId).map(x=>x.operationId)));
  const overlayIds=new Set();
  for(const candidate of overlay.operations){
    const {operationId,method,path,module,permission,requestSchema,responseSchema,responseExample,successStatus,frontendActions}=candidate;
    if(existingIds.has(operationId)||overlayIds.has(operationId))throw new Error('Duplicate operationId: '+operationId);
    overlayIds.add(operationId);
    if (!['GET','POST','PATCH'].includes(method) || !path.startsWith('/api/v1/')) throw new Error('Unsupported operation '+operationId);
    const key=method.toLowerCase();
    if(spec.paths[path]?.[key])throw new Error('Route conflict: '+method+' '+path);
    const params=[...path.matchAll(/\{([^}]+)\}/g)].map(([,name])=>({name,in:'path',required:true,schema:{type:'string'},description:'Path parameter for synthetic contract review'}));
    const responseBody={description:'Synthetic candidate response only — not production',content:{'application/json':{schema:responseSchema,example:responseExample}}};
    const responses={[successStatus]:responseBody};
    for(const status of [400,401,403,404,409,412,422,501]){
      if(status===successStatus)continue;
      responses[status]={description:'Structured Problem (candidate)',content:{'application/json':{schema:{type:'object',required:['code','message','correlationId','retryable'],properties:{code:{type:'string'},message:{type:'string'},correlationId:{type:'string'},retryable:{type:'boolean'},details:{type:'array',items:{type:'object',additionalProperties:true}}}}}}};
    }
    const op={
      operationId,tags:[module],summary:operationId+' — HOSNEX P0 PROPOSAL',
      description:candidate.notes,
      deprecated:false,
      'x-contract-status':'review-only',
      'x-hosnex-frontend-actions':frontendActions,
      'x-permission':permission,
      parameters:params,
      responses
    };
    if(method!=='GET') {
      op.parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8}});
      op.requestBody={required:true,content:{'application/json':{schema:requestSchema}}};
    }
    (spec.paths[path] ??= {})[key]=op;
  }
  spec.info={...spec.info,version:overlay.info.version,title:'SIMRS API + HOSNEX P0 (review-only)'};
  spec['x-overlay-status']='PROPOSAL_ONLY';
  spec['x-overlay-new-operations']=overlay.operations.length;
  return spec;
}
