import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import type { User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, species: 'human'|'ai'|'company') => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildLocalPassword(username: string, species: 'human'|'ai'|'company') {
  return `supernova-${species}-${username.trim().toLowerCase()}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        api.setToken(token);
        try {
          const userData = await api.getCurrentUser();
          setUser(userData);
        } catch (e) {
          console.error("Session invalid:", e);
          logout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (username: string, species: 'human'|'ai'|'company') => {
    setIsLoading(true);
    try {
      const password = buildLocalPassword(username, species);
      let data;
      try {
        data = await api.login(username, password);
      } catch {
        await api.register({
          username,
          password,
          species,
          email: `${username.trim().toLowerCase()}@local.supernova`,
        });
        data = await api.login(username, password);
      }

      setToken(data.access_token);
      api.setToken(data.access_token);
      const userData = await api.getCurrentUser();
      setUser(userData);
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
