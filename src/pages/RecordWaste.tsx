import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Menu, Ward, COMSTOCK_VALUES, MealTime } from '../types';
import { useAuth } from '../hooks/useAuth';
import { ClipboardCheck, CheckCircle2, User, Building2, UtensilsCrossed, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';

export default function RecordWaste() {
  const { profile, setAssignedWard } = useAuth();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Tab/Step control
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'L' | 'P'>('L');
  const [roomNumber, setRoomNumber] = useState('');
  const [bedNumber, setBedNumber] = useState('');
  const [staffInCharge, setStaffInCharge] = useState('');
  const [dietType, setDietType] = useState('');
  const [wardId, setWardId] = useState(profile?.assignedWardId || '');
  const [mealTime, setMealTime] = useState<MealTime>('B');
  const [menuId, setMenuId] = useState('');
  const [selectedScale, setSelectedScale] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const REASONS = [
    'Pasien tidak nafsu makan',
    'Porsi terlalu besar',
    'Pasien pulang/tindakan medis',
    'Makanan dingin'
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const menuSnap = await getDocs(query(collection(db, 'menus'), orderBy('name')));
      setMenus(menuSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));
      const wardSnap = await getDocs(query(collection(db, 'wards'), orderBy('name')));
      setWards(wardSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    };
    fetchData();
  }, []);

  // Sync ward from profile if available
  useEffect(() => {
    if (profile?.assignedWardId && !wardId) {
      setWardId(profile.assignedWardId);
    }
  }, [profile]);

  // Persist ward selection to profile
  const handleWardChange = (id: string) => {
    setWardId(id);
    if (id) {
      setAssignedWard(id);
    }
  };

  const handleSubmit = async () => {
    if (!profile || selectedScale === null || !menuId || !wardId || !patientName) return;
    
    setIsSubmitting(true);
    setError(null);
    const menu = menus.find(m => m.id === menuId);
    if (!menu) {
      setError('Menu tidak ditemukan');
      setIsSubmitting(false);
      return;
    }

    const scale = COMSTOCK_VALUES.find(v => v.scale === selectedScale);
    if (!scale) {
      setError('Skala Comstock tidak valid');
      setIsSubmitting(false);
      return;
    }

    const wasteWeight = menu.standardWeight * (scale.percentage / 100);
    const consumptionWeight = menu.standardWeight - wasteWeight;

    try {
      await addDoc(collection(db, 'transactions'), {
        patientName,
        patientAge: Number(patientAge) || 0,
        patientGender,
        wardId,
        roomNumber,
        bedNumber,
        staffInCharge,
        dietType: dietType || menu.dietType,
        mealTime,
        menuId,
        comstockScale: selectedScale,
        wasteWeight,
        consumptionWeight,
        reason: reason || null,
        staffId: profile.id,
        staffName: profile.name,
        timestamp: serverTimestamp()
      }).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, 'transactions');
      });

      setShowSuccess(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#059669', '#10b981', '#34d399', '#ffffff']
      });
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
      }, 2000);
    } catch (err: any) {
      console.error('Error adding document: ', err);
      setError(err.message || 'Gagal menyimpan data. Pastikan koneksi internet stabil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPatientName('');
    setPatientAge('');
    setPatientGender('L');
    setRoomNumber('');
    setBedNumber('');
    setStaffInCharge('');
    setDietType('');
    // Ward is kept for session persistence
    setMenuId('');
    setSelectedScale(null);
    setReason('');
    setStep(1);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-8">
      <header className="mb-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Input Sisa Makan</h2>
          <p className="text-slate-500 font-medium italic">Digitalisasi pencatatan porsi sisa pasien</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3 self-start md:self-auto">
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 animate-pulse">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Waktu Real-time</p>
            <p className="text-lg font-black text-slate-700 leading-tight">
              {format(currentTime, 'HH:mm:ss')}
              <span className="text-[10px] font-bold text-slate-400 ml-2">{format(currentTime, 'dd MMM')}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Staff Info Card */}
      <div className="bg-emerald-600 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-100 flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Petugas Bertugas</p>
          <h3 className="text-xl font-bold">{profile?.name}</h3>
          <p className="text-xs opacity-80 mt-1">NIP: {profile?.nip}</p>
        </div>
        <User size={64} className="absolute -right-4 -bottom-4 opacity-10" />
      </div>

      {/* Progress Indicator */}
      <div className="flex gap-2">
        {[1, 2].map((i) => (
          <div 
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= i ? 'bg-emerald-600' : 'bg-slate-200'}`}
          />
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-bold"
          >
            <div className="bg-red-100 p-2 rounded-xl">!</div>
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Patient & Room Info */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <User size={18} className="text-emerald-600" />
                  Data Pasien & Ruangan
                </h3>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-widest">Wajib Diisi</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Pasien</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Nama lengkap pasien"
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 placeholder:font-normal placeholder:text-slate-300"
                    />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-3 sm:col-span-3 gap-4">
                    <div className="col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Umur</label>
                      <input
                        type="number"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="Thn"
                        className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">JK</label>
                      <div className="flex bg-slate-100 p-1 rounded-2xl h-[58px]">
                        {(['L', 'P'] as const).map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setPatientGender(g)}
                            className={`flex-1 flex items-center justify-center text-xs font-black rounded-xl transition-all ${patientGender === g ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                          >
                            {g === 'L' ? 'LAKI' : 'PEREMPUAN'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unit / Ruangan</label>
                    <select 
                      value={wardId}
                      onChange={(e) => handleWardChange(e.target.value)}
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                    >
                      <option value="">-- Pilih Unit --</option>
                      {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Petugas PJ Ruangan</label>
                    <input
                      type="text"
                      value={staffInCharge}
                      onChange={(e) => setStaffInCharge(e.target.value)}
                      placeholder="Nama penanggung jawab"
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                    />
                  </div>
                </div>
                
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">No. Kamar</label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="Cth: 101"
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">No. Bed / Ranjang</label>
                    <input
                      type="text"
                      value={bedNumber}
                      onChange={(e) => setBedNumber(e.target.value)}
                      placeholder="Cth: A"
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Menu & Diet Info */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 space-y-6 shadow-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-emerald-600" />
                Menu & Jenis Diet
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Waktu Makan</label>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    {(['B', 'L', 'D'] as MealTime[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setMealTime(m)}
                        className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${mealTime === m ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        {m === 'B' ? 'PAGI' : m === 'L' ? 'SIANG' : 'SORE'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pilih Menu Hari Ini</label>
                  <select 
                    value={menuId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setMenuId(id);
                      const selected = menus.find(m => m.id === id);
                      if (selected) setDietType(selected.dietType);
                    }}
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                  >
                    <option value="">-- Pilih Menu --</option>
                    {menus.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.standardWeight}g)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {menuId && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Informasi Diet</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Jenis Diet: <span className="text-emerald-700">{dietType || 'Biasa'}</span></span>
                    <span className="text-xs text-slate-500">Standar: {menus.find(m => m.id === menuId)?.standardWeight}g</span>
                  </div>
                </div>
              )}
            </div>

            <button
              id="next-step-btn"
              disabled={!patientName || !wardId || !menuId}
              onClick={() => setStep(2)}
              className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              Lanjutkan ke Skala Comstock
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xl">
                    Skala Comstock
                  </h3>
                  <button onClick={() => setStep(1)} className="text-emerald-600 text-sm font-bold bg-emerald-50 px-4 py-2 rounded-full">Ubah Info</button>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {COMSTOCK_VALUES.map((v) => (
                   <button
                    key={v.scale}
                    onClick={() => setSelectedScale(v.scale)}
                    className={`
                      relative p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 text-center
                      ${selectedScale === v.scale 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-600' 
                        : 'border-slate-50 bg-slate-50/30 hover:border-slate-200 text-slate-500'}
                    `}
                   >
                     <span className="text-3xl font-black">{v.percentage}%</span>
                     <span className="text-[10px] font-bold uppercase tracking-tight">{v.label}</span>
                     {selectedScale === v.scale && (
                       <div className="absolute top-3 right-3">
                         <div className="bg-emerald-600 rounded-full p-0.5">
                            <CheckCircle2 size={16} className="text-white" />
                         </div>
                       </div>
                     )}
                   </button>
                 ))}
               </div>

               <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <ClipboardCheck size={18} className="text-emerald-600" />
                   Alasan Sisa Makan (Opsional)
                 </h3>
                 <div className="relative">
                   <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 appearance-none"
                   >
                     <option value="">-- Pilih Alasan (Opsional) --</option>
                     {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                   </div>
                 </div>
               </div>
            </div>

            <div className="flex gap-4">
              <button
                id="back-btn"
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-100 text-slate-600 font-bold py-5 rounded-[2rem] hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
              >
                Kembali
              </button>
              <button
                id="submit-record-btn"
                disabled={selectedScale === null || isSubmitting}
                onClick={handleSubmit}
                className="flex-[2] bg-emerald-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <ClipboardCheck size={20} className="stroke-[3]" />
                    Simpan Data Sisa
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-28 left-4 right-4 md:left-auto md:right-8 bg-emerald-600 text-white p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 z-50 md:max-w-sm"
          >
            <div className="bg-white/20 p-2 rounded-full">
              <CheckCircle2 size={32} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">Berhasil Disimpan!</p>
              <p className="text-xs opacity-90">Data sisa makanan telah tersinkronisasi ke server Nutriwaste.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Re-using Icon for missing imports
function PlusCircle({ size, className }: { size: number, className: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}
