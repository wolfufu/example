import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) return <div className="page-loader">Загрузка…</div>;
  if (isAuthenticated) return <Navigate to="/welcome" replace />;

  return children;
}