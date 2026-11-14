# M09: v3.5 saveLabResults — synthetic stateful draft correction

The existing HOSNEX `saveLabResults` candidate operation (`PATCH /api/v1/laboratory/orders/{id}/result-drafts`) now has **process-RAM mock state**, in addition to the 268 existing OpenAPI contract fixtures (still pure previews).

**Preconditions:** the order must be a LAB order created under a synthetic encounter; a specimen must already have been received and an initial `submitLabResults` draft created. Only an existing analyte may be revised, with finite numeric string values, matching `serviceCode`, a reason, and `expectedVersion`. The first draft starts at version 1; each successful revision increments it. `getLabReport` includes the current version, revised value, and note.

**Guards:** 404 unknown order, 409 missing/locked draft, 412 stale expectedVersion (including verify), 422 unknown analyte/invalid value or mismatched serviceCode, 403 incorrect tenant. Idempotency replay returns the same outcome; verified/released reports cannot be edited. No production analyzer, PACS, data persistence, real clinical sign, inventory or SATUSEHAT calls.

**PRD:** F-M09-03 (input & validation result) and F-M09-05 (component/range panel) are only **partially simulated**. Numeric analyte matching and revision state are covered; comprehensive LOINC/UCUM catalogs, calibrated reference range, critical/abnormal flags, verifier scope, full UI grid, rejection recovery and per-form UAT are not done. No medical results should be inferred from the synthetic value.

Test `node --test tests/v35-lab-draft-stateful.test.mjs`. Existing 268 pure fixtures via `/__mock/contract/operations` remain non-stateful and do not create or revise an order.
