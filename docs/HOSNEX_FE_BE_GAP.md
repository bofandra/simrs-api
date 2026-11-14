## Tahap 11 — Form resume dan koding draf M05 (14 Nov 2026)

- Modul P0 M05 menambah GET katalog/episode serta PATCH draf resume (5 bidang), PATCH draf koding ICD-10 (diagnosis utama/sekunder, bukti, coder), dan POST review QA. API tetap synthethic process-memory dan tidak pernah mengesahkan dokumen.
- Review QA membutuhkan draf resume dan koding sudah disimpan serta triase sintetis M03 berjalan. Respons memuat signed:false, codingVerified:false, legalSignature:false, persisted:false, realWorldEffect:false.
- Write mewajibkan optimistic version + Idempotency-Key, memiliki 409/412/422/403 dan injected 500. Tidak ada endpoint tanda tangan legal atau export RME.
- GET-only read model M05 menampilkan checklist dinamis status draf, tetapi seluruh POST/PATCH pada namespace read-only tetap 405.
- **Cakupan berubah menjadi 8 modul aksi parsial dan 13 read-only**, seluruhnya tetap synthetic mock. Form dan acceptance M05 selain dua draf tersebut tetap gap PRD.

## Tahap lanjutan — Semua 21 modul memiliki HTTP read workspace sintetis (14 November 2026)

- Menambahkan **9 modul**: M07 Operasi, M08 Pelayanan Khusus (6 subsistem: HD, rehabilitasi, MCU, Bank Darah, KIA/perinatologi, imunisasi), M10 Radiologi, M12 Gizi, M15 Akuntansi, M17 Sarpras, M18 SDM, M19 Mutu, M20 Analitik.
- Melalui namespace existing `GET /__demo/p0-read-models/{module}[/{id}]`, seluruh 9 modul baru menawarkan **daftar/detail hanya-baca** berisi field dan checklist khusus domain (minimal 2 record per modul); M08 punya enam contoh subsistem, M20 punya tiga tampilan analitik.
- Read model M19 dan M20 membaca tahap episode M03/M04/M06 (triase, admisi, handover), sehingga data contoh berubah sesuai workflow demo di RAM Node; bukan warehouse, RL, SIRS atau analytics rumah sakit yang valid.
- **Tidak ada aksi mutasi** untuk 9 modul ini; semua metode selain GET ke namespace ditolak 405. Tidak ada operasi kamar, pemberian obat, hasil radiologi, pelepasan darah, posting jurnal, perubahan jadwal SDM, servis alat atau pelaporan insiden yang nyata.
- Total backend mock **200 kandidat OpenAPI tidak berubah**; endpoint `__demo` hanya tooling internal, bukan klaim implementasi 200 operasi stateful.
- **21/21 berarti cakupan permukaan HTTP untuk navigasi modul**, bukan kesetaraan 21 modul dengan PRD, 97 form, 12 workflow atau implementasi SIMRS produksi.

## Wave P0 read-only — M05, M13, M14, M16, M21 (14 November 2026)

- HTTP **GET only**, namespace `/__demo/p0-read-models` berisi katalog/list/detail untuk 5 modul; total modul dengan workspace HTTP parsial menjadi **12/21**.
- M05: ringkasan kelengkapan resume IGD dan SBAR terhubung dengan tahap episode M03/M04/M06; bukan tanda tangan RME legal.
- M13: pratinjau biaya fiktif, **bukan** billing/payment atau ledger sungguhan.
- M14: checklist kesiapan klaim tergantung tahap IGD/RI/keperawatan; **tidak pernah mengirim klaim** dan tidak memvalidasi eligibility BPJS.
- M16: dua item stok fiktif untuk demo, tanpa mutasi atau distribusi/release stok.
- M21: pratinjau mapping FHIR sintetis dan gap validasi, **tanpa** koneksi SATUSEHAT.
- Seluruh payload mengandung `readOnly:true`, `simulated:true`, `persisted:false`, `realWorldEffect:false`, dan `stateScope:process-memory`; setiap metode non-GET ditolak dengan **405**.
- Pengujian: `tests/p0-read-models.test.mjs` memeriksa linked episode, tidak ada aksi finansial/nasional/stok, 403/404/405/500, serta 200 OpenAPI yang tidak berubah. Belum menjamin kesetaraan seluruh form/aksi PRD.

## Wave P0 tambahan — IGD, Rawat Inap, Keperawatan (14 November 2026)

- Node mock menyediakan namespace **`/__demo/clinical-workspaces/M03|M04|M06`** untuk worklist, detail, dan tujuh transisi sintetis dalam satu episode pasien fiktif.
- Semua perubahan hanya di **RAM proses Node** dan tidak pernah menyentuh database, stok, catatan klinis sungguhan, BPJS/SATUSEHAT, atau persistensi; respons menampilkan `simulated:true`, `persisted:false`, `stateScope:process-memory`, `X-SIMRS-Demo-State:process-memory`.
- Alur versi: IGD `triage → reassess → request-admission`; Rawat Inap `reserve-bed → admit-bed`; Keperawatan `assess → handover`. Worklist hilir kosong sampai tahap sebelumnya selesai. `expectedVersion` menghindari stale write, `Idempotency-Key` replay aman.
- Endpoint tooling ini **bukan** perubahan OpenAPI 200 kandidat dan **bukan** implementasi full PRD transaksi; hanya read/workflow contoh untuk HOSNEX mode API. Belum menangani real bed occupancy, triage instrument, assessment detail dan SBAR lengkap.
- Test API: `tests/clinical-workspaces.test.mjs` meliputi gating lintas modul, detail, duplicate replay, 412 stale, 409 transisi salah, 422 validasi, 403 tenant, dan 500 skenario.

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


## Tahap 12 — M10 Radiologi sintetik (14 November 2026)

HOSNEX M10 kini memakai rute tooling-only `/__demo/radiology/orders` pada Node mock v3.2: GET list/detail, PATCH jadwal, PATCH catatan akuisisi, PATCH draf laporan, POST review QA. `createRadiologyDemoStore` berisi dua seeded fictional orders terpisah dan menyimpan status hanya di RAM; transaksi diuji dengan optimistic version, Idempotency-Key, 403/404/409/412/422/500, serta `viewer` 501 dan `sign/study/publish` 405. Tidak ada CPOE order nyata, DICOM/PACS, StudyInstanceUID atau legal sign. Status hanya tahap QA, bukan pelaporan radiologi final. **200 kontrak OpenAPI tetap kandidat, bukan endpoint operasional baru.**

Cakupan HOSNEX sekarang 21 modul HTTP surfaces, 9 modul aksi demo parsial (M01,M02,M03,M04,M05,M06,M09,M10,M11) dan 12 modul GET-only (M07,M08,M12,M13,M14,M15,M16,M17,M18,M19,M20,M21). F-M10-03 (PACS viewer) dan WF-06 belum terpenuhi dan perlu kontrak riil terpisah sebelum production design. Detail acceptance di [M10 form parity](https://github.com/bofandra/hosnex/blob/feat/hosnex-api-alignment-20261114/docs/M10_RIS_PACS_MOCK_PARITY.md).


## Tahap 13 — M02 RAD CPOE sintetis dibaca RIS M10

Node v3.2 menjaga satu sumber order proses di `db.orders`. Operasi `createServiceOrder` dengan `category=RAD` dan `serviceCode=THX/CTH/USG` (setelah note `signed` secara sintetis) menjadi record M10 secara *read-through* lewat `createRadiologyDemoStore`. Tidak dibuat order duplikat atau study DICOM. ID sumber `order.id` digunakan langsung sebagai M10 `id` dan `orderId`, `episodeId` sama dengan encounter, sedangkan `patientId` berasal dari encounter server. Sebanyak 2 seeded orders lama tetap disediakan untuk QA tanpa order.

Aksi RAD CPOE dibatasi ke `X-Demo-Staff-Id:doctor/emergency/admin`. M10 GET dapat diakses `radiographer/radiology/doctor/emergency/admin`; penjadwalan dan catatan teknik untuk `radiographer/admin`; draf laporan dan review QA untuk `radiology/admin`. Semua ini hanya *role simulation* berbasis header spoofable (bukan IAM produksi). Tenant demo lain = 403; unsupported RAD exam = 422; ketidaksesuaian persona = 403. Keamanan pasien sungguhan **belum** diuji/dijamin.

Tidak ada perubahan jumlah kandidat OpenAPI v3.2: tetap 200; M10 `/__demo` tooling-only dan mutasi hanya RAM. Batas `signed:false`, `published:false`, `pacsAvailable:false`, `dicomAcquired:false`, `legalSignature:false`, `persisted:false`, `realWorldEffect:false` tetap berlaku.

Acceptance sekarang mencakup integrasi order M02→M10 yang sebelumnya belum ada, tetapi WF-06 dan FR-018 belum penuh: belum ada pembatalan dan amendment, DICOM modality, viewer berizin, verifikasi radiolog/legal-sign, integrasi PACS dan workflow klinis produksi. Pengujian backend: `tests/radiology-cpoe-link.test.mjs`; FE: `scripts/check-hosnex-http-e2e.ts` dan `src/components/simrs/ApiRadiologyCpoeAction.test.tsx`.
