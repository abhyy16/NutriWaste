import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, PlusCircle, Database, LogOut, Menu as MenuIcon, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard Utama', path: '/', icon: LayoutDashboard },
    { name: 'Input Sisa Makan', path: '/record', icon: PlusCircle },
    ...(profile?.role === 'admin' ? [{ name: 'Data Master', path: '/master', icon: Database }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">N</div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Nutriwaste</h1>
        </div>
        <button 
          id="mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-slate-600"
        >
          {isMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
        </button>
      </header>

      {/* Sidebar (Desktop) / Drawer (Mobile) */}
      <AnimatePresence>
        {(isMenuOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`
              fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-40 
              flex flex-col transform md:translate-x-0 transition-transform duration-200 ease-in-out
              shadow-xl md:shadow-none
              ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
          >
            <div className="p-6 hidden md:block">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-100">N</div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Nutriwaste</h1>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Digital Nutrition</span>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive 
                        ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm shadow-emerald-50' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                    `}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                  {profile?.name.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate leading-tight">{profile?.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate">{profile?.role}</p>
                </div>
              </div>
              <button
                id="logout-btn"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
              >
                <LogOut size={16} />
                <span>Logout Session</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
