import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import CompleteProfile from './pages/CompleteProfile';
import Dashboard from './pages/Dashboard';
import RecordWaste from './pages/RecordWaste';
import MasterData from './pages/MasterData';
import MenuCycle from './pages/MenuCycle';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Layout from './components/Layout';

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600 border-t-transparent shadow-lg shadow-emerald-100"></div>
      </div>
    );
  }

  const isAdminOrNutritionist = profile?.role === 'admin' || 
                             profile?.role === 'nutritionist' || 
                             ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(user?.email || '');

  const needsProfile = user && !profile;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : (needsProfile ? <Navigate to="/complete-profile" /> : <Navigate to="/" />)} />
        <Route path="/register" element={!user ? <Register /> : (needsProfile ? <Navigate to="/complete-profile" /> : <Navigate to="/" />)} />
        <Route path="/complete-profile" element={needsProfile ? <CompleteProfile /> : (user ? <Navigate to="/" /> : <Navigate to="/login" />)} />
        
        <Route
          path="/"
          element={user && profile ? <Layout /> : (needsProfile ? <Navigate to="/complete-profile" /> : <Navigate to="/login" />)}
        >
          <Route index element={<Dashboard />} />
          <Route path="record" element={<RecordWaste />} />
          <Route path="master" element={isAdminOrNutritionist ? <MasterData /> : <Navigate to="/" />} />
          <Route path="menu-cycle" element={isAdminOrNutritionist ? <MenuCycle /> : <Navigate to="/" />} />
          <Route path="reports" element={<Reports />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}
