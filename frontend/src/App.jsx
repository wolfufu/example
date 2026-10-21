import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import WelcomePage from './pages/auth/WelcomePage';

// Импорты для админки (создайте их согласно предыдущему ответу)
import AdminLayout from './components/AdminLayout';
import UsersPage from './pages/admin/UsersPage';

export default function App() {
  return (
    <Routes>
      {/* Публичные роуты */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      
      {/* Защищенные роуты пользователя */}
      <Route
        path="/welcome"
        element={
          <ProtectedRoute>
            <WelcomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/security"
        element={<ProtectedRoute><SecurityPage /></ProtectedRoute>}
      />

      {/* Защищенные роуты Админки (Nested Routes) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* При переходе на /admin автоматически редиректит на /admin/users */}
        <Route index element={<Navigate to="users" replace />} />
        
        {/* Модули админки */}
        <Route path="users" element={<UsersPage />} />
        
        {/* Пример заготовки для нового модуля в будущем */}
        <Route path="settings" element={<div>Модуль настроек в разработке</div>} />
      </Route>

      {/* Fallback (если путь не найден) */}
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}