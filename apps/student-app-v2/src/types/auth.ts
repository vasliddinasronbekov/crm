/**
 * Authentication Type Definitions
 */

// ============================================================================
// USER TYPES
// ============================================================================

export type UserRole = 'student' | 'teacher' | 'parent' | 'admin' | 'staff';

export interface User {
  id: number;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface TokenRefreshRequest {
  refresh: string;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// PROFILE
// ============================================================================

export interface ProfileUpdateRequest {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface ProfileResponse extends User {
  bio?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  language?: string;
}

// ============================================================================
// AUTH STATE
// ============================================================================

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}
