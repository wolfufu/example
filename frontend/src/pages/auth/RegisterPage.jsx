import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (form.name.trim().length < 2) return 'Имя должно содержать минимум 2 символа';
    if (!EMAIL_RE.test(form.email)) return 'Введите корректный email';
    if (form.password.length < 6) return 'Пароль должен содержать минимум 6 символов';
    if (form.password !== form.confirm) return 'Пароли не совпадают';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
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
        <h1 className="auth-card__title">Регистрация</h1>
        <p className="auth-card__subtitle">Создайте аккаунт, чтобы продолжить</p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          {error && <div className="alert">{error}</div>}

          <Input
            label="Имя"
            name="name"
            type="text"
            placeholder="Иван"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
          />

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
            placeholder="Минимум 6 символов"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
          />

          <Input
            label="Повторите пароль"
            name="confirm"
            type="password"
            placeholder="Повторите пароль"
            value={form.confirm}
            onChange={handleChange}
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading}>
            Зарегистрироваться
          </Button>
        </form>

        <p className="auth-card__footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}