'use client';

import React, { ReactNode } from 'react';
import { AuthProvider as SharedAuthProvider, useAuth as useSharedAuth } from '@/packages/context/auth/AuthContext';
import apiService from '@/lib/api'; // Web-specific apiService
import { ErrorHandler } from '@/lib/utils/errors'; // Web-specific ErrorHandler

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SharedAuthProvider appType="web" apiService={apiService}>
      {children}
    </SharedAuthProvider>
  );
}

export function useAuth() {
  const { login, logout, refreshUser, ...rest } = useSharedAuth();

  const webLogin = async (username: string, password: string) => {
    try {
      await login(username, password, apiService, 'web');
      ErrorHandler.showSuccess('Login successful!');
    } catch (error: any) {
      ErrorHandler.showError(error, 'Login failed');
      throw error;
    }
  };

  const webLogout = async () => {
    try {
      await logout(apiService);
    } catch (error) {
      console.error('Web Logout error:', error);
    }
  };

  const webRefreshUser = async () => {
    try {
      await refreshUser(apiService);
    } catch (error) {
      console.error('Web Failed to refresh user:', error);
    }
  };

  return {
    ...rest,
    login: webLogin,
    logout: webLogout,
    refreshUser: webRefreshUser,
  };
}