import React, { ReactNode } from 'react';
import { AuthProvider as SharedAuthProvider, useAuth as useSharedAuth } from '@/packages/context/auth/AuthContext';
import apiService from '@/services/api'; // Staff-app specific apiService

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SharedAuthProvider appType="staff" apiService={apiService}>
      {children}
    </SharedAuthProvider>
  );
}

export function useAuth() {
  const { login, logout, refreshUser, ...rest } = useSharedAuth();

  const staffLogin = async (username: string, password: string) => {
    try {
      await login(username, password, apiService, 'staff');
      // No app-specific ErrorHandler in staff-app, so no success toast here
    } catch (error: any) {
      // No app-specific ErrorHandler in staff-app, so just re-throw
      throw error;
    }
  };

  const staffLogout = async () => {
    try {
      await logout(apiService);
    } catch (error) {
      console.error('Staff App Logout error:', error);
    }
  };

  const staffRefreshUser = async () => {
    try {
      await refreshUser(apiService);
    } catch (error) {
      console.error('Staff App Failed to refresh user:', error);
    }
  };

  return {
    ...rest,
    login: staffLogin,
    logout: staffLogout,
    refreshUser: staffRefreshUser,
  };
}
