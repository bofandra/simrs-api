# Audit kontrak — PRD SIMRS Baru v3.0

Sumber: PRD_SIMRS_Baru_v3.0_Lengkap_Mandiri_2026-11-12.docx, 12 Nov 2026.

Status: **candidate; belum sign-off FE/BE atau UAT**.

## Cakupan
- 106 operationId unik dari Bab 10.2: 21 modul M01–M21 dan Portal Pasien CH01.
- Path/method, permission, request schema, response contoh, status success dan problem errors ada di OpenAPI 3.1.
- DTO normatif Bab 10.3 tetap tersedia di components.schemas.
- Mock server hanya punya sebagian stateful behavior (patient, registration, encounter, note, order/LIS, prescription, finance). Sisa operasi mengembalikan contoh kontrak, tanpa state machine penuh.

## Perbedaan API contract yang perlu direview
- Field pada request operasi vs DTO generik Bab 10.3 tidak selalu identik. Operation-level request mengikuti tabel Bab 10.2 untuk: recordObservation, createServiceOrder, submitLabResults, createPrescription, dispensePrescription, postStockMovement, createCharge, allocatePayment, submitClaim. Referensi DTO normatif dipertahankan.
- Amount pembayaran pada tabel tidak secara eksplisit menyebut satuan; saat ini tentatif memakai integer minor units. Wajib disepakati sebelum kontrak final.
- Transisi ClinicalNote, Encounter, Bed, Specimen, Invoice, Claim, IntegrationJob belum lengkap di semua endpoint; perlukan validasi SOP, optimistic version/ETag, idempotency, audit actor dan evidence.
- Portal Pasien memerlukan auth audience tersendiri, consent/proxy verification, revocation dan audit.
- Outbox/delivery ledger SATUSEHAT dan BPJS tidak boleh dianggap ACK ketika request lokal sudah 202.
- No real signing, dispensing, posting stok, jurnal, kasir, klaim, DICOM, transfusi, BPJS atau SATUSEHAT pada mock.

## Kriteria sebelum freeze kontrak produksi
1. Sepakati schema fields/enums untuk seluruh 106 operasi, 12 workflows, dan role assignment dengan tim Frontend dan Backend.
2. Tambahkan positive dan negative schema contract tests per operasi (400/401/403/404/409/412/422/429).
3. Buktikan tenant/unit/encounter isolation, idempotency, concurrent updates, append-only audit, consent dan masking.
4. UAT lintas role dengan data fiktif yang konsisten dan bukti penelusuran FR/US/form.
5. SOP dan sign-off khusus sebelum enable aksi klinis dan finansial sensitif.
