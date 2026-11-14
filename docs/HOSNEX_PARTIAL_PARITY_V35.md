# HOSNEX ↔ SIMRS API v3.5 — 29 partial action semantic alignment

**Source:** HOSNEX `src/lib/simrs/store.ts`, on main 14 November 2026, and backend static audit `contracts/hosnex-action-coverage.json`.

## Outcome
- 29 historically **partial** action mappings inspected by source signature and action behavior.
- **21 semantically distinct operations** proposed, in `contracts/v3.5/partial-operations.json`, rather than reusing misleading IDs.
- **8 require explicit adapter to existing endpoints** (portal appointment book/cancel/check-in; issueInvoice; addPatient; register; addTriage; saveEncounter). Their source signatures and mapping risks are captured in `contracts/v3.5/partial-action-alignment.json`.
- 247 prior API candidates remain unchanged. Total v3.5 **268 candidate operationIds**, **not 268 stateful workflow implementations**.
- Every v3.5 HTTP response marks `mock:true`, `simulated:true`, `persisted:false`, `realWorldEffect:false`. Draf is not legal signing, transfusion start, medication dispensing, invoice payment, clinical verification, inventory mutation, claim processing, PACS or external FHIR delivery.

## Acceptance remaining
1. 21 new proposals need FE typed clients, domain mock state-machine rules and request/response validation beyond schema snapshots.
2. 8 reuse proposals need adapter transformations, semantics/permissions review and negative tests; particularly MRN, L/P gender, rupiah, portal patient-audience, encounter ID and queue status.
3. 27 original candidate mappings and newly added HOSNEX actions need current live source audit.
4. All 97 forms, 84 FR, 76 US, 12 workflows require individual traceability and acceptance. Contract candidate coverage alone does not mean this goal is completed.

## Run
`npm run check:v3.5 && npm test && npm run start:v3.5`

No deployment or real FE-to-host connectivity is in scope for this phase.
