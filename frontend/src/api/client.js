// frontend/src/api/client.js
import axios from 'axios';
import { loadSession } from './authApi';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
    const session = loadSession();       // читает ключ 'auth_session'
    if (session?.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
    }
    return config;
});

export default api;