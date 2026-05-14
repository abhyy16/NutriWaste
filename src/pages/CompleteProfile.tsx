import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserCheck, Fingerprint, Building2, AlertCircle } from 'lucide-react';
import { Ward } from '../types';

export default function CompleteProfile() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [wardId, setWardId] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    }
    
    const fetchWards = async () => {
      const q = query(collection(db, 'wards'), orderBy('name'));
      const snap = await getDocs(q);
      setWards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    };
    fetchWards();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!name || !nip || !wardId) {
      setError('Mohon lengkapi semua data profil Anda.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await setDoc(doc(db, 'users', user.uid), {
        name,
        nip,
        email: user.email,
        assignedWardId: wardId,
        role: 'nutritionist', // Default role
        createdAt: serverTimestamp(),
      });
      
      await refreshProfile?.();
      navigate('/');
    } catch (err) {
      console.error('Gagal menyimpan profil:', err);
      setError('Gagal menyimpan data. Pastikan semua input sudah benar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-8 md:p-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
            <UserCheck className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lengkapi Profil</h1>
          <p className="text-sm text-slate-500">Satu langkah lagi untuk mulai menggunakan Nutriwaste</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 font-medium leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Petugas</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-bold text-slate-700"
              placeholder="Masukkan nama lengkap"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">NIP / ID Petugas</label>
            <div className="relative">
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-bold text-slate-700"
                placeholder="198XXXXXXXX"
              />
              <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px) font-bold text-slate-400 uppercase tracking-wider px-1">Unit/Bangsal Tugas</label>
            <div className="relative">
              <select
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-bold text-slate-700 appearance-none"
              >
                <option value="">-- Pilih Unit --</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
            ) : (
              'Simpan & Lanjutkan'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
