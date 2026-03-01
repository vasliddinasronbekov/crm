'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import { User, UserRole } from '@/packages/types/user';
import { RBAC } from '@/packages/utils/roleHelpers';

interface ApiService {
  getAccessToken: () => Promise<string | null>;
  getProfile: () => Promise<User>;
  login: (credentials: { username: string; password: string }) => Promise<any>;
  logout: () => Promise<any>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  role: UserRole;
  displayName: string;
  roleLabel: string;
  login: (username: string, password: string, apiService: ApiService, appType: 'web' | 'staff' | 'student') => Promise<void>;
  logout: (apiService: ApiService) => Promise<void>;
  refreshUser: (apiService: ApiService) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface SharedAuthProviderProps {
  children: ReactNode;
  apiService: ApiService;
  appType: 'web' | 'staff' | 'student';
}

export function AuthProvider({ children, apiService, appType }: SharedAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAppAccess = (userData: User, currentAppType: 'web' | 'staff' | 'student'): boolean => {
    switch (currentAppType) {
      case 'web':
        return RBAC.isStaff(userData) || RBAC.isSuperuser(userData) || RBAC.isTeacher(userData);
      case 'staff':
        return RBAC.isStaff(userData) || RBAC.isSuperuser(userData) || RBAC.isTeacher(userData);
      case 'student':
        return RBAC.isStudent(userData);
      default:
        return false;
    }
  };

  const getAccessDeniedMessage = (currentAppType: 'web' | 'staff' | 'student'): string => {
    switch (currentAppType) {
      case 'web':
      case 'staff':
        return 'Access denied. This application is for staff and teachers only.';
      case 'student':
        return 'Access denied. This application is for students only.';
      default:
        return 'Access denied.';
    }
  };

  // Initial authentication check on mount
  useEffect(() => {
    const performAuthCheck = async () => {
      setIsLoading(true);
      try {
        const accessToken = await apiService.getAccessToken();

        if (accessToken) {
          const userData = await apiService.getProfile();
          if (checkAppAccess(userData, appType)) {
            setUser(userData);
          } else {
            await apiService.logout();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    performAuthCheck();
  }, [apiService, appType]); // Depend on apiService and appType

  const login = async (username: string, password: string, loginApiService: ApiService, loginAppType: 'web' | 'staff' | 'student') => {
    setIsLoading(true);
    try {
      await loginApiService.login({ username, password });
      const userData = await loginApiService.getProfile();

      if (!checkAppAccess(userData, loginAppType)) {
        await loginApiService.logout();
        throw new Error(getAccessDeniedMessage(loginAppType));
      }

      setUser(userData);
    } catch (error: any) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (logoutApiService: ApiService) => {
    setIsLoading(true);
    try {
      await logoutApiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async (refreshApiService: ApiService) => {
    try {
      const userData = await refreshApiService.getProfile();
      if (checkAppAccess(userData, appType)) { // Use the appType from props for refresh
        setUser(userData);
      } else {
        await refreshApiService.logout();
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = RBAC.isAdmin(user);
  const isTeacher = RBAC.isTeacher(user);
  const isStaff = RBAC.isStaff(user);
  const isSuperuser = RBAC.isSuperuser(user);
  const role = RBAC.getRole(user);
  const displayName = RBAC.getDisplayName(user);
  const roleLabel = RBAC.getRoleLabel(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        isTeacher,
        isStaff,
        isSuperuser,
        role,
        displayName,
        roleLabel,
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
