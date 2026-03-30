import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Auth from './pages/Auth';
import Drive from './pages/Drive';

function App() {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="h-screen bg-[#02040a] text-cyan-400 flex items-center justify-center font-[Inter]">
        <div className="w-8 h-8 rounded-full animate-spin border-y-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={!isAuthenticated ? <Auth /> : <Navigate to="/" />} />
      <Route path="/" element={isAuthenticated ? <Drive /> : <Navigate to="/auth" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
