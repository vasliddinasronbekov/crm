// Shared Configuration
export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008/api/v1',
    timeout: 30000,
  },
  auth: {
    tokenKey: 'edu_access_token',
    refreshTokenKey: 'edu_refresh_token',
  },
  app: {
    name: 'EDU Platform',
    version: '1.0.0',
  },
}
