/**
 * Authentication Context
 *
 * Manages user authentication state and provides login/logout functionality
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userStr = await AsyncStorage.getItem('user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });

        // Optionally refresh user data from server
        try {
          const freshUser = await authAPI.getCurrentUser();
          await AsyncStorage.setItem('user', JSON.stringify(freshUser));
          setState({
            user: freshUser,
            isLoading: false,
            isAuthenticated: true,
          });
        } catch (error) {
          // Token might be expired, keep cached user for now
          console.log('Failed to refresh user:', error);
        }
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const response = await authAPI.login(email, password);

      // Store tokens and user
      await AsyncStorage.setItem('access_token', response.access);
      await AsyncStorage.setItem('refresh_token', response.refresh);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));

      setState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error: any) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of API call success
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const refreshUser = async () => {
    try {
      const user = await authAPI.getCurrentUser();
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setState(prev => ({
        ...prev,
        user,
      }));
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
