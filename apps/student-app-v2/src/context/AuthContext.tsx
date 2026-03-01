// apps/student-app-v2/src/context/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

const TOKEN_KEY = 'auth_token';

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
          apiClient.defaults.headers.common[
            'Authorization'
          ] = `Bearer ${storedToken}`;
        }
      } catch (e) {
        console.error('Failed to load token', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  const login = async (newToken: string) => {
    setToken(newToken);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
  };

  const logout = async () => {
    setToken(null);
    delete apiClient.defaults.headers.common['Authorization'];
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  };

  const value = {
    token,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
