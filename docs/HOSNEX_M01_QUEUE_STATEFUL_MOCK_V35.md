# M01 queue transition — synthetic stateful mock v3.5

This backend milestone implements the existing **setQueue** v3.5 candidate as a **RAM-only demo** for one HOSNEX registration queue ticket. It does not introduce a production API, new operationId or a real queue transaction.

- `POST /api/v1/registrations` issues synthetic `queueTicketId`, `queueNumber`, `encounterId`. The queue starts at `waiting`, internal version `1`.
- `GET /__demo/queue/tickets/{id}` reads the synthetic queue status/version for verified demo organisation `DEMO-RS-001`.
- `POST /api/v1/queue/tickets/{id}/transitions/preview` (existing OpenAPI v3.5 candidate) accepts `expectedVersion`, `queueStatus` and `reason` with `Idempotency-Key`.
- Allowed sequence: `waiting → called → in-service → done`. No arbitrary skip, rollback or update after `done`.
- Invalid ticket `404`, stale version `412`, out-of-order transition `409`, unsupported status `422`, wrong tenant `403`, and method mismatch `405` for read-only inspector. Replay of the same idempotency key + payload returns unchanged result.
- State is held only in Node process memory; restarting server resets the whole demo. HTTP response remains `mock:true`, `simulated:true`, `persisted:false`, `realWorldEffect:false`.

The legacy 268 contract fixture previews remain **stateless**, including `/__mock/contract/operations/setQueue`. Unlike a contract-only example, the special M01 stateful path requires a real synthetic registration-issued ticket. All other v3.5 newly proposed domain operations remain review-only, not false-success stateful actions.

Run `npm run check:v3.5 && npm test`. The new test `tests/v35-queue-workflow.test.mjs` validates lifecycle, cross-step version, unknown ticket, tenant guard, idempotency and restart isolation.

**Limits:** does not create a real patient, clinical action, bed movement, billing, inventory, BPJS/SATUSEHAT delivery or persistence.
