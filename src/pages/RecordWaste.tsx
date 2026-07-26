import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Menu, Ward, COMSTOCK_VALUES, MealTime } from '../types';
import { useAuth } from '../hooks/useAuth';
import { ClipboardCheck, CheckCircle2, User, Building2, UtensilsCrossed, Clock, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import ComstockAnimation from '../components/ComstockAnimation';

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
  const [medicalRecordNumber, setMedicalRecordNumber] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'L' | 'P'>('L');
  const [wardName, setWardName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [staffInCharge, setStaffInCharge] = useState('');
  const [dietType, setDietType] = useState('Biasa');
  const [wardId, setWardId] = useState(profile?.assignedWardId || '');
  const [cycleDay, setCycleDay] = useState<number>(1);
  const [mealTime, setMealTime] = useState<MealTime>('makan_siang');
  const [menuId, setMenuId] = useState('');
  const [foodItems, setFoodItems] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Multi-Record food items and scales state
  const [foodRecords, setFoodRecords] = useState<Record<string, { menuName: string, comstockScale: number | null, standardWeight: string }>>({
    'Makanan Pokok': { menuName: '', comstockScale: null, standardWeight: '150' },
    'Lauk Hewani': { menuName: '', comstockScale: null, standardWeight: '50' },
    'Lauk Nabati': { menuName: '', comstockScale: null, standardWeight: '50' },
    'Sayuran': { menuName: '', comstockScale: null, standardWeight: '100' },
    'Buah': { menuName: '', comstockScale: null, standardWeight: '50' },
  });

  // Helper parsing comma-separated menu cycle items into categories
  const parseFoodItems = (foodItemsStr: string) => {
    const parts = foodItemsStr.split(',').map(s => s.trim()).filter(Boolean);
    const result = {
      'Makanan Pokok': '',
      'Lauk Hewani': '',
      'Lauk Nabati': '',
      'Sayuran': '',
      'Buah': ''
    };

    parts.forEach(part => {
      const lower = part.toLowerCase();
      if (lower.includes('nasi') || lower.includes('kentang') || lower.includes('bubur') || lower.includes('mie') || lower.includes('roti') || lower.includes('singkong') || lower.includes('biun') || lower.includes('terigu') || lower.includes('beras')) {
        result['Makanan Pokok'] = result['Makanan Pokok'] ? `${result['Makanan Pokok']}, ${part}` : part;
      } else if (lower.includes('ayam') || lower.includes('daging') || lower.includes('sapi') || lower.includes('ikan') || lower.includes('telur') || lower.includes('nila') || lower.includes('bandeng') || lower.includes('sosis') || lower.includes('udang') || lower.includes('teri') || lower.includes('hati') || lower.includes('otak')) {
        result['Lauk Hewani'] = result['Lauk Hewani'] ? `${result['Lauk Hewani']}, ${part}` : part;
      } else if (lower.includes('tempe') || lower.includes('tahu') || lower.includes('kacang')) {
        if (lower.includes('panjang') || lower.includes('tauge') || lower.includes('sayur')) {
          result['Sayuran'] = result['Sayuran'] ? `${result['Sayuran']}, ${part}` : part;
        } else {
          result['Lauk Nabati'] = result['Lauk Nabati'] ? `${result['Lauk Nabati']}, ${part}` : part;
        }
      } else if (lower.includes('bayam') || lower.includes('sayur') || lower.includes('sop') || lower.includes('kol') || lower.includes('kangkung') || lower.includes('wortel') || lower.includes('sawi') || lower.includes('selada') || lower.includes('tumis') || lower.includes('timun') || lower.includes('terong') || lower.includes('kembang kol') || lower.includes('bung')) {
        result['Sayuran'] = result['Sayuran'] ? `${result['Sayuran']}, ${part}` : part;
      } else {
        result['Buah'] = result['Buah'] ? `${result['Buah']}, ${part}` : part;
      }
    });

    return result;
  };

  const updateMenuName = (fType: string, val: string) => {
    setFoodRecords(prev => ({
      ...prev,
      [fType]: { ...prev[fType], menuName: val }
    }));
  };

  const updateStandardWeight = (fType: string, val: string) => {
    setFoodRecords(prev => ({
      ...prev,
      [fType]: { ...prev[fType], standardWeight: val }
    }));
  };

  const handleScaleClick = (fType: string, scale: number) => {
    setFoodRecords(prev => {
      const currentScale = prev[fType].comstockScale;
      const nextScale = currentScale === scale ? null : scale;
      return {
        ...prev,
        [fType]: { ...prev[fType], comstockScale: nextScale }
      };
    });
  };

  const REASONS = [
    'Pasien tidak nafsu makan',
    'Porsi terlalu besar',
    'Pasien pulang/tindakan medis',
    'Makanan dingin',
    'Rasa makanan kurang',
    'Lainnya (Tulis manual)'
  ];

  const COMSTOCK_REFERENCE = [
    { scale: 0, desc: '0% (Habis Total)' },
    { scale: 1, desc: '20% (Sisa 1/5)' },
    { scale: 2, desc: '50% (Sisa 1/2)' },
    { scale: 3, desc: '75% (Sisa 3/4)' },
    { scale: 4, desc: '95% (Hampir Utuh)' },
    { scale: 5, desc: '100% (Utuh)' },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const menuSnap = await getDocs(query(collection(db, 'menus'), orderBy('cycleDay')));
      setMenus(menuSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));
      const wardSnap = await getDocs(query(collection(db, 'wards'), orderBy('name')));
      setWards(wardSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    };
    fetchData();
  }, []);

  // Auto-set menu items based on cycleDay and mealTime
  useEffect(() => {
    const matchingMenu = menus.find(m => m.cycleDay === cycleDay && m.mealTime === mealTime);
    if (matchingMenu) {
      setMenuId(matchingMenu.id);
      setFoodItems(matchingMenu.foodItems);
    } else {
      setMenuId('');
      setFoodItems('');
    }
  }, [cycleDay, mealTime, menus]);

  // Update categories when foodItems (Menu) changes
  useEffect(() => {
    if (foodItems) {
      const parsed = parseFoodItems(foodItems);
      setFoodRecords({
        'Makanan Pokok': { menuName: parsed['Makanan Pokok'] || '', comstockScale: null, standardWeight: '150' },
        'Lauk Hewani': { menuName: parsed['Lauk Hewani'] || '', comstockScale: null, standardWeight: '50' },
        'Lauk Nabati': { menuName: parsed['Lauk Nabati'] || '', comstockScale: null, standardWeight: '50' },
        'Sayuran': { menuName: parsed['Sayuran'] || '', comstockScale: null, standardWeight: '100' },
        'Buah': { menuName: parsed['Buah'] || '', comstockScale: null, standardWeight: '50' },
      });
    } else {
      setFoodRecords({
        'Makanan Pokok': { menuName: '', comstockScale: null, standardWeight: '150' },
        'Lauk Hewani': { menuName: '', comstockScale: null, standardWeight: '50' },
        'Lauk Nabati': { menuName: '', comstockScale: null, standardWeight: '50' },
        'Sayuran': { menuName: '', comstockScale: null, standardWeight: '100' },
        'Buah': { menuName: '', comstockScale: null, standardWeight: '50' },
      });
    }
  }, [foodItems, cycleDay, mealTime, menus]);

  // Sync ward from profile if available
  useEffect(() => {
    if (profile?.assignedWardId && !wardId) {
      setWardId(profile.assignedWardId);
    }
  }, [profile]);

  // Persist ward selection to profile
  const handleWardChange = (val: string) => {
    const selectedWard = wards.find(w => w.id === val || w.name === val);
    if (selectedWard) {
      setWardId(selectedWard.id);
      setWardName(selectedWard.name);
      setAssignedWard(selectedWard.id);
    } else {
      setWardId(val || 'manual_ward');
      setWardName(val);
    }
  };

  const handleSubmit = async () => {
    const effectiveWard = wardName || wardId;
    if (!profile || !effectiveWard || !patientName) {
      setError('Mohon lengkapi Nama Pasien dan Ruang Rawat / Unit.');
      return;
    }
    
    // Check if at least one scale is selected
    const activeRecords = Object.entries(foodRecords).filter(([_, data]) => data.comstockScale !== null);
    if (activeRecords.length === 0) {
      setError('Mohon pilih skala Comstock minimal untuk salah satu jenis makanan.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedWardObj = wards.find(w => w.id === wardId);
      const finalWardName = wardName || selectedWardObj?.name || wardId;

      const promises = activeRecords.map(([fType, data]) => {
        const scaleObj = COMSTOCK_VALUES.find(v => v.scale === data.comstockScale);
        const stdW = parseFloat(data.standardWeight) || 100;
        const wasteWeight = scaleObj ? (stdW * (scaleObj.percentage / 100)) : 0;
        const consumptionWeight = stdW - wasteWeight;

        return addDoc(collection(db, 'transactions'), {
          patientName,
          medicalRecordNumber: medicalRecordNumber || '-',
          patientAge: Number(patientAge) || 0,
          patientGender,
          wardId: wardId || 'manual',
          wardName: finalWardName,
          roomNumber: roomNumber || '-',
          staffInCharge: staffInCharge || '-',
          dietType: dietType || 'Biasa',
          mealTime: 'makan_siang', // Strict lunch measurement
          foodType: fType, // e.g., 'Makanan Pokok', 'Lauk Hewani', etc.
          menuId: menuId || 'manual',
          comstockScale: data.comstockScale,
          wasteWeight,
          consumptionWeight,
          reason: reason === 'Lainnya (Tulis manual)' ? customReason : (reason || null),
          staffId: profile.id,
          staffName: profile.name,
          timestamp: serverTimestamp()
        }).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, 'transactions');
        });
      });

      await Promise.all(promises);

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
      setError(err.message || 'Gagal menyimpan data sisa. Pastikan koneksi internet stabil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPatientName('');
    setMedicalRecordNumber('');
    setPatientAge('');
    setPatientGender('L');
    setWardName('');
    setRoomNumber('');
    setStaffInCharge('');
    setDietType('Biasa');
    // Ward is kept for session persistence
    setMenuId('');
    setFoodItems('');
    setReason('');
    setCustomReason('');
    setFoodRecords({
      'Makanan Pokok': { menuName: '', comstockScale: null, standardWeight: '150' },
      'Lauk Hewani': { menuName: '', comstockScale: null, standardWeight: '50' },
      'Lauk Nabati': { menuName: '', comstockScale: null, standardWeight: '50' },
      'Sayuran': { menuName: '', comstockScale: null, standardWeight: '100' },
      'Buah': { menuName: '', comstockScale: null, standardWeight: '50' },
    });
    setStep(1);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-8">
      <header className="mb-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-850 tracking-tight">Input Sisa Makan</h2>
          <p className="text-slate-500 font-semibold">Digitalisasi pencatatan porsi sisa pasien</p>
        </div>
        <div className="bg-smooth-olive border border-slate-300/50 rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3 self-start md:self-auto">
          <div className="bg-emerald-700/10 p-2 rounded-xl text-emerald-800 animate-pulse">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-tight">Waktu Real-time</p>
            <p className="text-lg font-black text-slate-800 leading-tight">
              {format(currentTime, 'HH:mm:ss')}
              <span className="text-[10px] font-bold text-slate-500 ml-2">{format(currentTime, 'dd MMM')}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Staff Info Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] p-6.5 text-white shadow-xl shadow-emerald-950/20 flex items-center justify-between overflow-hidden relative border border-emerald-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200 block mb-1">Petugas Aktif</p>
          <h3 className="text-2xl font-display font-black leading-none">{profile?.name}</h3>
          <p className="text-xs font-semibold text-emerald-50/80 mt-1">NIP. {profile?.nip || '-'}</p>
        </div>
        <User size={72} className="absolute -right-2 -bottom-2 opacity-[0.08] stroke-[1.5]" />
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-3 bg-smooth-olive px-6 py-4.5 rounded-[2rem] border border-slate-300/50 shadow-sm justify-between">
        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 font-display">Progres Langkah</span>
        <div className="flex gap-2 w-32 items-center">
          {[1, 2].map((i) => (
            <div 
              key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-350 ${
                step === i 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 shadow-sm ring-2 ring-emerald-200' 
                  : step > i 
                    ? 'bg-emerald-600' 
                    : 'bg-slate-300'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-black text-emerald-800 font-display">Langkah {step} dari 2</span>
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
            <div className="bg-smooth-olive p-6 rounded-[2rem] border border-slate-300/50 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-300/40 pb-3">
                <h3 className="font-bold text-slate-850 flex items-center gap-2">
                  <User size={18} className="text-emerald-850" />
                  Data Pasien & Ruangan
                </h3>
                <span className="text-[10px] font-black bg-emerald-700 text-white px-3 py-1 rounded-full uppercase tracking-widest">Wajib Diisi</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Nama Pasien</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Nama lengkap pasien"
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest ml-1">NOMER REKAM MEDIS (NO. RM)</label>
                    <input
                      type="text"
                      value={medicalRecordNumber}
                      onChange={(e) => setMedicalRecordNumber(e.target.value)}
                      placeholder="Cth: RM-2024-001"
                      className="w-full px-4 py-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/30 outline-none focus:ring-2 focus:ring-emerald-200 font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Umur</label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="Thn"
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Jenis Kelamin</label>
                    <div className="flex bg-slate-200/60 p-1 rounded-2xl h-[52px]">
                      {(['L', 'P'] as const).map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setPatientGender(g)}
                          className={`flex-1 flex items-center justify-center text-xs font-black rounded-xl transition-all ${patientGender === g ? 'bg-white text-emerald-800 shadow-sm font-black' : 'text-slate-600 hover:text-slate-850'}`}
                        >
                          {g === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Detail Ruang Rawat / No. Kamar</label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="Cth: Ruang Melati / 102"
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Ruang Rawat / Unit (Dapat Diisi Manual)</label>
                    <input
                      type="text"
                      list="ward-list"
                      value={wardName}
                      onChange={(e) => handleWardChange(e.target.value)}
                      placeholder="Ketik atau pilih nama ruang rawat..."
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 placeholder:text-slate-400"
                    />
                    <datalist id="ward-list">
                      {wards.map(w => (
                        <option key={w.id} value={w.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Petugas PJ Ruangan</label>
                    <input
                      type="text"
                      value={staffInCharge}
                      onChange={(e) => setStaffInCharge(e.target.value)}
                      placeholder="Nama penanggung jawab"
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Menu & Diet Info */}
            <div className="bg-smooth-olive p-6 rounded-[2rem] border border-slate-300/50 space-y-6 shadow-sm">
              <h3 className="font-bold text-slate-850 flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-emerald-850" />
                Menu & Siklus Hari
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Hari Siklus</label>
                    <select
                      value={cycleDay}
                      onChange={(e) => setCycleDay(Number(e.target.value))}
                      className="w-full px-4 py-4 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={d} value={d}>Hari ke-{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Jenis Diet</label>
                    <input
                      type="text"
                      list="diet-list"
                      value={dietType}
                      onChange={(e) => setDietType(e.target.value)}
                      placeholder="Cth: Biasa, RD, RG"
                      className="w-full px-4 py-4 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 placeholder:text-slate-400"
                    />
                    <datalist id="diet-list">
                      <option value="Biasa" />
                      <option value="Lunak" />
                      <option value="Saring" />
                      <option value="RG (Rendah Garam)" />
                      <option value="DM (Diabetes Melitus)" />
                    </datalist>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Waktu Makan</label>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase">Pengukuran Makan Siang</span>
                  </div>
                  <div className="flex bg-slate-200/60 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
                    {([
                      { id: 'makan_siang', label: 'Makan Siang (Sisa Makanan)' },
                    ] as { id: MealTime, label: string }[]).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMealTime(m.id)}
                        className="w-full py-3 text-xs font-black rounded-xl transition-all bg-white text-emerald-800 shadow-sm"
                      >
                        {m.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Detail Menu Terdeteksi</label>
                  <textarea
                    value={foodItems}
                    onChange={(e) => setFoodItems(e.target.value)}
                    placeholder="Isi menu hari ini..."
                    className="w-full px-4 py-4 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 min-h-[80px] text-sm"
                  />
                  {!foodItems && (
                    <p className="text-[10px] text-amber-850 bg-amber-500/10 px-2 py-1 rounded-lg font-bold italic ml-1">* Menu belum diatur di Siklus Menu</p>
                  )}
                </div>
              </div>
            </div>

            <button
              id="next-step-btn"
              disabled={!patientName || !wardId}
              onClick={() => setStep(2)}
              className="w-full bg-emerald-600 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] shadow-md shadow-emerald-950/20 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
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
            <div className="bg-smooth-olive p-6 sm:p-8 rounded-[2rem] border border-slate-300/50 shadow-sm relative overflow-hidden space-y-6">
              <div className="flex items-center justify-between border-b border-slate-300/40 pb-4">
                <div>
                  <h3 className="font-bold text-slate-850 text-xl">
                    Skala Comstock Sisa Makanan
                  </h3>
                  <p className="text-xs text-slate-700 font-bold italic mt-0.5">Pilih sisa makanan per kategori dalam sekali input</p>
                </div>
                <button 
                  onClick={() => setStep(1)} 
                  className="text-emerald-850 text-xs font-black bg-white hover:bg-slate-50 px-4 py-2 rounded-full transition-all border border-slate-300/40"
                >
                  Ubah Info Pasien
                </button>
              </div>

              {/* Multi-category list stack */}
              <div className="space-y-5">
                {Object.entries(foodRecords).map(([fType, data]) => {
                  const hasSelectedScale = data.comstockScale !== null;
                  return (
                    <div 
                      key={fType}
                      className={`p-5 rounded-[2rem] border-2 transition-all duration-300 space-y-4 bg-white ${
                        hasSelectedScale 
                          ? 'border-emerald-600 shadow-md ring-4 ring-emerald-600/10' 
                          : 'border-slate-200/80 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl transition-all ${hasSelectedScale ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            <UtensilsCrossed size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{fType}</span>
                            </div>
                            <div className="text-[10px] text-slate-600 font-bold italic mt-0.5 leading-none">
                              {hasSelectedScale ? 'Skala sisa tercatat' : 'Sisa belum diisi / tidak disajikan'}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 max-w-sm sm:text-right">
                          <input
                            type="text"
                            value={data.menuName}
                            onChange={(e) => updateMenuName(fType, e.target.value)}
                            placeholder="Isi menu hidangan..."
                            className="w-full px-4 py-2.5 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 text-xs font-bold text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>



                      {/* Comstock horizontal selector buttons */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-100 p-2.5 rounded-2xl border border-slate-200/80">
                        {COMSTOCK_VALUES.map((v) => {
                          const isCurrent = data.comstockScale === v.scale;
                          return (
                            <button
                              key={v.scale}
                              type="button"
                              onClick={() => handleScaleClick(fType, v.scale)}
                              className={`py-3.5 px-1 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-2 border group relative ${
                                isCurrent
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-transparent text-white shadow-md shadow-emerald-600/15 scale-[1.03] z-10 font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 font-bold'
                              }`}
                            >
                              {/* Custom Comstock Pie-Chart Circle Graphic (Visual indicator from image reference) */}
                              <div 
                                className={`w-7 h-7 rounded-full border-2 transition-all duration-200 relative shrink-0 ${
                                  isCurrent 
                                    ? 'border-white bg-white/20' 
                                    : 'border-slate-400 bg-slate-100 group-hover:border-slate-500'
                                }`}
                                style={{
                                  background: isCurrent
                                    ? `conic-gradient(#ffffff ${v.percentage}%, rgba(255,255,255,0.25) ${v.percentage}%)`
                                    : `conic-gradient(#059669 ${v.percentage}%, #f1f5f9 ${v.percentage}%)`
                                }}
                              />
                              <div className="flex flex-col items-center text-center">
                                <span className="text-[11px] leading-tight font-black">{v.percentage}%</span>
                                <span className="text-[8px] opacity-80 leading-none font-bold mt-0.5">
                                  {v.scale === 0 ? 'Habis' : v.scale === 1 ? 'Sisa 1/5' : v.scale === 2 ? 'Sisa 1/2' : v.scale === 3 ? 'Sisa 3/4' : v.scale === 4 ? '95%' : 'Utuh'}
                                </span>
                                <span className="text-[7.5px] opacity-60 font-mono mt-0.5 font-bold">({v.scale})</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Visualisasi untuk Kategori Lainnya */}
                      {hasSelectedScale && (
                        <div className="mt-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-[1.75rem] border border-emerald-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                          {/* Left side: Beautiful large real-time Comstock pie-chart visualizer */}
                          <div className="relative shrink-0">
                            <div 
                              className="w-12 h-12 rounded-full border-2 border-emerald-700 bg-white shadow-sm transition-all duration-300"
                              style={{
                                background: `conic-gradient(#059669 ${(COMSTOCK_VALUES.find(v => v.scale === data.comstockScale)?.percentage || 0)}%, #f1f5f9 ${(COMSTOCK_VALUES.find(v => v.scale === data.comstockScale)?.percentage || 0)}%)`
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[9px] font-mono font-black text-emerald-950 bg-white px-1.5 py-0.5 rounded shadow-sm scale-90 border border-emerald-300">
                                {data.comstockScale !== undefined && data.comstockScale !== null ? `(${data.comstockScale})` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Right side: Title, percentage text, and slider */}
                          <div className="flex-1 w-full space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span className="p-1 bg-emerald-100 rounded-full text-emerald-800 flex items-center justify-center">
                                  <UtensilsCrossed size={12} />
                                </span>
                                {`Sisa Makanan ${fType}:`}
                              </span>
                              <span className="font-mono text-sm font-black text-emerald-900">
                                {(() => {
                                  const matched = COMSTOCK_VALUES.find(v => v.scale === data.comstockScale);
                                  return matched ? matched.percentage : 0;
                                })()}% Sisa
                              </span>
                            </div>
                            <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                              <motion.div 
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${(COMSTOCK_VALUES.find(v => v.scale === data.comstockScale)?.percentage || 0)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              />
                              <div 
                                style={{ left: `${(COMSTOCK_VALUES.find(v => v.scale === data.comstockScale)?.percentage || 0)}%` }}
                                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4.5 h-4.5 bg-white border-2 border-emerald-600 rounded-full shadow flex items-center justify-center transition-all duration-300 pointer-events-none"
                              >
                                <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping" />
                              </div>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-650 font-extrabold uppercase tracking-wider px-1">
                              <span>Habis (0%)</span>
                              <span>Setengah (50%)</span>
                              <span>Utuh (100%)</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-white rounded-[2rem] border border-slate-300/60 italic text-[10.5px] text-slate-700 text-center font-medium">
                * Pilih dengan menekan skala sisa makan (0% sisa s.d. 100% sisa makanan). Tekan sekali lagi untuk membatalkan seleksi jika jenis makanan tidak disajikan.
              </div>

              {/* Box Perhitungan Total Skor Comstock (Sesuai Rumus Standar) */}
              {(() => {
                const activeEntries = Object.entries(foodRecords).filter(([_, d]) => d.comstockScale !== null);
                const totalScore = activeEntries.reduce((sum, [_, d]) => sum + (d.comstockScale || 0), 0);
                const totalItems = activeEntries.length;
                const maxDenominator = totalItems * 5;
                const finalPercentage = maxDenominator > 0 ? (totalScore / maxDenominator) * 100 : 0;

                const scaleCounts = [0, 1, 2, 3, 4, 5].map(s => ({
                  scale: s,
                  count: activeEntries.filter(([_, d]) => d.comstockScale === s).length
                }));

                return (
                  <div className="p-6 bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900 text-white rounded-[2rem] border border-emerald-800/50 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-2xl text-emerald-300 border border-emerald-500/30">
                          <Calculator size={22} />
                        </div>
                        <div>
                          <h4 className="font-display font-black text-base text-white">Perhitungan Skor Comstock</h4>
                          <p className="text-xs text-emerald-200/80 font-medium">Rumus: (Total Skor ÷ [Total Jenis Menu × 5]) × 100%</p>
                        </div>
                      </div>
                      <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-300">Hasil Sisa Makanan</span>
                        <span className="font-mono text-2xl font-black text-emerald-400">{finalPercentage.toFixed(1)}%</span>
                      </div>
                    </div>

                    {totalItems > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
                            <span className="text-[10px] text-slate-300 font-extrabold block uppercase tracking-wider">Total Skor Nilai (Pembilang)</span>
                            <span className="font-mono font-black text-xl text-emerald-300 mt-1 block">{totalScore}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Rincian: {scaleCounts.filter(c => c.count > 0).map(c => `${c.count}×(skala ${c.scale})`).join(' + ') || '0'}
                            </span>
                          </div>

                          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
                            <span className="text-[10px] text-slate-300 font-extrabold block uppercase tracking-wider">Maksimal Skor (Penyebut)</span>
                            <span className="font-mono font-black text-xl text-teal-300 mt-1 block">{maxDenominator}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{totalItems} jenis menu × 5 (skala maks)</span>
                          </div>

                          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider">Kalkulasi Matematika</span>
                            <div className="font-mono font-bold text-sm text-amber-300 mt-1">
                              ({totalScore} / {maxDenominator}) × 100% = <span className="text-emerald-300 underline font-black">{finalPercentage.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 bg-emerald-950/60 rounded-xl border border-emerald-800/50 text-[10.5px] text-emerald-200/90 leading-relaxed font-medium">
                          <strong>Standar Skala Comstock:</strong> 0 = 0% | 1 = 20% | 2 = 50% | 3 = 75% | 4 = 95% | 5 = 100%. Total nilai skor diperoleh dari hasil perkalian jumlah centangan dengan skala nilai di setiap baris menu.
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 italic text-center py-2">
                        Pilih skala Comstock pada hidangan di atas untuk melihat kalkulasi persentase dan rumus skor otomatis.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="pt-6 border-t border-slate-300/40 space-y-3">
                <h3 className="font-bold text-slate-850 flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-emerald-850" />
                  Alasan Sisa Makan (Opsional - Jika ada sisa)
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-800 appearance-none"
                    >
                      <option value="">-- Pilih Alasan (Opsional) --</option>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>

                  {reason === 'Lainnya (Tulis manual)' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest ml-1">Ketik Alasan Lainnya</label>
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Masukkan alasan kustom..."
                        className="w-full px-5 py-4 rounded-2xl border border-slate-300/80 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-850 placeholder:text-slate-400"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                id="back-btn"
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
              >
                Kembali
              </button>
              <button
                id="submit-record-btn"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flex-[2] bg-emerald-600 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] shadow-md shadow-emerald-950/20 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <ClipboardCheck size={20} className="stroke-[3]" />
                    Simpan Data Sisa Makanan
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
