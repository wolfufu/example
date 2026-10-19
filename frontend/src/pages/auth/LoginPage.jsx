// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email: form.email, password: form.password });
      navigate('/welcome', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Вход</h1>
        <p className="auth-card__subtitle">Войдите в свой аккаунт</p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          {error && <div className="alert">{error}</div>}

          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="ivan@example.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />

          <Input
            label="Пароль"
            name="password"
            type="password"
            placeholder="••••••"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading}>
            Войти
          </Button>
        </form>

        <p className="auth-card__footer">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}