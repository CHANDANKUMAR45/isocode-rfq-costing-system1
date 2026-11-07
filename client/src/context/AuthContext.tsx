import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchUser: (role: 'ESTIMATOR' | 'SALES_HEAD' | 'ADMIN') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('isocode_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await api.getMe();
          setUser(profile);
        } catch (err) {
          console.warn('Session expired, logging out');
          logout();
        }
      } else {
        // Automatically login default Estimator if not logged in for seamless demo review
        try {
          const res = await api.login('estimator@example.invalid', '[REDACTED_DEMO_PASSWORD]');
          localStorage.setItem('isocode_token', res.token);
          setToken(res.token);
          setUser(res.user);
        } catch {
          // ignore
        }
      }
      setLoading(false);
    }
    loadUser();
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

  const switchUser = async (role: 'ESTIMATOR' | 'SALES_HEAD' | 'ADMIN') => {
    const email =
      role === 'ESTIMATOR'
        ? 'estimator@example.invalid'
        : role === 'SALES_HEAD'
        ? 'saleshead@example.invalid'
        : 'admin@example.invalid';
    await login(email, '[REDACTED_DEMO_PASSWORD]');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchUser }}>
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
