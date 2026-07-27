import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Workflow, 
  HelpCircle, 
  Database, 
  Server, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  BookOpen, 
  Sparkles, 
  Shield, 
  FileSpreadsheet, 
  UtensilsCrossed, 
  Clock, 
  FileText,
  UserCheck,
  ChevronRight,
  Info
} from 'lucide-react';

// Interfaces
interface FlowStep {
  id: number;
  title: string;
  role: 'Semua User' | 'Admin / Koordinator' | 'Petugas Gizi';
  description: string;
  detailedSteps: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface FeatureSpec {
  id: string;
  name: string;
  category: 'Pencatatan' | 'Manajemen Siklus' | 'Analisis & Laporan' | 'Infrastruktur';
  description: string;
  specs: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function SystemFlow() {
  const [activeTab, setActiveTab] = useState<'flow' | 'architecture' | 'specs'>('flow');
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [selectedArchNode, setSelectedArchNode] = useState<'client' | 'auth' | 'database'>('client');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Steps Data
  const steps: FlowStep[] = [
    {
      id: 1,
      title: 'Registrasi & Setup Profil',
      role: 'Semua User',
      description: 'Langkah awal bagi petugas gizi baru untuk masuk ke ekosistem Nutriwaste.',
      icon: UserCheck,
      detailedSteps: [
        'Petugas melakukan pendaftaran (registrasi) menggunakan email aktif hospital.',
        'Sistem memvalidasi email dan mengarahkan ke halaman pelengkapan profil.',
        'Petugas memasukkan nama lengkap, nomor pegawai, dan memilih role (Koordinator Gizi / Petugas Gizi).',
        'Sistem menyimpan metadata profil ke Cloud Firestore dan mengaktifkan sesi login.'
      ]
    },
    {
      id: 2,
      title: 'Konfigurasi Data Master',
      role: 'Admin / Koordinator',
      description: 'Menyiapkan fondasi data rumah sakit sebelum pengisian sisa makan dapat dilakukan.',
      icon: Database,
      detailedSteps: [
        'Admin masuk ke menu "Data Master" untuk mengelola daftar bangsal/unit perawatan.',
        'Admin mendaftarkan jenis diet klinis pasien (misal: Diet Bubur, Rendah Garam, Jantung, Diabetes).',
        'Semua data disimpan terstruktur dengan validasi waktu real-time untuk mencegah data duplikat.',
        'Perubahan data master secara instan ter-sinkronisasi ke perangkat seluruh petugas gizi.'
      ]
    },
    {
      id: 3,
      title: 'Penetapan Siklus Menu',
      role: 'Admin / Koordinator',
      description: 'Menyusun siklus menu makanan terjadwal untuk memudahkan pencatatan harian.',
      icon: Clock,
      detailedSteps: [
        'Admin menyusun menu harian berdasarkan Siklus Hari ke-1 s/ad ke-10 atau menu pilihan khusus.',
        'Setiap siklus dikelompokkan berdasarkan waktu makan (Pagi, Siang, Sore) dan kategori diet.',
        'Aplikasi mendukung pergantian status menu (Aktif/Nonaktif) dengan transisi visual yang responsif.',
        'Siklus menu ini yang nantinya otomatis ter-load saat petugas melakukan input sisa makan.'
      ]
    },
    {
      id: 4,
      title: 'Pencatatan Sisa Makan Pasien',
      role: 'Petugas Gizi',
      description: 'Pengambilan data porsi sisa makan pasien di bangsal menggunakan visual skala Comstock.',
      icon: UtensilsCrossed,
      detailedSteps: [
        'Petugas gizi membawa tablet/smartphone ke bangsal perawatan saat waktu piring ditarik.',
        'Membuka menu "Input Sisa Makan", memilih tanggal, bangsal, waktu makan, dan jenis diet.',
        'Mengestimasi sisa makanan utama, lauk hewani, lauk nabati, sayuran, dan buah menggunakan skala visual Comstock (Sisa 100%, 75%, 50%, 25%, atau 0% habis).',
        'Jika internet tidak stabil, data otomatis masuk antrean lokal (Local Offline Storage) dan akan sinkron otomatis saat koneksi pulih.'
      ]
    },
    {
      id: 5,
      title: 'Dashboard Real-Time & KPI',
      role: 'Semua User',
      description: 'Menganalisis performa pelayanan asuhan gizi secara visual dan seketika.',
      icon: Activity,
      detailedSteps: [
        'Setiap porsi sisa makan yang disubmit langsung dikonversi menjadi indikator kepuasan & persentase food waste.',
        'Dashboard menampilkan grafik tren mingguan, sisa makanan tertinggi per bangsal, dan tingkat kepuasan gizi.',
        'Membantu manajemen rumah sakit memantau kepatuhan diet dan mengevaluasi cita rasa menu gizi.'
      ]
    },
    {
      id: 6,
      title: 'Ekspor Laporan Bulanan',
      role: 'Semua User',
      description: 'Menghasilkan berkas Excel terstandarisasi untuk kebutuhan akreditasi gizi rumah sakit.',
      icon: FileSpreadsheet,
      detailedSteps: [
        'Membuka halaman "Laporan" dan menyaring rentang tanggal yang diinginkan.',
        'Sistem memproses kompilasi ribuan data sisa makan per pasien, per bangsal, per diet.',
        'Klik tombol "Ekspor Excel" untuk mendownload file spreadsheet rapi berkode warna indikator.',
        'Laporan siap digunakan untuk rapat evaluasi pelayanan asuhan gizi rumah sakit.'
      ]
    }
  ];

  // Architecture Nodes Info
  const architectureNodes = {
    client: {
      title: 'Aplikasi Klien (Nutriwaste WebApp)',
      tech: 'React 18, Vite, Tailwind CSS, Lucide Icons, Recharts, Motion (Animate)',
      description: 'Antarmuka responsif modern yang dioperasikan oleh Petugas Gizi di lapangan maupun Koordinator Gizi di kantor.',
      capabilities: [
        'Antarmuka adaptif (Mobile-First untuk input bangsal, Desktop-First untuk dashboard).',
        'State Management reaktif untuk performa pengisian super cepat.',
        'Mekanisme offline caching mendeteksi sinyal internet terputus secara instan.',
        'Efek visual transisi interaktif berstandar Emil Kowalski (Scale active feedback, spring animation).'
      ]
    },
    auth: {
      title: 'Layanan Keamanan (Firebase Auth)',
      tech: 'Firebase Authentication SDK',
      description: 'Gerbang keamanan ter-enkripsi yang menangani verifikasi identitas pengguna secara aman.',
      capabilities: [
        'Sistem enkripsi password berskala industri.',
        'Manajemen sesi token JWT otomatis (tetap login tanpa perlu memasukkan password berulang-ulang).',
        'Autentikasi multi-level memisahkan hak akses Koordinator (Admin) dan Petugas Gizi.',
        'Proteksi rute halaman sensitif dari akses luar yang tidak sah.'
      ]
    },
    database: {
      title: 'Database Cloud (Firestore NoSQL)',
      tech: 'Google Cloud Firestore Persistent Database',
      description: 'Penyimpanan awan terdistribusi dengan sinkronisasi data real-time dan ketahanan tinggi.',
      capabilities: [
        'Sinkronisasi sisa makanan real-time (setiap input seketika mengupdate grafik dashboard).',
        'Skema NoSQL fleksibel yang menyimpan relasi Unit Perawatan, Jenis Diet, dan Siklus Menu.',
        'Arsitektur offline persistence bawaan yang memungkinkan penulisan data sisa makan tanpa internet.',
        'Keamanan dokumen database diatur oleh Aturan Keamanan (Firestore Rules) yang ketat.'
      ]
    }
  };

  // Feature Specifications
  const featureSpecs: FeatureSpec[] = [
    {
      id: 'spec-1',
      name: 'Estimasi Visual Skala Comstock',
      category: 'Pencatatan',
      description: 'Metode penilaian sisa makanan menggunakan estimasi visual piring sisa terstandarisasi 5 poin untuk kemudahan entri petugas.',
      icon: UtensilsCrossed,
      specs: [
        'Skala Nilai Sisa: 0 (0%), 1 (25%), 2 (50%), 3 (75%), 4 (95%), 5 (100%).',
        'Pengisian Multi-Komponen: Makanan Pokok, Lauk Hewani, Lauk Nabati, Sayuran, dan Buah.',
        'Kalkulasi persentase konsumsi riil otomatis per pasien.',
        'Tampilan warna indikator porsi sisa (Hijau = Bagus, Kuning = Sedang, Merah = Kritis).'
      ]
    },
    {
      id: 'spec-2',
      name: 'Resiliensi Mode Offline Mandiri',
      category: 'Infrastruktur',
      description: 'Menjamin kelancaran pendataan gizi di area rumah sakit yang minim sinyal atau terhalang dinding tebal.',
      icon: Shield,
      specs: [
        'Deteksi status jaringan (Online/Offline) secara otomatis lewat browser API.',
        'Penyimpanan antrean sisa makan ke cache internal saat offline.',
        'Mekanisme auto-syncing saat mendeteksi jaringan internet telah kembali normal.',
        'Alert status melayang (Floating Alert) yang elegan memberi tahu kondisi koneksi riil.'
      ]
    },
    {
      id: 'spec-3',
      name: 'Mesin Ekspor Dokumen Excel Terstandarisasi',
      category: 'Analisis & Laporan',
      description: 'Pengolah berkas spreadsheet dinamis tanpa ketergantungan server untuk performa unduh seketika.',
      icon: FileSpreadsheet,
      specs: [
        'Ekspor instan rentang tanggal kustom dalam format XLSX.',
        'Desain kolom teratur: Tanggal, Bangsal, Waktu Makan, Diet, Detail Comstock tiap komponen, dan Nama Petugas.',
        'Kompilasi rekapitulasi performa per bangsal untuk pelaporan bulanan akreditasi gizi.',
        'Kompatibel dengan Microsoft Excel, Google Sheets, dan WPS Office.'
      ]
    },
    {
      id: 'spec-4',
      name: 'Penjadwalan Siklus Menu Dinamis',
      category: 'Manajemen Siklus',
      description: 'Sistem pengaturan rotasi menu gizi rumah sakit untuk mencocokkan piring saji dengan asupan.',
      icon: Clock,
      specs: [
        'Konfigurasi siklus hari ke-1 sampai hari ke-10 dan menu pilihan.',
        'Pemetaan jenis masakan berdasarkan waktu makan (Pagi, Siang, Sore).',
        'Penyaringan otomatis menu yang relevan dengan jenis diet klinis pasien.',
        'Antarmuka interaktif seret-tukar (Switch-toggle) untuk aktivasi menu.'
      ]
    },
    {
      id: 'spec-5',
      name: 'Dashboard Grafik Analitis Interaktif',
      category: 'Analisis & Laporan',
      description: 'Visualisasi interaktif ribuan baris data asuhan gizi menjadi diagram tren keputusan manajemen gizi klinis.',
      icon: Activity,
      specs: [
        'Diagram Tren Sisa Makan mingguan & bulanan berbasis Recharts.',
        'Bento-grid KPI: Rata-rata Sisa Makan, Persentase Selesai Makan, Distribusi Sisa per Komponen.',
        'Analisis Bangsal Kritis: Menampilkan peringkat unit dengan sisa makanan tertinggi.',
        'Saringan (Filter) instan berdasarkan Bangsal dan Jenis Diet.'
      ]
    },
    {
      id: 'spec-6',
      name: 'Basis Data Terdistribusi Ter-enkripsi',
      category: 'Infrastruktur',
      description: 'Arsitektur database cloud modern yang mengamankan identitas pasien dan riwayat asuhan gizi rumah sakit.',
      icon: Database,
      specs: [
        'Autentikasi terenkripsi SSL 256-bit.',
        'Firestore Security Rules membatasi hak edit data master hanya untuk peran Koordinator (Admin).',
        'Pencatatan rekam jejak petugas (Audit Trail) otomatis pada setiap sisa makanan yang disimpan.',
        'Backup cloud harian otomatis oleh infrastruktur Google Cloud Firebase.'
      ]
    }
  ];

  const filteredSpecs = featureSpecs.filter(spec => {
    const matchesSearch = spec.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          spec.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || spec.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Workflow size={20} />
            </div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Informasi Sistem</span>
          </div>
          <h2 className="text-3xl font-display font-black text-slate-800 tracking-tight">Alur & Spesifikasi</h2>
          <p className="text-slate-500 text-sm font-semibold">Pahami alur kerja, arsitektur data, dan detail spesifikasi teknis Nutriwaste</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit items-center gap-1 border border-slate-200/60 shadow-sm">
          <button
            onClick={() => setActiveTab('flow')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 btn-press ${
              activeTab === 'flow'
                ? 'bg-white text-emerald-800 shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Workflow size={14} />
            <span>Alur Pengguna</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 btn-press ${
              activeTab === 'architecture'
                ? 'bg-white text-emerald-800 shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server size={14} />
            <span>Konektivitas Data</span>
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 btn-press ${
              activeTab === 'specs'
                ? 'bg-white text-emerald-800 shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen size={14} />
            <span>Spesifikasi Fitur</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'flow' && (
          <motion.div
            key="flow-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Left side: Flowchart Map */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white/90 backdrop-blur rounded-[2rem] p-6 md:p-8 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-100/20 to-transparent rounded-full pointer-events-none" />
                <h3 className="font-display font-black text-slate-800 text-lg mb-1 flex items-center gap-2">
                  <span>Peta Alur Kerja Nutriwaste</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">End-to-End</span>
                </h3>
                <p className="text-xs text-slate-500 mb-8 font-medium">Klik salah satu nomor alur untuk menampilkan detail penjelasan kerja operasionalnya di sebelah kanan.</p>

                {/* SVG Connecting Path / Visual Lines (Desktop Only) */}
                <div className="relative space-y-6">
                  {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isSelected = selectedStep === step.id;
                    return (
                      <div key={step.id} className="relative">
                        {/* Vertical line indicator */}
                        {index < steps.length - 1 && (
                          <div className={`absolute left-7 top-14 bottom-[-1.5rem] w-1 ${
                            selectedStep > step.id ? 'bg-emerald-500' : 'bg-slate-100'
                          } transition-colors duration-300`} />
                        )}

                        <button
                          onClick={() => setSelectedStep(step.id)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 btn-press relative ${
                            isSelected
                              ? 'bg-emerald-50/50 border-emerald-200/80 shadow-md shadow-emerald-900/5'
                              : 'bg-white hover:bg-slate-50/80 border-slate-200/60 hover:border-slate-300/60'
                          }`}
                        >
                          {/* Step Number Badge */}
                          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display shrink-0 transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className="text-[10px] font-bold leading-none uppercase tracking-wide opacity-80">Langkah</span>
                            <span className="text-xl font-black leading-none mt-0.5">{step.id}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="font-display font-black text-slate-800 text-sm leading-tight">{step.title}</h4>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                step.role === 'Semua User'
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200/50'
                                  : step.role === 'Admin / Koordinator'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}>
                                {step.role}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">{step.description}</p>
                          </div>

                          <div className={`self-center p-1 rounded-full border transition-transform ${
                            isSelected ? 'bg-emerald-100 border-emerald-200 text-emerald-800 rotate-90' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:translate-x-0.5'
                          }`}>
                            <ChevronRight size={16} />
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right side: Detailed Penjelasan Langkah */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900 text-slate-100 rounded-[2rem] p-6 md:p-8 border border-slate-800 shadow-[0_12px_40px_rgba(15,23,42,0.15)] sticky top-6">
                <AnimatePresence mode="wait">
                  {(() => {
                    const currentStep = steps.find(s => s.id === selectedStep) || steps[0];
                    const StepIcon = currentStep.icon;
                    return (
                      <motion.div
                        key={currentStep.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <StepIcon size={22} />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Detail Langkah {currentStep.id}</span>
                            <h3 className="font-display font-black text-white text-lg tracking-tight mt-0.5">{currentStep.title}</h3>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">Penjelasan Ringkas</p>
                          <p className="text-sm text-slate-200 leading-relaxed font-medium">{currentStep.description}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Rincian Alur Kerja Sistem</p>
                          <div className="space-y-3">
                            {currentStep.detailedSteps.map((detail, idx) => (
                              <div key={idx} className="flex gap-3 items-start">
                                <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                                  {idx + 1}
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex gap-3">
                          <div className="text-emerald-400 shrink-0">
                            <Info size={16} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-none">Aktor Pelaksana</p>
                            <p className="text-xs text-slate-300">Hanya pengguna dengan peran <strong className="text-emerald-300 font-semibold">{currentStep.role}</strong> yang memiliki akses penuh pada langkah proses ini.</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'architecture' && (
          <motion.div
            key="arch-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-8"
          >
            {/* Top architectural connection explanation block */}
            <div className="bg-white/90 backdrop-blur rounded-[2rem] p-6 md:p-8 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="max-w-3xl">
                <h3 className="font-display font-black text-slate-800 text-xl mb-2 flex items-center gap-2">
                  <Activity size={20} className="text-emerald-600" />
                  Bagaimana Aplikasi, Server, & Database Terhubung?
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  Nutriwaste menggunakan arsitektur <strong className="text-emerald-700 font-semibold">Serverless Real-Time Cloud NoSQL</strong>. 
                  Aplikasi klien tidak berkomunikasi langsung dengan server tradisional yang rumit, melainkan memanfaatkan 
                  layanan SDK Google Firebase secara terdistribusi yang terjamin keamanannya dan memiliki dukungan resiliensi offline penuh.
                </p>
              </div>

              {/* Graphical Blocks Connections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 relative">
                {/* Visual Connection Arrow Lines overlaying (Hidden on Mobile) */}
                <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-dashed border-t-2 border-dashed border-slate-300 pointer-events-none -translate-y-1/2" />

                {/* Node 1: Client Application */}
                <button
                  onClick={() => setSelectedArchNode('client')}
                  className={`relative p-6 rounded-2xl border text-left transition-all duration-200 flex flex-col items-center text-center btn-press ${
                    selectedArchNode === 'client'
                      ? 'bg-emerald-50/50 border-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                    selectedArchNode === 'client' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Smartphone size={26} />
                  </div>
                  <h4 className="font-display font-black text-slate-800 text-sm mb-1">Aplikasi Klien (React)</h4>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Frontend & Offline Cache</p>
                  <p className="text-xs text-slate-500 line-clamp-2">Mengolah input visual, menyajikan grafik, dan menyimpan data sementara saat sinyal putus.</p>
                  
                  {selectedArchNode === 'client' && (
                    <span className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-emerald-400 rotate-45" />
                  )}
                </button>

                {/* Node 2: Authentication Engine */}
                <button
                  onClick={() => setSelectedArchNode('auth')}
                  className={`relative p-6 rounded-2xl border text-left transition-all duration-200 flex flex-col items-center text-center btn-press ${
                    selectedArchNode === 'auth'
                      ? 'bg-amber-50/50 border-amber-400 shadow-lg shadow-amber-500/10'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                    selectedArchNode === 'auth' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Server size={26} />
                  </div>
                  <h4 className="font-display font-black text-slate-800 text-sm mb-1">Firebase Auth (Server)</h4>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">Gerbang Identitas & Sesi</p>
                  <p className="text-xs text-slate-500 line-clamp-2">Mengamankan kredensial, memvalidasi hak akses Koordinator, dan memelihara token login.</p>

                  {selectedArchNode === 'auth' && (
                    <span className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-amber-400 rotate-45" />
                  )}
                </button>

                {/* Node 3: Cloud Database */}
                <button
                  onClick={() => setSelectedArchNode('database')}
                  className={`relative p-6 rounded-2xl border text-left transition-all duration-200 flex flex-col items-center text-center btn-press ${
                    selectedArchNode === 'database'
                      ? 'bg-indigo-50/50 border-indigo-400 shadow-lg shadow-indigo-500/10'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                    selectedArchNode === 'database' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Database size={26} />
                  </div>
                  <h4 className="font-display font-black text-slate-800 text-sm mb-1">Cloud Firestore (DB)</h4>
                  <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Penyimpanan Terdistribusi</p>
                  <p className="text-xs text-slate-500 line-clamp-2">Sinkronisasi data sisa makan, riwayat bangsal, dan data jenis diet secara instan.</p>

                  {selectedArchNode === 'database' && (
                    <span className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-indigo-400 rotate-45" />
                  )}
                </button>
              </div>
            </div>

            {/* Bottom details card on selected Connection Node */}
            <div className="bg-slate-900 text-white rounded-[2rem] p-6 md:p-8 border border-slate-800 shadow-xl">
              <AnimatePresence mode="wait">
                {(() => {
                  const node = architectureNodes[selectedArchNode];
                  const isClient = selectedArchNode === 'client';
                  const isAuth = selectedArchNode === 'auth';
                  return (
                    <motion.div
                      key={selectedArchNode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                    >
                      <div className="lg:col-span-4 space-y-4">
                        <div className="space-y-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
                            isClient 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : isAuth 
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          }`}>
                            Spesifikasi Arsitektur
                          </span>
                          <h4 className="text-xl font-display font-black tracking-tight mt-3 text-white">{node.title}</h4>
                        </div>
                        
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Teknologi Utama</p>
                          <p className="text-xs text-slate-200 mt-1 font-mono leading-relaxed bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">{node.tech}</p>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">{node.description}</p>
                      </div>

                      <div className="lg:col-span-8 space-y-4">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kapasitas & Alur Hubung Balik</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {node.capabilities.map((cap, i) => (
                            <div key={i} className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1.5 hover:bg-slate-800/60 transition-all">
                              <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle2 size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">Kelebihan {i+1}</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed font-medium">{cap}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'specs' && (
          <motion.div
            key="specs-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-6"
          >
            {/* Category Filter and Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                {['Semua', 'Pencatatan', 'Manajemen Siklus', 'Analisis & Laporan', 'Infrastruktur'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 btn-press ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-sm font-black'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Cari fitur gizi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
                />
              </div>
            </div>

            {/* Spec Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSpecs.map((spec) => {
                const SpecIcon = spec.icon;
                return (
                  <div 
                    key={spec.id}
                    className="bg-white/90 backdrop-blur rounded-[2rem] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] transition-all duration-300"
                  >
                    <div className="space-y-4">
                      {/* Icon & Category */}
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                          <SpecIcon size={20} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {spec.category}
                        </span>
                      </div>

                      {/* Header Specs */}
                      <div>
                        <h4 className="font-display font-black text-slate-800 text-base tracking-tight leading-tight">{spec.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium">{spec.description}</p>
                      </div>

                      {/* Specs points detail */}
                      <div className="border-t border-slate-100 pt-4 space-y-2.5">
                        {spec.specs.map((item, idx) => (
                          <div key={idx} className="flex gap-2.5 items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl flex items-center gap-2 mt-6">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fitur Aktif & Siap Pakai</span>
                    </div>
                  </div>
                );
              })}

              {filteredSpecs.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white/50 rounded-[2rem] border border-dashed border-slate-300/80">
                  <HelpCircle size={32} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Spesifikasi Tidak Ditemukan</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Coba masukkan kata kunci pencarian atau ganti filter kategori lain.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
