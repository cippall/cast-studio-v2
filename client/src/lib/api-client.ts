/**
 * Axios API client for Cast Studio v2.
 * Base URL is proxied via Vite (/api → localhost:3001).
 * Session cookies are handled automatically by the browser.
 */
import axios from 'axios';
import type { ApiError } from '@cast/types';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // send session cookies
});

/**
 * Response interceptor: unwrap data, standardize error shape.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const apiError = error.response.data as ApiError;
      return Promise.reject({
        ...(apiError.error ?? {
          code: 'UNKNOWN_ERROR',
          message: error.response.statusText ?? 'An unknown error occurred',
        }),
        status: error.response.status,
      });
    }
    if (error.request) {
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Network error — please check your connection',
      });
    }
    return Promise.reject({
      code: 'REQUEST_ERROR',
      message: error.message,
    });
  },
);

export default apiClient;
