/**
 * API Configuration
 * Configure the API base URL for different environments.
 *
 * Keep BASE_URL as API host root (without trailing slash). Endpoints in
 * services already include their full path (for example "/api/v1/...").
 */

const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, '')

const getApiUrl = (): string => {
  const explicitUrl = process.env['EXPO_PUBLIC_API_URL'] || process.env['API_URL']
  if (explicitUrl) {
    return normalizeBaseUrl(explicitUrl)
  }

  if (__DEV__) {
    // Local network IP for emulator/device testing.
    return 'https://api.crmai.uz'
  }

  // Production fallback for release builds.
  return 'https://api.crmai.uz'
}

export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
}

// Log API URL in development.
if (__DEV__) {
  console.log('🌐 API Base URL:', API_CONFIG.BASE_URL)
}
