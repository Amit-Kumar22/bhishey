import { NextRequest } from 'next/server';
import { 
  createSuccessResponse
} from '../../../../../lib/api-utils';

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 * For JWT-based auth, logout is handled client-side by removing tokens.
 * In a more advanced setup, you might want to blacklist tokens server-side.
 */
export async function POST(request: NextRequest) {
  // For JWT-based auth, logout is handled client-side by removing tokens
  // The client will remove tokens from localStorage after this response
  
  return createSuccessResponse({
    message: 'Logged out successfully'
  });
}
