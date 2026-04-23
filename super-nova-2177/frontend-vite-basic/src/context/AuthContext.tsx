
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Species } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateSpecies: (species: Species) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => { },
  logout: () => { },
  updateSpecies: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      // Try to load user from local storage first for immediate UI
      const storedUser = localStorage.getItem('user_data');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error("Failed to parse stored user", e);
        }
      }

      if (token) {
        try {
          api.setToken(token);
          const userData = await api.getCurrentUser();
          setUser(userData);
        } catch (e) {
          console.warn("Session restore failed, clearing invalid token.");
          api.logout();
          if (!storedUser) {
            setUser(null);
          }
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (token: string) => {
    api.setToken(token);
    const userData = await api.getCurrentUser();
    setUser(userData);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const updateSpecies = (species: Species) => {
    if (!user) return;
    const updated = { ...user, species };
    setUser(updated);
    localStorage.setItem('user_data', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateSpecies }}>
      {children}
    </AuthContext.Provider>
  );
};
