import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('isocode_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const profile = await api.getMe();
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) {
          localStorage.removeItem('isocode_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem('isocode_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('isocode_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
