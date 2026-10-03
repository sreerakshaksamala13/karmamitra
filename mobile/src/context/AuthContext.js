import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import client, { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await client.get('/auth/me');
        setUser(res.data.user);
      } catch (err) {
        await tokenStore.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (phone, password) => {
    const res = await client.post('/auth/login', { phone, password });
    await tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (name, phone, password) => {
    const res = await client.post('/auth/register', { name, phone, password });
    await tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await client.delete('/auth/account');
    await tokenStore.clear();
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