import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

/**
 * HTTP Status Codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Standard API response format
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = HttpStatus.OK
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString()
    }
  }, { status });
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  code: string = 'internal_error',
  status: number = HttpStatus.INTERNAL_SERVER_ERROR,
  details?: any
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  }, { status });
}

/**
 * Validate request body against Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: createErrorResponse(
          'Validation failed',
          'validation_error',
          HttpStatus.BAD_REQUEST,
          error.issues
        )
      };
    }
    
    return {
      success: false,
      error: createErrorResponse(
        'Invalid JSON in request body',
        'invalid_json',
        HttpStatus.BAD_REQUEST
      )
    };
  }
}

/**
 * Extract and validate query parameters
 */
export function getQueryParam(
  request: NextRequest,
  param: string,
  defaultValue?: string
): string | undefined {
  const { searchParams } = new URL(request.url);
  return searchParams.get(param) || defaultValue;
}

/**
 * Extract numeric query parameter
 */
export function getNumericQueryParam(
  request: NextRequest,
  param: string,
  defaultValue?: number
): number | undefined {
  const value = getQueryParam(request, param);
  if (!value) return defaultValue;
  
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Method guard for API routes
 */
export function createMethodHandler(handlers: {
  GET?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  POST?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  PUT?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  PATCH?: (request: NextRequest, context?: any) => Promise<NextResponse>;
  DELETE?: (request: NextRequest, context?: any) => Promise<NextResponse>;
}) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const method = request.method as keyof typeof handlers;
    const handler = handlers[method];
    
    if (!handler) {
      return createErrorResponse(
        `Method ${method} not allowed`,
        'method_not_allowed',
        HttpStatus.METHOD_NOT_ALLOWED
      );
    }
    
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`API Error in ${method} ${request.url}:`, error);
      
      return createErrorResponse(
        'Internal server error',
        'internal_error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  };
}

/**
 * Rate limiting helper for API routes
 * Simple in-memory rate limiter (use Redis in production for multi-instance)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean up expired entries
  rateLimitMap.forEach((value, key) => {
    if (value.resetTime < now) {
      rateLimitMap.delete(key);
    }
  });
  
  const record = rateLimitMap.get(identifier);
  
  if (!record || record.resetTime < windowStart) {
    // First request or window expired
    const resetTime = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime
    };
  }
  
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }
  
  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Vercel provides the real IP in x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return request.headers.get('x-real-ip') || 
         request.headers.get('cf-connecting-ip') || 
         'unknown';
}

/**
 * CORS helper for API routes
 */
export function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export function handleCorsPrelight(): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}