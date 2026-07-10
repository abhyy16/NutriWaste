import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, serverTimestamp, collection, getDocs, orderBy, query, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserCheck, Fingerprint, Building2, AlertCircle, Camera, User, ShieldAlert } from 'lucide-react';
import { Ward, Role } from '../types';

export default function CompleteProfile() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [wardId, setWardId] = useState('');
  const [customWardName, setCustomWardName] = useState('');
  const [role, setRole] = useState<Role>('nutritionist');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    const fetchDraftRole = async () => {
      if (user) {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role) {
            setRole(data.role);
          }
        }
      }
    };

    fetchWards();
    fetchDraftRole();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
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
    
    if (!name || !nip || !wardId) {
      setError('Mohon lengkapi semua data profil Anda.');
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

      await setDoc(doc(db, 'users', user.uid), {
        name,
        nip,
        email: user.email,
        assignedWardId: finalWardId,
        photoURL: photoURL,
        role: role,
        createdAt: serverTimestamp(),
      });
      
      await refreshProfile?.();
      setTimeout(() => navigate('/', { replace: true }), 100);
    } catch (err) {
      console.error('Gagal menyimpan profil:', err);
      setError('Gagal menyimpan data. Pastikan semua input sudah benar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f7f4] via-[#eaf0eb] to-[#dde8e0] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-8 md:p-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-md shadow-emerald-950/20">
            <UserCheck className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lengkapi Profil</h1>
          <p className="text-sm text-slate-500">Unggah foto profil dan lengkapi data Anda</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 font-medium leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center transition-all overflow-hidden group">
                {photoURL ? (
                  <img src={photoURL} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-slate-300" />
                )}
                {isUploading && (
                   <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                     <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-emerald-600"></div>
                   </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-2 bg-emerald-600 text-white rounded-xl shadow-lg border-2 border-white hover:scale-110 transition-all active:scale-95"
              >
                <Camera size={14} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>

          <div className="space-y-5">
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Unit/Bangsal Tugas</label>
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
                className="space-y-1 pt-1"
              >
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Unit/Bangsal Baru</label>
                <input
                  type="text"
                  value={customWardName}
                  onChange={(e) => setCustomWardName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-bold text-slate-700"
                  placeholder="Cth: Bangsal Seruni"
                />
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading || isUploading}
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-md shadow-emerald-950/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
              ) : (
                'Simpan & Lanjutkan'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
