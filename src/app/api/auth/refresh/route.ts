import { NextRequest } from 'next/server';
import { z } from 'zod';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequestBody,
  HttpStatus
} from '../../../../../lib/api-utils';
import { verifyRefreshToken, generateTokenPair } from '../../../../../lib/jwt';

// Validation schema for refresh token
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

/**
 * POST /api/auth/refresh
 * Exchange refresh token for new access token
 */
async function handleRefresh(request: NextRequest) {
  // Validate request body
  const validation = await validateRequestBody(request, refreshSchema);
  if (!validation.success) {
    return validation.error;
  }

  const { refreshToken } = validation.data;

  try {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    
    // Generate new token pair
    const newTokens = generateTokenPair({
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles
    });

    return createSuccessResponse({
      token: newTokens.accessToken,
      refreshToken: newTokens.refreshToken
    });

  } catch (error) {
    return createErrorResponse(
      'Invalid or expired refresh token',
      'invalid_refresh_token',
      HttpStatus.UNAUTHORIZED
    );
  }
}

// Export the route handler
export async function POST(request: NextRequest) {
  return handleRefresh(request);
}