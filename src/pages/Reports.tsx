import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Menu, Ward } from '../types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { FileDown, Table as TableIcon, Calendar, Clock, User, HardDrive, Utensils, BarChart2, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

interface BarChartItem {
  label: string;
  percentage: number;
  count: number;
}

function MiniBarChartCard({ title, data, maxItem, minItem, icon: Icon }: {
  title: string;
  data: BarChartItem[];
  maxItem: BarChartItem | null;
  minItem: BarChartItem | null;
  icon: any;
}) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/85 shadow-[0_10px_30px_-15px_rgba(148,163,184,0.12)] flex flex-col space-y-5 transition-all duration-300 hover:shadow-[0_20px_45px_-12px_rgba(148,163,184,0.18)] hover:border-slate-350">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-[#f0fdf4] text-emerald-600 rounded-2xl border border-emerald-100">
            <Icon size={16} />
          </div>
          <h4 className="font-display font-black text-slate-800 text-sm tracking-tight">{title}</h4>
        </div>
        <span className="text-[8px] font-black tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md uppercase font-display">Bar Chart</span>
      </div>

      <div className="flex-1 space-y-4 pt-1">
        {data.map((item) => {
          const isMax = maxItem && maxItem.label === item.label && item.percentage > 0;
          const isMin = minItem && minItem.label === item.label && item.percentage > 0 && item.percentage !== maxItem?.percentage;

          return (
            <div key={item.label} className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-slate-600 flex items-center gap-1.5 font-display">
                  {item.label}
                  <span className="text-[9px] text-slate-405 font-normal">({item.count}x)</span>
                  {isMax && (
                    <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[8px] font-black uppercase tracking-wider py-0.5 px-1.5 rounded-md">
                      Maks
                    </span>
                  )}
                  {isMin && (
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-[8px] font-black uppercase tracking-wider py-0.5 px-1.5 rounded-md">
                      Min
                    </span>
                  )}
                </span>
                <span className={`font-mono font-bold ${item.percentage > 20 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                    item.percentage > 20 ? 'from-rose-500 to-amber-500' : 'from-emerald-500 to-teal-500'
                  }`}
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-150 grid grid-cols-2 gap-3 text-[10px]">
        <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-100">
          <p className="font-extrabold text-rose-500/80 uppercase tracking-widest text-[8.5px] font-display">Sisa Tertinggi</p>
          <p className="font-display font-black text-rose-700 truncate mt-1">
            {maxItem && maxItem.percentage > 0 
              ? `${maxItem.label} (${maxItem.percentage.toFixed(1)}%)`
              : 'Tidak ada data'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-100">
          <p className="font-extrabold text-emerald-500/80 uppercase tracking-widest text-[8.5px] font-display">Sisa Terendah</p>
          <p className="font-display font-black text-emerald-700 truncate mt-1">
            {minItem && minItem.percentage > 0 
              ? `${minItem.label} (${minItem.percentage.toFixed(1)}%)`
              : 'Tidak ada data'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedMealTime, setSelectedMealTime] = useState<string>('all');
  const [selectedFoodType, setSelectedFoodType] = useState<string>('all');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('all');
  const [selectedCycleDay, setSelectedCycleDay] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(parseISO(selectedMonth + '-01'));
        const end = endOfMonth(start);

        const q = query(
          collection(db, 'transactions'), 
          where('timestamp', '>=', start),
          where('timestamp', '<=', end)
        );

        const tSnap = await getDocs(q);
        
        const txs = tSnap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          timestamp: d.data().timestamp?.toDate() 
        } as Transaction)).sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

        setTransactions(txs);

        const [mSnap, wSnap] = await Promise.all([
          getDocs(collection(db, 'menus')),
          getDocs(collection(db, 'wards'))
        ]);

        setMenus(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));
        setWards(wSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedMonth]);

  const filteredTransactions = transactions.filter(t => {
    const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
    const mealTimeMatch = selectedMealTime === 'all' || t.mealTime === selectedMealTime;
    const foodTypeMatch = selectedFoodType === 'all' || (t.foodType || 'Makanan Pokok') === selectedFoodType;
    
    let dayOfWeekNum = -1;
    if (t.timestamp) {
      dayOfWeekNum = t.timestamp.getDay();
    }
    const dayMap: Record<string, number> = {
      'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6
    };
    const dayOfWeekMatch = selectedDayOfWeek === 'all' || dayOfWeekNum === dayMap[selectedDayOfWeek.toLowerCase()];
    
    const menu = menus.find(m => m.id === t.menuId);
    const cycleDayMatch = selectedCycleDay === 'all' || (menu && String(menu.cycleDay) === selectedCycleDay);
    
    return wardMatch && mealTimeMatch && foodTypeMatch && dayOfWeekMatch && cycleDayMatch;
  });

  const foodTypes = [
    'Makanan Pokok',
    'Lauk Hewani',
    'Lauk Nabati',
    'Sayuran',
    'Buah / Selingan',
    'Semua (Komposit)'
  ];

  const wasteByFoodType = foodTypes.map(fType => {
    const matchingTxs = transactions.filter(t => {
      const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
      return wardMatch && (t.foodType || 'Makanan Pokok') === fType;
    });
    const totalWaste = matchingTxs.reduce((sum, t) => sum + t.wasteWeight, 0);
    const count = matchingTxs.length;
    const percentage = count > 0 ? (totalWaste / (count * 400)) * 100 : 0;
    return { label: fType, percentage, count };
  });

  const activeFoodTypes = wasteByFoodType.filter(item => item.count > 0);
  const maxFoodType = activeFoodTypes.length > 0 ? activeFoodTypes.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minFoodType = activeFoodTypes.length > 0 ? activeFoodTypes.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const mealTimesList = [
    { value: 'sarapan', label: 'Sarapan' },
    { value: 'selingan_1', label: 'Selingan 1' },
    { value: 'makan_siang', label: 'Siang' },
    { value: 'selingan_2', label: 'Selingan 2' },
    { value: 'makan_malam', label: 'Malam' }
  ];

  const wasteByMealTime = mealTimesList.map(mt => {
    const matchingTxs = transactions.filter(t => {
      const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
      return wardMatch && t.mealTime === mt.value;
    });
    const totalWaste = matchingTxs.reduce((sum, t) => sum + t.wasteWeight, 0);
    const count = matchingTxs.length;
    const percentage = count > 0 ? (totalWaste / (count * 400)) * 100 : 0;
    return { label: mt.label, percentage, count };
  });

  const activeMealTimes = wasteByMealTime.filter(item => item.count > 0);
  const maxMealTime = activeMealTimes.length > 0 ? activeMealTimes.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minMealTime = activeMealTimes.length > 0 ? activeMealTimes.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const daysOfWeek = [
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
    { value: 0, label: 'Minggu' }
  ];

  const wasteByDay = daysOfWeek.map(d => {
    const matchingTxs = transactions.filter(t => {
      const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
      const tDay = t.timestamp ? t.timestamp.getDay() : -1;
      return wardMatch && tDay === d.value;
    });
    const totalWaste = matchingTxs.reduce((sum, t) => sum + t.wasteWeight, 0);
    const count = matchingTxs.length;
    const percentage = count > 0 ? (totalWaste / (count * 400)) * 100 : 0;
    return { label: d.label, percentage, count };
  });

  const activeDays = wasteByDay.filter(item => item.count > 0);
  const maxDay = activeDays.length > 0 ? activeDays.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minDay = activeDays.length > 0 ? activeDays.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const cycleDays = Array.from({ length: 10 }, (_, i) => i + 1);

  const wasteByCycle = cycleDays.map(cd => {
    const matchingMenuIds = menus.filter(m => m.cycleDay === cd).map(m => m.id);
    const matchingTxs = transactions.filter(t => {
      const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
      return wardMatch && matchingMenuIds.includes(t.menuId);
    });
    const totalWaste = matchingTxs.reduce((sum, t) => sum + t.wasteWeight, 0);
    const count = matchingTxs.length;
    const percentage = count > 0 ? (totalWaste / (count * 400)) * 100 : 0;
    return { label: `Hari ${cd}`, percentage, count };
  });

  const activeCycles = wasteByCycle.filter(item => item.count > 0);
  const maxCycle = activeCycles.length > 0 ? activeCycles.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minCycle = activeCycles.length > 0 ? activeCycles.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const exportToExcel = () => {
    const data = filteredTransactions.map(t => {
      const menu = menus.find(m => m.id === t.menuId);
      const ward = wards.find(w => w.id === t.wardId);
      const wastePercent = ((t.wasteWeight / 400) * 100).toFixed(1);

      return {
        'Tanggal': format(t.timestamp || new Date(), 'dd/MM/yyyy'),
        'Waktu': format(t.timestamp || new Date(), 'HH:mm'),
        'Nama Pasien': t.patientName,
        'JK': t.patientGender || '-',
        'Umur': t.patientAge,
        'Unit/Bangsal': ward?.name || 'Unknown',
        'Kamar/Bed': `${t.roomNumber || '-'}/${t.bedNumber || '-'}`,
        'PJ Ruangan': t.staffInCharge || '-',
        'Jenis Diet': t.dietType || 'Biasa',
        'Menu': menu?.foodItems || 'Menu Siklus',
        'Waktu Makan': (t.mealTime || '').replace('_', ' ').toUpperCase(),
        'Jenis Makanan': t.foodType || 'Makanan Pokok',
        'Berat Sisa (g)': t.wasteWeight,
        'Berat Standar (g)': 400,
        'Persentase Waste (%)': wastePercent,
        'Alasan': t.reason || '-',
        'Petugas Entry': t.staffName || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Waste');
    XLSX.writeFile(wb, `Laporan_Nutriwaste_${selectedMonth}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const title = `Laporan Nutriwaste - ${selectedMonth}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    const tableData = filteredTransactions.map(t => {
      const ward = wards.find(w => w.id === t.wardId);
      const wastePercent = ((t.wasteWeight / 400) * 100).toFixed(0);

      return [
        format(t.timestamp || new Date(), 'dd/MM/yy'),
        `${t.patientName} (${t.patientGender || '-'})`,
        ward?.name || '-',
        `${t.roomNumber || '-'}/${t.bedNumber || '-'}`,
        (t.mealTime || '').replace('_', ' ').toUpperCase(),
        t.foodType || 'Makanan Pokok',
        `${wastePercent}%`,
        t.reason || '-'
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Pasien', 'Unit', 'Kmr/Bed', 'Wkt', 'Jenis', 'Waste %', 'Alasan']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] }, // emerald-600
      styles: { fontSize: 9 }
    });

    doc.save(`Laporan_Nutriwaste_${selectedMonth}.pdf`);
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Laporan Bulanan</h2>
          <p className="text-slate-500">Ekspor data sisa makanan ke format Excel</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200">
           <div className="flex items-center gap-2 px-3 text-slate-400">
             <Calendar size={18} />
             <span className="text-xs font-bold uppercase tracking-wider">Periode:</span>
           </div>
           <input 
             type="month" 
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
             className="bg-transparent text-sm font-bold text-slate-800 outline-none pr-4"
           />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <HardDrive size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Record</p>
            <p className="text-2xl font-black text-slate-900">{filteredTransactions.length}</p>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-3 items-center">
           <button 
             onClick={exportToExcel}
             disabled={filteredTransactions.length === 0}
             className="flex items-center justify-center gap-2 px-4 py-4 bg-white border border-emerald-200 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-50 transition-all shadow-lg shadow-emerald-100/50 disabled:opacity-50 disabled:shadow-none text-xs sm:text-base"
           >
             <FileDown size={18} />
             <span>Excel</span>
           </button>
           <button 
             onClick={exportToPDF}
             disabled={filteredTransactions.length === 0}
             className="flex items-center justify-center gap-2 px-4 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:shadow-none text-xs sm:text-base"
           >
             <FileDown size={18} />
             <span>PDF</span>
           </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <TableIcon size={16} className="text-emerald-600" />
          Filter Laporan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Berdasarkan Bangsal</label>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-xs sm:text-sm"
            >
              <option value="all">Semua Bangsal</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Waktu Makan</label>
            <select
              value={selectedMealTime}
              onChange={(e) => setSelectedMealTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-xs sm:text-sm"
            >
              <option value="all">Semua Waktu Makan</option>
              <option value="sarapan">Sarapan</option>
              <option value="selingan_1">Selingan 1</option>
              <option value="makan_siang">Siang</option>
              <option value="selingan_2">Selingan 2</option>
              <option value="makan_malam">Malam</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Jenis Makanan</label>
            <select
              value={selectedFoodType}
              onChange={(e) => setSelectedFoodType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-xs sm:text-sm"
            >
              <option value="all">Semua Jenis</option>
              {foodTypes.map(ft => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hari</label>
            <select
              value={selectedDayOfWeek}
              onChange={(e) => setSelectedDayOfWeek(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-xs sm:text-sm"
            >
              <option value="all">Semua Hari</option>
              <option value="Senin">Senin</option>
              <option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option>
              <option value="Kamis">Kamis</option>
              <option value="Jumat">Jumat</option>
              <option value="Sabtu">Sabtu</option>
              <option value="Minggu">Minggu</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hari Siklus</label>
            <select
              value={selectedCycleDay}
              onChange={(e) => setSelectedCycleDay(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-xs sm:text-sm"
            >
              <option value="all">Semua Siklus</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(day => (
                <option key={day} value={String(day)}>Hari Siklus {day}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Four Visual Bar Charts showing food waste percentage configurations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MiniBarChartCard 
          title="Waste per Jenis Makanan" 
          data={wasteByFoodType} 
          maxItem={maxFoodType} 
          minItem={minFoodType} 
          icon={Utensils} 
        />
        <MiniBarChartCard 
          title="Waste per Waktu Makan" 
          data={wasteByMealTime} 
          maxItem={maxMealTime} 
          minItem={minMealTime} 
          icon={Clock} 
        />
        <MiniBarChartCard 
          title="Waste per Hari" 
          data={wasteByDay} 
          maxItem={maxDay} 
          minItem={minDay} 
          icon={Calendar} 
        />
        <MiniBarChartCard 
          title="Waste per Hari Siklus" 
          data={wasteByCycle} 
          maxItem={maxCycle} 
          minItem={minCycle} 
          icon={Layers} 
        />
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             <TableIcon size={18} className="text-emerald-600" />
             Preview Data
           </h3>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             Tampilkan {filteredTransactions.length} record terfilter
           </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Pasien</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Unit</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Diet</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Waktu</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Jenis Makanan</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right">Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    Tidak ada data yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => {
                  const menu = menus.find(m => m.id === t.menuId);
                  const ward = wards.find(w => w.id === t.wardId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{t.patientName} ({t.patientGender || '-'})</p>
                          <p className="text-[10px] text-slate-400 font-medium">BED: {t.bedNumber || '-'}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{ward?.name}</td>
                        <td className="px-6 py-4">
                           <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">{t.dietType || 'Biasa'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold text-[11px]">
                            <Clock size={12} />
                            {(t.mealTime || '').replace('_', ' ')} • {format(t.timestamp || new Date(), 'dd/LL')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded uppercase whitespace-nowrap">{t.foodType || 'Makanan Pokok'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className={`font-black ${((t.wasteWeight / 400) * 100) > 20 ? 'text-red-500' : 'text-emerald-600'}`}>
                             {((t.wasteWeight / 400) * 100).toFixed(0)}%
                           </span>
                        </td>
                      </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
