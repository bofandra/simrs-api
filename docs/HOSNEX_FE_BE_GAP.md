# HOSNEX ↔ SIMRS API — audit kontrak dan keputusan P0

**Tanggal:** 14 November 2026 · **Status:** draft untuk review FE/BE/klinisi; bukan sign-off produksi.

## Ruang lingkup audit kode

Sumber frontend: `bofandra/hosnex/src/lib/simrs/store.ts` (116 action teridentifikasi, termasuk dua method dengan anotasi return type).
Sumber backend: 106 API PRD v3.0 + 74 usulan v3.1 = **180 operationId unik**.

Audit machine-readable: [hosnex-action-coverage.json](../contracts/hosnex-action-coverage.json).

| Status | Jumlah | Makna |
|---|---:|---|
| candidate | 27 | Ada operationId terkait, tetapi tidak membuktikan kesetaraan DTO, state atau RBAC |
| partial | 29 | Operasi API berdekatan namun tidak semantik-identik |
| missing | 60 | Belum ada endpoint lifecycle ekuivalen |
| **total** | **116** | Tidak termasuk seluruh event/UI read path di komponen — audit lanjutan tetap diperlukan |

Audit ini **bukan** pengujian request HTTP atau bukti semua action berjalan.

## Temuan yang perlu diselesaikan sebelum FE mengganti store mock

1. **M01 Identitas:** Hosnex `sex=L/P`, `name`, alamat datar dan NIK opsional vs API `gender`, `identifiers`, `addresses`. Format dan audit duplicate-review harus disepakati. Patient ID frontend `p1` bukan UUID backend.
2. **M01 Registrasi:** Hosnex memakai `payer: UMUM/BPJS/ASURANSI`, `practitioner` string, `referralNumber`, `visitDateTime`, menampilkan `queueNumber`. API memakai payer object serta mengembalikan `queueTicketId`; FE membutuhkan resolved display text dan endpoint tiket.
3. **M02/M05 Dokter:** `saveEncounter` menyimpan seluruh SOAP, vital, order, resep dan radiologi dalam satu draft. API memecah catatan/observasi/order/resep. Simpan draft harus bebas dari sign/commit dan pengiriman ke instalasi penunjang; pilih orkestrasi transactional command.
4. **M03 IGD:** `addTriage/updateTriage` menjalankan beberapa transisi; audit status dan disposition perlu dibuat eksplisit agar admisi tidak terduplikasi.
5. **M04 RI/Bed:** belum ada reserve/admit/update-bed endpoint yang mewakili action frontend. Perlu version checks dan satu transaksi occupancy+admission.
6. **M09 LIS:** 23 operasi sudah tersedia, tetapi pemetaan `regId:panelCode`, barcode per attempt dan report release/version perlu model server terpusat.
7. **M11 Farmasi:** review/dispense tersedia tetapi clarification, preparation, item verification dan ready tidak ekuivalen dengan dispensing. Mutasi stok hanya ketika serah-terima tervalidasi setelah SOP/UAT.
8. **M13/M14 Finance:** Hosnex memakai rupiah integer dan state invoice/claim lokal; kontrak saat ini menyebut minor units tentatif. **Jangan melakukan konversi otomatis tanpa keputusan.**
9. **CH01 Pasien:** dua operasi portal eksisting belum mendukung appointment dan dokumen yang scoped ke patient/proxy token. Staff endpoint tidak boleh dipakai langsung untuk pasien.
10. **M21 Integrasi:** mocked outbox/job states di FE memiliki validate/send/reconcile/resolve/reset/cancel; API baru list/retry. ACK eksternal tidak boleh disimpulkan dari 202 lokal.

## Proposal kontrak tambahan P0

Berisi **19 operasi kandidat baru**, seluruhnya additive terhadap 180 existing: [hosnex-p0-overlay.json](../contracts/v3.2/hosnex-p0-overlay.json).

Terdiri dari M01 (practitioner per unit, pengecekan eligibility BPJS sintetik), M04 (reserve, admit, status bed), M02 (draft klinis gabungan), M11 (klarifikasi dan preparation), CH01 (janji temu mandiri, portal dokumen dan proxy), M05 (pelepasan dokumen ke portal). Ada lima amendment DTO pada endpoint existing. Semua tetap **proposal v3.2**, tidak aktif di mock server atau produksi.

## Gate sebelum API final dan integrasi UI

- FE–BE–klinisi menyetujui field, enum, ownership state, actor/patient/tenant scope untuk seluruh P0.
- Dokumentasikan sumber data tiap worklist/dashboard dan bentuk empty/loading/error/409/412/422; tambahkan filter, cursor, sort, ETag/If-Match, Idempotency-Key.
- Pastikan endpoint kritis mendukung evidence, audit append-only, duplicate suppression dan per-hospital isolation.
- Contract test request+response positif/negatif per operasi; e2e HOSNEX ↔ Node mock HTTP (belum dilakukan).
- Tidak mengaktifkan dispensing, stok, billing, pembayaran, tanda tangan klinis, BPJS/SATUSEHAT sebelum SOP, otorisasi dan UAT.

Rekomendasi: integrasi **read-only terlebih dahulu**, lalu draft klinis, dan baru transisi sensitif dengan approval. Generated client di FE harus memakai DTO backend, bukan tipe store lokal.


## Implementasi HTTP terverifikasi — 14 November 2026

Branch `feat/hosnex-api-alignment-20261114` memuat komposisi otomatis spesifikasi **v3.2.0-draft.0** dari 180 operasi v3.1 (dipertahankan byte-for-byte per operasi) + 19 proposal baru. Penelusuran OpenAPI saat mock dijalankan melalui `npm run start:v3.2` (port 4010) atau `/openapi-v3.2.json`.

- `scripts/compose-hosnex-v32.mjs` membangun OpenAPI 3.1 komposit; `npm run check:v3.2` memvalidasi 199 operationId, method, path, permission, schema, dan provenance tanpa mengubah 180 kontrak awal.
- `tests/workflow-hosnex-v32.test.mjs` menembak Node mock dengan HTTP untuk satu rangkaian pasien → registrasi → chart poli → SOAP/penandatanganan sintetis → order LAB → spesimen → verifikasi dan release → resep → review apoteker → dispensing sintetis → close encounter.
- Mock v3.2 membuat `patientId`, `registrationId`, `queueTicketId`, `encounterId` dan atribut `queueNumber` konsisten di lintas request. Pencarian pasien menggunakan filter `q`, worklist menampilkan pasien yang benar; chart menampilkan hasil LAB berstatus released.
- Validasi negatif telah mencakup `UNKNOWN_PATIENT`, versi draft stale (`412`), release LAB prematur (`422`), dispense sebelum review (`422`), dan operation overlay yang belum memiliki simulasi (`501`).
- Dari 19 operasi overlay, baru **tiga** memiliki perilaku mock eksplisit (`listUnitPractitioners`, `checkBPJSEligibility` sintetis, `saveCompositeEncounterDraft`). Sisanya secara sengaja mengembalikan `501 SCENARIO_NOT_IMPLEMENTED`, bukan success palsu.

**Perhatian:** kata `signed`, `dispensed`, dan `completed` di sini merujuk ke **perubahan state data sintetis di memori** untuk uji kontrak, bukan tanda tangan klinis, pengeluaran stok, transaksi atau pemberian obat sungguhan. Tidak ada persistensi PostgreSQL.

HOSNEX kini menyediakan halaman QA `/api-workflow` yang mengakses HTTP mock lokal dan panel GET read-only pada empat UI modul. Halaman pelayanan utama **masih memakai store fiktif lama**; migrasi action utama, auth per profesi, E2E browser dan UAT lapangan merupakan pekerjaan lanjutan, bukan bagian yang telah dinyatakan selesai.

Status: backend CI `https://github.com/bofandra/simrs-api/actions/runs/43522923317`; frontend cross-repo E2E `https://github.com/bofandra/hosnex/actions/runs/43523790593`. Kedua PR masih draft untuk review dan persetujuan FE/BE/klinisi.
