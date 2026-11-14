# HOSNEX–SIMRS API endpoint completion — contract-first, mock-only

Baseline 14 Nov 2026: **21/21 UI module HTTP surfaces, not 21/21 PRD complete**. Backend v3.2 has 200 proposed contract operations (180 prior + 20 overlay) and 116 legacy HOSNEX action response fixtures (27 candidates, 29 partial, 60 missing in the old 180-operation crosswalk).

## Change in this branch: P0 candidates v3.3

- Add 13 **typed** P0 endpoint candidates with one-to-one audited frontend action backlink: M21 6, M16 1, M05 3, M14 3.
- Compose v3.3 as **200 unchanged + 13 new = 213 candidate operationIds**. v3.2 remains at 200, with no silent breaking response changes.
- Mock REST success responses are **pure contract previews** (`mock:true`, `persisted:false`, `realWorldEffect:false`); no patient records, external transmission, billing, claim acknowledgement, stock movement, clinical signing or state transition occurs.
- 2 CH01 login/logout actions are explicitly **delegated patient OIDC boundaries**, not fabricated local hospital endpoints.
- Route status is `review-only`, not production-approved; integration with HOSNEX UI remains a separate acceptance task.
- Run `npm run check:v3.3 && npm test`, then `npm run start:v3.3` for local mock. This is **not a deployment task**.

## Remaining acceptance gates: full HOSNEX ↔ SIMRS API contract parity

1. Re-audit all currently defined UI actions, not only the historical 116; map module, screen, form, FR, US, target method/path, DTO, permissions and response statuses.
2. Close each missing or partially matched API operation with domain-specific request schema, response schema, success/error fixtures and unique operationId. Existing 29 partial/60 missing classifications are not automatically resolved by new proposal IDs.
3. Validate ID continuity and mock lifecycle across registration → chart → order → LIS/RIS → pharmacy → billing/claim → discharge and special services. Ensure negative tests (400/403/404/409/412/422/500), optimistic version, idempotency and explicit unsupported behavior.
4. Update FE API adapters after the API contract is proven, with parity tests against Mock Lokal. Do not confuse metadata-only fixture success with a stateful workflow.
5. Declare complete only when **every required UI action and PRD endpoint has a reviewed contract, synthetic executable response, negative tests and traceable acceptance**. No deployment/public URL/real external connectivity in this phase.

See `contracts/v3.3/p0-gap-operations.json` and `scripts/check-hosnex-v33.mjs` for strict mapping of all 15 outstanding audited P0 actions.
