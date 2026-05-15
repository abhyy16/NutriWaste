export type Role = 'admin' | 'nutritionist';

export interface UserProfile {
  id: string;
  name: string;
  nip: string;
  email: string;
  role: Role;
  photoURL?: string;
  assignedWardId?: string; // Session ward
  createdAt: any;
}

export interface Menu {
  id: string;
  cycleDay: number;
  mealTime: string;
  foodItems: string;
  updatedBy?: string;
  updatedAt?: any;
}

export interface Ward {
  id: string;
  name: string;
}

export type MealTime = 'sarapan' | 'selingan_1' | 'makan_siang' | 'selingan_2' | 'makan_malam'; 

export interface Transaction {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: 'L' | 'P';
  wardId: string;
  roomNumber?: string;
  bedNumber?: string;
  staffInCharge?: string; // New field as requested
  dietType?: string;      // New field as requested
  mealTime: MealTime;
  menuId: string;
  comstockScale: number; // 0-6
  wasteWeight: number;
  consumptionWeight: number;
  reason?: string;
  staffId: string;
  staffName?: string;
  timestamp: any;
}

export const COMSTOCK_VALUES = [
  { scale: 0, percentage: 0, label: '0% (Habis)' },
  { scale: 1, percentage: 25, label: '25% (Sisa 1/4)' },
  { scale: 2, percentage: 50, label: '50% (Sisa 1/2)' },
  { scale: 3, percentage: 75, label: '75% (Sisa 3/4)' },
  { scale: 4, percentage: 95, label: '95% (Hampir Utuh)' },
  { scale: 5, percentage: 100, label: '100% (Utuh)' },
];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
