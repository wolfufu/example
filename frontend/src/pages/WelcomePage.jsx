import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

export default function WelcomePage() {
  const { user, logout } = useAuth();

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
        </dl>

        <Button variant="ghost" onClick={logout}>
          Выйти из аккаунта
        </Button>
      </div>
    </div>
  );
}