import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Menu, Ward } from '../types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { FileDown, Table as TableIcon, Calendar, Clock, User, HardDrive } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function Reports() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedMealTime, setSelectedMealTime] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const start = startOfMonth(parseISO(selectedMonth + '-01'));
      const end = endOfMonth(start);

      let q = query(
        collection(db, 'transactions'), 
        where('staffId', '==', profile?.id || ''),
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
      setLoading(false);
    };
    fetchData();
  }, [selectedMonth]);

  const filteredTransactions = transactions.filter(t => {
    const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
    const mealTimeMatch = selectedMealTime === 'all' || t.mealTime === selectedMealTime;
    return wardMatch && mealTimeMatch;
  });

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
        `${wastePercent}%`,
        t.reason || '-'
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Pasien', 'Unit', 'Kmr/Bed', 'Wkt', 'Waste %', 'Alasan']],
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
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <TableIcon size={16} className="text-emerald-600" />
          Filter Laporan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Berdasarkan Bangsal</label>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-sm"
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
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700 text-sm"
            >
              <option value="all">Semua Waktu Makan</option>
              <option value="sarapan">Sarapan</option>
              <option value="selingan_1">Selingan 1</option>
              <option value="makan_siang">Siang</option>
              <option value="selingan_2">Selingan 2</option>
              <option value="makan_malam">Malam</option>
            </select>
          </div>
        </div>
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
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right">Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
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
