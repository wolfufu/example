// src/api/client.js
import axios from 'axios';
import { getAccessToken, refreshRequest } from './authApi';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true, // ← всегда отправляем cookie
});

// Подставляем актуальный access-токен
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Не пытаемся «рефрешить» сами auth-эндпоинты
const SKIP_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (
      !response ||
      response.status !== 401 ||
      config._retry ||
      SKIP_REFRESH.some((u) => config.url?.includes(u))
    ) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      await refreshRequest(); // shared promise — параллельные 401 ждут один refresh
      return api(config);     // request-интерсептор подставит новый токен
    } catch {
      // refresh умер — разлогиниваем приложение
      window.dispatchEvent(new Event('auth:logout'));
      return Promise.reject(error);
    }
  }
);

export default api;