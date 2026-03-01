/**
 * API Configuration
 * Configure the API base URL for different environments
 * Updated 2025-11-24: Using tested endpoints from comprehensive API review
 */

// Get the local network IP from environment or use default
const getApiUrl = (): string => {
  // You can override this by setting API_URL environment variable
  if (process.env['API_URL']) {
    return process.env['API_URL']
  }

  // In development, use the local network IP
  // When running on a physical device or emulator, localhost won't work
  // Use your computer's local network IP instead
  if (__DEV__) {
    // Base URL without /api/v1 suffix since different endpoints use different paths
    // Tested with student_akmal user: http://192.168.0.106:8008
    return 'http://192.168.0.106:8008'
  }

  // Production API URL
  // TODO: Update this to your production API URL
  return 'https://api.eduvoice.com'
}

export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
}

// Log API URL in development
if (__DEV__) {
  console.log('🌐 API Base URL:', API_CONFIG.BASE_URL)
}
