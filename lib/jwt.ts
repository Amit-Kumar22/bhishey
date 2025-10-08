import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-production';

// Token expiration times
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days

export interface JwtPayload {
  sub: string; // user/admin ID
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Sign access token with short expiration
 */
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: 'bhesi-api',
    audience: 'bhesi-web'
  });
}

/**
 * Sign refresh token with longer expiration
 */
export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'bhesi-api',
    audience: 'bhesi-web'
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'bhesi-api',
      audience: 'bhesi-web'
    }) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'bhesi-api',
      audience: 'bhesi-web'
    }) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw new Error('Refresh token verification failed');
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  
  return authorization.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Middleware helper to verify JWT token from request
 * Returns null if no token or invalid token
 */
export function verifyRequestToken(request: NextRequest): JwtPayload | null {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return null;
    }
    
    return verifyAccessToken(token);
  } catch (error) {
    console.warn('Token verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(payload: JwtPayload, requiredRole: string): boolean {
  return payload.roles?.includes(requiredRole) ?? false;
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
}