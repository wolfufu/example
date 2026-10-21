// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';

export default function LoginPage() {
  const { login, completeMfaLogin } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [mfa, setMfa] = useState(null); // { challengeToken }
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ← ВОТ ЭТО БЫЛО ПОТЕРЯНО
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login({ email: form.email, password: form.password });
      if (result?.mfaRequired) {
        setMfa({ challengeToken: result.challengeToken });
      } else {
        navigate('/welcome', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await completeMfaLogin({
        challengeToken: mfa.challengeToken,
        code: totpCode,
      });
      navigate('/welcome', { replace: true });
    } catch (err) {
      setError(err.message);
      setMfa(null);
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  // ← ВТОРАЯ ЧАСТЬ, КОТОРОЙ НЕ БЫЛО: экран ввода TOTP
  if (mfa) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Двухфакторная аутентификация</h1>
          <p className="auth-card__subtitle">
            Введите 6-значный код из приложения-аутентификатора
          </p>

          <form className="form" onSubmit={handleMfaSubmit} noValidate>
            {error && <div className="alert">{error}</div>}

            <Input
              label="Код"
              name="totp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              autoComplete="one-time-code"
            />

            <Button type="submit" loading={loading}>
              Подтвердить
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMfa(null);
                setTotpCode('');
                setError('');
              }}
            >
              Назад
            </Button>
          </form>
        </div>
      </div>
    );
  }

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