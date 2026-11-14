// Synthetic scenarios. Codes represent demo catalog items, never clinical advice.
const text = (id, label, example) => ({ id, label, type: 'text', example });
const choice = (id, label, options) => ({ id, label, type: 'choice', options });
const number = (id, label, example, min = 0) => ({ id, label, type: 'number', example, min });
const confirm = (id, label) => ({ id, label, type: 'confirm' });
const bad = (field, value, message) => ({ field, value, message });
const step = (id, form, role, label, fields, output, failure, requires = []) => ({
  id, form, workspace: form.split('-')[1], role, label, fields, output, failure, requires,
});

export const workflows = [
  { id: 'WF-01', title: 'Janji temu hingga pemeriksaan poli', summary: 'Reservasi, check-in, dan pemanggilan antrean.', steps: [
    step('find-patient','F-M01-01','admission','Konfirmasi pasien', [confirm('identified','Cocokkan nama dan nomor RM demo')], 'Pasien ditemukan'),
    step('book-appointment','F-M01-03','admission','Pesan jadwal poli',[choice('slot','Jadwal dokter',['Selasa 09.00 · Poli Penyakit Dalam','Selasa 09.15 · Penuh']), choice('payer','Penjamin',['Umum','BPJS demo aktif','BPJS demo tidak aktif'])],'Janji temu dikonfirmasi',[bad('slot','Selasa 09.15 · Penuh','Slot penuh. Pilih jadwal lain.'),bad('payer','BPJS demo tidak aktif','Kepesertaan tidak aktif. Pilih penjamin yang tersedia.')]),
    step('check-in','F-M01-02','admission','Check-in dan terbitkan antrean',[confirm('arrived','Pasien sudah tiba di loket')],'Registrasi dan tiket antrean terbit'),
    step('call-queue','F-M01-04','admission','Panggil antrean',[choice('counter','Loket',['Loket 1','Loket 2'])],'Antrean dipanggil'),
    step('open-encounter','F-M02-01','doctor','Terima pasien di poli',[confirm('present','Identitas pasien di poli cocok')],'Encounter aktif di poli'),
  ]},
  { id:'WF-02', title:'Pemeriksaan rawat jalan', summary:'Asesmen, order penunjang, dan resume kunjungan.', steps:[
    step('record-vitals','F-M05-02','nurse','Catat tanda vital', [number('pulse','Nadi demo (kali/menit)',80,1),number('temperature','Suhu demo (°C)',36.5,1)],'Tanda vital diterima'),
    step('save-soap','F-M02-02','doctor','Dokumentasikan SOAP',[text('complaint','Keluhan pasien','Keluhan kasus simulasi'),text('objective','Pemeriksaan','Pemeriksaan contoh'),text('assessment','Asesmen','Asesmen kasus demo'),text('plan','Rencana','Observasi dan kontrol demo')],'SOAP tersimpan'),
    step('place-outpatient-order','F-M05-04','doctor','Pesan pemeriksaan penunjang',[choice('panel','Panel',['Darah lengkap','Kimia darah demo']),text('indication','Indikasi','Evaluasi kasus demo')],'Order masuk ke laboratorium'),
    step('report-outpatient-result','F-M09-03','lab','Validasi dan rilis hasil contoh',[text('result','Ringkasan hasil','Hasil pemeriksaan demo'),confirm('verified','Panel dan identitas cocok')],'Hasil dirilis ke dokter'),
    step('write-followup','F-M02-03','doctor','Catat edukasi dan kontrol',[text('education','Edukasi pasien','Instruksi kunjungan simulasi'),text('followup','Rencana kontrol','Kontrol dua minggu (demo)')],'Instruksi tercatat'),
    step('close-encounter','F-M05-07','doctor','Sahkan resume dan tutup kunjungan',[text('summary','Ringkasan kunjungan','Asesmen dan rencana kasus demo'),confirm('reviewed','Hasil penunjang telah ditinjau')],'Kunjungan selesai'),
  ]},
  { id:'WF-03', title:'IGD dan disposisi', summary:'Prioritas IGD, evaluasi ulang, dan serah terima.', steps:[
    step('triage','F-M03-01','emergency','Catat triase',[choice('priority','Prioritas demo',['ATS 2 · Emergensi','ATS 3 · Urgen','ATS 4 · Semi-urgen']),text('complaint','Keluhan utama','Keluhan fiktif IGD')],'Triase tercatat'),
    step('stabilize','F-M03-02','emergency','Catat tindakan dan reassessment',[text('intervention','Tindakan simulasi','Observasi kasus demo'),text('reassessment','Evaluasi ulang','Kondisi dievaluasi pada skenario')],'Kondisi terakhir tercatat'),
    step('decide-disposition','F-M03-03','emergency','Putuskan disposisi',[choice('destination','Tujuan',['Bangsal Melati','Bangsal tanpa bed']),text('reason','Alasan rawat inap','Pemantauan kasus demo')],'Permintaan admisi diterima',[bad('destination','Bangsal tanpa bed','Bangsal tidak memiliki bed tersedia. Pilih tujuan yang dapat menerima pasien.')]),
    step('receive-emergency-handover','F-M04-05','nurse','Terima serah terima IGD',[confirm('received','Saya sudah membaca kondisi dan rencana asuhan')],'Serah terima bangsal diterima'),
  ]},
  { id:'WF-04', title:'Rawat inap dan perpindahan bed', summary:'Admisi, asuhan, transfer, dan persiapan pulang.', steps:[
    step('allocate-bed','F-M04-02','bed','Alokasikan bed admisi',[choice('bed','Bed tujuan',['Melati 01 · Tersedia','Melati 02 · Terisi']),text('reason','Alasan admisi','Observasi kasus demo')],'Bed ditempati',[bad('bed','Melati 02 · Terisi','Bed sudah terisi. Pilih bed yang tersedia.')]),
    step('receive-admission','F-M06-03','nurse','Terima pasien di bangsal',[text('condition','Kondisi saat diterima','Kondisi kasus contoh'),text('tasks','Tugas pending','Pantau sesuai skenario')],'Pasien diterima perawat'),
    step('record-ward-round','F-M05-01','doctor','Simpan CPPT visite',[text('assessment','Asesmen','Asesmen kasus demo'),text('plan','Rencana','Rencana rawat inap demo')],'CPPT visite tercatat'),
    step('transfer-bed','F-M04-05','nurse','Serahkan pasien ke bangsal tujuan',[choice('bed','Bed tujuan',['Kenanga 01 · Tersedia','Melati 02 · Terisi']),text('receiver','Penerima serah terima','Perawat Bangsal Demo')],'Bed tujuan ditempati, bed asal dibersihkan',[bad('bed','Melati 02 · Terisi','Bed tujuan sudah terisi.')]),
    step('prepare-discharge','F-M04-04','doctor','Sahkan ringkasan pulang',[text('summary','Ringkasan pulang','Ringkasan kasus fiktif'),text('followup','Instruksi kontrol','Jadwal kontrol demo'),confirm('reconciled','Rekonsiliasi obat selesai')],'Pasien siap finalisasi biaya'),
    step('finalize-inpatient-invoice','F-M13-02','cashier','Finalisasi invoice rawat inap',[confirm('reviewed','Rincian biaya episode sudah diperiksa')],'Invoice rawat inap final'),
    step('release-bed','F-M04-01','bed','Lepaskan bed pasien pulang',[confirm('vacated','Pasien sudah meninggalkan kamar')],'Bed menunggu pembersihan'),
  ]},
  { id:'WF-05', title:'Order laboratorium dan rilis hasil', summary:'Spesimen, validasi hasil, koreksi, dan penerimaan dokter.', steps:[
    step('place-lab-order','F-M05-04','doctor','Pesan panel laboratorium',[choice('panel','Panel',['Darah lengkap','Kimia darah demo']),text('indication','Indikasi','Evaluasi kasus demo')],'Order diterima worklist lab'),
    step('collect-specimen','F-M09-01','lab','Catat pengambilan spesimen',[confirm('identified','Identitas pasien dan label sesuai')],'Barcode spesimen diterbitkan'),
    step('receive-specimen','F-M09-02','lab','Periksa spesimen',[choice('quality','Kondisi spesimen',['Layak','Hemolisis','Label tidak sesuai'])],'Spesimen diterima',[bad('quality','Hemolisis','Spesimen hemolisis. Pengambilan ulang diperlukan.'),bad('quality','Label tidak sesuai','Cocokkan label dan identitas sebelum menerima spesimen.')]),
    step('save-lab-result','F-M09-03','lab','Simpan draf hasil',[text('analyte','Parameter','Parameter simulasi'),number('value','Nilai hasil demo',12.5),text('unit','Satuan','Unit demo')],'Draf hasil tersedia'),
    step('release-lab-result','F-M09-03','lab','Verifikasi dan rilis hasil',[confirm('reviewed','Cocokkan hasil, satuan, dan referensi')],'Laporan laboratorium dirilis'),
    step('acknowledge-lab-result','F-M02-03','doctor','Akui hasil di chart',[text('response','Catatan tindak lanjut','Hasil ilustratif ditinjau')],'Hasil ditinjau dokter'),
  ]},
  { id:'WF-06', title:'Order radiologi dan ekspertise', summary:'Jadwal, akuisisi ilustratif, dan rilis laporan radiolog.', steps:[
    step('place-radiology-order','F-M05-04','doctor','Pesan radiologi',[choice('modality','Pemeriksaan',['THX demo','USG demo']), text('indication','Indikasi','Evaluasi simulasi')],'Order masuk RIS'),
    step('schedule-imaging','F-M10-01','radiographer','Jadwalkan pemeriksaan',[choice('slot','Jadwal',['Rabu 10.00','Rabu 10.30'])],'Jadwal dikonfirmasi'),
    step('record-acquisition','F-M10-01','radiographer','Catat akuisisi ilustratif',[choice('identity','Kecocokan identitas',['Cocok','Tidak cocok']),confirm('acquired','Studi ilustratif tersedia')],'Studi terhubung ke order',[bad('identity','Tidak cocok','Identitas studi dan pasien harus sama.')]),
    step('release-radiology-report','F-M10-02','radiology','Sahkan dan rilis ekspertise',[text('findings','Temuan','Temuan studi ilustratif'),text('impression','Kesan','Laporan simulasi')],'Ekspertise dirilis'),
    step('view-released-study','F-M10-03','doctor','Tinjau laporan dan studi',[confirm('reviewed','Laporan dan citra ilustratif telah ditinjau')],'Hasil radiologi diterima dokter'),
  ]},
  { id:'WF-07', title:'Resep, dispensing dan pemberian obat', summary:'Kajian resep, lot simulasi, stok, dan catatan MAR.', steps:[
    step('place-prescription','F-M11-01','doctor','Terbitkan resep simulasi',[choice('product','Produk demo',['Obat Demo A','Obat Demo B']),number('quantity','Jumlah unit',4,1),text('instruction','Instruksi simulasi','Instruksi kasus fiktif')],'Resep masuk ke depo'),
    step('review-prescription','F-M11-02','pharmacy','Kaji resep',[choice('allergy','Hasil tinjauan alergi',['Sesuai','Perlu klarifikasi']),confirm('checked','Interaksi dan formularium sudah ditinjau')],'Resep diverifikasi',[bad('allergy','Perlu klarifikasi','Klarifikasi dengan dokter sebelum menyiapkan obat.')]),
    step('dispense-prescription','F-M11-03','pharmacy','Siapkan dan serahkan obat',[choice('lot','Lot FEFO',['LOT-DEMO-01 · Tersedia','LOT-DEMO-02 · Habis']),text('receiver','Penerima','Perawat Demo')],'Obat diserahkan dan ledger diperbarui',[bad('lot','LOT-DEMO-02 · Habis','Stok lot habis. Pilih lot dengan stok tersedia.')]),
    step('record-mar','F-M11-04','nurse','Catat pemberian di MAR',[choice('identity','Kecocokan pasien dan label',['Cocok','Tidak cocok']),confirm('given','Pemberian simulasi terkonfirmasi')],'Pemberian obat tercatat',[bad('identity','Tidak cocok','Cocokkan pasien dan label obat.')]),
    step('reconcile-dispense','F-M16-06','warehouse','Tinjau mutasi stok resep',[confirm('reconciled','Lot dan pengeluaran pada ledger sudah cocok')],'Pengeluaran terverifikasi'),
  ]},
  { id:'WF-08', title:'Tagihan, kasir dan klaim', summary:'Biaya episode hingga rekonsiliasi dan jurnal simulasi.', steps:[
    step('capture-charge','F-M13-01','cashier','Tinjau biaya tindakan',[confirm('reviewed','Sumber charge tersedia dan unik')],'Charge tercatat'),
    step('issue-invoice','F-M13-02','cashier','Terbitkan invoice',[choice('payer','Alokasi',['Pasien dan penjamin demo','Penjamin ditolak'])],'Invoice terbit',[bad('payer','Penjamin ditolak','Alokasi membutuhkan eligibility yang aktif.')]),
    step('receive-payment','F-M13-03','cashier','Catat pembayaran pasien',[number('amount','Pembayaran demo (Rp)',50000,1),choice('method','Cara bayar',['Tunai demo','Transfer demo'])],'Bukti penerimaan terbit'),
    step('submit-claim','F-M14-04','claims','Verifikasi dan kirim klaim simulasi',[confirm('ready','Berkas dan diagnosis lengkap')],'Klaim menunggu respons penjamin'),
    step('receive-claim-ack','F-M14-04','claims','Catat respons penjamin',[choice('ack','Respons simulasi',['Diterima','Ditolak'])],'Respons penjamin tercatat'),
    { ...step('correct-rejected-claim','F-M14-04','claims','Koreksi berkas dan kirim ulang',[text('reason','Perbaikan berkas','Bukti klaim demo ditambahkan'),confirm('accepted','Percobaan ulang menerima ACK positif')],'Koreksi dikirim dan ACK baru diterima'), when:['receive-claim-ack','ack','Ditolak'] },
    step('reconcile-claim','F-M14-04','claims','Rekonsiliasi klaim',[text('reference','Referensi remittance atau koreksi','REM-DEMO-001')],'Klaim direkonsiliasi'),
    step('post-journal','F-M15-01','accounting','Tinjau jurnal simulasi',[confirm('balanced','Debit, kredit, dan sumber transaksi seimbang')],'Jurnal simulasi tercatat'),
  ]},
  { id:'WF-09', title:'Rujukan internal dan eksternal', summary:'Kompetensi tujuan, consent, respons, dan penerimaan.', steps:[
    step('prepare-referral','F-M05-06','doctor','Siapkan rujukan',[choice('target','Tujuan',['Poli tujuan internal','RS tujuan demo','Layanan tidak tersedia']),text('reason','Alasan rujuk','Pemantauan kasus fiktif')],'Rujukan siap dikirim',[bad('target','Layanan tidak tersedia','Tujuan tidak memiliki layanan yang dipilih.')]),
    step('record-referral-consent','F-M21-04','admin','Konfirmasi persetujuan rujukan',[confirm('consent','Persetujuan berbagi ringkasan telah dicatat')],'Consent rujukan aktif'),
    step('send-referral','F-M05-06','doctor','Kirim ringkasan rujukan',[text('summary','Ringkasan untuk penerima','Kondisi dan rencana simulasi'),choice('partner','Kanal penerima',['Tersedia','Gangguan sementara'])],'Rujukan dikirim',[bad('partner','Gangguan sementara','Kanal tujuan belum tersedia. Draf rujukan tetap tersimpan.')]),
    step('accept-referral','F-M05-06','emergency','Tinjau dan respons rujukan',[choice('response','Keputusan penerima',['Diterima','Ditolak']),text('note','Catatan keputusan','Catatan penerima demo')],'Keputusan penerima tercatat'),
    { ...step('reroute-referral','F-M05-06','doctor','Pilih tujuan pengganti',[choice('target','Tujuan alternatif',['Poli Demo B','RS Demo B']),confirm('accepted','Penerima alternatif sudah menyetujui')],'Tujuan pengganti menerima rujukan'), when:['accept-referral','response','Ditolak'] },
    step('transfer-referral','F-M04-05','nurse','Selesaikan serah terima rujukan',[confirm('received','Tujuan sudah menerima pasien dan ringkasan')],'Episode rujukan diperbarui'),
  ]},
  { id:'WF-10', title:'Operasi, anestesi dan PACU', summary:'Kesiapan, checklist perioperatif, dan serah terima pemulihan.', steps:[
    step('schedule-surgery','F-M07-01','operating','Jadwalkan kasus operasi',[choice('room','Ruang operasi',['OK 1','OK 2']),choice('slot','Jadwal',['Kamis 08.00','Kamis 10.00'])],'Kasus terjadwal'),
    step('release-instruments','F-M17-01','assets','Konfirmasi set steril',[choice('quality','Hasil QC set',['Lulus','Gagal'])],'Set steril siap',[bad('quality','Gagal','Set gagal QC. Gunakan batch yang lulus sebelum operasi.')]),
    step('confirm-sign-in','F-M07-02','operating','Lengkapi sign-in',[confirm('consent','Consent aktif dan pre-op diperiksa'),confirm('identity','Identitas dan lokasi sesuai')],'Sign-in selesai'),
    step('confirm-time-out','F-M07-02','operating','Lengkapi time-out',[confirm('team','Tim menyetujui pasien, tindakan, dan lokasi')],'Time-out selesai'),
    step('record-anesthesia','F-M07-03','operating','Catat anestesi dan prosedur',[text('procedure','Catatan prosedur','Tindakan simulasi'),text('monitoring','Pemantauan','Catatan ilustratif')],'Catatan intraoperatif tersedia'),
    step('confirm-sign-out','F-M07-02','operating','Lengkapi sign-out',[confirm('count','Hitung instrumen dan checklist sesuai')],'Sign-out selesai'),
    step('handover-pacu','F-M07-04','operating','Serahkan pasien dari PACU',[choice('recovery','Kondisi pemulihan',['Stabil untuk serah terima','Perlu observasi']),text('destination','Unit penerima','Bangsal Melati')],'Serah terima PACU tercatat',[bad('recovery','Perlu observasi','Pasien tetap di PACU sampai evaluasi ulang.')]),
    step('accept-pacu-handover','F-M04-05','nurse','Terima pasien pascaoperasi',[confirm('reviewed','Instruksi PACU telah ditinjau')],'Bangsal menerima pasien'),
  ]},
  { id:'WF-11', title:'Gizi klinis dan distribusi tray', summary:'Order diet, produksi, QC, dan konfirmasi di bangsal.', steps:[
    step('order-diet','F-M12-01','nutrition','Tetapkan diet',[choice('diet','Diet demo',['Diet standar','Diet tekstur lunak']),text('allergies','Alergi pada kasus demo','Tidak ada alergi pada skenario')],'Order diet aktif'),
    step('produce-batch','F-M12-02','nutrition','Siapkan batch dan label tray',[number('quantity','Jumlah tray',1,1),confirm('qc','Cocokkan menu, diet, dan label pasien')],'Tray siap distribusi'),
    step('deliver-tray','F-M12-03','nutrition','Konfirmasi tray di bed',[choice('bed','Bed hasil pencocokan',['Melati 01 · Sesuai','Melati 02 · Salah pasien']),choice('status','Status pasien',['Boleh makan','Puasa'])],'Tray diserahkan',[bad('bed','Melati 02 · Salah pasien','Tray tidak sesuai pasien atau bed. Periksa label.'),bad('status','Puasa','Tahan distribusi sampai status puasa selesai.')]),
    step('acknowledge-tray','F-M04-03','nurse','Terima tray di bangsal',[confirm('received','Diet dan tray sesuai pasien')],'Penerimaan tray tercatat'),
  ]},
  { id:'WF-12', title:'Clinical pathway dan outcome', summary:'Langkah, deviasi, tindakan perbaikan, dan biaya.', steps:[
    step('enroll-pathway','F-M05-08','doctor','Daftarkan pasien ke pathway',[choice('pathway','Pathway aktif',['Observasi Demo v1','Pemulihan Demo v1'])],'Pathway aktif di episode'),
    step('record-pathway-step','F-M05-08','doctor','Catat langkah dan bukti',[text('evidence','Bukti langkah','Catatan kunjungan simulasi')],'Bukti langkah tersimpan'),
    step('review-pathway-variance','F-M05-08','quality','Tinjau deviasi dan tindak lanjut',[text('reason','Alasan deviasi','Perubahan jadwal demo'),text('action','Tindakan tindak lanjut','Atur ulang jadwal kasus demo')],'Deviasi dan tindak lanjut disetujui'),
    step('record-pathway-outcome','F-M05-08','doctor','Evaluasi outcome',[choice('outcome','Outcome pasien',['Tercapai','Belum tercapai','Belum dapat dinilai']),text('evidence','Bukti outcome','Ringkasan evaluasi demo')],'Outcome dicatat'),
    step('review-pathway-cost','F-M15-03','accounting','Tinjau snapshot biaya',[confirm('reviewed','Biaya berasal dari episode pathway')],'Outcome dan biaya tersedia'),
  ]},
];
