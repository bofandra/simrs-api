# SIMRS Baru — API contract v3.0 dan sandbox

## Contract v3.1 (candidate) — latest specification

**Current design work:** [OpenAPI v3.1 (180 operations)](openapi-v3.1.json) and [full contract guide](contracts/v3.1/README.md). This extends the original 106 PRD v3.0 operation IDs with **74 new lifecycle proposals** in M01, M02, M05, M09, M11. It does **not** mean 180 production endpoints are implemented or approved. Original [OpenAPI v3.0](openapi.json) remains unchanged for comparison.

- [Operation additions](contracts/v3.1/expansions.json) · [47 typed domain schemas](contracts/v3.1/domain-schemas.json) · [Traceability](contracts/v3.1/traceability.json)
- [State machines](contracts/v3.1/state-machines.json) · [12 workflow mappings](contracts/v3.1/workflows.json)
- [Outbox/domain events](contracts/v3.1/domain-events.json) · [Integration boundaries](contracts/v3.1/integration-boundaries.json)
- [Open decisions and risk gates](docs/CONTRACT_V31_DESIGN_DECISIONS.md)

### Local Swagger + contract checks

```bash
npm run check:v3.1       # checks generated OpenAPI, examples, traceability and states
npm test                 # HTTP demo tests including WF-05 and WF-07 negative paths
npm run start:v3.1       # Swagger HTTP synthetic mock: http://127.0.0.1:4010/docs
```

**Version choice:** `npm start` remains original v3.0 mock (106 operations), and `npm run start:v3.1` serves the v3.1 candidate (180). The mock server listens on loopback and is never a real clinical, finance, prescription, inventory or partner integration service.

**FE handoff:** The GitHub Pages UI in [bofandra/simrs](https://github.com/bofandra/simrs) has an API Sandbox. Its static contract viewer must be synchronized to v3.1 as an explicit FE update, because v3.1 changes list responses from bare arrays to pagination envelopes.

---


Kontrak kandidat **106 operasi** untuk **21 modul operasional (M01–M21) dan Portal Pasien (CH01)**, diturunkan dari [PRD SIMRS Baru v3.0 tanggal 12 November 2026](https://docs.google.com/document/d/1NzQ6ryYk8Jqat-nqI-Nbyjbx1inSn-ss/edit).

> **HANYA DEMO / DATA SINTETIS.** Jangan gunakan data pasien nyata, jangan mengaktifkan tindakan klinis, tanda tangan legal, mutasi stok, pembayaran, klaim, pengiriman SATUSEHAT/BPJS atau layanan nasional apa pun. Schema adalah rancangan kontrak, belum kontrak produksi yang telah disetujui.

## Akses dokumentasi interaktif

- **[API Explorer yang dipublikasikan bersama FE](https://bofandra.github.io/simrs/api-docs/)** — pilih dari 106 operasi, lihat request dan respons dummy. *Browser-only: tidak mengirim HTTP.*
- **Swagger UI (lokal):** jalankan server Node, buka `http://127.0.0.1:4010/docs`, gunakan *Try it out* untuk HTTP request ke mock server lokal.
- **[OpenAPI 3.1](openapi.json)** — method/path, operationId, permission, status, error, request/response schema.
- **[Katalog sumber PRD](contracts/operations.json)** — hasil ekstraksi seluruh 106 baris API PRD Bab 10.2.
- **[Analisis gap kontrak](docs/CONTRACT_GAP_ANALYSIS.md)** — beda DTO generik dan field per operasi, isu yang masih harus disepakati.

## Jalankan lokal

Node.js 20+; tidak membutuhkan database, token atau paket npm eksternal.

```bash
git clone https://github.com/bofandra/simrs-api.git
cd simrs-api
npm start
# HTTP mock: http://127.0.0.1:4010
# Swagger UI: http://127.0.0.1:4010/docs
```

```bash
npm run validate:contract
npm test
```

Contoh HTTP:

```bash
curl -i http://127.0.0.1:4010/healthz
curl -i 'http://127.0.0.1:4010/api/v1/patients?q=demo'
curl -i http://127.0.0.1:4010/api/v1/registrations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-registration-0001' \
  -H 'X-Organization-Id: DEMO-RS-001' \
  -d '{"patientId":"d2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1","serviceType":"RJ","unitId":"25d6f4b1-f3ad-48c6-919f-409fb68e0d0c","payer":{"type":"SELF_PAY"}}'
```

## Integrasi Frontend

Repo FE [bofandra/simrs](https://github.com/bofandra/simrs) sudah mempunyai `window.SIMRSApiContract` untuk menguji kontrak tanpa backend:

```js
const response = await window.SIMRSApiContract.call('searchPatients');
console.log(response.status, response.data);

const createResponse = await window.SIMRSApiContract.call('createRegistration', {
  body: {
    patientId: 'd2f8ba55-b1d0-4fd3-a95e-3bfca006b7f1',
    serviceType: 'RJ',
    unitId: '25d6f4b1-f3ad-48c6-919f-409fb68e0d0c',
    payer: { type: 'SELF_PAY' }
  },
  idempotencyKey: 'demo-registration-0001'
});
```

Di mockup FE: login akun `reviewer.demo` / `demo123` (atau akun demo Integrasi/Admin Sistem), kemudian buka panel **API Sandbox**. Hasil dari browser API adalah respons fiktif yang dicatat `simulated: true`, bukan permintaan HTTP.

Mock server Node hanya bind `127.0.0.1`. CORS `*` dan role/tenant check sintetis tidak boleh dipakai pada server produksi. Gunakan service Node produksi tersendiri dengan autentikasi nyata, RBAC/ABAC, database bertransaksi, audit append-only, validasi status dan SOP/UAT.

## GitHub Pages repository ini

Workflow `.github/workflows/pages.yml` dapat dijalankan manual *setelah* GitHub Pages repository `simrs-api` diaktifkan melalui **Settings → Pages → Source: GitHub Actions**. Koneksi GitHub Actions yang tersedia saat ini tidak diberi izin membuat Pages baru otomatis. Untuk dokumentasi publik yang langsung digunakan, API Explorer sudah disiapkan pada GitHub Pages FE `bofandra/simrs`.
