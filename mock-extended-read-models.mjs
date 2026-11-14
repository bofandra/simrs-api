/**
 * HOSNEX P1/P2 read-only workspace previews.
 * These records are fictional examples, NOT stateful clinical or financial
 * transactions. This is a dev-only, read-only extension of p0-read-models.
 */
export const EXTRA_READ_MODULES=Object.freeze(['M07','M08','M10','M12','M15','M17','M18','M19','M20']);
export const EXTRA_TITLES=Object.freeze({
  M07:'Kamar Operasi — jadwal dan keselamatan',
  M08:'Pelayanan Khusus — enam sub-layanan',
  M10:'Radiologi — order, laporan dan PACS',
  M12:'Gizi — asuhan, diet dan distribusi',
  M15:'Akuntansi — jurnal, piutang dan costing',
  M17:'Sarpras — pemeliharaan dan kalibrasi',
  M18:'SDM — penjadwalan dan kredensial',
  M19:'Mutu — insiden dan indikator keselamatan',
  M20:'Analitik — dashboard dan lineage pelaporan'
});
const EID='d091ae84-9548-4a24-8191-4106bc504111';
const PID='af7b7648-1a67-4589-96d0-a970c983b111';
const field=(label,value)=>({label,value:String(value)});
const check=(label,done)=>({label,done:Boolean(done)});
const patientModules=new Set(['M07','M08','M10','M12']);
function record(module,index,title,subtitle,status,fields,checks){
  const patientContext=patientModules.has(module);
  return {
    id:String(Number(module.slice(1))).padStart(8,'0')+'-0000-4000-8000-'+String(index).padStart(12,'0'),
    title,subtitle,status,
    module,readOnly:true,
    encounterId:patientContext?EID:null,
    patientId:patientContext?PID:null,
    fields:fields.map(([label,value])=>field(label,value)),
    checklist:checks.map(([label,done])=>check(label,done))
  };
}
export function buildExtendedReadModels(clinical){
  const ed=clinical.list('M03').items[0];
  const ward=clinical.list('M04').items[0];
  const nursing=clinical.list('M06').items[0];
  const admitted=ward?.status==='admitted';
  const handedOver=nursing?.status==='handed-over';
  const triaged=ed?.status!=='waiting';
  const admissionRequested=ed?.status==='admission-requested';
  const values={
    M07:[
      record('M07',1,'Jadwal kamar operasi — contoh elektif',
        'DEMO-OK-001 · penjadwalan hanya pratinjau','planned-only',[
          ['Kamar','OK Demo 1'],['Sesi','Simulasi sesi pagi'],
          ['Jenis tindakan','Contoh tindakan elektif'],['Tim','Tim bedah dan anestesi contoh']
        ],[['Admisi bangsal sintetis tersedia',admitted],['Consent dan surgical readiness terverifikasi',false]]),
      record('M07',2,'Checklist WHO Surgical Safety',
        'Sebelum insisi · bukan verifikasi keselamatan nyata','incomplete',[
          ['Tahap','Sign In / Time Out / Sign Out'],
          ['Episode',EID],['Anestesi','Persiapan contoh']
        ],[['Identitas dan sisi tindakan tervalidasi',false],['Anestesi dan risiko tindakan direview',false]])
    ],
    M08:[
      record('M08',1,'Hemodialisis — lembar penapisan',
        'Sub-layanan HD · hanya formulir contoh','screening-only',[
          ['Unit','Hemodialisis demo'],['Akses vaskular','Belum dinilai'],
          ['Sesi','Pratinjau tanpa mesin atau pengobatan']
        ],[['Resep dialisis dari DPJP tersedia',false],['Kesiapan mesin dan tindakan sah',false]]),
      record('M08',2,'Rehabilitasi Medik — asesmen',
        'Sub-layanan fisioterapi · penilaian contoh','assessment-needed',[
          ['Unit','Rehabilitasi Medik'],['Target fungsi','Mobilitas contoh'],
          ['Tindakan','Belum diberikan']
        ],[['Rujukan rehabilitasi tervalidasi',false],['Kunjungan tindakan dicatat',false]]),
      record('M08',3,'MCU — paket pemeriksaan',
        'Medical Check-up sintetis · tanpa klaim hasil','registered-only',[
          ['Paket','Paket MCU dasar demo'],['Pemeriksaan','Laboratorium, radiologi'],
          ['Laporan','Belum diterbitkan']
        ],[['Registrasi MCU nyata diterima',false],['Kesimpulan pemeriksaan final',false]]),
      record('M08',4,'Bank Darah — permintaan komponen',
        'Contoh pra-crossmatch · tanpa release kantong darah','sample-only',[
          ['Komponen','PRC contoh'],['Golongan','Belum diuji'],
          ['Nomor kantong','Tidak ada unit darah riil']
        ],[['Golongan/crossmatch tervalidasi',false],['Release unit darah fisik',false]]),
      record('M08',5,'KIA dan Perinatologi — daftar asesmen',
        'Ibu/bayi hanya alur referensi UI','observation-preview',[
          ['Layanan','KIA/Perinatologi'],['Subjek','Pasien contoh, bukan bayi nyata'],
          ['Asesmen','Belum tersedia']
        ],[['Dokumentasi maternal/neonatal valid',false],['Encounter/persalinan nyata tercatat',false]]),
      record('M08',6,'Imunisasi — jadwal layanan',
        'Pencatatan jadwal bukan bukti pemberian vaksin','schedule-only',[
          ['Layanan','Imunisasi'],['Jenis','Vaksin simulasi'],
          ['Nomor batch','Tidak ada stok riil']
        ],[['Skrining pra-imunisasi tervalidasi',false],['Administrasi vaksin terkonfirmasi',false]])
    ],
    M10:[
      record('M10',1,'Worklist X-ray toraks',
        'DEMO-RAD-0001 · hanya order contoh','order-preview',[
          ['Modalitas','DX'],['Order','Thorax PA'],['Accession Number','DEMO-ACSN-0001'],
          ['Status PACS','Tidak ada studi DICOM riil']
        ],[['Order dokter tervalidasi',false],['Akuisisi DICOM tersedia',false]]),
      record('M10',2,'Laporan radiologi — draft',
        'DEMO-RAD-0002 · belum ditandatangani radiolog','report-unsigned',[
          ['Modalitas','CT'],['Pemeriksaan','CT contoh'],
          ['Impression','Tidak ada interpretasi klinis nyata']
        ],[['Gambar DICOM tersedia',false],['Verifikasi laporan radiolog',false]])
    ],
    M12:[
      record('M12',1,'Skrining dan asesmen gizi',
        'DEMO-NUT-0001 · skor risiko hanya contoh','assessment-only',[
          ['Instrumen','NRS-2002 demo'],['Unit','Bangsal demo A'],
          ['Episode',EID]
        ],[['Pasien diadmisi dalam simulasi',admitted],['Skor gizi berdasarkan penilaian klinis',false]]),
      record('M12',2,'Diet order dan distribusi',
        'Tidak ada makanan/label pasien yang benar-benar dicetak','diet-preview',[
          ['Diet','Diet lunak simulasi'],['Jadwal','Makan siang contoh'],
          ['Dapur','Produksi dan distribusi tidak terhubung']
        ],[['Konsultasi ahli gizi selesai',false],['Distribusi hidangan tercatat',false]])
    ],
    M15:[
      record('M15',1,'Jurnal umum — pratinjau',
        'DEMO-JRN-0001 · bukan posting ke general ledger','unposted',[
          ['Akun Debit','Piutang dummy'],['Akun Kredit','Pendapatan dummy'],
          ['Nilai','Rp650.000 (simulasi)'],['Periode','November 2026 contoh']
        ],[['Jurnal seimbang secara contoh',true],['Otorisasi posting ke GL',false]]),
      record('M15',2,'Piutang dan utang usaha',
        'DEMO-AR-AP-0001 · hanya contoh saldo','unreconciled',[
          ['Piutang','Rp650.000 (dummy)'],['Utang','Rp150.000 (dummy)'],
          ['Aging','Bukan data akuntansi riil']
        ],[['Rekonsiliasi dengan subledger',false],['Konsistensi invoice nyata',false]]),
      record('M15',3,'Unit costing — kalkulasi contoh',
        'Biaya pusat layanan tidak dihitung dari transaksi riil','estimate-only',[
          ['Cost center','Bangsal Demo A'],['Basis','Estimasi bahan dan jasa'],
          ['Biaya','Rp200.000 (dummy)']
        ],[['Mapping cost center terverifikasi',false],['Alokasi biaya produksi valid',false]])
    ],
    M17:[
      record('M17',1,'Kalibrasi alat medis',
        'DEMO-ASSET-0001 · tidak menerbitkan sertifikat','calibration-due',[
          ['Peralatan','Patient Monitor contoh'],['Lokasi','Bangsal Demo A'],
          ['Serial','DEMO-SERIAL-001'],['Jadwal','Peninjauan simulasi']
        ],[['Alat terdaftar pada inventaris sah',false],['Kalibrasi resmi ditandatangani',false]]),
      record('M17',2,'Work order pemeliharaan',
        'DEMO-WO-0001 · belum ada pekerjaan fisik','maintenance-pending',[
          ['Kategori','Preventive maintenance'],
          ['Petugas','Teknisi fiktif'],['Tiket','DEMO-WO-0001']
        ],[['Persetujuan work order riil',false],['Hasil pengujian alat diterima',false]])
    ],
    M18:[
      record('M18',1,'Rostering petugas',
        'DEMO-SHIFT-0001 · tidak mengubah absensi','roster-draft',[
          ['Unit','IGD Demo'],['Shift','Pagi contoh'],
          ['Jumlah petugas','3 identitas simulasi']
        ],[['Jadwal disetujui kepala unit',false],['Absen/kehadiran valid',false]]),
      record('M18',2,'Kredensial tenaga kesehatan',
        'DEMO-CRED-0001 · STR/SIP tidak diverifikasi','credential-review',[
          ['Peran','Dokter contoh'],['STR/SIP','Identitas tidak tersedia'],
          ['Status','Perlu verifikasi di sistem berwenang']
        ],[['STR/SIP tervalidasi',false],['Hak klinis diberikan secara resmi',false]])
    ],
    M19:[
      record('M19',1,'Laporan insiden keselamatan pasien',
        'DEMO-INC-0001 · tidak mengirim insiden nyata','unsubmitted',[
          ['Kategori','Near miss fiktif'],['Lokasi','IGD Demo'],
          ['Tindak lanjut','Belum dilakukan']
        ],[['Klasifikasi insiden direview petugas',false],['Analisis dan tindak lanjut formal',false]]),
      record('M19',2,'Indikator mutu pelayanan',
        'DEMO-KPI-0001 · agregasi dari episode sintetis','preview-only',[
          ['Episode IGD contoh',1],['Triase dilakukan',triaged?'Ya (simulasi)':'Belum'],
          ['Handover keperawatan',handedOver?'Ya (simulasi)':'Belum']
        ],[['Data simulasi IGD tersedia',true],['Kualitas indikator berdasarkan data nyata',false]])
    ],
    M20:[
      record('M20',1,'Dashboard kinerja pelayanan',
        'DEMO-BI-0001 · bukan indikator kinerja RS riil','sample-metrics',[
          ['Episode IGD sintetis',1],['Permintaan admisi',admissionRequested?1:0],
          ['Admisi bangsal',admitted?1:0],['Handover SBAR',handedOver?1:0]
        ],[['Status demo klinis sinkron',true],['Data warehouse sumber diverifikasi',false]]),
      record('M20',2,'RL dan laporan SIRS — pratinjau',
        'DEMO-RL-0001 · tidak ada ekspor/pelaporan resmi','export-disabled',[
          ['Laporan','RL data contoh'],['Sumber','Episode sintetis Node'],
          ['Pengiriman SIRS','Tidak aktif']
        ],[['Validasi definisi RL terpenuhi',false],['Persetujuan pelaporan sah',false]]),
      record('M20',3,'Data lineage dan kualitas data',
        'DEMO-LINEAGE-0001 · metadata hanya contoh','lineage-preview',[
          ['Sumber','M03, M04, M06 (synthetic RAM)'],
          ['Tujuan','M20 dashboard demo'],['Penyimpanan','Tidak ada data warehouse']
        ],[['Sumber demo dapat ditelusuri',true],['Audit lineage produksi diverifikasi',false]])
    ]
  };
  for(const module of EXTRA_READ_MODULES){
    if(!Array.isArray(values[module])||values[module].length<2)
      throw new Error('Missing detailed synthetic read model for '+module);
  }
  return values;
}
