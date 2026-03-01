import React, { ReactNode } from 'react';
import { AuthProvider as SharedAuthProvider, useAuth as useSharedAuth } from '@/packages/context/auth/AuthContext';
import apiService from '../services/api'; // Student-app specific apiService

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SharedAuthProvider appType="student" apiService={apiService}>
      {children}
    </SharedAuthProvider>
  );
}

export function useAuth() {
  const { login, logout, refreshUser, ...rest } = useSharedAuth();

  const studentLogin = async (username: string, password: string) => {
    try {
      await login(username, password, apiService, 'student');
      // No app-specific ErrorHandler in student-app, so no success toast here
    } catch (error: any) {
      // No app-specific ErrorHandler in student-app, so just re-throw
      throw error;
    }
  };

  const studentLogout = async () => {
    try {
      await logout(apiService);
    } catch (error) {
      console.error('Student App Logout error:', error);
    }
  };

  const studentRefreshUser = async () => {
    try {
      await refreshUser(apiService);
    } catch (error) {
      console.error('Student App Failed to refresh user:', error);
    }
  };

  return {
    ...rest,
    login: studentLogin,
    logout: studentLogout,
    refreshUser: studentRefreshUser,
  };
}
