import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true on initial mount

  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    // Listen for global 401 events from api interceptor
    const handleUnauth = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauth);
    return () => window.removeEventListener('auth:unauthorized', handleUnauth);
  }, [fetchCurrentUser]);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isSecurity = user?.role === 'security';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isSecurity }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
