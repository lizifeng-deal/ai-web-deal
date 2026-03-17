import { request as umiRequest } from '@umijs/max';
const API_PREFIX = '/api';
const ABS_URL = /^https?:\/\//;

export type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
};

function withAuth(headers?: Record<string, string>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { ...(headers || {}), Authorization: `Bearer ${token}` } : headers || {};
}

async function baseRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  options: RequestOptions = {},
): Promise<T> {
  const finalUrl = ABS_URL.test(url) ? url : `${API_PREFIX}${url}`;
  return umiRequest<T>(finalUrl, {
    method,
    headers: withAuth(options.headers),
    params: options.params,
    data: options.data,
    timeout: options.timeout,
  });
}

export function get<T>(url: string, options?: RequestOptions) {
  return baseRequest<T>(url, 'GET', options);
}

export function post<T>(url: string, data?: any, options?: Omit<RequestOptions, 'data'>) {
  return baseRequest<T>(url, 'POST', { ...(options || {}), data });
}

export function put<T>(url: string, data?: any, options?: Omit<RequestOptions, 'data'>) {
  return baseRequest<T>(url, 'PUT', { ...(options || {}), data });
}

export function del<T>(url: string, options?: RequestOptions) {
  return baseRequest<T>(url, 'DELETE', options);
}

export default { get, post, put, del };