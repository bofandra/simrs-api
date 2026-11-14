# HOSNEX M03 typed triage — synthetic clinical workspace (partial PRD)

The existing M03 → M04 → M06 process-memory workflow now accepts an **optional validated triage DTO** in `POST /__demo/clinical-workspaces/M03/{encounterId}/actions/triage`:
`{expectedVersion,triage:{encounterId,patientId,complaint,atsLevel,vitals,overrideReason?}}`.

The payload is checked against the selected synthetic episode's server IDs, nonempty complaint, ATS 1–5, finite numeric vital signs and optional override reason, and then added to the M03 in-memory read model. Replay, 409 state conflict, 412 version conflict and rejection have no local side effects; earlier no-body demonstration remains backward compatible.

**Contract gap identified:** HOSNEX `prepareTriageCreate` produces `encounterId,patientId,complaint,atsLevel,vitals`, but the existing OpenAPI `createEmergencyTriage` candidate requires `emergencyEncounterId,priority,vitals:string,arrivalAt` and disallows additional properties. Therefore **do not claim the existing production-candidate `/api/v1/emergency/triages` is aligned or stateful**. This demo intentionally uses the non-production `/__demo/clinical-workspaces` route until a reviewed, fully-typed API contract and actor/arrival fields are agreed.

PRD F-M03-01 (triage intake) remains **partially demonstrated**, not form accepted: assessor ID, arrivalAt/arrivalMode, consciousness, missing vital ranges, role permissions, disposition and handoff still require contract/UI acceptance. F-M03-02..05 are not closed by this change.

Run `node --test tests/typed-triage-demo.test.mjs`, plus repository CI; state disappears on process restart. No real encounter, EHR, clinical decision, transport or SATUSEHAT writes.
