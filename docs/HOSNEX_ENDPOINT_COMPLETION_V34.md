# Endpoint coverage batch v3.4 — HOSNEX missing historical actions

This branch adds **34 domain-specific review-only mock response contracts**, grouped M19 quality (6), M18 staff (5), M17 assets (6), M12 nutrition (4), M08 blood bank (5), M07 surgery (4), M10 radiology (4). These are synthetic fixtures, **not clinical workflows**.

After v3.4: 180 v3.1 + 20 v3.2 + 13 v3.3 + 34 v3.4 = **247 candidate operations**. In the historical 116-action static crosswalk, all 60 originally `missing` have now either a **proposed** API mapping (58) or an explicit CH01 OIDC boundary (2). This does NOT close the 29 `partial` mappings, 27 `candidate` mappings, newly added UI actions, PRD 97-form coverage, or end-to-end acceptance.

Mock HTTP response success is marked `mock:true`, `simulated:true`, `persisted:false`, `realWorldEffect:false` with no cross-service business side effects. Safety-critical action words (publish, issue blood, revoke, sign) mean **contract previews only**. No real data, blood issue, note signing, financial posting, instrument/stock, outside network, database, or deployment.

Check with `npm run check:v3.4 && npm test`. Future work: regenerate crosswalk from current HOSNEX code, resolve the 29 partial mappings DTO-by-DTO, expand linked mock workflow state/negative cases, verify all FR/US/form acceptance; then update HOSNEX adapters. No public connectivity yet.
