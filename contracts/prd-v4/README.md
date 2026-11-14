# PRD SIMRS Baru 4.0 — baseline audit FE–BE

Baseline kebutuhan tunggal: [PRD Final 4.0](https://docs.google.com/document/d/1SZBVNRyz2VSu9lnE2_Dk9XYJ3RokOyfpxvdL4uYfwNc/edit) (14 Nov 2026). Tidak ada perubahan scope produk yang berasal dari prototipe.

## Inventaris sumber terverifikasi

- 21 modul M01–M21 dan kanal CH01, 84 FR, 76 US, 97 form, 12 WF, 268 *kandidat* operationId.
- File `requirements.json` menyimpan persyaratan, acceptance, form dan workflow dari PRD 4.0.
- File `operations.json` menyimpan kandidat kontrak 268 operasi, diturunkan dari katalog operasi repo dan diverifikasi unik lewat `npm run check:v4`.
- `verification: not-verified`, `contractStatus: candidate`, dan `implementationEvidence: not-verified` sengaja dipertahankan. Tidak ada klaim 84 FR/76 US/97 form/12 WF telah lulus UAT.

## Gap dan penerimaan

| Klaster | Gap penerimaan yang harus diselesaikan | Bukti minimum |
| --- | --- | --- |
| P0 M01–M06 | MPI/Encounter konsisten, antrean, SOAP/CPPT, IGD, bed transfer, asuhan keperawatan | UI field, state legal, role, error dan workflow WF-01–04 |
| P0 M09, M11 | specimen→result→verification/critical ACK; resep→review→dispense/MAR | WF-05/07, kasus negatif, idempotensi, linked ID |
| P0/P1 M13, M14, M16 | charge/invoice/penjamin/claim dan stock/lot/approval | simulasi yang aman, tanpa transaksi riil |
| P1 M07–M08, M10, M12 | operasi, specialty, RIS/PACS, gizi | form lengkap dan workflow WF-06/10/11 |
| P1/P2 M15, M17–M21, CH01 | finance, facility, credential, quality, RL, master data dan portal pasien | izin, laporan, rekonsiliasi dan pasien/wali |

**Kontrak 268 bukan 268 endpoint stateful.** Katalog simulasi dan endpoint HTTP yang berjalan harus dinilai terpisah. Semua respons sintetis harus tanpa persistensi PHI, tanda tangan sah, pembayaran riil, mutasi stok, dispensing riil atau delivery SATUSEHAT/BPJS.

Khusus M21, nomenklatur PRD adalah **Administrasi Sistem & Master Data**, termasuk kemampuan integrasi. Label prototipe yang hanya menonjolkan SATUSEHAT tidak merepresentasikan seluruh cakupan M21 dan perlu dibenahi pada navigasi/acceptance.

## Menjalankan audit

```bash
npm run check:v4
npm run check:v3.5
npm test
```

`check:v4` hanya memverifikasi inventaris dan keterlacakan kontrak desain; ia **bukan** uji UAT atau validasi runtime seluruh workflow.
