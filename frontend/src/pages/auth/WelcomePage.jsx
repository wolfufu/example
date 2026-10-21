// src/pages/WelcomePage.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="welcome">
      <div className="welcome__card">
        <div className="welcome__badge">✓</div>

        <h1>Добро пожаловать, {user?.name}!</h1>
        <p>Вы успешно вошли в систему.</p>

        {/* ── Баннер: 2FA не включена ── */}
        {user && !user.is_2fa_enabled && (
          <div className="welcome__banner welcome__banner--warning">
            <strong>🔒 Защитите аккаунт</strong>
            <p>
              Двухфакторная аутентификация не включена. Даже если пароль
              украдут — без кода из телефона войти не смогут.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/settings/security')}
            >
              Настроить 2FA
            </Button>
          </div>
        )}

        {/* ── Плашка: 2FA включена ── */}
        {user?.is_2fa_enabled && (
          <div className="welcome__banner welcome__banner--success">
            ✓ Двухфакторная аутентификация включена
          </div>
        )}

        <dl className="welcome__info">
          <div>
            <dt>Имя</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>{user?.id}</dd>
          </div>
          <div>
            <dt>2FA</dt>
            <dd>{user?.is_2fa_enabled ? 'Включена' : 'Выключена'}</dd>
          </div>
          {user?.is_superuser && (
            <div>
              <dt>Роль</dt>
              <dd>Администратор</dd>
            </div>
          )}
        </dl>

        <div className="welcome__actions">
          <Button
            variant="ghost"
            onClick={() => navigate('/settings/security')}
          >
            Безопасность
          </Button>
          {user?.is_superuser && (
            <Button
              variant="primary"
              onClick={() => navigate('/admin/users')}
            >
              Перейти в админ-панель
            </Button>
          )}
          <Button variant="ghost" onClick={handleLogout}>
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    </div>
  );
}