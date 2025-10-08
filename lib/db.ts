import { Pool, PoolClient } from 'pg';

// Global connection pool for serverless optimization
let globalPool: Pool | null = null;

interface PoolConfig {
  connectionString: string;
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
  };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle?: boolean;
}

/**
 * Creates optimized PostgreSQL connection pool for Vercel serverless functions
 * - Implements singleton pattern to prevent connection leaks
 * - Handles SSL configuration for hosted databases
 * - Optimized timeouts for cold starts
 */
function createPool(): Pool {
  // Force recreation in development when config changes
  if (globalPool && process.env.NODE_ENV !== 'development') {
    return globalPool;
  }
  
  // Close existing pool if recreating
  if (globalPool && process.env.NODE_ENV === 'development') {
    globalPool.end().catch(() => {});
    globalPool = null;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // SSL configuration for hosted databases (Aiven, AWS RDS, etc.)
  // When DB_ALLOW_SELF_SIGNED is true, disable certificate verification
  const allowSelfSigned = process.env.DB_ALLOW_SELF_SIGNED === 'true';
  const sslConfig = databaseUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production'
    ? {
        rejectUnauthorized: allowSelfSigned ? false : (process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'),
        ...(process.env.DB_SSL_CA && { ca: process.env.DB_SSL_CA })
      }
    : undefined;

  // For databases with self-signed certs, we need to explicitly configure SSL
  const finalSslConfig = sslConfig ? sslConfig : false;
  
  console.log('[DB] SSL Config:', { 
    allowSelfSigned, 
    rejectUnauthorized: sslConfig?.rejectUnauthorized,
    sslEnabled: !!finalSslConfig 
  });

  const config: PoolConfig = {
    connectionString: databaseUrl,
    ssl: finalSslConfig as any, // Type assertion needed for boolean | object
    // Optimized for serverless: smaller pool, faster timeouts
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    idleTimeoutMillis: 30000, // 30s - close idle connections quickly
    connectionTimeoutMillis: 10000, // 10s - fail fast on connection issues
    allowExitOnIdle: true // Allow process to exit when all connections idle
  };

  globalPool = new Pool(config);

  // Handle pool errors to prevent crashes
  globalPool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });

  // Graceful shutdown handler
  process.on('SIGINT', async () => {
    if (globalPool) {
      await globalPool.end();
      globalPool = null;
    }
  });

  return globalPool;
}

/**
 * Get database connection pool instance
 * Lazy initialization ensures connection only when needed
 */
export function getPool(): Pool {
  return createPool();
}

/**
 * Execute database query with automatic connection management
 * @param text SQL query string
 * @param params Query parameters
 * @returns Query result
 */
export async function query(text: string, params?: any[]) {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in production
    if (duration > 1000 && process.env.NODE_ENV === 'production') {
      console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', {
      query: text.substring(0, 100),
      params: params?.slice(0, 5), // Log first 5 params only
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Execute multiple queries in a transaction
 * Automatically handles rollback on errors
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check for database connection
 * Used by /api/health endpoint
 */
export async function healthCheck(): Promise<{ status: string; latency: number }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    return {
      status: 'healthy',
      latency: Date.now() - start
    };
  } catch (error) {
    throw new Error(`Database health check failed: ${error}`);
  }
}

// Export pool for advanced usage
export { globalPool as pool };