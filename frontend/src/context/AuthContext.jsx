import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  loginRequest,
  registerRequest,
  saveSession,
  loadSession,
  clearSession,
} from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Восстановление сессии при старте приложения
  useEffect(() => {
    const session = loadSession();
    if (session?.user && session?.token) {
      setUser(session.user);
      setToken(session.token);
    }
    setInitializing(false);
  }, []);

  const applySession = useCallback((session) => {
    saveSession(session);
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

  const logout = useCallback(() => {
    clearSession();
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