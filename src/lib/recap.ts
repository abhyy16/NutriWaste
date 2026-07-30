import { Transaction, COMSTOCK_VALUES } from '../types';

export function getTransactionWastePercentage(t: Transaction): number {
  if (t.comstockScale !== undefined && t.comstockScale !== null) {
    return (t.comstockScale / 5) * 100;
  }
  const totalWeight = (t.wasteWeight || 0) + (t.consumptionWeight || 0);
  if (totalWeight > 0) {
    return ((t.wasteWeight || 0) / totalWeight) * 100;
  }
  return 0;
}

export interface PatientRecapItem {
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
  wastePercentage: number;
  pagiPercent: number | null;
  siangPercent: number | null;
  malamPercent: number | null;
  sampleTx?: Transaction;
}

/**
 * Logika & Rumus Perhitungan Rekapitulasi Sisa Makanan Pasien:
 * 1. Setiap pasien dihitung rata-rata sisa makanannya (%).
 * 2. Total Kumulatif Sisa Makanan Pasien = Jumlah persentase sisa makanan seluruh pasien.
 * 3. Rekapitulasi Kumulatif (%) = (Total Kumulatif Sisa Makanan Pasien / Jumlah Pasien)
 * 4. Validasi jika Jumlah Pasien = 0 maka mengembalikan 0% (mencegah divide by zero).
 *
 * Contoh Acuan:
 * - Pasien 1: 28%
 * - Pasien 2: 20%
 * - Jumlah Pasien: 2
 * - Perhitungan: ((28 + 20) / 2) = 24%
 */
export function calculateCumulativeWasteFromRecaps(patientRecaps: { wastePercentage: number }[]): {
  overallWastePercentage: number;
  totalCumulativeWaste: number;
  totalPatients: number;
} {
  const totalPatients = patientRecaps.length;

  // Validasi penanganan jika Jumlah Pasien = 0 (mencegah divide by zero)
  if (!patientRecaps || totalPatients === 0) {
    return {
      overallWastePercentage: 0,
      totalCumulativeWaste: 0,
      totalPatients: 0
    };
  }

  const totalCumulativeWaste = patientRecaps.reduce((acc, curr) => acc + (curr.wastePercentage || 0), 0);
  const overallWastePercentage = totalCumulativeWaste / totalPatients;

  return {
    overallWastePercentage,
    totalCumulativeWaste,
    totalPatients
  };
}

/**
 * Menghitung rekapitulasi kumulatif (%) langsung dari array transaksi.
 * Otomatis mengelompokkan per pasien terlebih dahulu lalu menghitung rata-rata kumulatifnya.
 */
export function calculateCumulativeWasteFromTransactions(txs: Transaction[]): {
  overallWastePercentage: number;
  totalCumulativeWaste: number;
  totalPatients: number;
} {
  if (!txs || txs.length === 0) {
    return {
      overallWastePercentage: 0,
      totalCumulativeWaste: 0,
      totalPatients: 0
    };
  }

  const patientMap = new Map<string, { totalPctSum: number; count: number; totalWaste: number; totalServed: number }>();

  txs.forEach(t => {
    const key = (t.medicalRecordNumber || t.patientName || 'Unknown').trim().toLowerCase();
    const existing = patientMap.get(key);
    const pct = getTransactionWastePercentage(t);
    const stdW = (t.wasteWeight + t.consumptionWeight) || 400;

    if (!existing) {
      patientMap.set(key, {
        totalPctSum: pct,
        count: 1,
        totalWaste: t.wasteWeight || 0,
        totalServed: stdW
      });
    } else {
      existing.totalPctSum += pct;
      existing.count += 1;
      existing.totalWaste += (t.wasteWeight || 0);
      existing.totalServed += stdW;
    }
  });

  const patientPercentages = Array.from(patientMap.values()).map(p => {
    return p.count > 0 ? p.totalPctSum / p.count : 0;
  });

  const totalPatients = patientPercentages.length;

  // Validasi jika jumlah pasien = 0 (mencegah divide by zero)
  if (totalPatients === 0) {
    return {
      overallWastePercentage: 0,
      totalCumulativeWaste: 0,
      totalPatients: 0
    };
  }

  const totalCumulativeWaste = patientPercentages.reduce((acc, val) => acc + val, 0);
  const overallWastePercentage = totalCumulativeWaste / totalPatients;

  return {
    overallWastePercentage,
    totalCumulativeWaste,
    totalPatients
  };
}

export interface GroupedPatient {
  key: string;
  patientName: string;
  medicalRecordNumber: string;
  patientGender: string;
  patientAge: number;
  wardId: string;
  wardName: string;
  roomNumber: string;
  dietType: string;
  latestTimestamp: Date | null;
  avgWastePercentage: number;
  isHighWaste: boolean;
  items: Transaction[];
}

export function groupTransactionsByPatient(txs: Transaction[]): GroupedPatient[] {
  if (!txs || txs.length === 0) return [];

  const map = new Map<string, {
    key: string;
    patientName: string;
    medicalRecordNumber: string;
    patientGender: string;
    patientAge: number;
    wardId: string;
    wardName: string;
    roomNumber: string;
    dietType: string;
    latestTimestamp: Date | null;
    items: Transaction[];
  }>();

  txs.forEach(t => {
    const rawKey = (t.medicalRecordNumber || t.patientName || 'unnamed').trim().toLowerCase();
    const existing = map.get(rawKey);
    const tDate = t.timestamp || null;

    if (!existing) {
      map.set(rawKey, {
        key: rawKey,
        patientName: t.patientName || 'Pasien',
        medicalRecordNumber: t.medicalRecordNumber || '-',
        patientGender: t.patientGender || '-',
        patientAge: t.patientAge || 0,
        wardId: t.wardId || 'w1',
        wardName: t.wardName || 'Rawat Inap',
        roomNumber: t.roomNumber || '-',
        dietType: t.dietType || 'Biasa',
        latestTimestamp: tDate,
        items: [t]
      });
    } else {
      existing.items.push(t);
      if (tDate && (!existing.latestTimestamp || tDate > existing.latestTimestamp)) {
        existing.latestTimestamp = tDate;
      }
      if ((!existing.roomNumber || existing.roomNumber === '-') && t.roomNumber) {
        existing.roomNumber = t.roomNumber;
      }
    }
  });

  return Array.from(map.values()).map(g => {
    const sumPct = g.items.reduce((sum, item) => sum + getTransactionWastePercentage(item), 0);
    const avgWastePercentage = g.items.length > 0 ? sumPct / g.items.length : 0;
    const isHighWaste = avgWastePercentage > 20 || g.items.some(i => getTransactionWastePercentage(i) > 20);

    return {
      ...g,
      avgWastePercentage,
      isHighWaste
    };
  });
}
