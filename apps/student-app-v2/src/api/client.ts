// apps/student-app-v2/src/api/client.ts

import axios from 'axios';

// TODO: Move this to a configuration file or environment variable
const API_BASE_URL = 'http://localhost:8008/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// You can add interceptors here for handling tokens, errors, etc.
// For example:
// apiClient.interceptors.request.use(async (config) => {
//   const token = await getAccessToken(); // Function to get token from secure store
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

export default apiClient;
