import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Menu, OperationType } from '../types';
import { Utensils, Save, RefreshCw, CheckCircle2, AlertCircle, ChevronRight, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MEAL_TIMES = [
  { id: 'sarapan', label: 'Sarapan' },
  { id: 'selingan_1', label: 'Selingan Pagi' },
  { id: 'makan_siang', label: 'Makan Siang' },
  { id: 'selingan_2', label: 'Selingan Sore' },
  { id: 'makan_malam', label: 'Makan Malam' }
];

const DAYS = [1, 2, 3, 4, 5, 6, 7];

const DEFAULT_CYCLE_DATA: Record<number, Record<string, string>> = {
  1: {
    sarapan: 'Nasi, Hati ayam, tempe, susu',
    selingan_1: 'Tepung terigu, telur ayam, pisang',
    makan_siang: 'Nasi, daging sapi, kangkung, alpukat, susu',
    selingan_2: 'Tepung terigu, telur ayam, margarin',
    makan_malam: 'Nasi goreng, hati ayam, telur ayam, pisang ambon'
  },
  2: {
    sarapan: 'Nasi, ikan nila, tahu, apel',
    selingan_1: 'Apel, mangga, jeruk, melon, susu kental manis, yogurt, mayonise',
    makan_siang: 'Nasi, ikan teri, bayam, wortel, pisang ambon',
    selingan_2: 'Margarin, tepung terigu, tepung maizena, telur ayam, pisang',
    makan_malam: 'Nasi, telur ayam, tempe, mangga'
  },
  3: {
    sarapan: 'Nasi, tempe, ayam, apel',
    selingan_1: 'Agar-agar, biskuit, susu skim',
    makan_siang: 'Nasi, ayam, sawi hijau, wortel, kembang kol',
    selingan_2: 'Tepung terigu, gula merah, kelapa parut',
    makan_malam: 'Nasi, bandeng, tahu, tauge, semangka'
  },
  4: {
    sarapan: 'Nasi goreng, ayam, mangga',
    selingan_1: 'Tepung terigu, tepung beras, telur ayam, kelapa parut, santan',
    makan_siang: 'Nasi, nila, tempe, kacang panjang',
    selingan_2: 'Telur ayam, tepung terigu, tepung maizena, margarin',
    makan_malam: 'Nasi, daging sapi, tahu, selada'
  },
  5: {
    sarapan: 'Nasi, ayam, hati ayam, kol, pepaya',
    selingan_1: 'Agar-agar, coklat, susu kental manis',
    makan_siang: 'Nasi, udang, sawi, pisang ambon',
    selingan_2: 'Tepung terigu, telur ayam, bubuk coklat, coklat batang, margarin, susu kental manis',
    malam: 'Nasi, hati ayam, kentang, wortel, kol, apel'
  },
  6: {
    sarapan: 'Nasi, otak-otak ikan, bayam, sawi, wortel, pisang ambon',
    selingan_1: 'Susu skim, pisang',
    makan_siang: 'Nasi, udang, daun singkong, timun, apel',
    selingan_2: 'Kacang ijo, santan, susu skim',
    makan_malam: 'Nasi, ayam, terong, kacang panjang, santan'
  },
  7: {
    sarapan: 'Nasi, udang, selada, apel',
    selingan_1: 'Roti tawar, tepung maizena, keju, susu cair, santan',
    makan_siang: 'Nasi, telur, hati ayam, pisang ambon',
    selingan_2: 'Tepung terigu, kentang, telur ayam',
    makan_malam: 'Nasi goreng, sosis, ayam, udang, telur ayam, pepaya'
  }
};

// Fix for key mismatch in day 5
DEFAULT_CYCLE_DATA[5].makan_malam = (DEFAULT_CYCLE_DATA[5] as any).malam;

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
  const [cycleData, setCycleData] = useState<Record<number, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchMenuCycle = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'menus'), orderBy('cycleDay'));
      const snap = await getDocs(q);
      const data: Record<number, Record<string, string>> = {};
      
      snap.docs.forEach(d => {
        const menu = d.data() as Menu;
        if (!data[menu.cycleDay]) data[menu.cycleDay] = {};
        data[menu.cycleDay][menu.mealTime] = menu.foodItems;
      });

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

  const handleCellChange = (day: number, mealTime: string, value: string) => {
    setCycleData(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [mealTime]: value
      }
    }));
  };

  const saveCycle = async () => {
    setSaving(true);
    try {
      const promises = [];
      for (const day of DAYS) {
        for (const meal of MEAL_TIMES) {
          const foodItems = cycleData[day]?.[meal.id] || '';
          const menuId = `day_${day}_${meal.id}`;
          promises.push(
            setDoc(doc(db, 'menus', menuId), {
              cycleDay: day,
              mealTime: meal.id,
              foodItems: foodItems,
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
    if (confirm('Gunakan menu standar dari gambar? Ini akan mengganti inputan saat ini (tapi belum disimpan ke database).')) {
      setCycleData(DEFAULT_CYCLE_DATA);
    }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Master Menu Siklus</h2>
          <p className="text-slate-500">Kelola siklus menu makanan untuk 7 hari</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={seedDefaults}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RefreshCw size={20} />
            Muat Standar
          </button>
          <button
            onClick={saveCycle}
            disabled={saving}
            className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
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

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-6 text-left text-xs font-black uppercase tracking-widest text-slate-400 w-48">Waktu Makan</th>
                {DAYS.map(day => (
                  <th key={day} className="p-6 text-left text-xs font-black uppercase tracking-widest text-slate-400 min-w-[200px]">
                    Hari ke-{day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MEAL_TIMES.map(meal => (
                <tr key={meal.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="p-6 align-top">
                    <div className="flex items-center gap-3 text-emerald-600">
                      <div className="p-2 bg-emerald-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Utensils size={18} />
                      </div>
                      <span className="font-bold whitespace-nowrap">{meal.label}</span>
                    </div>
                  </td>
                  {DAYS.map(day => (
                    <td key={day} className="p-4 align-top">
                      <textarea
                        value={cycleData[day]?.[meal.id] || ''}
                        onChange={(e) => handleCellChange(day, meal.id, e.target.value)}
                        placeholder="Contoh: Nasi, Ayam, Kol..."
                        className="w-full min-h-[100px] p-4 rounded-2xl bg-white border border-slate-100 focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 flex items-start gap-4">
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
          <LayoutGrid size={24} />
        </div>
        <div>
          <h4 className="font-black text-emerald-900 uppercase text-xs tracking-wider mb-1">Informasi Siklus Menu</h4>
          <p className="text-emerald-700 text-sm leading-relaxed">
            Data menu yang Anda masukkan di sini akan tampil secara otomatis pada saat petugas gizi melakukan penginputan waste makanan (comstock). 
            Pastikan urutan menu sudah sesuai dengan standar operasional gizi rumah sakit.
          </p>
        </div>
      </div>
    </div>
  );
}
