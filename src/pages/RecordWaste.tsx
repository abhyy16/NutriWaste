import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Menu, Ward, COMSTOCK_VALUES, MealTime } from '../types';
import { useAuth } from '../hooks/useAuth';
import { ClipboardCheck, CheckCircle2, User, Building2, UtensilsCrossed, Clock } from 'lucide-react';
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
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'L' | 'P'>('L');
  const [roomNumber, setRoomNumber] = useState('');
  const [bedNumber, setBedNumber] = useState('');
  const [staffInCharge, setStaffInCharge] = useState('');
  const [dietType, setDietType] = useState('Biasa');
  const [wardId, setWardId] = useState(profile?.assignedWardId || '');
  const [cycleDay, setCycleDay] = useState<number>(1);
  const [mealTime, setMealTime] = useState<MealTime>('sarapan');
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
    'Buah / Selingan': { menuName: '', comstockScale: null, standardWeight: '50' },
    'Semua (Komposit)': { menuName: '', comstockScale: null, standardWeight: '400' },
  });

  // Helper parsing comma-separated menu cycle items into categories
  const parseFoodItems = (foodItemsStr: string) => {
    const parts = foodItemsStr.split(',').map(s => s.trim()).filter(Boolean);
    const result = {
      'Makanan Pokok': '',
      'Lauk Hewani': '',
      'Lauk Nabati': '',
      'Sayuran': '',
      'Buah / Selingan': '',
      'Semua (Komposit)': ''
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
        result['Buah / Selingan'] = result['Buah / Selingan'] ? `${result['Buah / Selingan']}, ${part}` : part;
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
    { scale: 1, desc: '25% (Sisa 1/4)' },
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
    const matchingMenu = menus.find(m => m.cycleDay === cycleDay && m.mealTime === mealTime);
    const customMatchWeight = (matchingMenu as any)?.beratStandar || '';
    const defaultTotalWeight = customMatchWeight || '400';

    if (foodItems) {
      const parsed = parseFoodItems(foodItems);
      setFoodRecords({
        'Makanan Pokok': { menuName: parsed['Makanan Pokok'] || '', comstockScale: null, standardWeight: '150' },
        'Lauk Hewani': { menuName: parsed['Lauk Hewani'] || '', comstockScale: null, standardWeight: '50' },
        'Lauk Nabati': { menuName: parsed['Lauk Nabati'] || '', comstockScale: null, standardWeight: '50' },
        'Sayuran': { menuName: parsed['Sayuran'] || '', comstockScale: null, standardWeight: '100' },
        'Buah / Selingan': { menuName: parsed['Buah / Selingan'] || '', comstockScale: null, standardWeight: '50' },
        'Semua (Komposit)': { menuName: 'Menu Komposit / Campuran', comstockScale: null, standardWeight: defaultTotalWeight },
      });
    } else {
      setFoodRecords({
        'Makanan Pokok': { menuName: '', comstockScale: null, standardWeight: '150' },
        'Lauk Hewani': { menuName: '', comstockScale: null, standardWeight: '50' },
        'Lauk Nabati': { menuName: '', comstockScale: null, standardWeight: '50' },
        'Sayuran': { menuName: '', comstockScale: null, standardWeight: '100' },
        'Buah / Selingan': { menuName: '', comstockScale: null, standardWeight: '50' },
        'Semua (Komposit)': { menuName: '', comstockScale: null, standardWeight: '400' },
      });
    }
  }, [foodItems, cycleDay, mealTime, menus]);

  // Auto-calculate 'Semua (Komposit)' scale whenever non-composite scales change
  useEffect(() => {
    const nonCompositeKeys = [
      'Makanan Pokok',
      'Lauk Hewani',
      'Lauk Nabati',
      'Sayuran',
      'Buah / Selingan'
    ];
    
    // Sum the scales of active items (menuName is set) that have a selected comstock scale
    const activeEntries = nonCompositeKeys.filter(key => foodRecords[key]?.menuName && foodRecords[key]?.comstockScale !== null);
    
    if (activeEntries.length > 0) {
      const sum = activeEntries.reduce((acc, key) => acc + (foodRecords[key].comstockScale || 0), 0);
      const avg = Math.round(sum / activeEntries.length);
      
      setFoodRecords(prev => {
        if (prev['Semua (Komposit)'].comstockScale === avg) return prev;
        return {
          ...prev,
          'Semua (Komposit)': {
            ...prev['Semua (Komposit)'],
            comstockScale: avg
          }
        };
      });
    } else {
      setFoodRecords(prev => {
        if (prev['Semua (Komposit)'].comstockScale === null) return prev;
        return {
          ...prev,
          'Semua (Komposit)': {
            ...prev['Semua (Komposit)'],
            comstockScale: null
          }
        };
      });
    }
  }, [
    foodRecords['Makanan Pokok']?.comstockScale,
    foodRecords['Lauk Hewani']?.comstockScale,
    foodRecords['Lauk Nabati']?.comstockScale,
    foodRecords['Sayuran']?.comstockScale,
    foodRecords['Buah / Selingan']?.comstockScale,
    foodRecords['Makanan Pokok']?.menuName,
    foodRecords['Lauk Hewani']?.menuName,
    foodRecords['Lauk Nabati']?.menuName,
    foodRecords['Sayuran']?.menuName,
    foodRecords['Buah / Selingan']?.menuName,
  ]);

  // Auto-calculate 'Semua (Komposit)' standardWeight whenever non-composite standardWeights change
  useEffect(() => {
    const nonCompositeKeys = [
      'Makanan Pokok',
      'Lauk Hewani',
      'Lauk Nabati',
      'Sayuran',
      'Buah / Selingan'
    ];
    
    // Sum standard weights of any active entries
    const activeWeights = nonCompositeKeys.map(key => parseFloat(foodRecords[key]?.standardWeight) || 0);
    const sum = activeWeights.reduce((acc, w) => acc + w, 0);
    
    if (sum > 0) {
      setFoodRecords(prev => {
        if (prev['Semua (Komposit)'].standardWeight === String(sum)) return prev;
        return {
          ...prev,
          'Semua (Komposit)': {
            ...prev['Semua (Komposit)'],
            standardWeight: String(sum)
          }
        };
      });
    }
  }, [
    foodRecords['Makanan Pokok']?.standardWeight,
    foodRecords['Lauk Hewani']?.standardWeight,
    foodRecords['Lauk Nabati']?.standardWeight,
    foodRecords['Sayuran']?.standardWeight,
    foodRecords['Buah / Selingan']?.standardWeight,
  ]);

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
    if (!profile || !wardId || !patientName) return;
    
    // Check if at least one scale is selected
    const activeRecords = Object.entries(foodRecords).filter(([_, data]) => data.comstockScale !== null);
    if (activeRecords.length === 0) {
      setError('Mohon pilih skala Comstock minimal untuk salah satu jenis makanan.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const promises = activeRecords.map(([fType, data]) => {
        const scaleObj = COMSTOCK_VALUES.find(v => v.scale === data.comstockScale);
        const stdW = parseFloat(data.standardWeight) || 400;
        const wasteWeight = scaleObj ? (stdW * (scaleObj.percentage / 100)) : 0;
        const consumptionWeight = stdW - wasteWeight;

        return addDoc(collection(db, 'transactions'), {
          patientName,
          patientAge: Number(patientAge) || 0,
          patientGender,
          wardId,
          roomNumber,
          bedNumber,
          staffInCharge,
          dietType,
          mealTime,
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
    setPatientAge('');
    setPatientGender('L');
    setRoomNumber('');
    setBedNumber('');
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
      'Buah / Selingan': { menuName: '', comstockScale: null, standardWeight: '50' },
      'Semua (Komposit)': { menuName: '', comstockScale: null, standardWeight: '400' },
    });
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
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] p-6.5 text-white shadow-xl shadow-emerald-600/10 flex items-center justify-between overflow-hidden relative border border-emerald-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200 block mb-1">Petugas Aktif</p>
          <h3 className="text-2xl font-display font-black leading-none">{profile?.name}</h3>
          <p className="text-xs font-semibold text-emerald-50/80 mt-1">NIP. {profile?.nip || '-'}</p>
        </div>
        <User size={72} className="absolute -right-2 -bottom-2 opacity-[0.08] stroke-[1.5]" />
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-6 py-4.5 rounded-[2rem] border border-slate-200 shadow-sm justify-between">
        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 font-display">Progres Langkah</span>
        <div className="flex gap-2 w-32 items-center">
          {[1, 2].map((i) => (
            <div 
              key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-350 ${
                step === i 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm ring-2 ring-emerald-100' 
                  : step > i 
                    ? 'bg-emerald-500' 
                    : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-black text-emerald-600 font-display">Langkah {step} dari 2</span>
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
                Menu & Siklus Hari
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hari Siklus</label>
                    <select
                      value={cycleDay}
                      onChange={(e) => setCycleDay(Number(e.target.value))}
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={d} value={d}>Hari ke-{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Jenis Diet</label>
                    <input
                      type="text"
                      list="diet-list"
                      value={dietType}
                      onChange={(e) => setDietType(e.target.value)}
                      placeholder="Cth: Biasa, RD, RG"
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700"
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Waktu Makan</label>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
                    {([
                      { id: 'sarapan', label: 'Sarapan' },
                      { id: 'selingan_1', label: 'Selingan 1' },
                      { id: 'makan_siang', label: 'Siang' },
                      { id: 'selingan_2', label: 'Selingan 2' },
                      { id: 'makan_malam', label: 'Malam' }
                    ] as { id: MealTime, label: string }[]).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMealTime(m.id)}
                        className={`min-w-[80px] flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${mealTime === m.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        {m.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Detail Menu Terdeteksi</label>
                  <textarea
                    value={foodItems}
                    onChange={(e) => setFoodItems(e.target.value)}
                    placeholder="Isi menu hari ini..."
                    className="w-full px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-600 min-h-[80px] text-sm italic bg-slate-50/50"
                  />
                  {!foodItems && (
                    <p className="text-[10px] text-amber-600 font-bold italic ml-1">* Menu belum diatur di Siklus Menu</p>
                  )}
                </div>
              </div>
            </div>

            <button
              id="next-step-btn"
              disabled={!patientName || !wardId}
              onClick={() => setStep(2)}
              className="w-full bg-emerald-600 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] shadow-xl shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
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
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">
                    Skala Comstock Sisa Makanan
                  </h3>
                  <p className="text-xs text-slate-400 font-bold italic mt-0.5">Pilih sisa makanan per kategori dalam sekali input</p>
                </div>
                <button 
                  onClick={() => setStep(1)} 
                  className="text-emerald-600 text-xs font-black bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full transition-all"
                >
                  Ubah Info Pasien
                </button>
              </div>

              {/* Multi-category list stack */}
              <div className="space-y-5">
                {Object.entries(foodRecords).map(([fType, data]) => {
                  const hasSelectedScale = data.comstockScale !== null;
                  const isComposite = fType === 'Semua (Komposit)';
                  return (
                    <div 
                      key={fType}
                      className={`p-5 rounded-[2rem] border-2 transition-all duration-300 space-y-4 bg-white ${
                        hasSelectedScale 
                          ? 'border-emerald-500 shadow-md shadow-emerald-500/5 ring-4 ring-emerald-50' 
                          : 'border-slate-100 hover:border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl transition-all ${hasSelectedScale ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <UtensilsCrossed size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{fType}</span>
                              {isComposite && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">Rerata Otomatis</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold italic mt-0.5 leading-none">
                              {isComposite 
                                ? 'Rerata dari sisa makanan pokok s/d buah/selingan'
                                : (hasSelectedScale ? 'Skala sisa tercatat' : 'Sisa belum diisi / tidak disajikan')}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 max-w-sm sm:text-right">
                          <input
                            type="text"
                            value={data.menuName}
                            disabled={isComposite}
                            onChange={(e) => updateMenuName(fType, e.target.value)}
                            placeholder={isComposite ? "Komposit / Campuran" : "Isi menu hidangan..."}
                            className={`w-full px-4 py-2.5 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-100 text-xs font-bold text-slate-700 bg-slate-50/50 ${isComposite ? 'opacity-70 cursor-not-allowed italic' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Standar Menu Column in gr - added before selecting percentage */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">Standar Menu:</span>
                          <div className="relative max-w-[120px]">
                            <input
                              type="number"
                              value={data.standardWeight || ''}
                              onChange={(e) => updateStandardWeight(fType, e.target.value)}
                              disabled={isComposite}
                              placeholder="e.g. 150"
                              className={`w-full px-3 py-1.5 pr-8 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-250 text-xs font-black text-slate-750 bg-slate-50/50 ${isComposite ? 'opacity-75 cursor-not-allowed text-emerald-600 bg-emerald-50' : ''}`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">gr</span>
                          </div>
                        </div>
                        {isComposite && (
                          <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-1 sm:justify-end">
                            * Terkalkulasi otomatis dari jumlah porsi bahan pokok
                          </div>
                        )}
                      </div>

                      {/* Comstock horizontal selector buttons */}
                      <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-2xl">
                        {COMSTOCK_VALUES.map((v) => {
                          const isCurrent = data.comstockScale === v.scale;
                          return (
                            <button
                              key={v.scale}
                              type="button"
                              disabled={isComposite}
                              onClick={() => handleScaleClick(fType, v.scale)}
                              className={`flex-1 min-w-[75px] py-4 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                                isCurrent
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/15 scale-[1.03] z-10 font-bold'
                                  : isComposite
                                    ? 'bg-slate-100/50 border border-slate-150 text-slate-350 cursor-not-allowed opacity-50'
                                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold'
                              }`}
                            >
                              <span className="text-[11px] leading-tight font-black">{v.percentage}%</span>
                              <span className="text-[9px] opacity-80 leading-none">
                                {v.scale === 0 ? 'Habis' : v.scale === 1 ? 'Sisa 1/4' : v.scale === 2 ? 'Sisa 1/2' : v.scale === 3 ? 'Sisa 3/4' : v.scale === 4 ? '95%' : 'Utuh'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Visualisasi untuk Semua (Komposit) */}
                      {isComposite && hasSelectedScale && (
                        <div className="space-y-2 mt-4 p-4 bg-emerald-50 bg-opacity-40 rounded-2xl border border-emerald-100">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <span className="p-1 bg-emerald-100 rounded-full text-emerald-600 flex items-center justify-center">
                                <UtensilsCrossed size={12} />
                              </span>
                              Visualisasi Rerata Sisa Makanan Komposit:
                            </span>
                            <span className="font-mono text-sm font-black text-emerald-700">
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
                              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4.5 h-4.5 bg-white border-2 border-emerald-605 rounded-full shadow flex items-center justify-center transition-all duration-300 pointer-events-none"
                            >
                              <div className="w-1.5 h-1.5 bg-emerald-650 rounded-full animate-ping" />
                            </div>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-430 font-extrabold uppercase tracking-wider px-1">
                            <span>Habis (0%)</span>
                            <span>Setengah (50%)</span>
                            <span>Utuh (100%)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 italic text-[10px] text-slate-500 text-center">
                * Pilih dengan menekan skala sisa makan (0% sisa s.d. 100% sisa makanan). Tekan sekali lagi untuk membatalkan seleksi jika jenis makanan tidak disajikan. Skala sisa "Semua (Komposit)" akan terhitung sebagai rata-rata secara otomatis.
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-emerald-600" />
                  Alasan Sisa Makan (Opsional - Jika ada sisa)
                </h3>
                <div className="space-y-3">
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

                  {reason === 'Lainnya (Tulis manual)' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest ml-1">Ketik Alasan Lainnya</label>
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Masukkan alasan kustom..."
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-700"
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
                className="flex-[2] bg-emerald-600 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] shadow-xl shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
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
