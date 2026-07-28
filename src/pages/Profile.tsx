import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, collection, getDocs, orderBy, query, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { User, Fingerprint, Building2, AlertCircle, CheckCircle2, ArrowLeft, Save, Camera, LogOut, ShieldAlert } from 'lucide-react';
import { Ward } from '../types';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [wardId, setWardId] = useState('');
  const [customWardName, setCustomWardName] = useState('');
  const [role, setRole] = useState<string>('nutritionist');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setNip(profile.nip);
      setWardId(profile.assignedWardId || '');
      setPhotoURL(profile.photoURL || null);
      setRole(profile.role || 'nutritionist');

      // Auto-fix admin role if email is in the list
      const adminEmails = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'];
      if (adminEmails.includes(user?.email || '') && profile.role !== 'admin') {
        const updateRole = async () => {
          await updateDoc(doc(db, 'users', user!.uid), { role: 'admin' });
          await refreshProfile?.();
        };
        updateRole();
      }
    }
    
    const fetchWards = async () => {
      const q = query(collection(db, 'wards'), orderBy('name'));
      const snap = await getDocs(q);
      setWards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
    };
    fetchWards();
  }, [profile, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // Limit to 500KB
        setError('Ukuran file terlalu besar. Maksimal 500KB.');
        return;
      }

      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!name || !wardId) {
      setError('Mohon isi nama dan unit/bangsal tugas Anda.');
      return;
    }

    if (wardId === 'other_custom' && !customWardName.trim()) {
      setError('Mohon isi nama bangsal kustom Anda.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let finalWardId = wardId;
      if (wardId === 'other_custom') {
        const cleanedName = customWardName.trim();
        const existing = wards.find(w => w.name.toLowerCase() === cleanedName.toLowerCase());
        if (existing) {
          finalWardId = existing.id;
        } else {
          const newWardDoc = await addDoc(collection(db, 'wards'), { name: cleanedName });
          finalWardId = newWardDoc.id;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), {
        name,
        nip,
        assignedWardId: finalWardId,
        photoURL: photoURL,
        role: role,
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

  const handleLogout = async () => {
    if (window.confirm('Keluar dari aplikasi?')) {
      await signOut(auth);
      navigate('/login');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-display font-black text-slate-850 tracking-tight">Profil Petugas</h2>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut size={16} />
          Keluar
        </button>
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

      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-10 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="relative group">
            <div className="w-32 h-32 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300 overflow-hidden border-4 border-white shadow-xl">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={64} />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                </div>
              )}
            </div>
            
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-3 bg-emerald-600 text-white rounded-2xl shadow-lg border-2 border-white hover:scale-110 transition-all active:scale-95"
            >
              <Camera size={20} />
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex-1 space-y-6 w-full">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {/* Role Selection (Read-Only) */}
              <div className="space-y-1 opacity-80">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jabatan / Role</label>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Terkonfirmasi saat Daftar</span>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1 rounded-2xl h-[58px]">
                  <button
                    type="button"
                    disabled
                    className={`flex items-center justify-center gap-1.5 text-xs font-black rounded-xl cursor-not-allowed transition-all ${role === 'admin' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-400 opacity-60'}`}
                  >
                    <ShieldAlert size={14} />
                    ADMIN
                  </button>
                  <button
                    type="button"
                    disabled
                    className={`flex items-center justify-center gap-1.5 text-xs font-black rounded-xl cursor-not-allowed transition-all ${role === 'nutritionist' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-400'}`}
                  >
                    <User size={14} />
                    PETUGAS GIZI
                  </button>
                </div>
              </div>

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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    NIP / ID <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                  </label>
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
                    <option value="other_custom">-- Lainnya (Input Manual) --</option>
                  </select>
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                </div>
              </div>

              {wardId === 'other_custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1"
                >
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Unit/Bangsal Baru</label>
                  <input
                    type="text"
                    value={customWardName}
                    onChange={(e) => setCustomWardName(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-bold text-slate-700"
                    placeholder="Cth: Bangsal Melati"
                  />
                </motion.div>
              )}

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
                disabled={isLoading || isUploading}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-md shadow-emerald-950/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
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
