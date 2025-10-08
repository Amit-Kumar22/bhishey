import { NextRequest } from 'next/server';
import { z } from 'zod';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequestBody,
  HttpStatus,
  checkRateLimit,
  getClientIP
} from '../../../../../lib/api-utils';
import { generateTokenPair } from '../../../../../lib/jwt';
import { query } from '../../../../../lib/db';
import bcrypt from 'bcryptjs';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

/**
 * POST /api/auth/login
 * Authenticate admin user and return JWT tokens
 */
async function handleLogin(request: NextRequest) {
  // Rate limiting: 10 attempts per 15 minutes per IP
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`login:${clientIP}`, 10, 15 * 60 * 1000);
  
  if (!rateLimit.allowed) {
    return createErrorResponse(
      'Too many login attempts. Please try again later.',
      'rate_limit_exceeded',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // Validate request body
  const validation = await validateRequestBody(request, loginSchema);
  if (!validation.success) {
    return validation.error;
  }

  const { email, password } = validation.data;

  try {
    // Find user by email
    const result = await query(
      'SELECT id, email, "passwordHash", roles, active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return createErrorResponse(
        'Invalid credentials',
        'invalid_credentials',
        HttpStatus.UNAUTHORIZED
      );
    }

    const admin = result.rows[0];

    // Parse roles - PostgreSQL returns enum array as string like "{ADMIN}"
    let roles = admin.roles || [];
    if (typeof roles === 'string') {
      // Convert PostgreSQL array format "{ADMIN,USER}" to JS array
      roles = roles.replace(/[{}]/g, '').split(',').filter(Boolean);
    }


    // Check if account is active
    if (!admin.active) {
      return createErrorResponse(
        'Account is inactive',
        'account_inactive',
        HttpStatus.FORBIDDEN
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return createErrorResponse(
        'Invalid credentials',
        'invalid_credentials',
        HttpStatus.UNAUTHORIZED
      );
    }

    // Check if user has ADMIN role
    if (!roles.includes('ADMIN')) {
      return createErrorResponse(
        'Insufficient permissions',
        'forbidden',
        HttpStatus.FORBIDDEN
      );
    }

    // Generate JWT tokens
    const tokenPayload = {
      sub: admin.id,
      email: admin.email,
      roles: roles
    };

    const tokens = generateTokenPair(tokenPayload);

    // Update last login timestamp
    await query(
      'UPDATE users SET "lastLoginAt" = NOW() WHERE id = $1',
      [admin.id]
    );

    // Return success response
    return createSuccessResponse({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: admin.id,
        email: admin.email,
        roles: roles
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse(
      'Authentication failed',
      'auth_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

// Export the route handler
export async function POST(request: NextRequest) {
  return handleLogin(request);
}