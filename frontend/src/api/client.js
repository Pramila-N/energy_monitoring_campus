import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sma_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const onLogin = window.location.pathname.startsWith('/login');
      localStorage.removeItem('sma_token');
      localStorage.removeItem('sma_admin');
      if (!onLogin) window.dispatchEvent(new CustomEvent('sma:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export default api;