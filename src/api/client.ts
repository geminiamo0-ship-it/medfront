import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { API_URL } from '@/lib/env';
import { getToken, clearToken } from '@/lib/token';
import { decryptPayload, isEncryptedPayload } from '@/lib/crypto';

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

const http = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set?.('Authorization', `Bearer ${token}`);
    if (!config.headers.set) {
      (config.headers as Record<string, unknown>).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Perform a request, then transparently decrypt the response when the backend
 * returns an envelope (`{ enc: true, v }`). All authenticated endpoints encrypt.
 */
export async function apiRequest<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  const tokenAtRequest = getToken();
  try {
    const res = await http.request(config);
    let data: unknown = res.data;

    if (isEncryptedPayload(data)) {
      if (!tokenAtRequest) {
        throw new ApiError('Encrypted response but no token available', 500, data);
      }
      data = await decryptPayload(data, tokenAtRequest);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 0;
      const body = error.response?.data as Record<string, unknown> | undefined;

      if (status === 401) {
        clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.replace('/login');
        }
      }

      const message =
        (body?.message as string) ||
        error.message ||
        'Request failed';
      const code = body?.code as string | undefined;
      throw new ApiError(message, status, body, code);
    }

    throw error;
  }
}

export const api = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, url, method: 'GET' }),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, url, method: 'POST', data }),
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, url, method: 'PUT', data }),
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, url, method: 'PATCH', data }),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, url, method: 'DELETE' }),
};