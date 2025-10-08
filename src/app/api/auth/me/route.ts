import { NextRequest } from 'next/server';
import { 
  createMethodHandler, 
  createSuccessResponse, 
  createErrorResponse,
  HttpStatus
} from '../../../../../lib/api-utils';
import { verifyRequestToken } from '../../../../../lib/jwt';
import { query } from '../../../../../lib/db';

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
async function handleMe(request: NextRequest) {
  // Verify JWT token
  const tokenPayload = verifyRequestToken(request);
  
  if (!tokenPayload) {
    return createErrorResponse(
      'Authentication required',
      'unauthorized',
      HttpStatus.UNAUTHORIZED
    );
  }

  try {
    // Fetch current user data from database
    const result = await query(
      'SELECT id, email, roles, active, "createdAt", "updatedAt" FROM users WHERE id = $1',
      [tokenPayload.sub]
    );

    if (result.rows.length === 0) {
      return createErrorResponse(
        'User not found',
        'user_not_found',
        HttpStatus.NOT_FOUND
      );
    }

    const user = result.rows[0];

    // Check if user is still active
    if (!user.active) {
      return createErrorResponse(
        'Account is inactive',
        'account_inactive',
        HttpStatus.FORBIDDEN
      );
    }

    return createSuccessResponse({
      id: user.id,
      email: user.email,
      roles: user.roles || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

  } catch (error) {
    console.error('Get user error:', error);
    return createErrorResponse(
      'Failed to fetch user information',
      'user_fetch_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

// Export the route handlers
export const GET = handleMe;