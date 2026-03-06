import axios, { AxiosInstance, AxiosError } from 'axios';

interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  tokenStorage: {
    getAccessToken: () => Promise<string | null> | string | null;
    setAccessToken: (token: string) => Promise<void> | void;
    getRefreshToken: () => Promise<string | null> | string | null;
    setRefreshToken: (token: string) => Promise<void> | void;
    clearTokens: () => Promise<void> | void;
  };
  onTokenRefreshFailure?: () => void;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const api = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout || 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth token
  api.interceptors.request.use(
    async (reqConfig) => {
      const accessToken = await Promise.resolve(config.tokenStorage.getAccessToken());
      if (accessToken) {
        reqConfig.headers.Authorization = `Bearer ${accessToken}`;
      }
      return reqConfig;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle token refresh
  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await Promise.resolve(config.tokenStorage.getRefreshToken());
          if (!refreshToken) {
            throw new Error('No refresh token available.');
          }

          const response = await axios.post(`${config.baseURL}auth/token/refresh/`, {
            refresh: refreshToken,
          });

          const newAccessToken = response.data.access;
          await Promise.resolve(config.tokenStorage.setAccessToken(newAccessToken));

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          await Promise.resolve(config.tokenStorage.clearTokens());
          config.onTokenRefreshFailure?.();
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
}
