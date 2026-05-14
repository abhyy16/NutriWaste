import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, Menu, Ward, COMSTOCK_VALUES } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, Utensils, AlertTriangle, Download, 
  Filter, Calendar, ChevronRight, Building2, Clock, User,
  Trash2, Pencil, X, Save, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    let q = query(collection(db, 'transactions'));
    
    // Filter by staffId if not admin/nutritionist
    const isAdminEmail = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(profile?.email || '');
    const isAuthorized = profile?.role === 'admin' || profile?.role === 'nutritionist' || isAdminEmail;

    if (!isAuthorized && profile?.id) {
      q = query(q, where('staffId', '==', profile.id));
    }

    const tSnap = await getDocs(q);
    const txs = tSnap.docs.map(d => ({ 
      id: d.id, 
      ...d.data(),
      timestamp: d.data().timestamp?.toDate() 
    } as Transaction)).sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    
    setTransactions(txs);

    const mSnap = await getDocs(collection(db, 'menus'));
    setMenus(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));

    const wSnap = await getDocs(collection(db, 'wards'));
    setWards(wSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const handleDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }

    try {
      setError(null);
      await deleteDoc(doc(db, 'transactions', id));
      setTransactions(prev => prev.filter(t => t.id !== id));
      setDeletingId(null);
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
      const menu = menus.find(m => m.id === editingTx.menuId);
      const scale = COMSTOCK_VALUES.find(v => v.scale === editingTx.comstockScale);
      
      if (!menu || !scale) return;

      const wasteWeight = menu.standardWeight * (scale.percentage / 100);
      const consumptionWeight = menu.standardWeight - wasteWeight;

      const txRef = doc(db, 'transactions', editingTx.id);
      await updateDoc(txRef, {
        patientName: editingTx.patientName,
        patientGender: editingTx.patientGender,
        wardId: editingTx.wardId,
        menuId: editingTx.menuId,
        comstockScale: editingTx.comstockScale,
        wasteWeight,
        consumptionWeight,
        reason: editingTx.reason || null
      });

      setEditingTx(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui data.');
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${editingTx.id}`);
    }
  };

  // Logical Helpers
  const avgWaste = transactions.length > 0 
    ? (transactions.reduce((acc, curr) => acc + curr.wasteWeight, 0) / transactions.reduce((acc, curr) => {
        const menu = menus.find(m => m.id === curr.menuId);
        return acc + (menu?.standardWeight || 0);
      }, 0)) * 100 
    : 0;

  const totalPatients = new Set(transactions.map(t => t.patientName)).size;

  // Chart Data: Waste by Day (Last 7 Days)
  const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), i);
    const dayTransactions = transactions.filter(t => 
      t.timestamp && format(t.timestamp, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
    
    const totalWaste = dayTransactions.reduce((acc, curr) => acc + curr.wasteWeight, 0);
    const totalServed = dayTransactions.reduce((acc, curr) => {
      const menu = menus.find(m => m.id === curr.menuId);
      return acc + (menu?.standardWeight || 0);
    }, 0);

    return {
      name: format(date, 'EEE'),
      percentage: totalServed > 0 ? (totalWaste / totalServed) * 100 : 0
    };
  }).reverse();

  // Chart Data: Waste by Meal Time
  const mealTimeData = ['B', 'L', 'D'].map(m => {
    const mtTransactions = transactions.filter(t => t.mealTime === m);
    const totalWaste = mtTransactions.reduce((acc, curr) => acc + curr.wasteWeight, 0);
    const totalServed = mtTransactions.reduce((acc, curr) => {
      const menu = menus.find(m => m.id === curr.menuId);
      return acc + (menu?.standardWeight || 0);
    }, 0);

    return {
      name: m === 'B' ? 'Breakfast' : m === 'L' ? 'Lunch' : 'Dinner',
      value: totalServed > 0 ? Number(((totalWaste / totalServed) * 100).toFixed(1)) : 0
    };
  });

  // Alarms: Menus with > 20% waste
  const menuWastes = menus.map(menu => {
    const menuTransactions = transactions.filter(t => t.menuId === menu.id);
    const totalWaste = menuTransactions.reduce((acc, curr) => acc + curr.wasteWeight, 0);
    const totalServed = menuTransactions.reduce((acc, curr) => acc + (menu.standardWeight || 0), 0);
    const wastePercent = totalServed > 0 ? (totalWaste / totalServed) * 100 : 0;
    return { ...menu, wastePercent };
  }).filter(m => m.wastePercent > 20);

  const COLORS = ['#10b981', '#34d399', '#6ee7b7'];

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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200">
        <div className="flex items-center gap-4">
          <Link to="/profile" className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-2xl border-4 border-white shadow-lg overflow-hidden group-hover:ring-4 group-hover:ring-emerald-50 transition-all">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.name.charAt(0)
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-600 text-white rounded-lg border-2 border-white">
              <User size={12} />
            </div>
          </Link>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Selamat Datang,</p>
            <h2 className="text-2xl font-black text-slate-900 leading-none">{profile?.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-black uppercase tracking-tighter">{profile?.role}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">NIP: {profile?.nip}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(), 'EEEE')}</p>
            <p className="text-sm font-black text-slate-900">{format(new Date(), 'dd MMMM yyyy')}</p>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden sm:block mx-2" />
          <Link to="/record" className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">
            <Utensils size={18} />
            Input Sisa Makan
          </Link>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Ringkasan</h2>
          <p className="text-slate-500">Analisis sisa makanan real-time dan KPI Rumah Sakit</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            <Filter size={16} /> Filter
          </button>
          <Link 
            to="/reports"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Download size={16} /> Ekspor Laporan
          </Link>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Rata-rata Waste" 
          value={`${avgWaste.toFixed(1)}%`} 
          subText="Target: < 20%" 
          icon={TrendingUp} 
          trend={avgWaste > 20 ? 'bad' : 'good'}
        />
        <StatCard 
          title="Total Rekam Data" 
          value={transactions.length} 
          subText="30 Hari Terakhir" 
          icon={Utensils} 
        />
        <StatCard 
          title="Pasien Terpantau" 
          value={totalPatients} 
          subText="Sensus Aktif" 
          icon={Users} 
        />
        <StatCard 
          title="Peringatan Kritis" 
          value={menuWastes.length} 
          subText="Jenis Diet Waste Tinggi" 
          icon={AlertTriangle} 
          trend={menuWastes.length > 0 ? 'bad' : 'neutral'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800 text-lg">Tren Persentase Waste</h3>
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

      {/* Additional Admin Stats for Today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
             <Clock className="text-emerald-600" size={20} />
             Ringkasan Hari Ini ({format(new Date(), 'dd MMM')})
           </h3>
           <div className="grid grid-cols-3 gap-4">
              {['B', 'L', 'D'].map(mt => {
                const todayTxs = transactions.filter(t => 
                  t.mealTime === mt && 
                  t.timestamp && 
                  format(t.timestamp, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                );
                
                const wasteTotal = todayTxs.reduce((acc, curr) => acc + curr.wasteWeight, 0);
                const servedTotal = todayTxs.reduce((acc, curr) => {
                  const menu = menus.find(m => m.id === curr.menuId);
                  return acc + (menu?.standardWeight || 0);
                }, 0);
                const mtPercent = servedTotal > 0 ? (wasteTotal / servedTotal) * 100 : 0;

                return (
                  <div key={mt} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {mt === 'B' ? 'PAGI' : mt === 'L' ? 'SIANG' : 'SORE'}
                    </p>
                    <p className={`text-2xl font-black ${mtPercent > 20 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {mtPercent.toFixed(0)}%
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{todayTxs.length} REKOR</p>
                  </div>
                );
              })}
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
             <Building2 className="text-emerald-600" size={20} />
             Waste Per Unit (7 Hari)
           </h3>
           <div className="space-y-3">
              {wards.slice(0, 3).map(w => {
                 const wardTxs = transactions.filter(t => t.wardId === w.id);
                 const wasteTotal = wardTxs.reduce((acc, curr) => acc + curr.wasteWeight, 0);
                 const servedTotal = wardTxs.reduce((acc, curr) => {
                    const menu = menus.find(m => m.id === curr.menuId);
                    return acc + (menu?.standardWeight || 0);
                 }, 0);
                 const percent = servedTotal > 0 ? (wasteTotal / servedTotal) * 100 : 0;

                 return (
                   <div key={w.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600">{w.name}</span>
                        <span className={percent > 20 ? 'text-red-500' : 'text-emerald-600'}>{percent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full ${percent > 20 ? 'bg-red-500' : 'bg-emerald-500'}`}
                           style={{ width: `${Math.min(percent, 100)}%` }}
                         />
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Alerts Section */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm border-t-4 border-t-red-500">
           <div className="flex items-center gap-3 mb-6">
             <AlertTriangle className="text-red-500" />
             <h3 className="font-bold text-slate-800 text-lg">Peringatan Waste {">"} 20%</h3>
           </div>
           
           <div className="space-y-4">
             {menuWastes.map(menu => (
               <div key={menu.id} className="flex items-center justify-between p-4 bg-red-50 rounded-2xl">
                 <div>
                   <p className="font-bold text-red-900">{menu.name}</p>
                   <p className="text-xs text-red-600 uppercase font-bold tracking-tight">{menu.dietType}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-xl font-black text-red-600">{menu.wastePercent.toFixed(1)}%</p>
                   <p className="text-[10px] font-bold text-red-400">SISA MAKANAN</p>
                 </div>
               </div>
             ))}
             {menuWastes.length === 0 && (
               <div className="text-center py-8 text-slate-400 italic">
                 Tidak ada jenis diet melebihi ambang batas. Kerja bagus!
               </div>
             )}
           </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-slate-800 text-lg">History Catatan Sisa Makan</h3>
               <button className="text-emerald-600 text-sm font-bold flex items-center gap-1">
                 Lihat Semua <ChevronRight size={16} />
               </button>
            </div>
            
            <div className="space-y-4">
              {transactions.slice(0, 10).map(t => {
                const menu = menus.find(m => m.id === t.menuId);
                const ward = wards.find(w => w.id === t.wardId);
                const isOwner = profile?.id === t.staffId;
                const isAdminEmail = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(profile?.email || '');
                const isAdmin = profile?.role === 'admin' || profile?.role === 'nutritionist' || isAdminEmail;
               return (
                 <div key={t.id} className="group flex items-center gap-4 p-4 border border-slate-50 rounded-2xl transition-colors hover:bg-slate-50">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold uppercase text-xs">
                      {t.mealTime}
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800 truncate">{t.patientName}</p>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-tight">{t.dietType || menu?.dietType || 'Biasa'}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {ward?.name} 
                        {t.roomNumber && ` • Kamar ${t.roomNumber}`}
                        {t.bedNumber && ` • Bed ${t.bedNumber}`}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1 truncate">
                        Menu: <span className="text-slate-400 italic">{menu?.name}</span>
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                       <div className="flex items-center gap-2">
                          {(isOwner || isAdmin) && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => setEditingTx(t)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(t.id)}
                                className={`p-1.5 rounded-lg transition-colors border ${
                                  deletingId === t.id 
                                  ? 'text-white bg-red-600 border-red-600' 
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-100'
                                }`}
                                title={deletingId === t.id ? "Klik lagi untuk hapus" : "Hapus"}
                              >
                                {deletingId === t.id ? <span className="text-[10px] font-black px-1">YAKIN?</span> : <Trash2 size={14} />}
                              </button>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="font-bold text-slate-900">{((t.wasteWeight / (menu?.standardWeight || 1)) * 100).toFixed(0)}%</p>
                            <p className="text-[10px] text-slate-300 font-bold uppercase">{format(t.timestamp || new Date(), 'dd/MM HH:mm')}</p>
                          </div>
                       </div>
                    </div>
                 </div>
               )
             })}
           </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTx(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900">Edit Rekam Data</h3>
                  <button 
                    onClick={() => setEditingTx(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">JK</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl h-[46px]">
                          {(['L', 'P'] as const).map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setEditingTx({...editingTx, patientGender: g})}
                              className={`flex-1 flex items-center justify-center text-[10px] font-black rounded-lg transition-all ${editingTx.patientGender === g ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                            >
                              {g === 'L' ? 'LAKI' : 'PEREMPUAN'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                         <label className="text-xs font-bold text-slate-400 uppercase">Unit/Ward</label>
                         <select 
                           value={editingTx.wardId}
                           onChange={e => setEditingTx({...editingTx, wardId: e.target.value})}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                           required
                         >
                           {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                         </select>
                      </div>
                    </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Menu Makanan</label>
                    <select 
                      value={editingTx.menuId}
                      onChange={e => setEditingTx({...editingTx, menuId: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                      required
                    >
                      {menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Skala Comstock (Sisa)</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                       {COMSTOCK_VALUES.map(v => (
                         <button
                           key={v.scale}
                           type="button"
                           onClick={() => setEditingTx({...editingTx, comstockScale: v.scale})}
                           className={`py-2 rounded-xl text-xs font-black transition-all border-2 ${
                             editingTx.comstockScale === v.scale 
                             ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' 
                             : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200'
                           }`}
                         >
                           {v.percentage}%
                         </button>
                       ))}
                    </div>
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
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Simpan Perubahan
                    </button>
                  </div>
                </form>
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
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-2xl text-slate-500">
          <Icon size={24} />
        </div>
        {trend && (
          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
            trend === 'good' ? 'bg-emerald-100 text-emerald-600' : 
            trend === 'bad' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
          }`}>
            {trend === 'good' ? 'Stable' : trend === 'bad' ? 'Warning' : 'Normal'}
          </span>
        )}
      </div>
      <h4 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">{title}</h4>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900">{value}</span>
      </div>
      <p className="text-xs text-slate-400 mt-2 font-medium">{subText}</p>
    </motion.div>
  );
}
