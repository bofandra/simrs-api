# Contract decisions requiring explicit FE–BE and clinical approval

## Observed gaps in PRD API table (source-backed)
Original v3.0 has 106 operationIds and approximately 13 GET / 93 POST, without PATCH. Many original responses use generic IDs and `status=draft` examples even for sign/verify/release actions. These are being corrected or marked provisional in v3.1, not hidden.

## New v3.1 proposals (not direct PRD facts)
- 74 operations for five P0 domains and typed shared model. GET read/detail/history and PATCH draft changes were added to support forms and workflows.
- Pagination envelope for list endpoints is a **breaking FE contract proposal**, not a silent migration.
- Prescription `draft` plus `createPrescriptionDraft`, `updatePrescriptionDraft`, `placePrescription` are new proposed states/operations; PRD v3.0 described `ordered/reviewed/dispensed/cancelled` but no draft API. Clinical and legal sign-off needed.
- On-premise Keycloak, RabbitMQ, Patroni, Redis and MinIO are recommended implementation products from supplied architecture, not mandated by PRD.

## Unresolved by document; no implicit claims
1. 77 original operations have module-level FR/US references but not reviewed operation-by-form acceptance.
2. Which modules are responsible for cross-domain changes in Encounter/LIS/Pharmacy and what data ownership boundaries apply to the 23 schemas.
3. Partial-dispatch and return stock allocation, FEFO, expiry, patient matching and accounting compensation require detailed rules/test evidence.
4. LIS analyzer protocol variants, reference range calculation by age/sex/method, critical result communication and amendment authorization require operating SOP.
5. Transfusion/blood product release, payment, stock posting, clinical signatures and national API writes need security and UAT gates; NO production operations enabled.
6. Patient Portal CH01 token audience, consent/proxy and disclosure are not the same as staff OIDC.
7. RTO/RPO, HA sizing, observability thresholds and DLQ/manual retry SLA require explicit decisions.
8. Official SATUSEHAT, BPJS, RS Online, PACS, PSrE, and payment adapter payloads have not been copied into this repo; separate contract verification is required.

## Gate for declaring API v3.1 FINAL
Every API operation has reviewed field types/constraints/enum, request/response positive+negative examples, permission and context, auditable preconditions and side effects, linked PRD FR/US/form/WF with confidence, automation tests, and clinical/FE/BE product owner sign-off.
