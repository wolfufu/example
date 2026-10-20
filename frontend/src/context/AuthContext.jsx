import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  loginRequest,
  registerRequest,
  logoutRequest,
  refreshRequest,
  fetchMe,
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

  const login = useCallback(
    async (credentials) => applySession(await loginRequest(credentials)),
    [applySession]
  );

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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return ctx;
}