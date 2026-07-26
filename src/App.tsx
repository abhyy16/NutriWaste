import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import CompleteProfile from './pages/CompleteProfile';
import Dashboard from './pages/Dashboard';
import RecordWaste from './pages/RecordWaste';
import MenuCycle from './pages/MenuCycle';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import SystemFlow from './pages/SystemFlow';
import Layout from './components/Layout';

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#f3f7f4] via-[#eaf0eb] to-[#dde8e0]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600 border-t-transparent shadow-md shadow-emerald-950/20"></div>
      </div>
    );
  }

  const isAdminOrNutritionist = profile?.role === 'admin' || 
                             profile?.role === 'nutritionist' || 
                             ['f1b02310096@student.unram.ac.id', 'nahdah031@gmail.com', 'arifah031@gmail.com'].includes(user?.email || '');

  const needsProfile = user && (!profile || !profile.name);

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
          <Route path="menu-cycle" element={isAdminOrNutritionist ? <MenuCycle /> : <Navigate to="/" />} />
          <Route path="reports" element={<Reports />} />
          <Route path="system-flow" element={<SystemFlow />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}
