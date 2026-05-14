import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Menu, Ward } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, Utensils, AlertTriangle, Download, 
  Filter, Calendar, ChevronRight 
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const tSnap = await getDocs(query(collection(db, 'transactions'), orderBy('timestamp', 'desc')));
      const txs = tSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        timestamp: d.data().timestamp?.toDate() 
      } as Transaction));
      setTransactions(txs);

      const mSnap = await getDocs(collection(db, 'menus'));
      setMenus(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));

      const wSnap = await getDocs(collection(db, 'wards'));
      setWards(wSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
      
      setLoading(false);
    };
    fetchData();
  }, []);

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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Ringkasan</h2>
          <p className="text-slate-500">Analisis sisa makanan real-time dan KPI Rumah Sakit</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            <Filter size={16} /> Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
            <Download size={16} /> Ekspor Laporan
          </button>
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
          subText="Menu Waste Tinggi" 
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
                 Tidak ada menu melebihi ambang batas. Kerja bagus!
               </div>
             )}
           </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-6">
             <h3 className="font-bold text-slate-800 text-lg">Catatan Terakhir</h3>
             <button className="text-emerald-600 text-sm font-bold flex items-center gap-1">
               Lihat Semua <ChevronRight size={16} />
             </button>
           </div>
           
           <div className="space-y-4">
             {transactions.slice(0, 4).map(t => {
               const menu = menus.find(m => m.id === t.menuId);
               const ward = wards.find(w => w.id === t.wardId);
               return (
                 <div key={t.id} className="flex items-center gap-4 p-4 border border-slate-50 rounded-2xl transition-colors hover:bg-slate-50">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold uppercase text-xs">
                      {t.mealTime}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-slate-800 truncate">{t.patientName}</p>
                      <p className="text-xs text-slate-400">{ward?.name} • {menu?.name}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-slate-900">{((t.wasteWeight / (menu?.standardWeight || 1)) * 100).toFixed(0)}%</p>
                       <p className="text-[10px] text-slate-300 font-bold uppercase">{format(t.timestamp || new Date(), 'HH:mm')}</p>
                    </div>
                 </div>
               )
             })}
           </div>
        </div>
      </div>
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
