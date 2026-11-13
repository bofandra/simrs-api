# SIMRS API — kontrak FE–BE dan sandbox PRD v3.0

> **STATUS: CONTRACT-FIRST / DEMO ONLY.** Bukan backend produksi. Data fiktif; tidak ada koneksi SATUSEHAT, BPJS, PACS, bank, farmasi, atau sistem rumah sakit sesungguhnya.

Sumber tunggal: **PRD SIMRS Baru v3.0 (12 November 2026)**; cakupan 21 modul M01–M21 + CH01 Portal Pasien, 106 operasi kandidat.

Dokumentasi OpenAPI 3.1 dan katalog akan ditambahkan ke repo ini. Node.js 20+ dipakai sebagai mock server **tanpa dependensi eksternal**. FE static mockup di [bofandra/simrs](https://github.com/bofandra/simrs) dapat memanggil adapter demo di browser.

Dokumen kebutuhan: [PRD v3.0](https://docs.google.com/document/d/1NzQ6ryYk8Jqat-nqI-Nbyjbx1inSn-ss/edit).

## Keselamatan dan status
Setiap respons sandbox wajib berlabel simulated. Eksekusi POST hanya membuat state sintetis; **bukan** pemberian terapi, penandatanganan legal, mutasi gudang, pembukuan, transaksi kasir, persetujuan klaim, maupun pengiriman partner nasional. Auth demo dan permission metadata tidak menggantikan enforcement JWT/RBAC/ABAC produksi.
