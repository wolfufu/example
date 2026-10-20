// src/api/authApi.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ---------- Access-token хранится ТОЛЬКО в памяти ----------
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const clearAccessToken = () => { accessToken = null; };

// ---------- Login ----------
export const loginRequest = async ({ email, password }) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
    credentials: 'include', // ← получаем HttpOnly refresh-cookie
  });

  if (!res.ok) throw new Error('Неверный email или пароль');

  const { access_token } = await res.json();
  setAccessToken(access_token);

  const user = await fetchMe(access_token);
  return { user, token: access_token };
};

// ---------- Register ----------
export const registerRequest = async (data) => {
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
    }),
  });

  if (!regRes.ok) {
    const errorData = await regRes.json().catch(() => ({}));
    let errorMessage = 'Ошибка при регистрации';
    if (Array.isArray(errorData.detail)) {
      errorMessage = errorData.detail.map((err) => err.msg).join(', ');
    } else if (errorData.detail) {
      errorMessage = errorData.detail;
    }
    throw new Error(errorMessage);
  }

  return loginRequest({ email: data.email, password: data.password });
};

// ---------- Refresh (единый promise — защита от гонок) ----------
let refreshPromise = null;

export const refreshRequest = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // ← refresh-cookie едет автоматически
      });
      if (!res.ok) {
        clearAccessToken();
        throw new Error('Не удалось обновить сессию');
      }
      const { access_token } = await res.json();
      setAccessToken(access_token);
      return access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// ---------- Logout ----------
export const logoutRequest = async () => {
  clearAccessToken();
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // ← бэкенд удалит cookie
    });
  } catch {
    /* сеть недоступна — локально уже разлогинены */
  }
};

// ---------- Профиль ----------
export const fetchMe = async (token) => {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Ошибка получения профиля');
  return res.json();
};