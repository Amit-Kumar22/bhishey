import { NextRequest } from 'next/server';
import { 
  createSuccessResponse, 
  createErrorResponse,
  HttpStatus
} from '../../../../lib/api-utils';
import { healthCheck } from '../../../../lib/db';

/**
 * GET /api/health
 * System health check endpoint
 */
async function handleHealthCheck(request: NextRequest) {
  try {
    // Check database connection
    const dbHealth = await healthCheck();
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
      }
    };

    return createSuccessResponse(healthData);

  } catch (error) {
    console.error('Health check failed:', error);
    
    return createErrorResponse(
      'Service unhealthy',
      'health_check_failed',
      HttpStatus.SERVICE_UNAVAILABLE,
      {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}

// Export the route handler
export async function GET(request: NextRequest) {
  return handleHealthCheck(request);
}