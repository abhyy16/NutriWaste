import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertCircle, UserPlus, Fingerprint, ShieldAlert, User, Sparkles } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { Role } from '../types';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('nutritionist');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleInstantLogin = async (targetRole: Role) => {
    setIsLoading(true);
    setError(null);
    setRole(targetRole);
    const demoEmail = targetRole === 'admin' ? 'admin.demo@rsud.com' : 'petugas.demo@rsud.com';
    const demoPassword = 'password123';

    try {
      // Try to sign in
      const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      const user = userCredential.user;
      
      // Ensure profile exists in Firestore with role and name to bypass CompleteProfile screen
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || !docSnap.data().name) {
        await setDoc(docRef, {
          email: demoEmail,
          role: targetRole,
          name: targetRole === 'admin' ? 'Dr. Nabila (Admin Demo)' : 'Faza, S.Gz (Petugas Gizi Demo)',
          nip: targetRole === 'admin' ? '199001012015011001' : '199505052020022002',
          assignedWardId: 'ward_all',
          createdAt: serverTimestamp(),
        }, { merge: true });
      }
      navigate('/');
    } catch (err: any) {
      // If user does not exist, create the user
      if (
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/invalid-login-credentials'
      ) {
        try {
          const usrCred = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          const user = usrCred.user;
          await setDoc(doc(db, 'users', user.uid), {
            email: demoEmail,
            role: targetRole,
            name: targetRole === 'admin' ? 'Dr. Nabila (Admin Demo)' : 'Faza, S.Gz (Petugas Gizi Demo)',
            nip: targetRole === 'admin' ? '199001012015011001' : '199505052020022002',
            assignedWardId: 'ward_all',
            createdAt: serverTimestamp(),
          });
          navigate('/');
        } catch (innerErr: any) {
          console.error('Simulasi Register gagal:', innerErr);
          setError('Gagal membuat akun simulasi: ' + innerErr.message);
        }
      } else {
        console.error('Simulasi Login gagal:', err);
        setError('Gagal masuk simulasi: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Form validation
    if (!email || !password) {
      setError('Email dan Kata Sandi harus diisi.');
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;
      
      // Create user profile document pre-loaded with the selected role
      await setDoc(doc(db, 'users', fbUser.uid), {
        email: email,
        role: role,
        createdAt: serverTimestamp(),
      });

      navigate('/');
    } catch (err) {
      console.error('Registrasi gagal:', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/email-already-in-use') {
          setError('Email sudah terdaftar. Silakan gunakan menu Masuk untuk mengakses akun Anda.');
        } else if (err.code === 'auth/weak-password') {
          setError('Kata sandi terlalu lemah. Gunakan minimal 6 karakter.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Format email tidak valid.');
        } else {
          setError(`Gagal Daftar: ${err.message}`);
        }
      } else {
        setError('Terjadi kesalahan yang tidak terduga saat mencoba mendaftar.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5da281] via-[#4d8c6d] to-[#3e755b] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-8 md:p-12"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-md shadow-emerald-950/20">
            <UserPlus className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daftar Akun Petugas</h1>
          <p className="text-sm text-slate-500">Mulai digitalisasi pemantauan waste hari ini</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 font-medium leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Jabatan / Role</label>
            <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1 rounded-2xl h-[58px]">
              <button
                type="button"
                onClick={() => handleInstantLogin('admin')}
                className={`flex items-center justify-center gap-1.5 text-xs font-black rounded-xl transition-all ${role === 'admin' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ShieldAlert size={14} />
                ADMIN
              </button>
              <button
                type="button"
                onClick={() => handleInstantLogin('nutritionist')}
                className={`flex items-center justify-center gap-1.5 text-xs font-black rounded-xl transition-all ${role === 'nutritionist' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <User size={14} />
                PETUGAS GIZI
              </button>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold mt-1 px-1 flex items-center gap-1">
              <Sparkles size={11} className="shrink-0 text-emerald-500" />
              Klik pilihan jabatan di atas untuk masuk langsung secara otomatis (simulasi)
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                placeholder="siti@rsud.go.id"
              />
              <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Kata Sandi</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-md shadow-emerald-950/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
            ) : (
              'Daftar Sekarang'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-emerald-600 font-bold hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
