import { signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { useState } from 'react';
import { AlertCircle, LogIn, Fingerprint, MailCheck, ShieldAlert, User, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Role } from '../types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('nutritionist');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleInstantLogin = async (role: Role) => {
    setIsLoading(true);
    setError(null);
    setResetMessage(null);
    setSelectedRole(role);
    const demoEmail = role === 'admin' ? 'admin.demo@rsud.com' : 'petugas.demo@rsud.com';
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
          role: role,
          name: role === 'admin' ? 'Dr. Nabila (Admin Demo)' : 'Faza, S.Gz (Petugas Gizi Demo)',
          nip: role === 'admin' ? '199001012015011001' : '199505052020022002',
          assignedWardId: 'ward_all',
          createdAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (err: any) {
      // If user does not exist or password mismatch, create the user
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
            role: role,
            name: role === 'admin' ? 'Dr. Nabila (Admin Demo)' : 'Faza, S.Gz (Petugas Gizi Demo)',
            nip: role === 'admin' ? '199001012015011001' : '199505052020022002',
            assignedWardId: 'ward_all',
            createdAt: serverTimestamp(),
          });
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResetMessage(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify role matches selection before letting them enter
      const isDeveloperEmail = ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(user.email || '');
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && !isDeveloperEmail) {
        const storedRole = docSnap.data().role as Role;
        if (storedRole !== selectedRole) {
          await auth.signOut();
          setError(`Akun Anda terdaftar sebagai ${storedRole === 'admin' ? 'ADMIN' : 'PETUGAS GIZI'}. Silakan sesuaikan pilihan jabatan di atas sebelum Masuk.`);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Login error details:', err);
      if (err instanceof FirebaseError) {
        const code = err.code;
        if (
          code === 'auth/user-not-found' || 
          code === 'auth/wrong-password' || 
          code === 'auth/invalid-credential' ||
          code === 'auth/invalid-login-credentials'
        ) {
          setError('Email atau kata sandi salah. Silakan periksa kembali atau gunakan fitur "Lupa Password" jika Anda lupa kata sandi Anda.');
        } else if (code === 'auth/invalid-email') {
          setError('Format email tidak valid. Pastikan alamat email sudah benar (contoh: nama@rsud.go.id).');
        } else if (code === 'auth/user-disabled') {
          setError('Akun ini telah dinonaktifkan. Silakan hubungi administrator.');
        } else if (code === 'auth/too-many-requests') {
          setError('Terlalu banyak percobaan masuk yang gagal. Akun Anda telah diblokir sementara. Silakan coba lagi nanti atau reset kata sandi Anda.');
        } else {
          setError(`Gagal masuk: ${err.message}`);
        }
      } else {
        setError('Terjadi kesalahan koneksi. Pastikan internet Anda stabil dan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Silakan masukkan email Anda terlebih dahulu untuk mereset kata sandi.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResetMessage(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Email reset kata sandi telah dikirim! Silakan periksa kotak masuk atau folder spam Anda.');
    } catch (err) {
      console.error('Reset password gagal:', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/user-not-found') {
          setError('Alamat email belum terdaftar di sistem kami.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Format email tidak valid.');
        } else {
          setError(`Gagal mengirim email reset: ${err.message}`);
        }
      } else {
        setError('Terjadi kesalahan saat mengirim instruksi reset kata sandi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-8 md:p-12 text-center"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-emerald-200">
            <span className="text-white text-4xl font-bold italic">N</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Nutriwaste</h1>
          <p className="text-slate-500 font-medium leading-tight px-4">Digitalisasi Pemantauan Sisa Makanan Rumah Sakit</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 font-medium leading-tight">{error}</p>
          </div>
        )}

        {resetMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-left animate-in fade-in slide-in-from-top-2">
            <MailCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-emerald-700 font-medium leading-tight">{resetMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          {/* Role Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Pilih Jabatan Masuk</label>
            <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1 rounded-2xl h-[58px]">
              <button
                type="button"
                onClick={() => handleInstantLogin('admin')}
                className={`flex items-center justify-center gap-1.5 text-xs font-black rounded-xl transition-all ${selectedRole === 'admin' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ShieldAlert size={14} />
                ADMIN
              </button>
              <button
                type="button"
                onClick={() => handleInstantLogin('nutritionist')}
                className={`flex items-center justify-center gap-1.5 text-xs font-black rounded-xl transition-all ${selectedRole === 'nutritionist' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <User size={14} />
                PETUGAS GIZI
              </button>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold mt-1 px-1 flex items-center gap-1">
              <Sparkles size={11} className="shrink-0 text-emerald-500" />
              Klik pilihan jabatan di atas untuk masuk secara otomatis tanpa password (simulasi)
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Email RSUD</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                placeholder="nama@rsud.go.id"
                required
              />
              <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kata Sandi</label>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
              >
                Lupa Password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
              placeholder="••••••••"
              required={!resetMessage}
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
            ) : (
              <>
                <LogIn size={20} />
                Masuk
              </>
            )}
          </button>
        </form>

        <div className="mt-8">
          <p className="text-sm text-slate-500">
            Belum punya akun?{' '}
            <Link to="/register" className="text-emerald-600 font-bold hover:underline">
              Daftar di sini
            </Link>
          </p>
        </div>

        <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          SISTEM KHUSUS TENAGA KESEHATAN
        </p>
      </motion.div>
    </div>
  );
}
