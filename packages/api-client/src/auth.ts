import { AxiosInstance } from 'axios';
import { User } from '@/packages/types/user';
import { ApiClientConfig } from './core'; // Import ApiClientConfig for type

interface LoginCredentials {
  username: string;
  password: string;
}

export class AuthApiClient {
  private api: AxiosInstance;
  private tokenStorage: ApiClientConfig['tokenStorage']; // Correct type

  constructor(apiInstance: AxiosInstance, tokenStorage: ApiClientConfig['tokenStorage']) {
    this.api = apiInstance;
    this.tokenStorage = tokenStorage;
  }

  async login(credentials: LoginCredentials) {
    const response = await this.api.post('/auth/login/', credentials);
    const { access, refresh } = response.data;

    await Promise.resolve(this.tokenStorage.setAccessToken(access));
    await Promise.resolve(this.tokenStorage.setRefreshToken(refresh));

    return response.data;
  }

  async logout() {
    try {
      const refreshToken = await Promise.resolve(this.tokenStorage.getRefreshToken());
      if (refreshToken) {
        await this.api.post('/auth/logout/', { refresh: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await Promise.resolve(this.tokenStorage.clearTokens());
    }
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get('/auth/profile/');
    return response.data;
  }

  async updateProfile(data: any): Promise<User> {
    const response = await this.api.patch('/auth/profile/', data);
    return response.data;
  }

  async changePassword(data: { old_password: string; new_password: string }) {
    const response = await this.api.post('/auth/change-password/', data);
    return response.data;
  }

  // Helper to get access token (used by AuthContext)
  async getAccessToken(): Promise<string | null> {
    return Promise.resolve(this.tokenStorage.getAccessToken());
  }
}
