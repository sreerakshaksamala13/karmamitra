import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import client, { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on first load.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (phone, password) => {
    const res = await client.post('/auth/login', { phone, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (name, phone, password) => {
    const res = await client.post('/auth/register', { name, phone, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await client.delete('/auth/account');
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, deleteAccount }),
    [user, loading, login, register, logout, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}