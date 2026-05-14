import { useState, useEffect } from 'react';
import { doc, updateDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { User, Fingerprint, Building2, AlertCircle, CheckCircle2, ArrowLeft, Save } from 'lucide-react';
import { Ward } from '../types';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [wardId, setWardId] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setNip(profile.nip);
      setWardId(profile.assignedWardId);
    }
    
    const fetchWards = async () => {
      const q = query(collection(db, 'wards'), orderBy('name'));
      const snap = await getDocs(q);
      setWards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    };
    fetchWards();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!name || !nip || !wardId) {
      setError('Mohon lengkapi semua data profil.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        nip,
        assignedWardId: wardId,
      });
      
      await refreshProfile?.();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Gagal memperbarui profil:', err);
      setError('Gagal memperbarui data profil.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-500"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Profil Petugas</h2>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center gap-3"
          >
            <CheckCircle2 className="text-emerald-500" size={20} />
            <p className="text-sm text-emerald-700 font-bold">Profil berhasil diperbarui!</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-10 shadow-sm">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 relative group overflow-hidden">
            <User size={48} />
          </div>

          <div className="flex-1 space-y-6 w-full">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Petugas</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-bold text-slate-700"
                    placeholder="Nama Lengkap"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">NIP / ID</label>
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
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Unit/Bangsal Tugas Saat Ini</label>
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

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Email (Akun)</label>
                <input
                  type="text"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 outline-none text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <Save size={20} />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
