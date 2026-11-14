# SIMRS Baru — API contract v3.0 dan sandbox

## Status kontrak HOSNEX terkini — mock API v3.5 (14 November 2026)

**268 operationId kandidat** sudah tersedia di `main` setelah PR #3–#5:
106 v3.0 + 74 v3.1 + 20 v3.2 + 13 v3.3 + 34 v3.4 + 21 v3.5.

`simrs-api` adalah **MOCK RESPONSE SERVER** untuk HOSNEX, bukan backend rumah sakit operasional. Semua 268 kandidat punya contoh response OpenAPI yang dapat dipicu lewat `/__mock/contract/operations/{operationId}`; angka itu **bukan** 268 stateful REST endpoint atau pemenuhan seluruh form/FR/US/PRD. Untuk mendemokan kontrak terbaru:

```sh
npm run check:v3.5
npm test
npm run start:v3.5
# Swagger: http://127.0.0.1:4010/docs
# GET list metadata: http://127.0.0.1:4010/__mock/contract/operations
```

HOSNEX `/api-sandbox` dapat menampilkan 268 kandidat; mode `Mock Lokal` tetap default. 8 adapter HOSNEX v3.5 masih review-only, dan operasi baru perlu implementasi state/typed adapter dan acceptance workflow. Tidak ada database, BPJS/SATUSEHAT sungguhan, sign klinis legal, posting akuntansi, pembayaran atau mutasi stok.

Dokumen kontrak bertahap: [v3.3](docs/HOSNEX_ENDPOINT_COMPLETION.md) · [v3.4](docs/HOSNEX_ENDPOINT_COMPLETION_V34.md) · [v3.5](docs/HOSNEX_PARTIAL_PARITY_V35.md). Versi v3.1 di bawah tetap terdokumentasi sebagai baseline historis, bukan versi terbaru.

## Deploy mock API v3.5 ke VPS

[Contract Tests and VPS Deploy](https://github.com/bofandra/simrs-api/actions/workflows/contract-tests.yml) menjalankan validasi dan tes pada pull request dan push ke `main`. Setelah tes lulus, push ke `main` atau **Run workflow** dari `main` akan men-deploy commit yang diuji. VPS mengambil rilis berdasarkan commit SHA, me-restart `simrs-api.service`, dan mengecek `/healthz`. Jika rilis baru gagal, VPS mencoba mengaktifkan kembali rilis sebelumnya.

API demo mendengarkan di `127.0.0.1:4010` pada VPS. Gunakan SSH dengan akun admin VPS untuk verifikasi dan akses Swagger:

```bash
ssh ubuntu@VPS_HOST 'curl -fsS http://127.0.0.1:4010/healthz'
ssh -N -L 4010:127.0.0.1:4010 ubuntu@VPS_HOST
# Buka http://127.0.0.1:4010/docs setelah tunnel aktif.
```

Untuk memasang deployment pada VPS Ubuntu x86_64, salin direktori `deploy/vps` dan public key Ed25519 khusus GitHub Actions, lalu jalankan `sudo bash deploy/vps/install.sh /path/to/deploy_key.pub` pada VPS. Installer menyiapkan Node.js 22 khusus layanan ini, unit systemd, dan akun SSH `simrs-api-deploy` dengan perintah deploy yang dibatasi. Jalankan ulang installer sebagai admin saat mengubah konfigurasi di `deploy/vps`.

Di GitHub **Settings → Environments → vps**, batasi deployment ke branch `main` dan isi environment secrets `VPS_HOST` (alamat VPS), `VPS_KNOWN_HOSTS` (baris host key Ed25519 yang sudah diverifikasi), dan `VPS_SSH_KEY` (private key pasangan deploy). Untuk memeriksa kegagalan di VPS, jalankan `sudo journalctl -u simrs-api.service -n 50 --no-pager`.

---

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
