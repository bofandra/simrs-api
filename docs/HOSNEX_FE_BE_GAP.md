# SIMRS API — mock response server untuk HOSNEX (14 November 2026)

**Keputusan produk:** `bofandra/simrs-api` **hanya MOCK RESPONSE SERVER**. Tujuannya memenuhi kebutuhan pengembangan dan QA antarmuka HOSNEX, tanpa membangun layanan backend produksi. Tidak diperlukan PostgreSQL, koneksi nasional, autentikasi pengguna nyata, transaksi keuangan, inventory atau tanda tangan klinis legal.

**PRD terbaru:** [SIMRS Baru v3.1 lengkap, mock-first](https://docs.google.com/document/d/1gF73c2A2IEMexZIAjhM98Wamr9kaufGWoSF5kc1qPEY/edit). Sumber baseline v3.0 tetap tersedia; 21 modul dan CH01, 97 komponen form, 12 workflow, 84 FR, 76 stories termasuk penambahan Bab 14.

## Dua jalur respons mock

| Jalur | Cakupan | State | Bukti |
|---|---|---|---|
| `GET /__mock/hosnex/actions` dan `POST /__mock/hosnex/actions/{actionName}` | **116 aksi asli HOSNEX**, terdiri dari 27 kandidat, 29 parsial, 60 tanpa padanan API langsung | **Stateless**, deterministik | `tests/hosnex-mock-action-fixtures.test.mjs` |
| `GET /__mock/contract/operations` dan `POST /__mock/contract/operations/{operationId}` | **200 kandidat operasi API** (106 PRD v3.0 +74 ekspansi v3.1 +20 proposal v3.2) | **Stateless**, contoh dari schema/example OpenAPI | `tests/hosnex-mock-action-fixtures.test.mjs` |
| `/api/v1/*` dengan `npm run start:v3.2` | Workflow pasien → encounter → note/demo sign → order LAB → specimen/result → resep → simulated dispensing | **Stateful hanya RAM Node**, sebagian operasi 501 | `tests/workflow-hosnex-v32.test.mjs` |

**Penting:** jalur `/__mock` bukan kandidat endpoint produksi dan tidak mengeksekusi tindakan bisnis. `/api/v1/*` tetap server fiktif in-memory; 200 operasi adalah metadata kontrak, **bukan 200 workflow yang lengkap**. Operasi yang belum dibuat sebagai simulasi stateful tetap mengembalikan `501 SCENARIO_NOT_IMPLEMENTED`, tidak mengarang keberhasilan.

## Quickstart

```sh
npm run check:v3.2
npm test
npm run start:v3.2
# berjalan lokal pada http://127.0.0.1:4010
```

Contoh:

```sh
curl 'http://127.0.0.1:4010/__mock/hosnex/actions?module=M09'
curl -X POST 'http://127.0.0.1:4010/__mock/hosnex/actions/verifyLab' \
  -H 'X-Organization-Id: DEMO-RS-001' -H 'Content-Type: application/json' \
  -d '{"synthetic":true}'
curl -X POST 'http://127.0.0.1:4010/__mock/contract/operations/createPatient' \
  -H 'X-Organization-Id: DEMO-RS-001' -H 'Content-Type: application/json' \
  -d '{"synthetic":true}'
curl -X POST 'http://127.0.0.1:4010/__mock/hosnex/actions/register' \
  -H 'X-Organization-Id: DEMO-RS-001' -H 'X-Demo-Scenario: conflict' \
  -H 'Content-Type: application/json' -d '{}'
```

Semua respons pure fixture menampilkan `mock:true, simulated:true, persisted:false, realWorldEffect:false`, serta `X-SIMRS-Mock:true` dan `X-SIMRS-State-Persisted:false`. Opsi `X-Demo-Scenario`: `success` (200), `forbidden` (403), `conflict` (409), `invalid` (422), `error` (500).

## Traceability dan prioritas pengembangan

- `contracts/hosnex-action-coverage.json`: 116 action lama yang sudah diobservasi dari store UI. **Tidak mencakup otomatis action baru** dari M06/M08/M15/M20.
- `contracts/v3.2/hosnex-p0-closure-backlog.json`: 65 aksi P0 yang diaudit; 15 masih belum memiliki proposal padanan kontrak. Ini bukan klaim bahwa lainnya selesai.
- `contracts/v3.2/hosnex-p0-overlay.json`: 20 operasi review-only, termasuk GET/PATCH clinical draft. Dipadukan dengan 180 operasi baseline v3.1.
- FE `/mock-actions`: visualisasi respons 116 aksi tanpa butuh server atau dengan HTTP Node localhost.
- FE `/api-sandbox`: visualisasi 200 operationId, mode browser metadata dan mode schema/example HTTP.
- FE `/form-audit`: katalog 97 form dan status referensi kode. Yang memiliki referensi eksplisit baru 16; 81 belum diverifikasi visual.
- Semua stateful mock harus konsisten dalam patientId/registrationId/encounterId/unitVisitId/orderId dan aman terhadap ulang kirim/konflik. Saat ini backend mock hanya menguji beberapa workflow; belum berarti 12 workflow lengkap.

## Batas dan non-goals

**Dilarang menginterpretasikan `signed`, `released`, `dispensed`, `paid`, atau `sent` pada data sintetis sebagai hasil pelayanan nyata.** Tidak ada akses data pasien nyata, BPJS, SATUSEHAT, storage FHIR/DICOM, mutasi stok, posting jurnal, atau pengiriman klaim. Mock ini tidak menyediakan keamanan produksi. Semua data harus fiktif.

Branch `feat/hosnex-api-alignment-20261114` dan PR #2 tetap draft sampai kontrak dan kebutuhan mock selesai. **HOSNEX main terpisah sebagai mock frontend tanpa API**, sedangkan fitur integrasi FE ditujukan ke `integration/simrs-api`, tidak ke main.

Terakhir: [Gap & rencana FE](https://github.com/bofandra/hosnex/blob/feat/hosnex-api-alignment-20261114/docs/PRD_V3_HOSNEX_API_GAP.md) · [Mock-first FE guide](https://github.com/bofandra/hosnex/blob/feat/hosnex-api-alignment-20261114/docs/API_INTEGRATION_HOSNEX.md).
