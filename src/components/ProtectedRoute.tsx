import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  // Jika status autentikasi masih dimuat, jangan lakukan apa-apa.
  // AuthContext akan menampilkan skeleton loading.
  if (loading) {
    return null;
  }

  // Jika tidak dalam status loading dan tidak ada pengguna, arahkan ke halaman login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Jika tidak dalam status loading dan ada pengguna, tampilkan konten yang dilindungi.
  return <Outlet />;
};

export default ProtectedRoute;