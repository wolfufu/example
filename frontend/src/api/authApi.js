// src/api/authApi.js

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 1. Вход (Login) - делаем два запроса: получаем токен, затем данные юзера
export const loginRequest = async ({ email, password }) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!loginRes.ok) {
    throw new Error('Неверный email или пароль');
  }

  const { access_token } = await loginRes.json();

  // Сразу запрашиваем профиль пользователя
  const meRes = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!meRes.ok) throw new Error('Ошибка получения профиля');
  const user = await meRes.json();

  return { user, token: access_token };
};

// 2. Регистрация (Register) - после регистрации сразу логиним
export const registerRequest = async (data) => {
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // ДОБАВЛЕНО ПОЛЕ name:
    body: JSON.stringify({ 
        name: data.name, 
        email: data.email, 
        password: data.password 
    }),
  });

  if (!regRes.ok) {
    const errorData = await regRes.json();
    
    // FastAPI при ошибке 422 возвращает массив объектов в detail.
    // Нам нужно вытащить из него текст ошибки, чтобы не было [object Object]
    let errorMessage = 'Ошибка при регистрации';
    
    if (errorData.detail && Array.isArray(errorData.detail)) {
      // Собираем все сообщения об ошибках через запятую
      errorMessage = errorData.detail.map(err => err.msg).join(', ');
    } else if (errorData.detail) {
      errorMessage = errorData.detail;
    }
    
    throw new Error(errorMessage);
  }

  // Автоматически входим после успешной регистрации
  return loginRequest({ email: data.email, password: data.password });
};

// 3. Управление сессией (LocalStorage)
export const saveSession = (session) => {
  localStorage.setItem('auth_session', JSON.stringify(session));
};

export const loadSession = () => {
  const session = localStorage.getItem('auth_session');
  return session ? JSON.parse(session) : null;
};

export const clearSession = () => {
  localStorage.removeItem('auth_session');
};