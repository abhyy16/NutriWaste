import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Menu, OperationType } from '../types';
import { 
  Utensils, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft, 
  LayoutGrid, 
  Plus, 
  Trash2, 
  Calendar, 
  Table, 
  Sparkles, 
  Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MEAL_TIMES, DEFAULT_CYCLE_DATA } from '../constants/menuCycle';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function MenuCycle() {
  interface CycleCell {
    foodItems: string;
    standarBahan: string;
    gramasi: string;
    beratStandar: string;
  }

  const [cycleData, setCycleData] = useState<Record<number, Record<string, CycleCell>>>({});
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 350;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchMenuCycle = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'menus'), orderBy('cycleDay'));
      const snap = await getDocs(q);
      const data: Record<number, Record<string, CycleCell>> = {};
      
      snap.docs.forEach(d => {
        const menu = d.data();
        const day = menu.cycleDay;
        const mealTime = menu.mealTime;
        if (!data[day]) data[day] = {};
        data[day][mealTime] = {
          foodItems: menu.foodItems || '',
          standarBahan: menu.standarBahan || '',
          gramasi: menu.gramasi || '',
          beratStandar: menu.beratStandar || '400',
        };
      });

      // Parse and dynamically populate cycle days from Firestore
      const fetchedDays = Object.keys(data).map(Number).sort((a, b) => a - b);
      if (fetchedDays.length > 0) {
        const uniqueDays = Array.from(new Set([...Array.from({ length: 7 }, (_, i) => i + 1), ...fetchedDays])).sort((a, b) => a - b);
        setDays(uniqueDays);
      } else {
        setDays([1, 2, 3, 4, 5, 6, 7]);
      }

      setCycleData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuCycle();
  }, []);

  const handleCellFieldChange = (day: number, mealTime: string, field: keyof CycleCell, value: string) => {
    setCycleData(prev => {
      const dayData = prev[day] || {};
      const cellData = dayData[mealTime] || { foodItems: '', standarBahan: '', gramasi: '', beratStandar: '' };
      return {
        ...prev,
        [day]: {
          ...dayData,
          [mealTime]: {
            ...cellData,
            [field]: value
          }
        }
      };
    });
  };

  const saveCycle = async () => {
    setSaving(true);
    try {
      const promises = [];
      for (const day of days) {
        for (const meal of MEAL_TIMES) {
          const cell = cycleData[day]?.[meal.id] || { foodItems: '', standarBahan: '', gramasi: '', beratStandar: '400' };
          const menuId = `day_${day}_${meal.id}`;
          promises.push(
            setDoc(doc(db, 'menus', menuId), {
              cycleDay: day,
              mealTime: meal.id,
              foodItems: cell.foodItems || '',
              // Keep default/mock standards to remain backward-compatible without visual clutter
              standarBahan: cell.standarBahan || 'Beras, sayuran segar, lauk pauk',
              gramasi: cell.gramasi || 'Nasi 150g, Protein 50g, Sayur 100g, Buah 50g',
              beratStandar: cell.beratStandar || '400',
              updatedBy: auth.currentUser?.uid,
              updatedAt: serverTimestamp()
            })
          );
        }
      }
      await Promise.all(promises);
      notify('success', 'Siklus menu berhasil disimpan');
    } catch (error) {
      notify('error', 'Gagal menyimpan siklus menu');
      handleFirestoreError(error, OperationType.WRITE, 'menus');
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = () => {
    setConfirmDialog({
      title: 'Gunakan Menu Standar?',
      message: 'Apakah Anda yakin ingin memuat menu standar? Ini akan mengganti seluruh inputan di editor saat ini (tetapi belum disimpan ke database).',
      confirmText: 'Ya, Gunakan',
      isDanger: false,
      onConfirm: () => {
        setConfirmDialog(null);
        const formatted: Record<number, Record<string, CycleCell>> = {};
        Object.keys(DEFAULT_CYCLE_DATA).forEach((dayStr) => {
          const day = parseInt(dayStr);
          formatted[day] = {};
          Object.keys(DEFAULT_CYCLE_DATA[day]).forEach((mealTime) => {
            formatted[day][mealTime] = {
              foodItems: DEFAULT_CYCLE_DATA[day][mealTime],
              standarBahan: 'Beras, sayuran segar, lauk pauk',
              gramasi: 'Nasi 150g, Protein 50g, Sayur 100g, Buah 50g',
              beratStandar: '400'
            };
          });
        });
        setCycleData(formatted);
        setDays([1, 2, 3, 4, 5, 6, 7]);
        setActiveDay(1);
        notify('success', 'Menu standar berhasil dimuat ke editor.');
      }
    });
  };

  const addDayManually = () => {
    const nextDay = days.length > 0 ? Math.max(...days) + 1 : 1;
    setDays(prev => [...prev, nextDay]);
    setActiveDay(nextDay);
    notify('success', `Hari ke-${nextDay} ditambahkan secara manual!`);
  };

  const removeSpecificDay = (dayToDelete: number) => {
    if (days.length <= 1) {
      notify('error', 'Harus ada minimal 1 hari dalam siklus menu!');
      return;
    }
    setConfirmDialog({
      title: `Hapus Hari ke-${dayToDelete}?`,
      message: `Apakah Anda yakin ingin menghapus Hari ke-${dayToDelete} dari siklus menu? Tindakan ini akan mengosongkan data hari tersebut di editor.`,
      confirmText: 'Ya, Hapus',
      isDanger: true,
      onConfirm: () => {
        setConfirmDialog(null);
        const updatedDays = days.filter(d => d !== dayToDelete);
        setDays(updatedDays);
        if (activeDay === dayToDelete) {
          const nextActive = updatedDays.find(d => d > dayToDelete) || updatedDays[updatedDays.length - 1];
          setActiveDay(nextActive);
        }
        setCycleData(prev => {
          const copy = { ...prev };
          delete copy[dayToDelete];
          return copy;
        });
        notify('success', `Hari ke-${dayToDelete} berhasil dihapus dari siklus.`);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-850 tracking-tight">Siklus Menu</h2>
          <p className="text-slate-500 text-sm font-semibold">Kelola siklus menu makanan secara fleksibel dan nyaman</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'card'
                  ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              Per Hari (Nyaman)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Table size={14} />
              Tabel Semua Hari
            </button>
          </div>

          <button
            type="button"
            onClick={seedDefaults}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 text-xs"
          >
            <RefreshCw size={15} />
            Muat Standar
          </button>
          <button
            type="button"
            onClick={saveCycle}
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-2 disabled:opacity-50 text-xs"
          >
            {saving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
            Simpan Siklus
          </button>
        </div>
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 z-50 ${
              notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="font-bold">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Scrolling Days Bar with Explicit Navigation Arrows */}
      <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-3xl border border-slate-200 shadow-inner">
        <button
          type="button"
          onClick={() => scroll('left')}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl shadow-sm hover:text-slate-800 active:scale-95 transition-all shrink-0 flex items-center justify-center focus:ring-2 focus:ring-emerald-500/20 outline-none"
          title="Geser Kiri"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>

        {/* Horizontally scrolling Days Pills */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto py-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent scroll-smooth px-1"
        >
          {days.map(day => {
            const isActive = activeDay === day;
            return (
              <div key={day} className="relative flex items-center shrink-0 group">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDay(day);
                    setViewMode('card'); // Switch to card mode automatically for best editing experience on click
                  }}
                  className={`pl-5 pr-10 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isActive && viewMode === 'card'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-transparent text-white shadow-md shadow-emerald-600/15 scale-[1.02]'
                      : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Calendar size={13} />
                  Hari ke-{day}
                </button>
                {days.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSpecificDay(day);
                    }}
                    className={`absolute right-2.5 p-1.5 rounded-lg transition-all ${
                      isActive && viewMode === 'card'
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50/80'
                    }`}
                    title={`Hapus Hari ke-${day}`}
                  >
                    <Trash2 size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addDayManually}
            className="px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border border-dashed border-emerald-300 text-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 shrink-0 flex items-center gap-1"
          >
            <Plus size={14} />
            Tambah Hari Baru
          </button>
        </div>

        <button
          type="button"
          onClick={() => scroll('right')}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl shadow-sm hover:text-slate-800 active:scale-95 transition-all shrink-0 flex items-center justify-center focus:ring-2 focus:ring-emerald-500/20 outline-none"
          title="Geser Kanan"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'card' ? (
          <motion.div
            key="card-layout"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Active Day Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {MEAL_TIMES.map(meal => {
                const val = cycleData[activeDay]?.[meal.id]?.foodItems || '';
                return (
                  <div
                    key={meal.id}
                    className="bg-white p-5 rounded-[2rem] border border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all duration-300 flex flex-col gap-3 group"
                  >
                    <div className="flex items-center gap-2 text-emerald-600 shrink-0">
                      <div className="p-2 bg-emerald-50 rounded-xl group-hover:scale-105 transition-transform">
                        <Utensils size={15} />
                      </div>
                      <span className="font-black text-[11px] uppercase tracking-wider text-slate-800">
                        {meal.label}
                      </span>
                    </div>

                    <div className="flex-1 min-h-[140px] flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Menu Hidangan
                      </label>
                      <textarea
                        value={val}
                        onChange={(e) => handleCellFieldChange(activeDay, meal.id, 'foodItems', e.target.value)}
                        placeholder="e.g. Nasi, Ayam goreng, Sup wortel, Apel..."
                        className="flex-1 w-full p-3.5 text-xs font-bold text-slate-700 placeholder:text-slate-300 bg-slate-50/50 rounded-xl border border-slate-200 focus:border-emerald-350 focus:ring-4 focus:ring-emerald-50/40 outline-none transition-all resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={activeDay === Math.min(...days)}
                onClick={() => {
                  const sorted = [...days].sort((a,b) => a - b);
                  const idx = sorted.indexOf(activeDay);
                  if (idx > 0) setActiveDay(sorted[idx - 1]);
                }}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 text-slate-600 rounded-2xl font-bold transition-all flex items-center gap-1.5 text-xs shadow-sm"
              >
                <ChevronLeft size={16} />
                Hari Sebelumnya
              </button>
              <div className="text-xs font-extrabold text-slate-500 bg-slate-100/85 px-4 py-2 rounded-full border border-slate-200 font-mono">
                Hari {activeDay} dari {days.length} Hari Siklus
              </div>
              <button
                type="button"
                disabled={activeDay === Math.max(...days)}
                onClick={() => {
                  const sorted = [...days].sort((a,b) => a - b);
                  const idx = sorted.indexOf(activeDay);
                  if (idx < sorted.length - 1) setActiveDay(sorted[idx + 1]);
                }}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 text-slate-600 rounded-2xl font-bold transition-all flex items-center gap-1.5 text-xs shadow-sm"
              >
                Hari Selanjutnya
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="table-layout"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-5 text-left text-xs font-black uppercase tracking-widest text-slate-400 w-44 shrink-0">
                      Waktu Makan
                    </th>
                    {days.map(day => (
                      <th key={day} className="p-5 text-left text-xs font-black uppercase tracking-widest text-slate-400 min-w-[200px]">
                        Hari ke-{day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MEAL_TIMES.map(meal => (
                    <tr key={meal.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-5 align-top">
                        <div className="flex items-center gap-2.5 text-emerald-600 mt-2">
                          <div className="p-2 bg-emerald-50 rounded-xl group-hover:scale-110 transition-transform">
                            <Utensils size={15} />
                          </div>
                          <span className="font-extrabold text-xs whitespace-nowrap">{meal.label}</span>
                        </div>
                      </td>
                      {days.map(day => (
                        <td key={day} className="p-3 align-top">
                          <div className="space-y-1 min-w-[190px]">
                            <textarea
                              value={cycleData[day]?.[meal.id]?.foodItems || ''}
                              onChange={(e) => handleCellFieldChange(day, meal.id, 'foodItems', e.target.value)}
                              placeholder="Belum diisi..."
                              className="w-full min-h-[90px] p-3 text-xs rounded-xl bg-slate-50/30 border border-slate-200 focus:border-emerald-350 focus:ring-4 focus:ring-emerald-50/30 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none leading-relaxed"
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Information Panel */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50/40 p-6 rounded-[2.5rem] border border-emerald-100/80 flex items-start gap-4">
        <div className="p-3.5 bg-emerald-100 text-emerald-600 rounded-2xl shrink-0">
          <Info size={22} />
        </div>
        <div>
          <h4 className="font-black text-emerald-900 uppercase text-xs tracking-wider mb-1">Panduan Pengelolaan Siklus</h4>
          <p className="text-emerald-700/90 text-sm leading-relaxed">
            Data menu yang diisi di sini akan muncul otomatis saat petugas gizi menginput porsi sisa makanan (comstock) pasien. 
            Anda sekarang dapat <strong>menambah atau menghapus jumlah hari siklus secara manual</strong> untuk menyesuaikan kebutuhan institusi Anda. 
            Gunakan <strong>Tampilan Per Hari</strong> untuk pengalaman input data yang paling nyaman dan fokus.
          </p>
        </div>
      </div>

      {/* Custom animated confirmation modal */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white p-6 rounded-[2rem] border border-slate-100 shadow-2xl flex flex-col items-center text-center gap-4 z-10"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${confirmDialog.isDanger ? 'bg-rose-50 border border-rose-100 text-rose-500' : 'bg-emerald-50 border border-emerald-100 text-emerald-500'}`}>
                <AlertCircle size={24} className={confirmDialog.isDanger ? 'animate-pulse' : ''} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-slate-900">{confirmDialog.title}</h4>
                <p className="text-sm text-slate-500 px-2 leading-relaxed">{confirmDialog.message}</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className={`flex-1 py-3 px-4 rounded-xl text-white font-bold shadow-md transition-all text-sm ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'}`}
                >
                  {confirmDialog.confirmText || 'Ya'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
