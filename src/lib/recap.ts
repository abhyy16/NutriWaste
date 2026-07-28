import { Transaction, COMSTOCK_VALUES } from '../types';

export function getTransactionWastePercentage(t: Transaction): number {
  if (t.comstockScale !== undefined && t.comstockScale !== null) {
    const scaleObj = COMSTOCK_VALUES.find(v => v.scale === t.comstockScale);
    if (scaleObj) return scaleObj.percentage;
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

  const patientMap = new Map<string, { totalScore: number; maxScore: number; totalWaste: number; totalServed: number }>();

  txs.forEach(t => {
    const key = (t.medicalRecordNumber || t.patientName || 'Unknown').trim().toLowerCase();
    const existing = patientMap.get(key);
    const cScale = t.comstockScale !== undefined && t.comstockScale !== null ? t.comstockScale : 0;
    const stdW = (t.wasteWeight + t.consumptionWeight) || 400;

    if (!existing) {
      patientMap.set(key, {
        totalScore: cScale,
        maxScore: 5,
        totalWaste: t.wasteWeight,
        totalServed: stdW
      });
    } else {
      existing.totalScore += cScale;
      existing.maxScore += 5;
      existing.totalWaste += t.wasteWeight;
      existing.totalServed += stdW;
    }
  });

  const patientPercentages = Array.from(patientMap.values()).map(p => {
    return p.maxScore > 0
      ? (p.totalScore / p.maxScore) * 100
      : (p.totalServed > 0 ? (p.totalWaste / p.totalServed) * 100 : 0);
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
