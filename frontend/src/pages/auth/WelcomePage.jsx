import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="welcome">
      <div className="welcome__card">
        <div className="welcome__badge">✓</div>

        <h1>Добро пожаловать, {user?.name}!</h1>
        <p>Вы успешно вошли в систему.</p>

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
          {user?.is_superuser && (
            <div>
              <dt>Роль</dt>
              <dd>Администратор</dd>
            </div>
          )}
        </dl>

        <div className="welcome__actions">
          {user?.is_superuser && (
            <Button variant="primary" onClick={() => navigate('/admin/users')}>
              Перейти в админ-панель
            </Button>
          )}
          <Button variant="ghost" onClick={logout}>
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    </div>
  );
}