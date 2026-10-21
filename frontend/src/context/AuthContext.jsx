import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  loginRequest,
  registerRequest,
  logoutRequest,
  refreshRequest,
  fetchMe,
  verifyMfaChallengeRequest,   // ← добавили
  getAccessToken,               // ← добавили
} from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Восстановление сессии при старте: пробуем refresh по HttpOnly cookie
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const newToken = await refreshRequest(); // 401 → гость, выходим молча
        const me = await fetchMe(newToken);
        if (cancelled) return;
        setToken(newToken);
        setUser(me);
      } catch {
        /* нет cookie / истёк — пользователь не авторизован */
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Глобальный выход по событию от axios (refresh не удался)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const applySession = useCallback((session) => {
    setUser(session.user);
    setToken(session.token);
    return session.user;
  }, []);

  const refreshUser = useCallback(async () => {
    const t = getAccessToken();
    if (!t) return null;
    const me = await fetchMe(t);
    setUser(me);
    return me;
  }, []);
  

  const login = useCallback(async (credentials) => {
    const result = await loginRequest(credentials);
    // Если 2FA — НЕ логиним, возвращаем challenge наружу
    if (result.mfaRequired) return result;
    return applySession(result);
  }, [applySession]);

  const completeMfaLogin = useCallback(async ({ challengeToken, code }) => {
    const session = await verifyMfaChallengeRequest({ challengeToken, code });
    return applySession(session);
  }, [applySession]);

  const register = useCallback(
    async (data) => applySession(await registerRequest(data)),
    [applySession]
  );

  const logout = useCallback(async () => {
    await logoutRequest(); // бэкенд удалит refresh-cookie, память очистится
    setUser(null);
    setToken(null);
  }, []);

  const value = {
    user,
    token,
    initializing,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshUser,        // ← добавили
    completeMfaLogin,   // ← добавили
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return ctx;
}