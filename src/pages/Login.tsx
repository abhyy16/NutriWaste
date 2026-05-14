import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { useState } from 'react';
import { AlertCircle, LogIn, Fingerprint } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Login gagal:', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Email atau kata sandi tidak valid.');
        } else if (err.code === 'auth/operation-not-allowed') {
          setError('Metode login ini belum diaktifkan di Firebase Console.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google login gagal:', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/popup-closed-by-user') {
          setError('Jendela login ditutup sebelum selesai.');
        } else if (err.code === 'auth/operation-not-allowed') {
          setError('Google Login belum diaktifkan di Firebase Console.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Terjadi kesalahan saat masuk dengan Google.');
      }
      setIsGoogleLoading(false);
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
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 font-medium leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Email / NIP</label>
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

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">Atau masuk dengan</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-4 px-6 rounded-2xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-slate-400"></div>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              Google
            </>
          )}
        </button>

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
