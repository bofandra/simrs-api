# SIMRS API Contract v3.1 — Comprehensive Clinical Core (Candidate)

**Source baseline:** PRD SIMRS Baru v3.0, 12 November 2026 (21 modules + Patient Portal CH01). **Target topology:** On-Premise, Node.js modular monolith, PostgreSQL HA, OIDC, transactional outbox and separate integration worker.

**Status:** Proposal for FE/BE contract review, NOT a production schema freeze; all examples and mock calls contain synthetic data only.

## What changed

| Scope | Original PRD v3.0 APIs | New proposed lifecycle endpoints | Candidate total |
|---|---:|---:|---:|
| M01 Registration / Booking / Queue | 8 | 16 | 24 |
| M02 Outpatient | 3 | 7 | 10 |
| M05 Clinical RME / CPOE | 9 | 18 | 27 |
| M09 LIS | 5 | 18 | 23 |
| M11 Pharmacy / BCMA | 4 | 15 | 19 |
| Other M03–M21 + CH01 | 77 | 0 | 77 |
| **TOTAL** | **106** | **74** | **180** |

Source audit note: mapping from original PRD is included in `../operations.json`; proposed fields and resource definitions are curated in `expansions.json` and `domain-schemas.json`. The 74 **added operations are not directly specified by PRD Chapter 10.2** and must be validated with clinical operations and UI forms.

## Files and scope

- `../../openapi.json` — preserved source v3.0 (106 operations), not silently changed.
- `../../openapi-v3.1.json` — compiled candidate containing 180 operations.
- `expansions.json` — curated 74 proposed endpoints with FR/US/form/WF metadata.
- `domain-schemas.json` — 47 reusable schemas for the clinical core.
- `traceability.json` — 180 operation-level traceability records. **77 original operations remain module-level only**; do not interpret broad FR/US matches as verified per-operation requirements.
- `state-machines.json` — 11 modelled domain state machines, expected transitions/guards/evidence.
- `workflows.json` — 12 WF indices; only WF-01/02/05/07 are designed in detail. The remaining 8 are placeholders for further contract development.
- `domain-events.json` — versioned internal event envelope, outbox and deduplication principles.
- `integration-boundaries.json` — conceptual SATUSEHAT/BPJS/RS Online/analyzer/PACS/PSrE/payment adapter boundaries, NOT made-up partner API contracts.

## API conventions

- Versioned REST under `/api/v1`, stable `operationId` and per-operation `x-fr`, `x-us`, `x-forms`, `x-workflows`.
- Token roles and organization/unit/patient scope come from verified identity and care assignment, NEVER client-selected headers in real deployment.
- `Idempotency-Key` required on commands, `If-Match` for versioned state-changing transitions, correlation ID on requests/responses.
- JSON errors share `ProblemV31{code,message,details,correlationId,retryable}`; expected errors 400,401,403,404,409,412,422,429,500,503.
- List responses are proposed as `{items:[...],pageInfo:{nextCursor,pageSize,hasMore}}`, with `cursor`, `pageSize`, `sort`. **This is intentionally incompatible with bare-array GET v3.0.** FE consumers must opt into v3.1 and adapt deliberately.
- Clinical signing, dispense, stock posting and partner ACK require validated business states, evidence, attribution and audit. A successful local transaction cannot imply external delivery ACK.
- Values of status `CONTRACT_REVIEW_REQUIRED` in legacy schema examples intentionally mean **status semantics are not finalized**. They MUST be resolved before any production client interprets them.

## Contract development and tests

```bash
npm run build:v3.1     # regenerate OpenAPI v3.1 from curated contract sources
npm run check:v3.1     # check generated artifact, schema/examples/metadata and workflow links
npm test               # both v3.0 and v3.1 synthetic HTTP examples / negative paths
npm run start:v3.1     # local loopback HTTP mock at http://127.0.0.1:4010/docs
```

Try an example in Swagger UI; mock responses are labelled `X-SIMRS-Mock: true`. The local mock supports a selected subset of end-to-end state transitions and returns examples for other operations. It is **not** a Node.js production backend or replacement for a full state machine.

### Contract-first review tasks / non-negotiable release gates

1. **P0:** Approve field-level request/response semantics and lifecycle of M01/M02/M05/M09/M11; confirm the proposed Prescription draft/placement states (these extend v3.0).
2. **P0:** Confirm status types `placed/accepted/verified/released/dispensed` with clinician and pharmacy sign-off, including critical result acknowledgement.
3. **P0:** Complete scope permissions per organization, unit, care-team, emergency break-glass, consent, and patient proxy.
4. **P0:** Link each PRD form and acceptance to at least one operation/test or a documented no-API rationale; validate data consistency with Node and PostgreSQL design.
5. **P1:** Finish workflow contracts WF-03/04/06/08/09/10/11/12; expand remaining modules only from genuine form/workflow gaps.
6. **P1:** Verify national interoperability adapters against current official APIs and facility SOP; build real connectors **only after** approval, security, and UAT.

### Core architecture guardrails

- Single Node.js HTTP API deployment for M01–M21; domain modules share approved contracts, not private database access across boundaries.
- Transactional outbox record and aggregate update in one PostgreSQL transaction; worker/broker consumer idempotent.
- PostgreSQL/Redis/broker/MinIO restricted data zone; integration via allowlisted egress proxy; analyzer devices communicate through dedicated LIS interface engine only.
- HA and DR target RTO/RPO are decisions for infrastructure governance, not guessed in this contract.
