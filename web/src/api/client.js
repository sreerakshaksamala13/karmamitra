import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'karmamitra_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      // Full reload keeps the app state simple and consistent.
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Turns any axios error into a readable message. */
export function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

export default client;