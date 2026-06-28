import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Menu, Ward, OperationType, MealTime } from '../types';
import { Trash2, Plus, Database, Landmark, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function MasterData() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [activeTab, setActiveTab] = useState<'menus' | 'wards'>('wards'); // Default to wards
  
  // Menu form
  const [foodItems, setFoodItems] = useState('');
  const [cycleDay, setCycleDay] = useState('');
  const [mealTime, setMealTime] = useState<MealTime>('sarapan');

  // Ward form
  const [wardName, setWardName] = useState('');

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotification, setShowNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setShowNotification({ type, message });
    setTimeout(() => setShowNotification(null), 3000);
  };

  const fetchData = async () => {
    try {
      const menuSnap = await getDocs(collection(db, 'menus'));
      setMenus(menuSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));

      const wardSnap = await getDocs(collection(db, 'wards'));
      setWards(wardSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'master_data');
    }
  };

  const seedDefaults = () => {
    setConfirmDialog({
      title: 'Gunakan Contoh Data?',
      message: 'Apakah Anda yakin ingin menambahkan bangsal standar ke database sebagai data awal?',
      confirmText: 'Ya, Gunakan',
      isDanger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsSubmitting(true);
        try {
          const defaultWards = ['Bangsal Mawar', 'Bangsal Melati', 'Bangsal Anggrek', 'ICU', 'IGD'];
          
          for (const w of defaultWards) {
            await addDoc(collection(db, 'wards'), { name: w, createdAt: serverTimestamp() });
          }

          notify('success', 'Data standar berhasil ditambahkan');
          fetchData();
        } catch (error) {
          notify('error', 'Gagal menambahkan data standar');
          console.error(error);
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodItems || !cycleDay) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'menus'), {
        foodItems,
        cycleDay: Number(cycleDay),
        mealTime,
        updatedBy: auth.currentUser?.uid,
        updatedAt: serverTimestamp()
      });
      setFoodItems('');
      setCycleDay('');
      notify('success', 'Menu berhasil ditambahkan');
      fetchData();
    } catch (error) {
      notify('error', 'Gagal menambahkan menu.');
      handleFirestoreError(error, OperationType.WRITE, 'menus');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardName) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'wards'), {
        name: wardName,
        createdAt: serverTimestamp()
      });
      setWardName('');
      notify('success', 'Bangsal berhasil ditambahkan');
      fetchData();
    } catch (error) {
      notify('error', 'Gagal menambahkan bangsal. Periksa izin Anda.');
      handleFirestoreError(error, OperationType.WRITE, 'wards');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (coll: string, id: string) => {
    const itemName = coll === 'menus' ? 'jenis diet' : 'bangsal/unit';
    setConfirmDialog({
      title: `Hapus ${coll === 'menus' ? 'Jenis Diet' : 'Bangsal'}?`,
      message: `Apakah Anda yakin ingin menghapus data ${itemName} ini secara permanen dari database?`,
      confirmText: 'Ya, Hapus',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteDoc(doc(db, coll, id));
          notify('success', 'Data berhasil dihapus');
          fetchData();
        } catch (error) {
          notify('error', 'Gagal menghapus data. Anda mungkin tidak memiliki izin.');
          handleFirestoreError(error, OperationType.DELETE, `${coll}/${id}`);
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-white tracking-tight drop-shadow-sm">Data Master</h2>
          <p className="text-emerald-50 text-sm font-semibold">Kelola database jenis diet dan unit/bangsal rumah sakit</p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit items-center gap-2">
          <button
            onClick={() => setActiveTab('menus')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'menus' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Jenis Diet
          </button>
          <button
            onClick={() => setActiveTab('wards')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'wards' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Unit / Bangsal
          </button>
          {(menus.length === 0 && wards.length === 0) && (
            <button
              onClick={seedDefaults}
              className="ml-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center gap-1.5"
            >
              <Database size={14} />
              Gunakan Contoh
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 z-50 min-w-[300px] ${
              showNotification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {showNotification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="font-bold text-sm tracking-tight">{showNotification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <motion.div
           layout
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 h-fit"
        >
          {activeTab === 'menus' ? (
            <form onSubmit={handleAddMenu} className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Database size={20} />
                <h3 className="font-bold">Tambah Menu Siklus</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Rincian Menu</label>
                <textarea
                  value={foodItems}
                  onChange={(e) => setFoodItems(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium min-h-[100px]"
                  placeholder="Contoh: Nasi, Ayam Bakar, Lalapan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Hari Siklus</label>
                  <input
                    type="number"
                    value={cycleDay}
                    onChange={(e) => setCycleDay(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                    placeholder="1-7"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Waktu Makan</label>
                  <select
                    value={mealTime}
                    onChange={(e) => setMealTime(e.target.value as MealTime)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                  >
                    <option value="sarapan">Sarapan</option>
                    <option value="selingan_1">Selingan 1</option>
                    <option value="makan_siang">Siang</option>
                    <option value="selingan_2">Selingan 2</option>
                    <option value="makan_malam">Malam</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-md shadow-emerald-950/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <Plus size={20} />
                    Tambah Menu
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddWard} className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Landmark size={20} />
                <h3 className="font-bold">Tambah Bangsal Baru</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nama Bangsal</label>
                <input
                  type="text"
                  value={wardName}
                  onChange={(e) => setWardName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                  placeholder="Contoh: Bangsal Melati"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-md shadow-emerald-950/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <Plus size={20} />
                    Tambah Bangsal
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>

        {/* List Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 min-h-[400px]">
          <h3 className="font-bold text-slate-800 mb-6">Database {activeTab === 'menus' ? 'Jenis Diet' : 'Bangsal / Unit'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="pb-4 px-2">{activeTab === 'menus' ? 'Hari / Waktu' : 'Nama Bangsal'}</th>
                  {activeTab === 'menus' && (
                    <>
                      <th className="pb-4">Rincian Menu</th>
                    </>
                  )}
                  <th className="pb-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeTab === 'menus' ? (
                  menus.sort((a,b) => a.cycleDay - b.cycleDay).map(menu => (
                    <tr key={menu.id} className="text-sm">
                      <td className="py-4 px-2 font-medium text-slate-700">
                        H{menu.cycleDay} - {(menu.mealTime || '').replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="py-4 text-slate-500 text-xs italic">{menu.foodItems}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end pr-2">
                          <button 
                            onClick={() => handleDelete('menus', menu.id)} 
                            className="group p-3 rounded-2xl bg-white hover:bg-red-50 border border-slate-100 hover:border-red-100 transition-all duration-300 shadow-sm hover:shadow-md"
                            title="Hapus Jenis Diet"
                          >
                            <Trash2 size={18} className="text-red-500 transform group-hover:scale-110 transition-all" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  wards.map(ward => (
                    <tr key={ward.id} className="text-sm">
                      <td className="py-4 px-2 font-medium text-slate-700">{ward.name}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end pr-2">
                          <button 
                            onClick={() => handleDelete('wards', ward.id)} 
                            className="group p-3 rounded-2xl bg-white hover:bg-red-50 border border-slate-100 hover:border-red-100 transition-all duration-300 shadow-sm hover:shadow-md"
                            title="Hapus Bangsal"
                          >
                            <Trash2 size={18} className="text-red-500 transform group-hover:scale-110 transition-all" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {(activeTab === 'menus' ? menus.length : wards.length) === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 italic">Data tidak ditemukan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
