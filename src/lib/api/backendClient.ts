import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from '@/lib/config/api';

export const backendClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

backendClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track if we're currently refreshing to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Add subscribers waiting for token refresh
function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

// Notify all subscribers when token is refreshed
function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

backendClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean });
    
    // If no response (network error) or already retried, just reject
    if (!error.response || original?._retry) {
      return Promise.reject(error);
    }
    
    // Don't attempt refresh on refresh endpoint itself, logout, or login endpoints
    if (original.url && (
      original.url.includes('/auth/refresh') || 
      original.url.includes('/auth/logout') ||
      original.url.includes('/auth/login')
    )) {
      return Promise.reject(error);
    }
    
    // Handle 401 Unauthorized errors with token refresh
    if (error.response.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        // No refresh token available, clear any stale auth token
        localStorage.removeItem('auth_token');
        return Promise.reject(error);
      }

      // Mark this request as retried
      original._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (original.headers) {
              original.headers.Authorization = `Bearer ${token}`;
            }
            resolve(backendClient.request(original));
          });
        });
      }

      // Start refresh process
      isRefreshing = true;

      try {
        const res = await backendClient.post('/auth/refresh', { refreshToken });
        const { token, refreshToken: newRefresh } = res.data.data;
        
        // Update stored tokens
        localStorage.setItem('auth_token', token);
        localStorage.setItem('refresh_token', newRefresh);
        
        // Update the authorization header for the original request
        if (original.headers) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        
        // Notify all queued requests
        onRefreshed(token);
        isRefreshing = false;
        
        // Retry the original request with new token
        return backendClient.request(original);
        
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        
        // Only clear tokens and redirect if refresh truly failed with auth error
        const refreshErr = refreshError as AxiosError;
        if (refreshErr.response?.status === 401 || refreshErr.response?.status === 403) {
          console.info('Token refresh failed, clearing authentication');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          
          // Only redirect if we're in an admin area and not already on login page
          if (typeof window !== 'undefined' && 
              window.location.pathname.startsWith('/admin') && 
              !window.location.pathname.includes('/admin/login')) {
            // Use setTimeout to avoid redirect during request handling
            setTimeout(() => {
              window.location.href = '/admin/login';
            }, 100);
          }
        }
        
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default backendClient;