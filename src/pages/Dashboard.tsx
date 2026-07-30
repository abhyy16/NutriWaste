import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where, deleteDoc, doc, updateDoc, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, Menu, Ward, COMSTOCK_VALUES } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, Utensils, AlertTriangle, Download, 
  Filter, Calendar, ChevronRight, Building2, Clock, User,
  Trash2, Pencil, X, Save, AlertCircle, Info, HelpCircle,
  Search, RefreshCw, FileText, Database, ChevronDown, ChevronUp, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { calculateCumulativeWasteFromTransactions, getTransactionWastePercentage, groupTransactionsByPatient, GroupedPatient } from '../lib/recap';

interface EditingGroupState {
  patientKey: string;
  patientName: string;
  medicalRecordNumber: string;
  patientGender: 'L' | 'P';
  patientAge: number;
  wardId: string;
  wardName: string;
  roomNumber: string;
  dietType: string;
  menuId: string;
  mealTime: string;
  sharedReason: string;
  itemsMap: Record<string, {
    id?: string;
    foodType: string;
    comstockScale: number;
    reason: string;
  }>;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingGroup, setEditingGroup] = useState<EditingGroupState | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [expandedAlertKey, setExpandedAlertKey] = useState<string | null>(null);
  const [expandedHistoryKey, setExpandedHistoryKey] = useState<string | null>(null);
  const [expandedModalKey, setExpandedModalKey] = useState<string | null>(null);

  const handleClearAllData = async () => {
    try {
      setIsClearing(true);
      setError(null);
      const snap = await getDocs(collection(db, 'transactions'));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)));
      await Promise.all(deletePromises);
      setTransactions([]);
      setShowClearConfirm(false);
      setIsClearing(false);
    } catch (err: any) {
      setError(err.message || 'Gagal mengosongkan data transaksi.');
      setIsClearing(false);
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
    }
  };

  useEffect(() => {
    setLoading(true);

    // Real-time listener for menus
    const unsubMenus = onSnapshot(collection(db, 'menus'), (snap) => {
      setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'menus');
    });

    // Real-time listener for wards
    const unsubWards = onSnapshot(collection(db, 'wards'), (snap) => {
      setWards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'wards');
    });

    // Real-time listener for transactions
    const q = query(collection(db, 'transactions'));
    const unsubTransactions = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        timestamp: d.data().timestamp?.toDate() 
      } as Transaction)).sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
      
      setTransactions(txs);
      setLoading(false);
    }, (err) => {
      setError(err.message || 'Gagal menyinkronkan data.');
      handleFirestoreError(err, OperationType.GET, 'transactions');
      setLoading(false);
    });

    return () => {
      unsubMenus();
      unsubWards();
      unsubTransactions();
    };
  }, [profile]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan sisa makanan ini?")) return;

    try {
      setError(null);
      await deleteDoc(doc(db, 'transactions', id));
      setTransactions(prev => prev.filter(t => t.id !== id));
      setDeletingId(null);
      alert("Berhasil menghapus catatan sisa makanan.");
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus data.');
      handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    try {
      setError(null);
      const weight = 400; // Standard fallback
      const wasteWeight = weight * (editingTx.comstockScale / 5);
      const consumptionWeight = weight - wasteWeight;
      const selectedWard = wards.find(w => w.id === editingTx.wardId);

      const txRef = doc(db, 'transactions', editingTx.id);
      await updateDoc(txRef, {
        medicalRecordNumber: editingTx.medicalRecordNumber || null,
        patientName: editingTx.patientName,
        patientGender: editingTx.patientGender || 'L',
        patientAge: Number(editingTx.patientAge) || 0,
        wardId: editingTx.wardId || 'w1',
        wardName: editingTx.wardName || selectedWard?.name || 'Rawat Inap',
        roomNumber: editingTx.roomNumber || null,
        dietType: editingTx.dietType || 'Biasa',
        menuId: editingTx.menuId,
        foodType: editingTx.foodType || 'Makanan Pokok',
        comstockScale: editingTx.comstockScale,
        wasteWeight,
        consumptionWeight,
        reason: editingTx.reason || null
      });

      setEditingTx(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui data.');
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${editingTx.id}`);
    }
  };

  const openEditGroupModal = (gp: GroupedPatient) => {
    const firstItem = gp.items[0];
    const itemsMap: Record<string, { id?: string; foodType: string; comstockScale: number; reason: string }> = {};

    const categories = ['Makanan Pokok', 'Lauk Hewani', 'Lauk Nabati', 'Sayuran', 'Buah'];
    const sharedReason = gp.items.find(i => i.reason && i.reason !== '-')?.reason || '';
    
    categories.forEach(cat => {
      const existing = gp.items.find(i => (i.foodType || 'Makanan Pokok') === cat);
      if (existing) {
        itemsMap[cat] = {
          id: existing.id,
          foodType: cat,
          comstockScale: existing.comstockScale ?? 0,
          reason: existing.reason || sharedReason
        };
      } else {
        itemsMap[cat] = {
          foodType: cat,
          comstockScale: 0,
          reason: sharedReason
        };
      }
    });

    setEditingGroup({
      patientKey: gp.key,
      patientName: gp.patientName || firstItem?.patientName || 'Pasien',
      medicalRecordNumber: (gp.medicalRecordNumber && gp.medicalRecordNumber !== '-') ? gp.medicalRecordNumber : (firstItem?.medicalRecordNumber || ''),
      patientGender: ((firstItem?.patientGender || gp.patientGender || 'L') === 'P' ? 'P' : 'L'),
      patientAge: gp.patientAge || firstItem?.patientAge || 0,
      wardId: gp.wardId || firstItem?.wardId || 'w1',
      wardName: gp.wardName || firstItem?.wardName || '',
      roomNumber: (gp.roomNumber && gp.roomNumber !== '-') ? gp.roomNumber : (firstItem?.roomNumber || ''),
      dietType: gp.dietType || firstItem?.dietType || 'Biasa',
      menuId: firstItem?.menuId || 'manual',
      mealTime: firstItem?.mealTime || 'makan_siang',
      sharedReason,
      itemsMap
    });
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    try {
      setSavingGroup(true);
      setError(null);

      const categories = Object.keys(editingGroup.itemsMap);
      const selectedWardObj = wards.find(w => w.id === editingGroup.wardId);

      await Promise.all(categories.map(async (cat) => {
        const itemData = editingGroup.itemsMap[cat];
        const weight = 400;
        const wasteWeight = weight * (itemData.comstockScale / 5);
        const consumptionWeight = weight - wasteWeight;
        const finalReason = editingGroup.sharedReason || itemData.reason || null;

        const payload = {
          medicalRecordNumber: editingGroup.medicalRecordNumber || null,
          patientName: editingGroup.patientName,
          patientGender: editingGroup.patientGender || 'L',
          patientAge: Number(editingGroup.patientAge) || 0,
          wardId: editingGroup.wardId || 'w1',
          wardName: editingGroup.wardName || selectedWardObj?.name || 'Rawat Inap',
          roomNumber: editingGroup.roomNumber || null,
          dietType: editingGroup.dietType || 'Biasa',
          menuId: editingGroup.menuId || 'manual',
          mealTime: editingGroup.mealTime || 'makan_siang',
          foodType: cat,
          comstockScale: itemData.comstockScale,
          wasteWeight,
          consumptionWeight,
          reason: finalReason,
          updatedAt: serverTimestamp()
        };

        if (itemData.id) {
          const txRef = doc(db, 'transactions', itemData.id);
          await updateDoc(txRef, payload);
        } else if (itemData.comstockScale > 0 || (finalReason && finalReason.trim())) {
          await addDoc(collection(db, 'transactions'), {
            ...payload,
            staffId: profile?.id || 'staff1',
            staffName: profile?.name || 'Petugas Gizi',
            timestamp: serverTimestamp()
          });
        }
      }));

      setEditingGroup(null);
    } catch (err: any) {
      console.error('Gagal menyimpan perubahan kelompok pasien:', err);
      setError(err.message || 'Gagal menyimpan perubahan laporan pasien.');
      handleFirestoreError(err, OperationType.UPDATE, 'transactions/group');
    } finally {
      setSavingGroup(false);
    }
  };

  // Logical Helpers - Perhitungan Rekapitulasi Sisa Makanan Pasien
  const displayedTransactions = transactions.filter(t => (selectedWard === 'all' || t.wardId === selectedWard) && t.foodType !== 'Semua (Komposit)');

  // Rekapitulasi (%) = (Total Kumulatif Sisa Makanan Pasien / Jumlah Pasien)
  const { overallWastePercentage: avgWaste, totalPatients } = calculateCumulativeWasteFromTransactions(displayedTransactions);

  // Chart Data: Waste by Day (Last 7 Days)
  const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), i);
    const dayTransactions = displayedTransactions.filter(t => 
      t.timestamp && format(t.timestamp, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
    
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(dayTransactions);

    return {
      name: format(date, 'EEE'),
      percentage: Number(overallWastePercentage.toFixed(1))
    };
  }).reverse();

  // Chart Data: Waste by Meal Time
  const mealTimes = ['sarapan', 'makan_siang', 'makan_malam'];
  const mealTimeData = mealTimes.map(m => {
    const mtTransactions = displayedTransactions.filter(t => t.mealTime === m);
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(mtTransactions);

    return {
      name: (m || '').replace('_', ' ').toUpperCase(),
      value: Number(overallWastePercentage.toFixed(1))
    };
  });

  // Chart Data: Waste by Food Type
  const foodTypesList = [
    'Makanan Pokok',
    'Lauk Hewani',
    'Lauk Nabati',
    'Sayuran',
    'Buah'
  ];

  const foodTypeData = foodTypesList.map(fType => {
    const fTransactions = displayedTransactions.filter(t => (t.foodType || 'Makanan Pokok') === fType);
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(fTransactions);

    return {
      name: fType,
      value: Number(overallWastePercentage.toFixed(1)),
      count: fTransactions.length
    };
  });

  // Grouped Patients for History cards and Alerts (1 Card per Pasien)
  const groupedHistoryPatients = groupTransactionsByPatient(displayedTransactions);
  const groupedAlertPatients = groupedHistoryPatients.filter(gp => gp.isHighWaste);
  const menuAlerts = displayedTransactions.filter(t => getTransactionWastePercentage(t) > 20);

  const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#ecfdf5'];

  if (loading) return null;

  return (
    <div className="space-y-8 pb-12">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-2xl"
          >
            <div className="bg-red-100 p-2 rounded-xl">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <p className="truncate">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 md:p-8 rounded-[2.5rem] border border-emerald-900/40 shadow-xl shadow-emerald-950/20 overflow-hidden relative group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_-20%,rgba(16,185,129,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <Link to="/profile" className="relative group/avatar">
            <div className="w-18 h-18 rounded-2xl bg-white/10 flex items-center justify-center text-white font-display font-black text-2xl border-2 border-white/20 shadow-lg overflow-hidden group-hover/avatar:ring-4 group-hover/avatar:ring-emerald-500/30 transition-all">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || 'UN').substring(0, 2).toUpperCase()
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-500 text-white rounded-xl border border-emerald-950 shadow">
              <User size={10} strokeWidth={3} />
            </div>
          </Link>
          <div>
            <p className="text-xs font-bold text-emerald-400 font-display uppercase tracking-widest leading-none mb-1.5">Selamat Datang,</p>
            <h2 className="text-2xl font-display font-black text-white leading-tight tracking-tight">{profile?.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 rounded-lg text-[9px] font-extrabold uppercase tracking-widest">{profile?.role || 'Staff'}</span>
              <span className="text-[10px] text-emerald-200/50 font-bold uppercase tracking-widest">NIP. {profile?.nip || '-'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 font-display">{format(new Date(), 'EEEE')}</p>
            <p className="text-sm font-display font-black text-white tracking-wide">{format(new Date(), 'dd MMMM yyyy')}</p>
          </div>
          <div className="w-px h-10 bg-white/10 hidden sm:block mx-2" />
          <Link to="/record" className="px-7 py-3.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 rounded-2xl font-display font-extrabold text-sm tracking-wide flex items-center gap-2 px-6 py-4 bg-emerald-600 hover:scale-[1.03] active:scale-[0.98] hover:shadow-lg hover:shadow-emerald-950/20 transition-all duration-300">
            <Utensils size={16} strokeWidth={3} />
            <span>Input Sisa Makan</span>
          </Link>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-850 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 text-sm font-semibold">Analisis sisa makanan real-time dan KPI Rumah Sakit</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="appearance-none flex items-center gap-2 pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">Semua Bangsal</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <Link 
            to="/reports"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-950/20"
          >
            <Download size={16} /> Ekspor Laporan
          </Link>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer"
            title="Kosongkan seluruh data transaksi"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Kosongkan Data</span>
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Avg Waste" 
          value={`${avgWaste.toFixed(0)}%`} 
          subText="Target: <20%" 
          icon={TrendingUp} 
          trend={avgWaste > 20 ? 'bad' : 'good'}
        />
        <StatCard 
          title="Records" 
          value={displayedTransactions.length} 
          subText="30 Days" 
          icon={Utensils} 
        />
        <StatCard 
          title="Patients" 
          value={totalPatients} 
          subText="Sensus" 
          icon={Users} 
        />
        <StatCard 
          title="Alerts" 
          value={menuAlerts.length} 
          subText="Critical" 
          icon={AlertTriangle} 
          trend={menuAlerts.length > 0 ? 'bad' : 'neutral'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800 text-lg">Analisis Sisa Makanan</h3>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Calendar size={14} /> 7 HARI TERAKHIR
            </div>
          </div>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={last7DaysData}>
                  <defs>
                    <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                  />
                  <Area type="monotone" dataKey="percentage" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWave)" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Meal Time Distribution */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 text-lg mb-8">Waste per Waktu Makan</h3>
           <div className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={mealTimeData}
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {mealTimeData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip />
               </PieChart>
             </ResponsiveContainer>
           </div>
           <div className="mt-4 space-y-3">
             {mealTimeData.map((item, idx) => (
               <div key={item.name} className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                   <span className="text-sm font-medium text-slate-600">{item.name}</span>
                 </div>
                 <span className="text-sm font-bold text-slate-900">{item.value}%</span>
               </div>
             ))}
           </div>
        </div>
      </div>



      <div className="grid lg:grid-cols-2 gap-8">
        {/* Alerts Section */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm border-t-4 border-t-red-500">
           <div className="flex items-center justify-between gap-3 mb-6">
             <div className="flex items-center gap-3">
               <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                 <AlertTriangle size={22} />
               </div>
               <div>
                 <h3 className="font-bold text-slate-800 text-lg">Peringatan Waste (&gt; 20%)</h3>
                 <p className="text-xs text-slate-500 font-medium">Berdasarkan indikator mutu pelayanan gizi Kemenkes RI (Standar sisa makanan ≤ 20%)</p>
               </div>
             </div>
             <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-black">
               {groupedAlertPatients.length} Pasien Peringatan
             </span>
           </div>
           
           <div className="space-y-4">
             {groupedAlertPatients.map(gp => {
               const isExpanded = expandedAlertKey === gp.key;
               const ward = wards.find(w => w.id === gp.wardId);

               return (
                 <div key={gp.key} className="border border-red-100 bg-red-50/60 rounded-2xl overflow-hidden transition-all duration-200 shadow-sm hover:border-red-200">
                   <div 
                     onClick={() => setExpandedAlertKey(isExpanded ? null : gp.key)}
                     className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 cursor-pointer select-none hover:bg-red-100/40 transition-colors"
                   >
                     <div className="space-y-1 text-left">
                       <div className="flex items-center gap-2 flex-wrap">
                         <p className="font-bold text-red-950 text-base">{gp.patientName}</p>
                         <span className="text-[10px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-md uppercase">
                           RM: {gp.medicalRecordNumber || '-'}
                         </span>
                         <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                           {gp.dietType || 'Biasa'}
                         </span>
                         <span className="text-[10px] font-extrabold text-red-800 bg-red-200/80 px-2 py-0.5 rounded-md">
                           {gp.items.length} Komponen
                         </span>
                       </div>
                       <p className="text-xs text-slate-600 font-medium">
                         {gp.wardName || ward?.name || 'Rawat Inap'} {gp.roomNumber && gp.roomNumber !== '-' ? `• Kamar ${gp.roomNumber}` : ''}
                       </p>
                     </div>

                     <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 flex-wrap">
                       <div className="text-right">
                         <p className="text-xl font-black text-red-600 font-mono">{gp.avgWastePercentage.toFixed(0)}%</p>
                         <p className="text-[9px] font-bold text-red-500 uppercase tracking-tight">RATA-RATA SISA</p>
                       </div>
                       <button
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           setExpandedAlertKey(isExpanded ? null : gp.key);
                         }}
                         className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer shadow-sm active:scale-[0.98]"
                       >
                         <span>{isExpanded ? 'Tutup Detail' : 'Detail Makanan'}</span>
                         {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                       </button>
                     </div>
                   </div>

                   {/* Accordion Expanded Detail */}
                   <AnimatePresence>
                     {isExpanded && (
                       <motion.div
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         transition={{ duration: 0.2, ease: "easeOut" }}
                         className="border-t border-red-200/80 bg-white p-4 space-y-3.5 text-xs text-slate-700 text-left"
                       >
                         <div>
                           <p className="font-extrabold text-slate-900 text-xs mb-2.5 flex items-center gap-1.5">
                             <Utensils size={14} className="text-red-500" />
                             Rincian Data Makanan Pasien ({gp.items.length} Komponen Makanan):
                           </p>
                           <div className="space-y-2">
                             {gp.items.map(item => {
                               const itemWaste = getTransactionWastePercentage(item);
                               const itemMenu = menus.find(m => m.id === item.menuId);
                               const scaleObj = COMSTOCK_VALUES.find(v => v.scale === item.comstockScale);
                               const isOwner = profile?.id === item.staffId;
                               const isAdminEmail = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(profile?.email || '');
                               const isAdmin = profile?.role === 'admin' || profile?.role === 'nutritionist' || isAdminEmail;

                               return (
                                 <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors">
                                   <div className="space-y-1">
                                     <div className="flex items-center gap-2 flex-wrap">
                                       <span className="px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-black rounded uppercase">
                                         {item.foodType || 'Makanan Pokok'}
                                       </span>
                                       <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded uppercase">
                                         {(item.mealTime || '').replace('_', ' ').toUpperCase()}
                                       </span>
                                       <span className="text-[11px] font-bold text-slate-800">
                                         Menu: <span className="text-slate-600 font-normal">{itemMenu?.foodItems || 'Menu Siklus'}</span>
                                       </span>
                                     </div>
                                     <p className="text-[10px] text-slate-500">
                                       Petugas: <span className="font-medium text-slate-700">{item.staffName || 'Petugas Gizi'}</span>
                                       {item.reason && item.reason !== '-' && (
                                         <span className="ml-2 italic text-amber-800 font-medium">({item.reason})</span>
                                       )}
                                     </p>
                                   </div>

                                   <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                     <div className="text-right">
                                       <span className={`font-mono font-black text-sm ${itemWaste > 20 ? 'text-red-600' : 'text-emerald-600'}`}>
                                         {itemWaste.toFixed(0)}% Sisa
                                       </span>
                                       <p className="text-[9px] text-slate-400 font-semibold">
                                         {scaleObj?.label || `Skala ${item.comstockScale}`}
                                       </p>
                                     </div>

                                     {(isOwner || isAdmin) && (
                                       <div className="flex items-center gap-1">
                                         <button
                                           type="button"
                                           onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                           className={`p-1.5 rounded-lg transition border cursor-pointer ${
                                             deletingId === item.id
                                               ? 'text-white bg-red-600 border-red-600'
                                               : 'text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-100'
                                           }`}
                                           title="Hapus Item Ini"
                                         >
                                           {deletingId === item.id ? <span className="text-[9px] font-black px-1">YAKIN?</span> : <Trash2 size={13} />}
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                         </div>

                         {/* Explanation / Conclusion */}
                         <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 font-medium text-[11px]">
                           <span className="font-bold flex items-center gap-1 text-amber-950 mb-1">
                             <Info size={14} className="text-amber-600" />
                             Dasar Kesimpulan Peringatan Kemenkes RI:
                           </span>
                           Standar Pelayanan Gizi RS menetapkan batas ambang toleransi sisa makanan pasien maksimal <span className="font-bold">20%</span>. Karena sisa makanan rata-rata pasien <span className="font-bold">{gp.patientName}</span> sebesar <span className="font-bold font-mono text-red-700">{gp.avgWastePercentage.toFixed(0)}%</span> melebihi 20%, sistem memberikan peringatan otomatis.
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
               );
             })}

             {groupedAlertPatients.length === 0 && (
               <div className="text-center py-8 text-slate-400 italic">
                 Tidak ada catatan sisa makanan melebihi ambang batas 20%. Seluruh sajian tergolong efisien!
               </div>
             )}
           </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <div className="text-left">
                 <h3 className="font-bold text-slate-800 text-lg">History Catatan Sisa Makan</h3>
                 <p className="text-xs text-slate-400 font-medium">Ringkasan per Pasien ({groupedHistoryPatients.length} Pasien)</p>
               </div>
               <button 
                 onClick={() => setShowAllHistoryModal(true)}
                 className="text-emerald-600 hover:text-emerald-700 text-sm font-bold flex items-center gap-1 cursor-pointer hover:underline transition-all bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-100 shadow-sm active:scale-[0.98]"
               >
                 <span>Lihat Semua ({groupedHistoryPatients.length} Pasien)</span> <ChevronRight size={16} />
               </button>
            </div>
            
            <div className="space-y-3">
              {groupedHistoryPatients.slice(0, 10).map(gp => {
                const isExpanded = expandedHistoryKey === gp.key;
                const ward = wards.find(w => w.id === gp.wardId);

                return (
                  <div key={gp.key} className="border border-slate-100 bg-white rounded-2xl overflow-hidden transition-all duration-200 shadow-sm hover:border-slate-200">
                    <div 
                      onClick={() => setExpandedHistoryKey(isExpanded ? null : gp.key)}
                      className="flex items-center justify-between p-4 gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden text-left">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {(gp.patientName || 'P').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 truncate">{gp.patientName}</p>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                              {gp.dietType || 'Biasa'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {gp.items.length} Komponen
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {gp.wardName || ward?.name} {gp.roomNumber && gp.roomNumber !== '-' ? `• Kamar ${gp.roomNumber}` : ''} | RM: {gp.medicalRecordNumber}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditGroupModal(gp);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                        >
                          <Pencil size={13} className="text-emerald-600" />
                          <span className="hidden sm:inline">Edit Laporan</span>
                          <span className="sm:hidden">Edit</span>
                        </button>
                        <div>
                          <p className={`font-mono font-black text-base ${gp.avgWastePercentage > 20 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {gp.avgWastePercentage.toFixed(0)}%
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">
                            {gp.latestTimestamp ? format(gp.latestTimestamp, 'dd/MM HH:mm') : '-'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedHistoryKey(isExpanded ? null : gp.key);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Accordion Expanded Detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-2 text-xs text-left"
                        >
                          <p className="font-extrabold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                            <Utensils size={14} className="text-emerald-600" />
                            Rincian Detail Komponen Makanan Pasien ({gp.items.length} Item):
                          </p>

                          {gp.items.map(item => {
                            const itemWaste = getTransactionWastePercentage(item);
                            const itemMenu = menus.find(m => m.id === item.menuId);
                            const scaleObj = COMSTOCK_VALUES.find(v => v.scale === item.comstockScale);
                            const isOwner = profile?.id === item.staffId;
                            const isAdminEmail = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(profile?.email || '');
                            const isAdmin = profile?.role === 'admin' || profile?.role === 'nutritionist' || isAdminEmail;

                            return (
                              <div key={item.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black rounded uppercase">
                                      {item.foodType || 'Makanan Pokok'}
                                    </span>
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">
                                      {(item.mealTime || '').replace('_', ' ').toUpperCase()}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-700">
                                      Menu: <strong>{itemMenu?.foodItems || 'Siklus'}</strong>
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    Oleh: {item.staffName || 'Petugas'} {item.reason && item.reason !== '-' && `• Alasan: "${item.reason}"`}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                  <div className="text-right">
                                    <span className={`font-mono font-black text-sm ${itemWaste > 20 ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {itemWaste.toFixed(0)}%
                                    </span>
                                    <p className="text-[9px] text-slate-400 font-semibold">
                                      {scaleObj?.label || `${itemWaste}%`}
                                    </p>
                                  </div>

                                  {(isOwner || isAdmin) && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setEditingTx(item); }}
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                        title="Edit Item Ini"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                                          deletingId === item.id
                                            ? 'text-white bg-red-600'
                                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                        }`}
                                        title="Hapus Item Ini"
                                      >
                                        {deletingId === item.id ? <span className="text-[9px] font-black px-1">YAKIN?</span> : <Trash2 size={14} />}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {groupedHistoryPatients.length === 0 && (
                <div className="text-center py-12 text-slate-400 italic">
                  Belum ada catatan sisa makanan.
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[88vh] my-auto"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">Edit Rekam Data Item</h3>
                <button 
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">No. Rekam Medis</label>
                        <input 
                          type="text"
                          value={editingTx.medicalRecordNumber || ''}
                          onChange={e => setEditingTx({...editingTx, medicalRecordNumber: e.target.value})}
                          placeholder="RM-XXXXXX"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Nama Pasien</label>
                        <input 
                          type="text"
                          value={editingTx.patientName}
                          onChange={e => setEditingTx({...editingTx, patientName: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Umur (Tahun)</label>
                        <input 
                          type="number"
                          value={editingTx.patientAge || ''}
                          onChange={e => setEditingTx({...editingTx, patientAge: Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Jenis Kelamin</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl h-[46px]">
                          {(['L', 'P'] as const).map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setEditingTx({...editingTx, patientGender: g})}
                              className={`flex-1 flex items-center justify-center text-[10px] font-black rounded-lg transition-all ${editingTx.patientGender === g ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                            >
                              {g === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-400 uppercase">Ruang Rawat / Unit</label>
                         <input 
                           type="text"
                           value={editingTx.wardName || wards.find(w => w.id === editingTx.wardId)?.name || ''}
                           onChange={e => setEditingTx({...editingTx, wardName: e.target.value})}
                           placeholder="misal: Mawar / Melati"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                           required
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-400 uppercase">No. Kamar / Bed</label>
                         <input 
                           type="text"
                           value={editingTx.roomNumber || ''}
                           onChange={e => setEditingTx({...editingTx, roomNumber: e.target.value})}
                           placeholder="misal: 102A"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase">Jenis Diet</label>
                       <input 
                         type="text"
                         value={editingTx.dietType || 'Biasa'}
                         onChange={e => setEditingTx({...editingTx, dietType: e.target.value})}
                         placeholder="misal: Makanan Biasa / Diet Rendah Garam"
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                       />
                    </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Menu Makanan</label>
                    <select 
                      value={editingTx.menuId}
                      onChange={e => setEditingTx({...editingTx, menuId: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                      required
                    >
                      <option value="manual">Manual / Hari ini</option>
                      {menus.map(m => (
                        <option key={m.id} value={m.id}>
                          H{m.cycleDay} - {(m.mealTime || '').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Jenis Makanan</label>
                    <select 
                      value={editingTx.foodType || 'Makanan Pokok'}
                      onChange={e => setEditingTx({...editingTx, foodType: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                      required
                    >
                      {[
                        'Makanan Pokok',
                        'Lauk Hewani',
                        'Lauk Nabati',
                        'Sayuran',
                        'Buah'
                      ].map(fType => (
                        <option key={fType} value={fType}>{fType}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Skala Comstock (Sisa)</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                       {COMSTOCK_VALUES.map(v => {
                         const isCurrent = editingTx.comstockScale === v.scale;
                         return (
                           <button
                             key={v.scale}
                             type="button"
                             onClick={() => setEditingTx({...editingTx, comstockScale: v.scale})}
                             className={`py-3 px-1 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1.5 border group relative ${
                               isCurrent 
                               ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-transparent text-white shadow-md shadow-emerald-600/15 scale-[1.02] z-10 font-bold' 
                               : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50'
                             }`}
                           >
                             {/* Custom Comstock Pie-Chart Circle Graphic (Visual indicator from image reference) */}
                             <div 
                               className={`w-6.5 h-6.5 rounded-full border-2 transition-all duration-200 relative shrink-0 ${
                                 isCurrent 
                                   ? 'border-white bg-white/20' 
                                   : 'border-slate-400 bg-slate-50 group-hover:border-slate-500'
                               }`}
                               style={{
                                 background: isCurrent
                                   ? `conic-gradient(#ffffff ${v.percentage}%, rgba(255,255,255,0.2) ${v.percentage}%)`
                                   : `conic-gradient(#059669 ${v.percentage}%, #f1f5f9 ${v.percentage}%)`
                               }}
                             />
                             <div className="flex flex-col items-center text-center">
                               <span className="text-[10.5px] leading-none font-black">{v.percentage}%</span>
                               <span className="text-[7.5px] opacity-80 leading-none mt-0.5 font-bold">
                                 {v.scale === 0 ? 'Habis' : v.scale === 1 ? 'Sisa 1/4' : v.scale === 2 ? 'Sisa 1/2' : v.scale === 3 ? 'Sisa 3/4' : v.scale === 4 ? '95%' : 'Utuh'}
                               </span>
                             </div>
                           </button>
                         );
                       })}
                    </div>

                    {editingTx.comstockScale !== null && editingTx.comstockScale !== undefined && (
                      <div className="mt-3 p-4 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
                        {/* Large real-time Comstock pie-chart visualizer */}
                        <div className="relative shrink-0">
                          <div 
                            className="w-10 h-10 rounded-full border-2 border-emerald-600 bg-slate-50 shadow-sm transition-all duration-300"
                            style={{
                              background: `conic-gradient(#059669 ${(COMSTOCK_VALUES.find(v => v.scale === editingTx.comstockScale)?.percentage || 0)}%, #f1f5f9 ${(COMSTOCK_VALUES.find(v => v.scale === editingTx.comstockScale)?.percentage || 0)}%)`
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] font-mono font-black text-emerald-800 bg-white/90 px-0.5 py-0.2 rounded shadow-sm scale-90 border border-emerald-100">
                              ({editingTx.comstockScale})
                            </span>
                          </div>
                        </div>

                        {/* Title, percentage and slider */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                            <span className="flex items-center gap-1">
                              <span className="p-0.5 bg-emerald-100 rounded-full text-emerald-600 flex items-center justify-center">
                                <Utensils size={10} />
                              </span>
                              Sisa Makanan ({editingTx.foodType || 'Makanan Pokok'}):
                            </span>
                            <span className="font-mono text-xs font-black text-emerald-700">
                              {(() => {
                                const matched = COMSTOCK_VALUES.find(v => v.scale === editingTx.comstockScale);
                                return matched ? matched.percentage : 0;
                              })()}% Sisa
                            </span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                            <motion.div 
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${(COMSTOCK_VALUES.find(v => v.scale === editingTx.comstockScale)?.percentage || 0)}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                            <div 
                              style={{ left: `${(COMSTOCK_VALUES.find(v => v.scale === editingTx.comstockScale)?.percentage || 0)}%` }}
                              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow flex items-center justify-center transition-all duration-300 pointer-events-none"
                            >
                              <div className="w-1.2 h-1.2 bg-emerald-600 rounded-full" />
                            </div>
                          </div>
                          <div className="flex justify-between text-[8px] text-slate-450 font-extrabold uppercase tracking-wider px-1">
                            <span>Habis (0%)</span>
                            <span>Setengah (50%)</span>
                            <span>Utuh (100%)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Alasan Sisa Makan</label>
                    <select 
                      value={editingTx.reason || ''}
                      onChange={e => setEditingTx({...editingTx, reason: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                    >
                      <option value="">-- Tanpa Alasan --</option>
                      <option value="Pasien tidak nafsu makan">Pasien tidak nafsu makan</option>
                      <option value="Porsi terlalu besar">Porsi terlalu besar</option>
                      <option value="Pasien pulang/tindakan medis">Pasien pulang/tindakan medis</option>
                      <option value="Makanan dingin">Makanan dingin</option>
                    </select>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setEditingTx(null)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Simpan Perubahan
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grouped Edit Modal (Edit seluruh komponen & profil pasien dalam 1 kartu) */}
      <AnimatePresence>
        {editingGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[88vh] my-auto text-left"
            >
              {/* Header */}
              <div className="p-6 sm:p-7 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
                    <Pencil size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                      Edit Laporan Pasien
                    </h3>
                    <p className="text-xs text-emerald-100 font-medium mt-0.5">
                      Kelola identitas & 5 komponen makanan pasien <span className="font-bold underline">{editingGroup.patientName}</span> dalam 1 halaman
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="p-2.5 hover:bg-white/15 rounded-2xl transition-colors text-white/80 hover:text-white cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSaveGroup} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 sm:p-8 space-y-8 overflow-y-auto flex-1">
                  {/* Section 1: Data Identitas & Rawat Inap */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <User size={18} className="text-emerald-600" />
                      <h4 className="font-black text-slate-800 text-sm tracking-tight uppercase">Identitas & Data Rawat Inap</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">No. Rekam Medis (RM)</label>
                        <input
                          type="text"
                          value={editingGroup.medicalRecordNumber}
                          onChange={e => setEditingGroup({...editingGroup, medicalRecordNumber: e.target.value})}
                          placeholder="RM-XXXXXX"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Nama Lengkap Pasien *</label>
                        <input
                          type="text"
                          value={editingGroup.patientName}
                          onChange={e => setEditingGroup({...editingGroup, patientName: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Umur (Tahun)</label>
                        <input
                          type="number"
                          value={editingGroup.patientAge || ''}
                          onChange={e => setEditingGroup({...editingGroup, patientAge: Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Jenis Kelamin</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl h-[42px]">
                          {(['L', 'P'] as const).map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setEditingGroup({...editingGroup, patientGender: g})}
                              className={`flex-1 flex items-center justify-center text-[10px] font-black rounded-lg transition-all ${
                                editingGroup.patientGender === g ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                              }`}
                            >
                              {g === 'L' ? 'LAKI-LAKI ♂' : 'PEREMPUAN ♀'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Ruang Rawat / Unit *</label>
                        <input
                          type="text"
                          value={editingGroup.wardName || wards.find(w => w.id === editingGroup.wardId)?.name || ''}
                          onChange={e => setEditingGroup({...editingGroup, wardName: e.target.value})}
                          placeholder="misal: Bangsal I / Melati"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">No. Kamar / Bed</label>
                        <input
                          type="text"
                          value={editingGroup.roomNumber}
                          onChange={e => setEditingGroup({...editingGroup, roomNumber: e.target.value})}
                          placeholder="misal: 102A"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Jenis Diet</label>
                        <input
                          type="text"
                          value={editingGroup.dietType}
                          onChange={e => setEditingGroup({...editingGroup, dietType: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Menu Makanan</label>
                        <select
                          value={editingGroup.menuId}
                          onChange={e => setEditingGroup({...editingGroup, menuId: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                        >
                          <option value="manual">Manual / Hari ini</option>
                          {menus.map(m => (
                            <option key={m.id} value={m.id}>
                              H{m.cycleDay} - {(m.mealTime || '').toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Waktu Makan</label>
                        <select
                          value={editingGroup.mealTime}
                          onChange={e => setEditingGroup({...editingGroup, mealTime: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-200 outline-none"
                        >
                          <option value="sarapan">Makan Pagi / Sarapan</option>
                          <option value="makan_siang">Makan Siang</option>
                          <option value="makan_malam">Makan Malam</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: 5 Komponen Makanan dalam 1 Kartu Terpadu */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Utensils size={18} className="text-emerald-600" />
                        <h4 className="font-black text-slate-800 text-sm tracking-tight uppercase">
                          Asesmen 5 Komponen Makanan Pasien
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        1 Kartu Terpadu
                      </span>
                    </div>

                    {/* Single Unified Reason Field */}
                    <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-2">
                      <label className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardCheck size={14} className="text-emerald-600" />
                        Alasan Sisa Makanan Pasien (Disatukan untuk Makanan Pokok, Lauk, Sayur & Buah)
                      </label>
                      <select
                        value={editingGroup.sharedReason}
                        onChange={e => {
                          const newReason = e.target.value;
                          const updatedItemsMap = { ...editingGroup.itemsMap };
                          Object.keys(updatedItemsMap).forEach(k => {
                            updatedItemsMap[k] = { ...updatedItemsMap[k], reason: newReason };
                          });
                          setEditingGroup({
                            ...editingGroup,
                            sharedReason: newReason,
                            itemsMap: updatedItemsMap
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-emerald-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <option value="">-- Pilih Alasan Sisa Makanan Terpadu --</option>
                        <option value="Pasien tidak nafsu makan">Pasien tidak nafsu makan</option>
                        <option value="Porsi terlalu besar">Porsi terlalu besar</option>
                        <option value="Pasien pulang/tindakan medis">Pasien pulang/tindakan medis</option>
                        <option value="Makanan dingin">Makanan dingin</option>
                        <option value="Sensori / Rasa kurang cocok">Sensori / Rasa kurang cocok</option>
                        <option value="Lainnya">Lainnya (Ketik Manual)</option>
                      </select>
                      {editingGroup.sharedReason === 'Lainnya' && (
                        <input
                          type="text"
                          placeholder="Tulis alasan sisa makanan secara manual..."
                          onChange={e => {
                            const customVal = e.target.value;
                            const updatedItemsMap = { ...editingGroup.itemsMap };
                            Object.keys(updatedItemsMap).forEach(k => {
                              updatedItemsMap[k] = { ...updatedItemsMap[k], reason: customVal };
                            });
                            setEditingGroup({
                              ...editingGroup,
                              itemsMap: updatedItemsMap
                            });
                          }}
                          className="w-full mt-2 px-3.5 py-2 bg-white border border-emerald-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      )}
                      <p className="text-[10px] text-emerald-700/80 font-medium">
                        * Alasan ini disatukan untuk seluruh 5 komponen hidangan pasien.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {['Makanan Pokok', 'Lauk Hewani', 'Lauk Nabati', 'Sayuran', 'Buah'].map((fType) => {
                        const currentItem = editingGroup.itemsMap[fType] || { foodType: fType, comstockScale: 0, reason: '' };
                        const currentScale = currentItem.comstockScale;
                        const matchedComstock = COMSTOCK_VALUES.find(v => v.scale === currentScale) || COMSTOCK_VALUES[0];

                        const getFoodIcon = (type: string) => {
                          switch(type) {
                            case 'Makanan Pokok': return '🍞';
                            case 'Lauk Hewani': return '🍗';
                            case 'Lauk Nabati': return '🫘';
                            case 'Sayuran': return '🥦';
                            case 'Buah': return '🍎';
                            default: return '🍱';
                          }
                        };

                        return (
                          <div key={fType} className="p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getFoodIcon(fType)}</span>
                                <span className="font-black text-slate-800 text-xs sm:text-sm">{fType}</span>
                              </div>
                              <span className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-full ${
                                matchedComstock.percentage > 20 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {matchedComstock.percentage}% Sisa ({matchedComstock.scale})
                              </span>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                              {COMSTOCK_VALUES.map(v => {
                                const isSelected = currentScale === v.scale;
                                return (
                                  <button
                                    key={v.scale}
                                    type="button"
                                    onClick={() => {
                                      setEditingGroup({
                                        ...editingGroup,
                                        itemsMap: {
                                          ...editingGroup.itemsMap,
                                          [fType]: {
                                            ...currentItem,
                                            comstockScale: v.scale
                                          }
                                        }
                                      });
                                    }}
                                    className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 border cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm font-bold scale-[1.02]'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <div
                                      className="w-5 h-5 rounded-full border border-slate-300 relative shrink-0"
                                      style={{
                                        background: isSelected
                                          ? `conic-gradient(#ffffff ${v.percentage}%, rgba(255,255,255,0.3) ${v.percentage}%)`
                                          : `conic-gradient(#059669 ${v.percentage}%, #f1f5f9 ${v.percentage}%)`
                                      }}
                                    />
                                    <span className="text-[9px] font-black">{v.percentage}%</span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                              <span>Alasan Terpadu:</span>
                              <span className="font-bold text-slate-700">{currentItem.reason || editingGroup.sharedReason || 'Tanpa Alasan / Habis'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3 z-10">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingGroup}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-950/20 flex items-center gap-2 transition cursor-pointer"
                  >
                    <Save size={16} />
                    <span>{savingGroup ? 'Menyimpan...' : 'Simpan Seluruh Laporan Pasien'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Clear All Data Confirmation */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 sm:p-8 text-center space-y-4 z-10"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-rose-200">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-display font-black text-slate-900">Kosongkan Semua Data Transaksi?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Tindakan ini akan menghapus <span className="font-bold text-slate-800">{transactions.length} entri catatan sisa makanan</span> secara permanen di database Firestore. Data yang dihapus tidak dapat dikembalikan.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  disabled={isClearing}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-md shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {isClearing ? 'Mengosongkan...' : 'Ya, Kosongkan Data'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: All History View ("Lihat Semua") */}
      <AnimatePresence>
        {showAllHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllHistoryModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                <div className="text-left">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <FileText className="text-emerald-600" size={22} />
                    Seluruh History Catatan Sisa Makan
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Total {displayedTransactions.length} entri observasi sisa makanan
                  </p>
                </div>
                <button 
                  onClick={() => setShowAllHistoryModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search & Actions Bar */}
              <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                <div className="relative w-full sm:w-72">
                  <input 
                    type="text"
                    placeholder="Cari nama pasien, RM, atau bangsal..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <Link
                  to="/reports"
                  onClick={() => setShowAllHistoryModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Buka Laporan Lengkap</span>
                  <ChevronRight size={14} />
                </Link>
              </div>

              {/* List Content */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1">
                {groupTransactionsByPatient(
                  displayedTransactions.filter(t => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase();
                    return (
                      (t.patientName || '').toLowerCase().includes(q) ||
                      (t.medicalRecordNumber || '').toLowerCase().includes(q) ||
                      (t.wardName || '').toLowerCase().includes(q)
                    );
                  })
                ).map(gp => {
                  const isExpanded = expandedModalKey === gp.key;
                  const ward = wards.find(w => w.id === gp.wardId);

                  return (
                    <div key={gp.key} className="border border-slate-100 bg-white rounded-2xl overflow-hidden transition-all duration-200 shadow-sm hover:border-slate-200">
                      <div 
                        onClick={() => setExpandedModalKey(isExpanded ? null : gp.key)}
                        className="flex items-center justify-between p-4 gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden text-left">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {(gp.patientName || 'P').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-800 truncate">{gp.patientName}</p>
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                                {gp.dietType || 'Biasa'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {gp.items.length} Komponen
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {gp.wardName || ward?.name} {gp.roomNumber && gp.roomNumber !== '-' ? `• Kamar ${gp.roomNumber}` : ''} | RM: {gp.medicalRecordNumber}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditGroupModal(gp);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <Pencil size={13} className="text-emerald-600" />
                            <span className="hidden sm:inline">Edit Laporan</span>
                            <span className="sm:hidden">Edit</span>
                          </button>
                          <div>
                            <p className={`font-mono font-black text-base ${gp.avgWastePercentage > 20 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {gp.avgWastePercentage.toFixed(0)}%
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">
                              {gp.latestTimestamp ? format(gp.latestTimestamp, 'dd/MM HH:mm') : '-'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedModalKey(isExpanded ? null : gp.key);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* Accordion Expanded Detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-2 text-xs text-left"
                          >
                            <p className="font-extrabold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                              <Utensils size={14} className="text-emerald-600" />
                              Rincian Detail Komponen Makanan Pasien ({gp.items.length} Item):
                            </p>

                            {gp.items.map(item => {
                              const itemWaste = getTransactionWastePercentage(item);
                              const itemMenu = menus.find(m => m.id === item.menuId);
                              const scaleObj = COMSTOCK_VALUES.find(v => v.scale === item.comstockScale);
                              const isOwner = profile?.id === item.staffId;
                              const isAdminEmail = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(profile?.email || '');
                              const isAdmin = profile?.role === 'admin' || profile?.role === 'nutritionist' || isAdminEmail;

                              return (
                                <div key={item.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black rounded uppercase">
                                        {item.foodType || 'Makanan Pokok'}
                                      </span>
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">
                                        {(item.mealTime || '').replace('_', ' ').toUpperCase()}
                                      </span>
                                      <span className="text-[11px] font-medium text-slate-700">
                                        Menu: <strong>{itemMenu?.foodItems || 'Siklus'}</strong>
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                      Oleh: {item.staffName || 'Petugas'} {item.reason && item.reason !== '-' && `• Alasan: "${item.reason}"`}
                                    </p>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    <div className="text-right">
                                      <span className={`font-mono font-black text-sm ${itemWaste > 20 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {itemWaste.toFixed(0)}%
                                      </span>
                                      <p className="text-[9px] text-slate-400 font-semibold">
                                        {scaleObj?.label || `${itemWaste}%`}
                                      </p>
                                    </div>

                                    {(isOwner || isAdmin) && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setShowAllHistoryModal(false); 
                                            setEditingTx(item); 
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                          title="Edit Item Ini"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                                            deletingId === item.id
                                              ? 'text-white bg-red-600'
                                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                          }`}
                                          title="Hapus Item Ini"
                                        >
                                          {deletingId === item.id ? <span className="text-[9px] font-black px-1">YAKIN?</span> : <Trash2 size={14} />}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {displayedTransactions.length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic text-sm">
                    Tidak ada data transaksi yang ditemukan.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, subText, icon: Icon, trend }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-[0_10px_30px_-15px_rgba(148,163,184,0.12)] relative overflow-hidden group transition-all duration-300 hover:shadow-[0_20px_45px_-12px_rgba(16,185,129,0.1)] hover:border-emerald-300"
    >
      <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 rounded-full blur-2xl translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
      
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-gradient-to-b from-[#fafbfe] to-[#f1f5f9] rounded-2xl text-slate-500 border border-slate-200/60 group-hover:from-emerald-50 group-hover:to-teal-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-all duration-300 shadow-sm">
          <Icon size={20} className="transition-transform duration-300 group-hover:rotate-12" />
        </div>
        {trend && (
          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
            trend === 'good' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' : 
            trend === 'bad' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600' : 'bg-slate-500/10 border border-slate-500/20 text-slate-500'
          }`}>
            {trend === 'good' ? 'Aman' : trend === 'bad' ? 'Waspada' : 'Stabil'}
          </span>
        )}
      </div>
      <h4 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1 font-display">{title}</h4>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-display font-black text-slate-800 tracking-tight">{value}</span>
      </div>
      <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">{subText}</p>
    </motion.div>
  );
}
