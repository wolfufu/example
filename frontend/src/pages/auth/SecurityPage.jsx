// src/pages/SecurityPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import {
  setup2faRequest,
  verify2faRequest,
  disable2faRequest,
} from '../../api/authApi';

export default function SecurityPage() {
  const { user, token, refreshUser } = useAuth();
  const [setupData, setSetupData] = useState(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const startSetup = async () => {
    resetMessages();
    setLoading(true);
    try {
      setSetupData(await setup2faRequest(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await verify2faRequest({ token, code });
      setSetupData(null);
      setCode('');
      setSuccess('2FA успешно включена');
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await disable2faRequest({ token, code });
      setDisabling(false);
      setCode('');
      setSuccess('2FA отключена');
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Безопасность</h1>

        {error && <div className="alert">{error}</div>}
        {success && <div className="alert">{success}</div>}

        {/* --- Не включена: показать кнопку --- */}
        {!user?.is_2fa_enabled && !setupData && (
          <>
            <p className="auth-card__subtitle">
              Двухфакторная аутентификация <strong>не включена</strong>.
              Добавьте второй фактор для защиты аккаунта.
            </p>
            <Button onClick={startSetup} loading={loading}>
              Включить 2FA
            </Button>
          </>
        )}

        {/* --- Настройка: QR + код --- */}
        {setupData && (
          <>
            <p className="auth-card__subtitle">
              Отсканируйте QR-код в Google Authenticator, Authy или 1Password,
              затем введите 6-значный код.
            </p>

            {setupData.qr_code_base64 && (
              <img
                src={setupData.qr_code_base64}
                alt="QR для 2FA"
                style={{ width: 220, height: 220, margin: '16px 0', display: 'block' }}
              />
            )}

            <p style={{ fontSize: 13, opacity: 0.75 }}>
              Не получается отсканировать? Введите секрет вручную:
            </p>
            <code style={{ display: 'block', wordBreak: 'break-all', marginBottom: 16 }}>
              {setupData.secret}
            </code>

            <form className="form" onSubmit={confirmSetup} noValidate>
              <Input
                label="Код из приложения"
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
              />
              <Button type="submit" loading={loading}>Подтвердить</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSetupData(null); setCode(''); resetMessages(); }}
              >
                Отмена
              </Button>
            </form>
          </>
        )}

        {/* --- Включена: показать статус и кнопку отключения --- */}
        {user?.is_2fa_enabled && !disabling && (
          <>
            <p className="auth-card__subtitle">
              ✓ 2FA <strong>включена</strong>. Аккаунт защищён вторым фактором.
            </p>
            <Button variant="ghost" onClick={() => { setDisabling(true); resetMessages(); }}>
              Отключить 2FA
            </Button>
          </>
        )}

        {/* --- Отключение: подтверждение кодом --- */}
        {user?.is_2fa_enabled && disabling && (
          <form className="form" onSubmit={confirmDisable} noValidate>
            <p className="auth-card__subtitle">
              Введите код из приложения-аутентификатора для подтверждения.
            </p>
            <Input
              label="Код из приложения"
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <Button type="submit" loading={loading}>Отключить</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setDisabling(false); setCode(''); resetMessages(); }}
            >
              Отмена
            </Button>
          </form>
        )}

        <p className="auth-card__footer">
          <Link to="/welcome">← На главную</Link>
        </p>
      </div>
    </div>
  );
}