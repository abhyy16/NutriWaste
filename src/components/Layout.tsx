import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, PlusCircle, Database, LogOut, Menu as MenuIcon, X, FileText, User, Utensils, WifiOff, Workflow } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
// @ts-ignore
import nutriwasteLogo from '../assets/images/nutriwaste_logo_1782572222694.jpg';

export default function Layout() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const isAdmin = profile?.role === 'admin' || ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(user?.email || '');

  const navItems = [
    { name: 'Dashboard Utama', path: '/', icon: LayoutDashboard },
    { name: 'Input Sisa Makan', path: '/record', icon: PlusCircle },
    { name: 'Laporan', path: '/reports', icon: FileText },
    { name: 'Siklus Menu', path: '/menu-cycle', icon: Utensils },
    ...(isAdmin ? [
      { name: 'Data Master', path: '/master', icon: Database },
    ] : []),
    { name: 'Alur & Spesifikasi', path: '/system-flow', icon: Workflow },
  ];

  const SidebarContent = ({ isMobile = false }) => (
    <>
      {!isMobile && (
        <div className="p-6">
          <div className="flex items-center gap-3">
            <img src={nutriwasteLogo} alt="Nutriwaste Logo" className="w-10 h-10 rounded-2xl object-cover shadow-md border border-slate-100 shrink-0" referrerPolicy="no-referrer" />
            <div>
              <h1 className="text-xl font-display font-black text-slate-800 tracking-tight leading-none">Nutriwaste</h1>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mt-0.5">Digital Nutrition</span>
            </div>
          </div>
        </div>
      )}

      <nav className={`flex-1 p-4 ${isMobile ? 'space-y-2' : 'space-y-1.5'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setIsMenuOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-md shadow-emerald-950/20' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                ${isMobile ? 'text-base py-4' : 'text-sm'}
              `}
            >
              <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
              <span className="font-display font-black tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-3">
        {profile && (
          <div className="flex items-center gap-3 px-2 py-1.5 bg-slate-50/50 rounded-2xl border border-slate-100/50">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center rounded-xl text-xs uppercase tracking-wider">
              {profile.name?.slice(0, 2) || 'US'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 truncate leading-none">{profile.name}</p>
              <span className="text-[10px] font-bold text-slate-400 block mt-0.5 capitalize">{profile.role === 'admin' ? 'Kordinator Gizi' : 'Petugas Gizi'}</span>
            </div>
          </div>
        )}
        <Link 
          to="/profile"
          onClick={() => isMobile && setIsMenuOpen(false)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-150"
        >
          <User size={15} />
          <span className="font-display">My Profile</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50/80 rounded-xl transition-all border border-transparent hover:border-red-100"
        >
          <LogOut size={15} />
          <span className="font-display">Logout Session</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f7f4] via-[#eaf0eb] to-[#dde8e0] flex flex-col md:flex-row relative overflow-x-hidden">
      {/* Subtle ambient decorative blur circles */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-100/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-100/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={nutriwasteLogo} alt="Nutriwaste Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm border border-slate-100 shrink-0" referrerPolicy="no-referrer" />
          <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Nutriwaste</h1>
        </div>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-slate-600"
        >
          {isMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex sticky top-0 h-screen w-64 bg-white border-r border-slate-200 flex-col z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 z-[60] md:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-[280px] bg-white z-[70] flex flex-col shadow-2xl md:hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={nutriwasteLogo} alt="Nutriwaste Logo" className="w-10 h-10 rounded-xl object-cover shadow-sm border border-slate-100 shrink-0" referrerPolicy="no-referrer" />
                  <h1 className="text-xl font-bold text-slate-800">Nutriwaste</h1>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <SidebarContent isMobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 pb-36 md:pb-8 lg:pb-12 max-w-7xl mx-auto w-full z-10">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 shadow-[0_20px_50px_-12px_rgba(5,150,105,0.15)] rounded-[2rem] px-3 py-2 flex items-center justify-around z-50 transition-all ring-1 ring-slate-200">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 ${
                isActive ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50' : ''}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-[0.05em] text-center ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.name.includes(' ') ? item.name.split(' ')[0] : item.name}
              </span>
            </Link>
          );
        })}
        <Link
          to="/profile"
          className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 ${
            location.pathname === '/profile' ? 'text-emerald-700' : 'text-slate-400'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${location.pathname === '/profile' ? 'bg-emerald-50' : ''}`}>
            <User size={18} />
          </div>
          <span className={`text-[8px] font-black uppercase tracking-[0.05em] text-center ${location.pathname === '/profile' ? 'opacity-100' : 'opacity-60'}`}>
            Akun
          </span>
        </Link>
      </nav>

      {/* Offline Indicator Alert */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 md:bottom-8 right-6 bg-slate-900/95 backdrop-blur text-white px-5 py-4.5 rounded-[1.5rem] shadow-2xl border border-slate-800 flex items-center gap-3.5 z-50 max-w-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <WifiOff size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">Koneksi Terputus</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-relaxed">Anda sedang offline. Aplikasi Nutriwaste siap berjalan dengan data lokal secara mandiri.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
