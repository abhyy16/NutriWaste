import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Menu, Ward, COMSTOCK_VALUES, MealTime } from '../types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { FileDown, Table as TableIcon, Calendar, Clock, User, HardDrive, Utensils, BarChart2, Layers, Search, X, Info, FileText, Activity, ShieldCheck, ChevronDown, ChevronUp, Pencil, Edit3, Save, CheckCircle2, Trash2, AlertTriangle, Eye, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { calculateCumulativeWasteFromRecaps, calculateCumulativeWasteFromTransactions } from '../lib/recap';

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
          const isMax = maxItem && maxItem.label === item.label && item.count > 0;
          const isMin = minItem && minItem.label === item.label && item.count > 0 && (maxItem ? maxItem.label !== minItem.label : true);

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
                <span className={`font-mono font-bold ${item.percentage > 25 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                    item.percentage > 25 ? 'from-rose-500 to-amber-500' : 'from-emerald-500 to-teal-500'
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
            {maxItem && maxItem.count > 0 
              ? `${maxItem.label} (${maxItem.percentage.toFixed(1)}%)`
              : 'Tidak ada data'}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-100">
          <p className="font-extrabold text-emerald-500/80 uppercase tracking-widest text-[8.5px] font-display">Sisa Terendah</p>
          <p className="font-display font-black text-emerald-700 truncate mt-1">
            {minItem && minItem.count > 0 
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Tab & Patient Editing States
  const [viewTab, setViewTab] = useState<'rekap_pasien' | 'record_detail'>('rekap_pasien');
  const [editingPatient, setEditingPatient] = useState<{
    patientKey: string;
    medicalRecordNumber: string;
    patientName: string;
    patientGender: string;
    patientAge: number;
    wardName: string;
    roomNumber: string;
    dietType: string;
  } | null>(null);
  const [savingPatient, setSavingPatient] = useState(false);
  const [editingSingleTx, setEditingSingleTx] = useState<Transaction | null>(null);
  const [savingSingleTx, setSavingSingleTx] = useState(false);

  // Preview Modals State
  const [previewPdfModal, setPreviewPdfModal] = useState<{
    isOpen: boolean;
    title: string;
    blobUrl: string;
    filename: string;
    doc: jsPDF | null;
  }>({
    isOpen: false,
    title: '',
    blobUrl: '',
    filename: '',
    doc: null
  });

  const [previewExcelModal, setPreviewExcelModal] = useState<{
    isOpen: boolean;
    title: string;
    filename: string;
    headers: string[];
    rows: (string | number)[][];
    sheetName: string;
    wb: XLSX.WorkBook | null;
  }>({
    isOpen: false,
    title: '',
    filename: '',
    headers: [],
    rows: [],
    sheetName: '',
    wb: null
  });

  const openPdfPreview = (doc: jsPDF, filename: string, title: string) => {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    setPreviewPdfModal({
      isOpen: true,
      title,
      blobUrl,
      filename,
      doc
    });
  };

  const openExcelPreview = (data: Record<string, any>[], filename: string, sheetName: string, title: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data.map(item => headers.map(h => item[h]));

    setPreviewExcelModal({
      isOpen: true,
      title,
      filename,
      headers,
      rows,
      sheetName,
      wb
    });
  };

  const exportPatientToExcel = (patientName: string) => {
    const pTxs = transactions.filter(t => t.patientName.toLowerCase() === patientName.toLowerCase());
    const data = pTxs.map(t => {
      const menu = menus.find(m => m.id === t.menuId);
      const ward = wards.find(w => w.id === t.wardId);
      const stdW = (t.wasteWeight + t.consumptionWeight) || 400;
      const wastePercent = ((t.wasteWeight / stdW) * 100).toFixed(1);

      return {
        'Tanggal': format(t.timestamp || new Date(), 'dd/MM/yyyy'),
        'Waktu': format(t.timestamp || new Date(), 'HH:mm'),
        'Nama Pasien': t.patientName,
        'JK': t.patientGender || '-',
        'Umur': t.patientAge,
        'Unit/Bangsal': ward?.name || 'Unknown',
        'No. Kamar': t.roomNumber || '-',
        'PJ Ruangan': t.staffInCharge || '-',
        'Jenis Diet': t.dietType || 'Biasa',
        'Menu': menu?.foodItems || 'Menu Siklus',
        'Waktu Makan': (t.mealTime || '').replace('_', ' ').toUpperCase(),
        'Jenis Makanan': t.foodType || 'Makanan Pokok',
        'Berat Sisa (g)': t.wasteWeight,
        'Berat Standar (g)': stdW,
        'Persentase Waste (%)': wastePercent,
        'Alasan': t.reason || '-',
        'Petugas Entry': t.staffName || '-'
      };
    });

    const filename = `Sisa_Makan_${patientName.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`;
    openExcelPreview(data, filename, 'Riwayat Sisa Makan', `Riwayat Sisa Makan Pasien: ${patientName}`);
  };

  const exportPatientToPDF = (patientName: string) => {
    const pTxs = transactions.filter(t => t.patientName.toLowerCase() === patientName.toLowerCase());
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text(`Riwayat Sisa Makan: ${patientName}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    const tableData = pTxs.map(t => {
      const ward = wards.find(w => w.id === t.wardId);
      const stdW = (t.wasteWeight + t.consumptionWeight) || 400;
      const wastePercent = ((t.wasteWeight / stdW) * 100).toFixed(0);

      return [
        format(t.timestamp || new Date(), 'dd/MM/yy HH:mm'),
        ward?.name || '-',
        t.roomNumber || '-',
        (t.mealTime || '').replace('_', ' ').toUpperCase(),
        t.foodType || 'Makanan Pokok',
        `${t.wasteWeight}g / ${stdW}g`,
        `${wastePercent}%`,
        t.reason || '-'
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Tanggal & Waktu', 'Unit', 'Kmr/Bed', 'Waktu Makan', 'Jenis', 'Gramasi Sisa', 'Waste %', 'Alasan']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] }, // emerald-600
      styles: { fontSize: 9 }
    });

    const filename = `Riwayat_Sisa_Makan_${patientName.replace(/\s+/g, '_')}_${selectedMonth}.pdf`;
    openPdfPreview(doc, filename, `Riwayat Sisa Makan Pasien: ${patientName}`);
  };

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
    if (t.foodType === 'Semua (Komposit)') return false;
    const nameMatch = searchQuery === '' || (t.patientName || '').toLowerCase().includes(searchQuery.toLowerCase());
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
    
    return nameMatch && wardMatch && mealTimeMatch && foodTypeMatch && dayOfWeekMatch && cycleDayMatch;
  });

  // Calculate Recapitulation Per Patient
  const patientRecapMap = new Map<string, {
    patientKey: string;
    medicalRecordNumber: string;
    patientName: string;
    patientGender: string;
    patientAge: number;
    wardName: string;
    roomNumber: string;
    dietType: string;
    totalAssessments: number;
    totalComstockScore: number;
    totalComstockMax: number;
    totalWasteWeight: number;
    totalServedWeight: number;
    pagiScore: number;
    pagiMax: number;
    pagiWasteWeight: number;
    pagiServedWeight: number;
    pagiCount: number;
    siangScore: number;
    siangMax: number;
    siangWasteWeight: number;
    siangServedWeight: number;
    siangCount: number;
    malamScore: number;
    malamMax: number;
    malamWasteWeight: number;
    malamServedWeight: number;
    malamCount: number;
    sampleTx: Transaction;
  }>();

  filteredTransactions.forEach(t => {
    const key = (t.medicalRecordNumber || t.patientName || 'Unknown').trim().toLowerCase();
    const existing = patientRecapMap.get(key);
    const stdW = (t.wasteWeight + t.consumptionWeight) || 400;
    const cScale = t.comstockScale !== undefined && t.comstockScale !== null ? t.comstockScale : 0;

    const mt = (t.mealTime || '').toLowerCase();
    const isPagi = mt.includes('pagi') || mt.includes('sarapan');
    const isMalam = mt.includes('malam');

    if (!existing) {
      patientRecapMap.set(key, {
        patientKey: key,
        medicalRecordNumber: t.medicalRecordNumber || '-',
        patientName: t.patientName,
        patientGender: t.patientGender || 'L',
        patientAge: t.patientAge || 0,
        wardName: t.wardName || wards.find(w => w.id === t.wardId)?.name || 'Ruang Rawat',
        roomNumber: t.roomNumber || '-',
        dietType: t.dietType || 'Biasa',
        totalAssessments: 1,
        totalComstockScore: cScale,
        totalComstockMax: 5,
        totalWasteWeight: t.wasteWeight,
        totalServedWeight: stdW,
        pagiScore: isPagi ? cScale : 0,
        pagiMax: isPagi ? 5 : 0,
        pagiWasteWeight: isPagi ? t.wasteWeight : 0,
        pagiServedWeight: isPagi ? stdW : 0,
        pagiCount: isPagi ? 1 : 0,
        siangScore: (!isPagi && !isMalam) ? cScale : 0,
        siangMax: (!isPagi && !isMalam) ? 5 : 0,
        siangWasteWeight: (!isPagi && !isMalam) ? t.wasteWeight : 0,
        siangServedWeight: (!isPagi && !isMalam) ? stdW : 0,
        siangCount: (!isPagi && !isMalam) ? 1 : 0,
        malamScore: isMalam ? cScale : 0,
        malamMax: isMalam ? 5 : 0,
        malamWasteWeight: isMalam ? t.wasteWeight : 0,
        malamServedWeight: isMalam ? stdW : 0,
        malamCount: isMalam ? 1 : 0,
        sampleTx: t
      });
    } else {
      existing.totalAssessments += 1;
      existing.totalComstockScore += cScale;
      existing.totalComstockMax += 5;
      existing.totalWasteWeight += t.wasteWeight;
      existing.totalServedWeight += stdW;

      if (isPagi) {
        existing.pagiScore += cScale;
        existing.pagiMax += 5;
        existing.pagiWasteWeight += t.wasteWeight;
        existing.pagiServedWeight += stdW;
        existing.pagiCount += 1;
      } else if (isMalam) {
        existing.malamScore += cScale;
        existing.malamMax += 5;
        existing.malamWasteWeight += t.wasteWeight;
        existing.malamServedWeight += stdW;
        existing.malamCount += 1;
      } else {
        existing.siangScore += cScale;
        existing.siangMax += 5;
        existing.siangWasteWeight += t.wasteWeight;
        existing.siangServedWeight += stdW;
        existing.siangCount += 1;
      }
    }
  });

  const patientRecaps = Array.from(patientRecapMap.values()).map(pr => {
    // Formula: (Total Comstock Score / [Total Items Evaluated * 5]) * 100%
    const wastePercentage = pr.totalComstockMax > 0
      ? (pr.totalComstockScore / pr.totalComstockMax) * 100
      : (pr.totalServedWeight > 0 ? (pr.totalWasteWeight / pr.totalServedWeight) * 100 : 0);

    const pagiPercent = pr.pagiCount > 0
      ? (pr.pagiMax > 0 ? (pr.pagiScore / pr.pagiMax) * 100 : (pr.pagiServedWeight > 0 ? (pr.pagiWasteWeight / pr.pagiServedWeight) * 100 : 0))
      : null;

    const siangPercent = pr.siangCount > 0
      ? (pr.siangMax > 0 ? (pr.siangScore / pr.siangMax) * 100 : (pr.siangServedWeight > 0 ? (pr.siangWasteWeight / pr.siangServedWeight) * 100 : 0))
      : null;

    const malamPercent = pr.malamCount > 0
      ? (pr.malamMax > 0 ? (pr.malamScore / pr.malamMax) * 100 : (pr.malamServedWeight > 0 ? (pr.malamWasteWeight / pr.malamServedWeight) * 100 : 0))
      : null;

    return {
      ...pr,
      wastePercentage,
      pagiPercent,
      siangPercent,
      malamPercent
    };
  });

  const { overallWastePercentage, totalCumulativeWaste, totalPatients } = calculateCumulativeWasteFromRecaps(patientRecaps);

  const handleSavePatientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    setSavingPatient(true);
    try {
      const matchingTxs = transactions.filter(t => 
        (t.medicalRecordNumber || t.patientName || '').trim().toLowerCase() === editingPatient.patientKey ||
        t.patientName.toLowerCase() === editingPatient.patientName.toLowerCase()
      );

      const promises = matchingTxs.map(t => {
        const txRef = doc(db, 'transactions', t.id);
        return updateDoc(txRef, {
          medicalRecordNumber: editingPatient.medicalRecordNumber || null,
          patientName: editingPatient.patientName,
          patientGender: editingPatient.patientGender,
          patientAge: Number(editingPatient.patientAge) || 0,
          wardName: editingPatient.wardName,
          roomNumber: editingPatient.roomNumber || null,
          dietType: editingPatient.dietType || 'Biasa'
        });
      });

      await Promise.all(promises);

      setTransactions(prev => prev.map(t => {
        const isMatch = (t.medicalRecordNumber || t.patientName || '').trim().toLowerCase() === editingPatient.patientKey ||
          t.patientName.toLowerCase() === editingPatient.patientName.toLowerCase();
        
        if (!isMatch) return t;
        return {
          ...t,
          medicalRecordNumber: editingPatient.medicalRecordNumber,
          patientName: editingPatient.patientName,
          patientGender: (editingPatient.patientGender as 'L' | 'P') || 'L',
          patientAge: Number(editingPatient.patientAge),
          wardName: editingPatient.wardName,
          roomNumber: editingPatient.roomNumber,
          dietType: editingPatient.dietType
        };
      }));

      setEditingPatient(null);
    } catch (err) {
      console.error("Gagal memperbarui data pasien:", err);
    } finally {
      setSavingPatient(false);
    }
  };

  const handleSaveSingleTxEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSingleTx) return;

    setSavingSingleTx(true);
    try {
      const scaleObj = COMSTOCK_VALUES.find(v => v.scale === editingSingleTx.comstockScale);
      const stdW = (editingSingleTx.wasteWeight + editingSingleTx.consumptionWeight) || 400;
      const wasteWeight = scaleObj ? (stdW * (scaleObj.percentage / 100)) : editingSingleTx.wasteWeight;
      const consumptionWeight = stdW - wasteWeight;

      const txRef = doc(db, 'transactions', editingSingleTx.id);
      await updateDoc(txRef, {
        medicalRecordNumber: editingSingleTx.medicalRecordNumber || null,
        patientName: editingSingleTx.patientName,
        patientGender: editingSingleTx.patientGender || 'L',
        patientAge: Number(editingSingleTx.patientAge) || 0,
        wardName: editingSingleTx.wardName || 'Rawat Inap',
        roomNumber: editingSingleTx.roomNumber || null,
        dietType: editingSingleTx.dietType || 'Biasa',
        mealTime: editingSingleTx.mealTime || 'makan_siang',
        foodType: editingSingleTx.foodType || 'Makanan Pokok',
        comstockScale: editingSingleTx.comstockScale,
        wasteWeight,
        consumptionWeight,
        reason: editingSingleTx.reason || null
      });

      setTransactions(prev => prev.map(t => t.id === editingSingleTx.id ? {
        ...editingSingleTx,
        wasteWeight,
        consumptionWeight
      } : t));

      setEditingSingleTx(null);
    } catch (err) {
      console.error("Gagal memperbarui catatan transaksi:", err);
    } finally {
      setSavingSingleTx(false);
    }
  };

  const handleDeletePatient = async (patientKey: string, patientName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus SELURUH catatan transaksi sisa makanan untuk pasien "${patientName}"?`)) return;
    try {
      setLoading(true);
      const matchingTxs = transactions.filter(t => 
        (t.medicalRecordNumber || t.patientName || '').trim().toLowerCase() === patientKey ||
        t.patientName.toLowerCase() === patientName.toLowerCase()
      );

      const promises = matchingTxs.map(t => deleteDoc(doc(db, 'transactions', t.id)));
      await Promise.all(promises);

      setTransactions(prev => prev.filter(t => 
        (t.medicalRecordNumber || t.patientName || '').trim().toLowerCase() !== patientKey &&
        t.patientName.toLowerCase() !== patientName.toLowerCase()
      ));
    } catch (err) {
      console.error("Gagal menghapus data pasien:", err);
      alert("Gagal menghapus data pasien");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingleTx = async (txId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan sisa makanan ini?")) return;
    try {
      await deleteDoc(doc(db, 'transactions', txId));
      setTransactions(prev => prev.filter(t => t.id !== txId));
    } catch (err) {
      console.error("Gagal menghapus transaksi:", err);
      alert("Gagal menghapus transaksi");
    }
  };

  const handleClearAllTransactions = async () => {
    if (!window.confirm("PERINGATAN KRITIS: Apakah Anda yakin ingin MENGHAPUS SELURUH DATA TRANSAKSI SISA MAKANAN di database? Angka laporan akan kembali menjadi 0 secara penuh.")) return;
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'transactions'));
      const promises = snap.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)));
      await Promise.all(promises);
      setTransactions([]);
      alert("Seluruh data transaksi berhasil dihapus. Database sekarang bernilai 0.");
    } catch (err) {
      console.error("Gagal menghapus semua data:", err);
      alert("Gagal menghapus semua data.");
    } finally {
      setLoading(false);
    }
  };

  const formatIndonesianMonth = (monthStr: string) => {
    if (!monthStr) return '-';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const year = parts[0];
    const month = parts[1];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const idx = parseInt(month, 10) - 1;
    return `${monthNames[idx] || month} ${year}`;
  };

  const exportPatientRecapToExcel = () => {
    const data = patientRecaps.map(pr => ({
      'No. Rekam Medis': pr.medicalRecordNumber,
      'Nama Pasien': pr.patientName,
      'JK': pr.patientGender,
      'Umur': pr.patientAge,
      'Ruang Rawat / Unit': pr.wardName,
      'No. Kamar': pr.roomNumber,
      'Jenis Diet': pr.dietType,
      'Jumlah Asesmen': pr.totalAssessments,
      'Sisa Pagi (%)': pr.pagiPercent !== null ? pr.pagiPercent.toFixed(1) + '%' : '-',
      'Sisa Siang (%)': pr.siangPercent !== null ? pr.siangPercent.toFixed(1) + '%' : '-',
      'Sisa Malam (%)': pr.malamPercent !== null ? pr.malamPercent.toFixed(1) + '%' : '-',
      'Rata-rata Total (%)': pr.wastePercentage.toFixed(1) + '%',
      'Sisa <= 25%': pr.wastePercentage <= 25 ? 'Ya' : 'Tidak',
      'Status Efisiensi': pr.wastePercentage <= 25 ? 'Sesuai Standar (<=25%)' : 'Sisa Tinggi (>25%)'
    }));

    if (patientRecaps.length > 0) {
      data.push({
        'No. Rekam Medis': 'REKAPITULASI',
        'Nama Pasien': `RATA-RATA KUMULATIF (${totalPatients} PASIEN)`,
        'JK': '-',
        'Umur': 0,
        'Ruang Rawat / Unit': '-',
        'No. Kamar': '-',
        'Jenis Diet': '-',
        'Jumlah Asesmen': totalPatients,
        'Sisa Pagi (%)': '-',
        'Sisa Siang (%)': '-',
        'Sisa Malam (%)': '-',
        'Rata-rata Total (%)': `${overallWastePercentage.toFixed(1)}%`,
        'Sisa <= 25%': overallWastePercentage <= 25 ? 'Ya' : 'Tidak',
        'Status Efisiensi': overallWastePercentage <= 25 ? 'Sesuai Standar (<=25%)' : 'Sisa Tinggi (>25%)'
      });
    }

    const filename = `Rekapitulasi_Sisa_Makan_Pasien_${selectedMonth}.xlsx`;
    openExcelPreview(data, filename, 'Rekapitulasi Pasien', 'Rekapitulasi Sisa Makanan Pasien');
  };

  const exportPatientRecapToPDF = () => {
    const doc = new jsPDF('landscape');
    const monthYearFormatted = formatIndonesianMonth(selectedMonth);
    const printedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REKAPITULASI SISA MAKANAN PASIEN', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bulan / Tahun : ${monthYearFormatted}`, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${printedAt} WITA`, 220, 22);

    const efficientCount = patientRecaps.filter(p => p.wastePercentage <= 25).length;
    const highWasteCount = patientRecaps.filter(p => p.wastePercentage > 25).length;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`Rata-rata Rekapitulasi Kumulatif: ${overallWastePercentage.toFixed(1)}% (Total Kumulatif / ${totalPatients} Pasien)`, 14, 28);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Pasien Ter-observasi: ${patientRecaps.length} Pasien | Sisa <= 25%: ${efficientCount} | Sisa > 25%: ${highWasteCount}`, 14, 32);

    const recapTableData: any[] = patientRecaps.map((pr, index) => [
      index + 1,
      pr.medicalRecordNumber,
      `${pr.patientName} (${pr.patientGender})`,
      pr.wardName,
      pr.roomNumber,
      pr.dietType,
      pr.pagiPercent !== null ? `${pr.pagiPercent.toFixed(1)}%` : '-',
      pr.siangPercent !== null ? `${pr.siangPercent.toFixed(1)}%` : '-',
      pr.malamPercent !== null ? `${pr.malamPercent.toFixed(1)}%` : '-',
      `${pr.wastePercentage.toFixed(1)}%`,
      pr.wastePercentage <= 25 ? 'Ya' : 'Tidak',
      pr.wastePercentage <= 25 ? 'Sesuai Standar (<=25%)' : 'Sisa Tinggi (>25%)'
    ]);

    if (patientRecaps.length > 0) {
      recapTableData.push([
        '',
        'REKAPITULASI',
        `RATA-RATA KUMULATIF (${totalPatients} PASIEN)`,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        `${overallWastePercentage.toFixed(1)}%`,
        overallWastePercentage <= 25 ? 'Ya' : 'Tidak',
        overallWastePercentage <= 25 ? 'Sesuai Standar (<=25%)' : 'Sisa Tinggi (>25%)'
      ]);
    }

    autoTable(doc, {
      startY: 36,
      head: [
        [
          'No.',
          'No. RM',
          'Nama Pasien',
          'Ruang Rawat',
          'No. Kamar',
          'Jenis Diet',
          'Sisa Pagi',
          'Sisa Siang',
          'Sisa Malam',
          'Rata-rata Total',
          'Sisa <= 25%',
          'Status Efisiensi'
        ]
      ],
      body: recapTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: 255,
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { cellWidth: 38 },
        3: { cellWidth: 28 },
        4: { halign: 'center', cellWidth: 18 },
        5: { cellWidth: 22 },
        6: { halign: 'center', cellWidth: 20 },
        7: { halign: 'center', cellWidth: 20 },
        8: { halign: 'center', cellWidth: 20 },
        9: { halign: 'center', cellWidth: 22 },
        10: { halign: 'center', cellWidth: 18 },
        11: { halign: 'center', cellWidth: 32 }
      }
    });

    const filename = `Rekapitulasi_Sisa_Makan_Pasien_${selectedMonth}.pdf`;
    openPdfPreview(doc, filename, 'Rekapitulasi Sisa Makanan Pasien');
  };

  const foodTypes = [
    'Makanan Pokok',
    'Lauk Hewani',
    'Lauk Nabati',
    'Sayuran',
    'Buah'
  ];

  // Helper to filter transactions for specific charts with partial filter exclusion
  const getFilteredForChart = (excludeFilter: 'foodType' | 'mealTime' | 'dayOfWeek' | 'cycleDay') => {
    return transactions.filter(t => {
      if (t.foodType === 'Semua (Komposit)') return false;
      const wardMatch = selectedWard === 'all' || t.wardId === selectedWard;
      
      const mealTimeMatch = excludeFilter === 'mealTime' || selectedMealTime === 'all' || t.mealTime === selectedMealTime;
      
      const foodTypeMatch = excludeFilter === 'foodType' || selectedFoodType === 'all' || (t.foodType || 'Makanan Pokok') === selectedFoodType;
      
      let dayOfWeekNum = -1;
      if (t.timestamp) {
        dayOfWeekNum = t.timestamp.getDay();
      }
      const dayMap: Record<string, number> = {
        'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6
      };
      const dayOfWeekMatch = excludeFilter === 'dayOfWeek' || selectedDayOfWeek === 'all' || dayOfWeekNum === dayMap[selectedDayOfWeek.toLowerCase()];
      
      const menu = menus.find(m => m.id === t.menuId);
      const cycleDayMatch = excludeFilter === 'cycleDay' || selectedCycleDay === 'all' || (menu && String(menu.cycleDay) === selectedCycleDay);
      
      return wardMatch && mealTimeMatch && foodTypeMatch && dayOfWeekMatch && cycleDayMatch;
    });
  };

  const wasteByFoodType = foodTypes.map(fType => {
    const matchingTxs = getFilteredForChart('foodType').filter(t => (t.foodType || 'Makanan Pokok') === fType);
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(matchingTxs);
    return { label: fType, percentage: Math.min(overallWastePercentage, 100), count: matchingTxs.length };
  });

  const activeFoodTypes = wasteByFoodType.filter(item => item.count > 0);
  const maxFoodType = activeFoodTypes.length > 0 ? activeFoodTypes.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minFoodType = activeFoodTypes.length > 0 ? activeFoodTypes.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const mealTimesList = [
    { value: 'sarapan', label: 'Sarapan' },
    { value: 'makan_siang', label: 'Siang' },
    { value: 'makan_malam', label: 'Malam' }
  ];

  const wasteByMealTime = mealTimesList.map(mt => {
    const matchingTxs = getFilteredForChart('mealTime').filter(t => t.mealTime === mt.value);
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(matchingTxs);
    return { label: mt.label, percentage: Math.min(overallWastePercentage, 100), count: matchingTxs.length };
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
    const matchingTxs = getFilteredForChart('dayOfWeek').filter(t => {
      const tDay = t.timestamp ? t.timestamp.getDay() : -1;
      return tDay === d.value;
    });
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(matchingTxs);
    return { label: d.label, percentage: Math.min(overallWastePercentage, 100), count: matchingTxs.length };
  });

  const activeDays = wasteByDay.filter(item => item.count > 0);
  const maxDay = activeDays.length > 0 ? activeDays.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minDay = activeDays.length > 0 ? activeDays.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const cycleDays = Array.from({ length: 10 }, (_, i) => i + 1);

  const wasteByCycle = cycleDays.map(cd => {
    const matchingMenuIds = menus.filter(m => m.cycleDay === cd).map(m => m.id);
    const matchingTxs = getFilteredForChart('cycleDay').filter(t => matchingMenuIds.includes(t.menuId));
    const { overallWastePercentage } = calculateCumulativeWasteFromTransactions(matchingTxs);
    return { label: `Hari ${cd}`, percentage: Math.min(overallWastePercentage, 100), count: matchingTxs.length };
  });

  const activeCycles = wasteByCycle.filter(item => item.count > 0);
  const maxCycle = activeCycles.length > 0 ? activeCycles.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current) : null;
  const minCycle = activeCycles.length > 0 ? activeCycles.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current) : null;

  const exportToExcel = () => {
    const data = filteredTransactions.map(t => {
      const menu = menus.find(m => m.id === t.menuId);
      const ward = wards.find(w => w.id === t.wardId);
      const stdWeight = t.wasteWeight + t.consumptionWeight;
      const wastePercent = stdWeight > 0 ? ((t.wasteWeight / stdWeight) * 100).toFixed(1) : '0';

      return {
        'Tanggal': format(t.timestamp || new Date(), 'dd/MM/yyyy'),
        'Waktu': format(t.timestamp || new Date(), 'HH:mm'),
        'Nama Pasien': t.patientName,
        'JK': t.patientGender || '-',
        'Umur': t.patientAge,
        'Unit/Bangsal': ward?.name || 'Unknown',
        'No. Kamar': t.roomNumber || '-',
        'PJ Ruangan': t.staffInCharge || '-',
        'Jenis Diet': t.dietType || 'Biasa',
        'Menu': menu?.foodItems || 'Menu Siklus',
        'Waktu Makan': (t.mealTime || '').replace('_', ' ').toUpperCase(),
        'Jenis Makanan': t.foodType || 'Makanan Pokok',
        'Berat Sisa (g)': t.wasteWeight,
        'Berat Standar (g)': stdWeight || 400,
        'Persentase Waste (%)': wastePercent,
        'Alasan': t.reason || '-',
        'Petugas Entry': t.staffName || '-'
      };
    });

    const filename = `Laporan_Nutriwaste_${selectedMonth}.xlsx`;
    openExcelPreview(data, filename, 'Laporan Waste', 'Laporan Observasi Sisa Makanan Pasien');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const monthYearFormatted = formatIndonesianMonth(selectedMonth);
    const printedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    // Title Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN OBSERVASI SISA MAKANAN PASIEN', 14, 15);

    // Subheader Bulan / Tahun (Sesuai format formulir resmi)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bulan / Tahun : ${monthYearFormatted}`, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${printedAt} WITA`, 220, 22);

    // Tabel 1: Log Observasi Data Sisa Makanan (11 Kolom sesuai gambar)
    const tableData = filteredTransactions.map((t, index) => {
      const ward = wards.find(w => w.id === t.wardId);
      
      let wastePercentNum = 0;
      if (t.comstockScale !== undefined && t.comstockScale !== null) {
        wastePercentNum = (t.comstockScale / 5) * 100;
      } else {
        const stdWeight = (t.wasteWeight + t.consumptionWeight) || 400;
        wastePercentNum = stdWeight > 0 ? (t.wasteWeight / stdWeight) * 100 : 0;
      }

      const isLE25 = wastePercentNum <= 25;
      const methodStr = (t.comstockScale !== undefined && t.comstockScale !== null) ? 'Comstock' : 'Timbang';

      return [
        index + 1,
        format(t.timestamp || new Date(), 'dd/MM/yyyy'),
        `${t.patientName} (${t.patientGender || '-'})`,
        t.medicalRecordNumber || '-',
        t.wardName || ward?.name || 'Rawat Inap',
        t.dietType || 'Biasa',
        methodStr,
        `${wastePercentNum.toFixed(1)}%`,
        isLE25 ? 'v' : '',
        !isLE25 ? 'v' : '',
        t.reason || '-',
        t.staffName || t.staffInCharge || 'Ahli Gizi'
      ];
    });

    autoTable(doc, {
      startY: 26,
      head: [
        [
          { content: 'No.', rowSpan: 2 },
          { content: 'Tanggal Observasi', rowSpan: 2 },
          { content: 'Nama Pasien', rowSpan: 2 },
          { content: 'No. RM', rowSpan: 2 },
          { content: 'Ruang Rawat', rowSpan: 2 },
          { content: 'Jenis Diet', rowSpan: 2 },
          { content: 'Metode Pengukuran\n(Comstock/Timbang)', rowSpan: 2 },
          { content: 'Estimasi Sisa\nMakanan (%)', rowSpan: 2 },
          { content: 'Sisa <= 25%', colSpan: 2, styles: { halign: 'center' } },
          { content: 'Alasan Tidak Habis', rowSpan: 2 },
          { content: 'Nama Ahli Gizi', rowSpan: 2 }
        ],
        [
          { content: 'Ya', styles: { halign: 'center' } },
          { content: 'Tidak', styles: { halign: 'center' } }
        ]
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        overflow: 'linebreak',
        lineWidth: 0.1,
        lineColor: [220, 220, 220]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { cellWidth: 32 },
        3: { halign: 'center', cellWidth: 20 },
        4: { cellWidth: 24 },
        5: { cellWidth: 20 },
        6: { halign: 'center', cellWidth: 28 },
        7: { halign: 'center', cellWidth: 22 },
        8: { halign: 'center', cellWidth: 12 },
        9: { halign: 'center', cellWidth: 12 },
        10: { cellWidth: 35 },
        11: { cellWidth: 25 }
      }
    });

    // Positions for Rekapitulasi Section at the end of PDF
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    let recapStartY = finalY + 14;

    if (recapStartY > 155) {
      doc.addPage();
      recapStartY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`REKAPITULASI SISA MAKANAN PASIEN (${monthYearFormatted.toUpperCase()})`, 14, recapStartY);

    const efficientCount = patientRecaps.filter(p => p.wastePercentage <= 25).length;
    const highWasteCount = patientRecaps.filter(p => p.wastePercentage > 25).length;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Pasien: ${patientRecaps.length} Pasien  |  Efisien (Sisa <= 25%): ${efficientCount} Pasien  |  Sisa Tinggi (> 25%): ${highWasteCount} Pasien`, 14, recapStartY + 6);

    const recapTableData = patientRecaps.map((pr, index) => [
      index + 1,
      pr.medicalRecordNumber,
      `${pr.patientName} (${pr.patientGender})`,
      pr.wardName,
      pr.dietType,
      pr.pagiPercent !== null ? `${pr.pagiPercent.toFixed(1)}%` : '-',
      pr.siangPercent !== null ? `${pr.siangPercent.toFixed(1)}%` : '-',
      pr.malamPercent !== null ? `${pr.malamPercent.toFixed(1)}%` : '-',
      `${pr.wastePercentage.toFixed(1)}%`,
      pr.wastePercentage <= 25 ? 'Ya' : 'Tidak',
      pr.wastePercentage <= 25 ? 'Sesuai Standar (<=25%)' : 'Sisa Tinggi (>25%)'
    ]);

    autoTable(doc, {
      startY: recapStartY + 10,
      head: [
        [
          'No.',
          'No. RM',
          'Nama Pasien',
          'Ruang Rawat',
          'Jenis Diet',
          'Sisa Pagi (%)',
          'Sisa Siang (%)',
          'Sisa Malam (%)',
          'Rata-rata Total (%)',
          'Sisa <= 25%',
          'Status Efisiensi'
        ]
      ],
      body: recapTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [5, 150, 105], // emerald-600
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { cellWidth: 38 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'center', cellWidth: 22 },
        8: { halign: 'center', cellWidth: 25 },
        9: { halign: 'center', cellWidth: 18 },
        10: { halign: 'center', cellWidth: 32 }
      }
    });

    const filename = `Laporan_Observasi_Sisa_Makan_${selectedMonth}.pdf`;
    openPdfPreview(doc, filename, 'Laporan Observasi Sisa Makanan Pasien');
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-850 tracking-tight">Laporan Bulanan</h2>
          <p className="text-slate-500 text-sm font-semibold">Pratinjau & ekspor data sisa makanan ke format Excel & PDF</p>
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rekapitulasi Sisa Makanan</p>
            <p className="text-2xl font-black text-emerald-600 font-mono">{overallWastePercentage.toFixed(1)}%</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">(Total Kumulatif / Pasien)</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <User size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah Pasien</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{totalPatients}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Pasien Ter-observasi</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <HardDrive size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Transaksi</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{filteredTransactions.length}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Entri Data</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
         <button 
           onClick={exportToExcel}
           disabled={filteredTransactions.length === 0}
           className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-emerald-200 text-emerald-800 rounded-2xl font-bold hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-50 disabled:shadow-none text-xs sm:text-sm cursor-pointer"
           title="Pratinjau data spreadsheet Excel sebelum diunduh"
         >
           <FileSpreadsheet size={18} className="text-emerald-600" />
           <span>Pratinjau & Unduh Excel</span>
         </button>
         <button 
           onClick={exportToPDF}
           disabled={filteredTransactions.length === 0}
           className="flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-950/20 disabled:opacity-50 disabled:shadow-none text-xs sm:text-sm cursor-pointer"
           title="Pratinjau dokumen PDF sebelum diunduh"
         >
           <FileText size={18} />
           <span>Pratinjau & Unduh PDF</span>
         </button>
      </div>

      {/* Search & Filter Section */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-emerald-600" />
            <h3 className="font-display font-black text-slate-800 text-sm tracking-tight">Pencarian & Filter Laporan</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAllTransactions}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-600 bg-rose-50/50 rounded-xl hover:bg-rose-100 text-xs font-bold transition cursor-pointer focus:outline-none"
              title="Hapus seluruh transaksi untuk mengosongkan laporan (kembali 0)"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Reset / Kosongkan Data</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer focus:outline-none"
            >
              <span>{showFilters ? 'Sembunyikan Saringan' : 'Tampilkan Saringan'}</span>
              <ChevronDown size={14} className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* ALWAYS VISIBLE SEARCH BAR AT THE TOP FOR PATIENTS */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Masukkan nama pasien untuk mencari riwayat sisa makan secara instan..."
            className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-600 transition-all font-bold text-slate-855 text-xs sm:text-sm"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={18} />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline` focus:none cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Collapsible filters that expand/collapse to save space */}
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-4 border-t border-slate-100"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Berdasarkan Bangsal</label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-110/20 focus:border-emerald-600 transition-all font-bold text-slate-700 text-xs sm:text-sm cursor-pointer"
              >
                <option value="all">Semua Bangsal</option>
                {wards.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Makan</label>
              <select
                value={selectedMealTime}
                onChange={(e) => setSelectedMealTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-110/20 focus:border-emerald-600 transition-all font-bold text-slate-700 text-xs sm:text-sm cursor-pointer"
              >
                <option value="all">Semua Waktu Makan</option>
                <option value="sarapan">Sarapan</option>
                <option value="makan_siang">Siang</option>
                <option value="makan_malam">Malam</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Makanan</label>
              <select
                value={selectedFoodType}
                onChange={(e) => setSelectedFoodType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-110/20 focus:border-emerald-600 transition-all font-bold text-slate-700 text-xs sm:text-sm cursor-pointer"
              >
                <option value="all">Semua Jenis</option>
                {foodTypes.map(ft => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hari</label>
              <select
                value={selectedDayOfWeek}
                onChange={(e) => setSelectedDayOfWeek(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-110/20 focus:border-emerald-600 transition-all font-bold text-slate-700 text-xs sm:text-sm cursor-pointer"
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hari Siklus</label>
              <select
                value={selectedCycleDay}
                onChange={(e) => setSelectedCycleDay(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-110/20 focus:border-emerald-600 transition-all font-bold text-slate-700 text-xs sm:text-sm cursor-pointer"
              >
                <option value="all">Semua Siklus</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={String(day)}>Hari Siklus {day}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </div>

      {/* Four Visual Bar Charts showing food waste percentage configurations - hidden during search */}
      {!searchQuery && (
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
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
             <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button
                 type="button"
                 onClick={() => setViewTab('rekap_pasien')}
                 className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                   viewTab === 'rekap_pasien'
                   ? 'bg-white text-emerald-700 shadow-sm'
                   : 'text-slate-500 hover:text-slate-800'
                 }`}
               >
                 Rekapitulasi Pasien ({patientRecaps.length})
               </button>
               <button
                 type="button"
                 onClick={() => setViewTab('record_detail')}
                 className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                   viewTab === 'record_detail'
                   ? 'bg-white text-emerald-700 shadow-sm'
                   : 'text-slate-500 hover:text-slate-800'
                 }`}
               >
                 Log Detail ({filteredTransactions.length})
               </button>
             </div>
           </div>

           {viewTab === 'rekap_pasien' && (
             <div className="flex items-center gap-2">
               <button
                 type="button"
                 onClick={exportPatientRecapToExcel}
                 disabled={patientRecaps.length === 0}
                 className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-sm cursor-pointer"
               >
                 <FileDown size={14} />
                 <span>Excel Rekap</span>
               </button>
               <button
                 type="button"
                 onClick={exportPatientRecapToPDF}
                 disabled={patientRecaps.length === 0}
                 className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-sm cursor-pointer"
               >
                 <FileDown size={14} />
                 <span>PDF Rekap</span>
               </button>
             </div>
           )}
        </div>
        
        {viewTab === 'rekap_pasien' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">No. Rekam Medis</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Nama Pasien</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Ruang Rawat / Unit</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Diet</th>
                  <th className="px-4 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Pagi</th>
                  <th className="px-4 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Siang</th>
                  <th className="px-4 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Malam</th>
                  <th className="px-4 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Rata-rata</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={10} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : patientRecaps.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                      Tidak ada data rekapitulasi pasien untuk kriteria ini.
                    </td>
                  </tr>
                ) : (
                  patientRecaps.map(pr => {
                    const isHighWaste = pr.wastePercentage > 25;
                    return (
                      <tr key={pr.patientKey} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">
                          {pr.medicalRecordNumber}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-extrabold text-slate-800 leading-tight">
                            {pr.patientName} ({pr.patientGender})
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {pr.patientAge ? `${pr.patientAge} th` : '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-700 font-bold">{pr.wardName}</p>
                          <p className="text-[10px] text-slate-400">Kamar: {pr.roomNumber}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-extrabold rounded uppercase">
                            {pr.dietType}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-slate-600">
                          {pr.pagiPercent !== null ? `${pr.pagiPercent.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-slate-600">
                          {pr.siangPercent !== null ? `${pr.siangPercent.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-slate-600">
                          {pr.malamPercent !== null ? `${pr.malamPercent.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`font-mono font-black text-sm ${isHighWaste ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {pr.wastePercentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isHighWaste 
                            ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          }`}>
                            {isHighWaste ? 'Sisa Tinggi (>25%)' : 'Efisien (≤25%)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingPatient({
                              patientKey: pr.patientKey,
                              medicalRecordNumber: pr.medicalRecordNumber === '-' ? '' : pr.medicalRecordNumber,
                              patientName: pr.patientName,
                              patientGender: pr.patientGender,
                              patientAge: pr.patientAge,
                              wardName: pr.wardName,
                              roomNumber: pr.roomNumber === '-' ? '' : pr.roomNumber,
                              dietType: pr.dietType
                            })}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition border border-slate-200"
                            title="Edit Data Pasien"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePatient(pr.patientKey, pr.patientName)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-slate-200"
                            title="Hapus Seluruh Data Pasien Ini"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTx(pr.sampleTx)}
                            className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/80 border-t-2 border-emerald-300 text-slate-800">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-display font-black uppercase text-xs tracking-wider text-emerald-950">
                        REKAPITULASI KUMULATIF SISA MAKANAN:
                      </span>
                      <span className="text-xs text-emerald-800 font-semibold">
                        (Total Kumulatif: {totalCumulativeWaste.toFixed(1)}% / {totalPatients} Pasien)
                      </span>
                    </div>
                  </td>
                  <td colSpan={2} className="px-4 py-4 text-center font-mono font-black text-base text-emerald-700">
                    {overallWastePercentage.toFixed(1)}%
                  </td>
                  <td colSpan={2} className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      overallWastePercentage > 25 
                        ? 'bg-rose-100 text-rose-700 border border-rose-300' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {overallWastePercentage > 25 ? 'Sisa Tinggi (>25%)' : 'Efisien (≤25%)'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Pasien</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Unit / Kamar</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Diet</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Waktu</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Jenis Makanan</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right">Waste</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
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
                          <button 
                            type="button"
                            onClick={() => setSelectedTx(t)}
                            className="text-left cursor-pointer group focus:outline-none"
                            title="Klik untuk melihat detail lengkap pasien"
                          >
                            <p className="font-extrabold text-emerald-600 group-hover:text-emerald-700 hover:underline transition-all underline-offset-2 flex items-center gap-1.5 leading-tight">
                              {t.patientName} ({t.patientGender || '-'})
                              <span className="opacity-0 group-hover:opacity-100 transition-all font-black bg-emerald-50 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider">Detail</span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold group-hover:text-slate-500 transition-colors mt-0.5">RM: {t.medicalRecordNumber || '-'}</p>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {t.wardName || ward?.name || 'Rawat Inap'}
                          <span className="text-[10px] text-slate-400 block font-normal">Kamar: {t.roomNumber || '-'}</span>
                        </td>
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
                          {(() => {
                            const stdW = (t.wasteWeight + t.consumptionWeight) || 400;
                            const pct = Math.round((t.wasteWeight / stdW) * 100);
                            return (
                              <span className={`font-black ${pct > 20 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                {pct}%
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingSingleTx(t)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition border border-slate-200 cursor-pointer"
                              title="Edit Catatan Sisa Makanan Ini"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleTx(t.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-slate-200 cursor-pointer"
                              title="Hapus Transaksi Ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Patient Modal Dialog */}
      {editingPatient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl">
                  <Edit3 size={22} className="text-white" />
                </div>
                <div>
                  <h4 className="font-display font-black text-lg">Edit Data Pasien</h4>
                  <p className="text-xs text-emerald-100">Perbarui identitas & informasi medis pasien</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingPatient(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePatientEdit} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">No. Rekam Medis</label>
                <input 
                  type="text"
                  value={editingPatient.medicalRecordNumber}
                  onChange={e => setEditingPatient({...editingPatient, medicalRecordNumber: e.target.value})}
                  placeholder="RM-XXXXXX"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Nama Pasien</label>
                <input 
                  type="text"
                  value={editingPatient.patientName}
                  onChange={e => setEditingPatient({...editingPatient, patientName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Jenis Kelamin</label>
                  <select 
                    value={editingPatient.patientGender}
                    onChange={e => setEditingPatient({...editingPatient, patientGender: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Umur (Tahun)</label>
                  <input 
                    type="number"
                    value={editingPatient.patientAge || ''}
                    onChange={e => setEditingPatient({...editingPatient, patientAge: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ruang Rawat / Unit</label>
                  <input 
                    type="text"
                    value={editingPatient.wardName}
                    onChange={e => setEditingPatient({...editingPatient, wardName: e.target.value})}
                    placeholder="misal: Mawar"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">No. Kamar</label>
                  <input 
                    type="text"
                    value={editingPatient.roomNumber}
                    onChange={e => setEditingPatient({...editingPatient, roomNumber: e.target.value})}
                    placeholder="misal: 102A"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Jenis Diet</label>
                <input 
                  type="text"
                  value={editingPatient.dietType}
                  onChange={e => setEditingPatient({...editingPatient, dietType: e.target.value})}
                  placeholder="misal: Makanan Biasa"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 transition rounded-xl font-bold text-slate-600 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPatient}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 transition rounded-xl font-bold text-white text-xs flex items-center gap-1.5 shadow"
                >
                  <Save size={14} />
                  <span>{savingPatient ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Single Transaction Edit Modal */}
      {editingSingleTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-xl overflow-hidden shadow-2xl relative flex flex-col my-6"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl">
                  <Pencil size={22} className="text-white" />
                </div>
                <div>
                  <h4 className="font-display font-black text-lg">Edit Catatan Sisa Makanan</h4>
                  <p className="text-xs text-emerald-100">Perbarui data skala Comstock dan rincian transaksi</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingSingleTx(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSingleTxEdit} className="p-8 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">No. Rekam Medis</label>
                  <input 
                    type="text"
                    value={editingSingleTx.medicalRecordNumber || ''}
                    onChange={e => setEditingSingleTx({...editingSingleTx, medicalRecordNumber: e.target.value})}
                    placeholder="RM-XXXXXX"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nama Pasien</label>
                  <input 
                    type="text"
                    value={editingSingleTx.patientName}
                    onChange={e => setEditingSingleTx({...editingSingleTx, patientName: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Umur (Thn)</label>
                  <input 
                    type="number"
                    value={editingSingleTx.patientAge || ''}
                    onChange={e => setEditingSingleTx({...editingSingleTx, patientAge: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Jenis Kelamin</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl h-[46px]">
                    {(['L', 'P'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setEditingSingleTx({...editingSingleTx, patientGender: g})}
                        className={`flex-1 flex items-center justify-center text-xs font-black rounded-lg transition-all ${editingSingleTx.patientGender === g ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                      >
                        {g === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ruang Rawat / Unit</label>
                  <input 
                    type="text"
                    value={editingSingleTx.wardName || ''}
                    onChange={e => setEditingSingleTx({...editingSingleTx, wardName: e.target.value})}
                    placeholder="misal: Mawar"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">No. Kamar</label>
                  <input 
                    type="text"
                    value={editingSingleTx.roomNumber || ''}
                    onChange={e => setEditingSingleTx({...editingSingleTx, roomNumber: e.target.value})}
                    placeholder="misal: 102A"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Jenis Diet</label>
                  <input 
                    type="text"
                    value={editingSingleTx.dietType || 'Biasa'}
                    onChange={e => setEditingSingleTx({...editingSingleTx, dietType: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Waktu Makan</label>
                  <select
                    value={editingSingleTx.mealTime || 'makan_siang'}
                    onChange={e => setEditingSingleTx({...editingSingleTx, mealTime: e.target.value as MealTime})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="sarapan">Sarapan</option>
                    <option value="makan_siang">Makan Siang</option>
                    <option value="makan_malam">Makan Malam</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Jenis Makanan</label>
                <select
                  value={editingSingleTx.foodType || 'Makanan Pokok'}
                  onChange={e => setEditingSingleTx({...editingSingleTx, foodType: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="Makanan Pokok">Makanan Pokok</option>
                  <option value="Lauk Hewani">Lauk Hewani</option>
                  <option value="Lauk Nabati">Lauk Nabati</option>
                  <option value="Sayuran">Sayuran</option>
                  <option value="Buah/Lainnya">Buah/Lainnya</option>
                </select>
              </div>

              {/* Comstock Scale Selection */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Skala Comstock (Persentase Sisa)</label>
                <div className="grid grid-cols-6 gap-2">
                  {COMSTOCK_VALUES.map(v => {
                    const isSelected = editingSingleTx.comstockScale === v.scale;
                    return (
                      <button
                        key={v.scale}
                        type="button"
                        onClick={() => setEditingSingleTx({...editingSingleTx, comstockScale: v.scale})}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105 font-black'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                        }`}
                      >
                        <span className="text-xs">{v.scale}</span>
                        <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {v.percentage}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Alasan Sisa Makan</label>
                <select 
                  value={editingSingleTx.reason || ''}
                  onChange={e => setEditingSingleTx({...editingSingleTx, reason: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">-- Tanpa Alasan --</option>
                  <option value="Pasien tidak nafsu makan">Pasien tidak nafsu makan</option>
                  <option value="Porsi terlalu besar">Porsi terlalu besar</option>
                  <option value="Pasien pulang/tindakan medis">Pasien pulang/tindakan medis</option>
                  <option value="Makanan dingin">Makanan dingin</option>
                  <option value="Sensori / Rasa kurang cocok">Sensori / Rasa kurang cocok</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSingleTx(null)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 transition rounded-xl font-bold text-slate-600 text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSingleTx}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 transition rounded-xl font-bold text-white text-xs flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Save size={14} />
                  <span>{savingSingleTx ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}      {/* Modern, gorgeous patient details description modal dialog overlay */}
      {selectedTx && (() => {
        const pTxs = transactions.filter(t => t.patientName.toLowerCase() === selectedTx.patientName.toLowerCase());
        const patientWasteByFoodType = foodTypes.map(fType => {
          const matchingTxs = pTxs.filter(t => (t.foodType || 'Makanan Pokok') === fType);
          const totalWaste = matchingTxs.reduce((sum, t) => sum + t.wasteWeight, 0);
          const count = matchingTxs.length;
          let totalStdWeight = 0;
          matchingTxs.forEach(t => {
            totalStdWeight += (t.wasteWeight + t.consumptionWeight) || 400;
          });
          const percentage = totalStdWeight > 0 ? (totalWaste / totalStdWeight) * 100 : 0;
          return { label: fType, percentage, count };
        });

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col my-8"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-6 relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20">
                    <User size={22} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-display font-black text-lg tracking-tight">Profil & Riwayat Pasien</h4>
                    <p className="text-xs text-emerald-50 font-bold uppercase tracking-widest mt-0.5">Asesmen & Analisis Sisa Makan Comstock</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition duration-150 cursor-pointer focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6 overflow-y-auto max-h-[72vh]">
                {/* Patient Identity Grid */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Activity size={10} className="text-emerald-500" />
                    Identitas Pasien
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">NAMA LENGKAP PASIEN</span>
                      <span className="text-sm font-black text-slate-800">{selectedTx.patientName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">JENIS KELAMIN</span>
                      <span className="text-sm font-black text-slate-800">{selectedTx.patientGender === 'L' ? 'Laki-Laki ♂' : 'Perempuan ♀'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">UMUR PASIEN</span>
                      <span className="text-sm font-black text-slate-800">{selectedTx.patientAge} Tahun</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">LOKASI BANGSAL / KAMAR</span>
                      <span className="text-sm font-black text-slate-800">
                        {wards.find(w => w.id === selectedTx.wardId)?.name || 'Bangsal'} 
                        {selectedTx.roomNumber ? ` • Kamar ${selectedTx.roomNumber}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Patient Waste Analytics and Trend (The requested Chart) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                    <BarChart2 size={10} className="text-emerald-500" />
                    Grafik Rata-Rata Sisa Makanan Pasien ({pTxs.length} Asesmen Terkumpul)
                  </h5>
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 space-y-3.5">
                    {patientWasteByFoodType.map((item) => {
                      const isMeasured = item.count > 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-bold">
                            <span className="text-slate-600 flex items-center gap-1.5 font-display">
                              {item.label}
                              <span className="text-[8px] text-slate-400 font-normal">({item.count}x)</span>
                            </span>
                            <span className={`font-mono text-[10px] font-black ${isMeasured ? (item.percentage > 20 ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-400'}`}>
                              {isMeasured ? `${item.percentage.toFixed(0)}% Sisa` : 'Tidak ada data'}
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full relative overflow-hidden">
                            {isMeasured ? (
                              <div 
                                className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${
                                  item.percentage > 20 ? 'from-rose-500 to-amber-500' : 'from-emerald-500 to-teal-500'
                                }`}
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              />
                            ) : (
                              <div className="h-full rounded-full bg-slate-200/50 w-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Exporter Section inside Patient Profile (PDF and Excel specific downloaders) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                    <FileDown size={10} className="text-emerald-500" />
                    Ekspor Laporan Sisa Makan Khusus Pasien Ini
                  </h5>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-150">
                    <button 
                      type="button"
                      onClick={() => exportPatientToExcel(selectedTx.patientName)}
                      className="flex items-center justify-center gap-1.5 py-3.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-2xl text-xs shadow-sm transition cursor-pointer"
                    >
                      <FileDown size={14} className="text-emerald-600" />
                      <span>Unduh Excel</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => exportPatientToPDF(selectedTx.patientName)}
                      className="flex items-center justify-center gap-1.5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow hover:shadow-emerald-950/20 transition cursor-pointer"
                    >
                      <FileDown size={14} />
                      <span>Unduh PDF</span>
                    </button>
                  </div>
                </div>

                {/* Meal & Diet Details */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <FileText size={10} className="text-emerald-500" />
                    Detail Asesmen Terkini (ID: {selectedTx.id?.slice(0,6)})
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">JENIS DIET</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold rounded uppercase inline-block mt-1">
                        {selectedTx.dietType || 'Biasa'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">WAKTU MAKAN</span>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded uppercase inline-block mt-1">
                        {(selectedTx.mealTime || '').replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">TANGGAL PENILAIAN</span>
                      <span className="text-xs font-bold text-slate-700 mt-1 block">
                        {selectedTx.timestamp ? format(selectedTx.timestamp, 'dd MMMM yyyy, HH:mm') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">JENIS MAKANAN</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold rounded uppercase inline-block mt-1">
                        {selectedTx.foodType || 'Makanan Pokok'}
                      </span>
                    </div>
                    {/* Detailed plate menu */}
                    <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block">MENU DI MAKANAN</span>
                      <span className="text-xs font-black text-slate-700 block mt-1">
                        {menus.find(m => m.id === selectedTx.menuId)?.foodItems || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comstock Assessment */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Info size={10} className="text-emerald-500" />
                    Asesmen Porsi Sisa & Gramasi
                  </h5>
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 space-y-4">
                    {/* visual slider scale */}
                    {(() => {
                      const stdW = (selectedTx.wasteWeight + selectedTx.consumptionWeight) || 400;
                      const pct = Math.round((selectedTx.wasteWeight / stdW) * 100);
                      return (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center">
                              <span className="text-[9px] font-bold text-slate-400 block">STANDAR PORSI</span>
                              <span className="font-mono text-xs font-black text-slate-800">{stdW} gr</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center">
                              <span className="text-[9px] font-bold text-slate-400 block">DIKONSUMSI</span>
                              <span className="font-mono text-xs font-black text-emerald-600">{selectedTx.consumptionWeight} gr</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center">
                              <span className="text-[9px] font-bold text-rose-500 block">SISA MAKANAN</span>
                              <span className="font-mono text-xs font-black text-rose-600">{selectedTx.wasteWeight} gr</span>
                            </div>
                          </div>

                          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                            {/* Beautiful large Comstock pie-chart visualizer */}
                            <div className="relative shrink-0">
                              <div 
                                className="w-12 h-12 rounded-full border-2 border-emerald-600 bg-slate-50 shadow-sm transition-all duration-300"
                                style={{
                                  background: `conic-gradient(#059669 ${pct}%, #f1f5f9 ${pct}%)`
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[9px] font-mono font-black text-emerald-800 bg-white/90 px-1 py-0.5 rounded shadow-sm scale-90 border border-emerald-100">
                                  {selectedTx.comstockScale !== undefined && selectedTx.comstockScale !== null ? `(${selectedTx.comstockScale})` : '-'}
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 w-full space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Sisa Makanan (Skala Comstock):</span>
                                <span className={`font-mono text-sm font-black ${pct > 20 ? 'text-red-500' : 'text-emerald-600'}`}>
                                  {pct}% Sisa (Skala {selectedTx.comstockScale})
                                </span>
                              </div>
                              <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                                <div 
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                                  style={{ width: `${pct}%` }}
                                />
                                <div 
                                  style={{ left: `${pct}%` }}
                                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-slate-400 rounded-full shadow"
                                />
                              </div>
                              <div className="flex justify-between text-[8px] text-slate-400 font-black uppercase tracking-wider px-1 font-bold">
                                <span>Habis (0%)</span>
                                <span>Setengah (50%)</span>
                                <span>Utuh (100%)</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Reason for waste if exists */}
                    {selectedTx.reason && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">ALASAN SISA MAKANAN</span>
                        <p className="text-xs font-bold text-slate-700 italic bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 mt-1">
                          "{selectedTx.reason}"
                        </p>
                      </div>
                    )}

                    {/* Staff ID details */}
                    <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] font-bold text-slate-500">
                      <span>Petugas Penilai:</span>
                      <span className="text-slate-800 flex items-center gap-1">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        {selectedTx.staffName || 'Petugas Gizi'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="px-6 py-2 bg-slate-200 hover:bg-slate-300 transition duration-150 rounded-xl font-bold text-slate-700 text-xs cursor-pointer focus:outline-none"
                >
                  Tutup Deskripsi
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* PDF PREVIEW MODAL */}
      <AnimatePresence>
        {previewPdfModal.isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">{previewPdfModal.title}</h3>
                    <p className="text-xs text-slate-400">Pratinjau Dokumen Laporan Sebelum Diunduh</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewPdfModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - PDF Iframe */}
              <div className="p-4 bg-slate-100 flex-1 overflow-hidden min-h-[450px]">
                {previewPdfModal.blobUrl ? (
                  <iframe 
                    src={previewPdfModal.blobUrl} 
                    className="w-full h-full min-h-[450px] rounded-2xl border border-slate-200 shadow-inner"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 italic">
                    Memuat pratinjau PDF...
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-slate-500 font-mono">
                  File: <strong className="text-slate-800">{previewPdfModal.filename}</strong>
                </span>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewPdfModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewPdfModal.doc) {
                        previewPdfModal.doc.save(previewPdfModal.filename);
                      }
                      setPreviewPdfModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-950/20 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Unduh File PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXCEL PREVIEW MODAL */}
      <AnimatePresence>
        {previewExcelModal.isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 bg-emerald-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-700/50 text-emerald-300 rounded-xl border border-emerald-600/50">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">{previewExcelModal.title}</h3>
                    <p className="text-xs text-emerald-200">Pratinjau Data Spreadsheet Excel ({previewExcelModal.rows.length} Baris Data)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewExcelModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-800 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Table Preview */}
              <div className="p-6 flex-1 overflow-auto bg-slate-50 space-y-3">
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-emerald-800 text-white sticky top-0 z-10">
                        {previewExcelModal.headers.map((h, i) => (
                          <th key={i} className="px-4 py-3 font-bold border-b border-emerald-900/40">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewExcelModal.rows.slice(0, 100).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-emerald-50/50 transition">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2.5 text-slate-700 font-medium border-r border-slate-100 last:border-r-0">
                              {cell !== undefined && cell !== null ? String(cell) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {previewExcelModal.rows.length === 0 && (
                        <tr>
                          <td colSpan={previewExcelModal.headers.length || 1} className="p-8 text-center text-slate-400 italic">
                            Tidak ada data untuk ditayangkan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {previewExcelModal.rows.length > 100 && (
                  <p className="text-[11px] text-slate-500 italic text-right">
                    * Menampilkan 100 baris pertama dari total {previewExcelModal.rows.length} baris pada pratinjau.
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-slate-500 font-mono">
                  File: <strong className="text-slate-800">{previewExcelModal.filename}</strong>
                </span>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewExcelModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewExcelModal.wb) {
                        XLSX.writeFile(previewExcelModal.wb, previewExcelModal.filename);
                      }
                      setPreviewExcelModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-950/20 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Unduh File Excel (.xlsx)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
