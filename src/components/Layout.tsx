import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, PlusCircle, Database, LogOut, Menu as MenuIcon, X, FileText } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const isAdmin = profile?.role === 'admin' || ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(user?.email || '');

  const navItems = [
    { name: 'Dashboard Utama', path: '/', icon: LayoutDashboard },
    { name: 'Input Sisa Makan', path: '/record', icon: PlusCircle },
    { name: 'Laporan', path: '/reports', icon: FileText },
    ...(isAdmin ? [
      { name: 'Data Master', path: '/master', icon: Database },
    ] : []),
  ];

  const SidebarContent = ({ isMobile = false }) => (
    <>
      {!isMobile && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-100">N</div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Nutriwaste</h1>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Digital Nutrition</span>
            </div>
          </div>
        </div>
      )}

      <nav className={`flex-1 p-4 ${isMobile ? 'space-y-2' : 'space-y-1'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setIsMenuOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                ${isActive 
                  ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm shadow-emerald-50' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                ${isMobile ? 'text-base py-4' : 'text-sm'}
              `}
            >
              <Icon size={isMobile ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <Link 
          to="/profile"
          onClick={() => isMobile && setIsMenuOpen(false)}
          className="flex items-center gap-3 px-3 py-2 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:ring-2 hover:ring-emerald-50 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors overflow-hidden flex-shrink-0">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profile?.name.charAt(0)
            )}
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{profile?.name}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate">{profile?.role}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
        >
          <LogOut size={16} />
          <span>Logout Session</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">N</div>
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
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">N</div>
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
      <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
