import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import backendClient from '@/lib/api/backendClient';
import axios from 'axios';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
}

interface AuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error?: string;
  rehydrated: boolean;
}
const initialState: AuthState = { user: null, status: 'idle', rehydrated: false };

export const login = createAsyncThunk('auth/login', async (data: { email: string; password: string }) => {
  const res = await backendClient.post('/auth/login', data);
  const { token, refreshToken, user } = res.data.data;
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
  }
  return user as AuthUser;
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await backendClient.post('/auth/logout');
  } catch (error) {
    // Ignore logout errors, still clear tokens locally
    console.warn('Logout API call failed, clearing tokens locally');
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
  }
  return true;
});

/**
 * Rehydrate auth state from stored tokens
 * This function handles:
 * 1. Checking if tokens exist in localStorage
 * 2. Attempting to fetch user data
 * 3. Auto-refreshing expired tokens via interceptor
 * 4. Only clearing tokens when they are truly invalid
 */
export const rehydrate = createAsyncThunk('auth/rehydrate', async (_, { rejectWithValue }) => {
  console.log('🔍 [REHYDRATE] Starting rehydration process...');
  
  if (typeof window === 'undefined') {
    console.log('🔍 [REHYDRATE] Running on server, skipping');
    return null;
  }
  
  const token = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('refresh_token');
  
  console.log('🔍 [REHYDRATE] Token exists:', !!token);
  console.log('🔍 [REHYDRATE] Refresh token exists:', !!refreshToken);
  
  // No tokens found, user is not logged in
  if (!token || !refreshToken) {
    console.log('❌ [REHYDRATE] No tokens found in localStorage');
    return null;
  }

  try {
    console.log('🔍 [REHYDRATE] Calling /auth/me to validate token...');
    // Try to fetch user data - the interceptor will handle token refresh if needed
    const res = await backendClient.get('/auth/me');
    console.log('✅ [REHYDRATE] Successfully fetched user data:', res.data.data);
    return res.data.data as AuthUser;
  } catch (error: any) {
    console.error('❌ [REHYDRATE] Error during rehydration:', error);
    
    // Check if this is a network error (no response from server)
    if (!error.response) {
      console.warn('⚠️ [REHYDRATE] Network error during rehydration, keeping tokens for retry');
      // Keep tokens, user can retry when network is back
      return rejectWithValue('network_error');
    }

    console.log('🔍 [REHYDRATE] Error response status:', error.response?.status);
    console.log('🔍 [REHYDRATE] Request was retried:', error.config?._retry);

    // Check if token refresh was attempted and failed
    if (error.config?._retry) {
      // The interceptor already tried to refresh and failed
      // This means both access and refresh tokens are invalid
      console.info('❌ [REHYDRATE] Token refresh failed, clearing authentication');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      return null;
    }

    // For any other error (401 without retry, 403, 500, etc.)
    // The interceptor should have handled 401 with refresh
    // If we're here with 401, it means no refresh token was available
    if (error.response.status === 401 || error.response.status === 403) {
      console.info('❌ [REHYDRATE] Authentication failed, clearing tokens');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      return null;
    }

    // For server errors (500, etc.), keep tokens and let user retry
    console.warn('⚠️ [REHYDRATE] Server error during rehydration, keeping tokens for retry');
    return rejectWithValue('server_error');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Manual action to clear auth state (e.g., on token expiration detected elsewhere)
    clearAuth: (state: AuthState) => {
      state.user = null;
      state.status = 'idle';
      state.error = undefined;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Login actions
      .addCase(login.pending, (state: AuthState) => { 
        state.status = 'loading'; 
        state.error = undefined; 
      })
      .addCase(login.fulfilled, (state: AuthState, action: any) => { 
        state.status = 'authenticated'; 
        state.user = action.payload;
        state.error = undefined;
      })
      .addCase(login.rejected, (state: AuthState, action: any) => { 
        state.status = 'error'; 
        state.error = action.error.message; 
        state.user = null;
      })
      
      // Logout actions
      .addCase(logout.fulfilled, (state: AuthState) => { 
        state.status = 'idle'; 
        state.user = null;
        state.error = undefined;
      })
      .addCase(logout.rejected, (state: AuthState) => {
        // Even if logout API fails, clear local state
        state.status = 'idle';
        state.user = null;
        state.error = undefined;
      })
      
      // Rehydrate actions
      .addCase(rehydrate.pending, (state: AuthState) => { 
        // Don't change status, just show we're checking
        state.error = undefined;
      })
      .addCase(rehydrate.fulfilled, (state: AuthState, action: any) => {
        if (action.payload) {
          // Successfully rehydrated user data
          state.user = action.payload;
          state.status = 'authenticated';
          state.error = undefined;
        } else {
          // No valid tokens or user data
          state.user = null;
          state.status = 'idle';
        }
        state.rehydrated = true;
      })
      .addCase(rehydrate.rejected, (state: AuthState, action: any) => {
        // Rehydration failed, but we mark as rehydrated to allow app to continue
        // User stays in current state (may retry or need to login)
        state.rehydrated = true;
        if (action.payload === 'network_error' || action.payload === 'server_error') {
          // Keep existing user state for temporary errors
          state.error = action.payload;
        } else {
          // For auth failures, clear user
          state.user = null;
          state.status = 'idle';
        }
      });
  }
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;