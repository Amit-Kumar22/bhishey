import { NextRequest } from 'next/server';
import { z } from 'zod';
import { 
  createMethodHandler, 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequestBody,
  getQueryParam,
  getNumericQueryParam,
  HttpStatus
} from '../../../../lib/api-utils';
import { verifyRequestToken, hasRole } from '../../../../lib/jwt';
import { query } from '../../../../lib/db';

// Validation schemas
const blogCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug too long'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  tags: z.array(z.string()).default([]),
  readingMinutes: z.number().int().positive().default(5),
  heroImage: z.union([
    z.object({
      url: z.string(),
      alt: z.string().optional()
    }),
    z.string(),
    z.null()
  ]).optional(),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional()
  }).default({}),
  published: z.boolean().default(true)
});

const blogUpdateSchema = blogCreateSchema.partial();

/**
 * GET /api/blogs
 * List all published blogs with pagination
 */
async function handleGetBlogs(request: NextRequest) {
  try {
    const page = getNumericQueryParam(request, 'page', 1) || 1;
    const limit = Math.min(getNumericQueryParam(request, 'limit', 10) || 10, 50); // Max 50 per page
    const tag = getQueryParam(request, 'tag');
    const search = getQueryParam(request, 'search');
    
    const offset = (page - 1) * limit;
    
    // Build dynamic query
    let baseQuery = `
      SELECT id, title, slug, body, excerpt, tags, "readingMinutes", "heroImage", seo, "publishedAt", "createdAt", "updatedAt"
      FROM blog_posts 
      WHERE "publishedAt" IS NOT NULL
    `;
    
    const queryParams: any[] = [];
    let paramCounter = 1;
    
    // Add filters
    if (tag) {
      baseQuery += ` AND $${paramCounter} = ANY(tags)`;
      queryParams.push(tag);
      paramCounter++;
    }
    
    if (search) {
      baseQuery += ` AND (title ILIKE $${paramCounter} OR excerpt ILIKE $${paramCounter})`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }
    
    // Add ordering and pagination
    baseQuery += ` ORDER BY "createdAt" DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    queryParams.push(limit, offset);
    
    const result = await query(baseQuery, queryParams);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM blog_posts WHERE "publishedAt" IS NOT NULL';
    const countParams: any[] = [];
    let countParamCounter = 1;
    
    if (tag) {
      countQuery += ` AND $${countParamCounter} = ANY(tags)`;
      countParams.push(tag);
      countParamCounter++;
    }
    
    if (search) {
      countQuery += ` AND (title ILIKE $${countParamCounter} OR excerpt ILIKE $${countParamCounter})`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    return createSuccessResponse({
      blogs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('List blogs error:', error);
    return createErrorResponse(
      'Failed to fetch blogs',
      'fetch_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/blogs
 * Create new blog (requires ADMIN role)
 */
async function handleCreateBlog(request: NextRequest) {
  // Log raw request body BEFORE anything
  try {
    const clonedRequest = request.clone();
    const rawBody = await clonedRequest.json();
  } catch (e) {
    console.error('[Blog Create] Failed to parse request:', e);
  }

  // Verify authentication and authorization
  const tokenPayload = verifyRequestToken(request);
  
  if (!tokenPayload || !hasRole(tokenPayload, 'ADMIN')) {
    return createErrorResponse(
      'Admin access required',
      'forbidden',
      HttpStatus.FORBIDDEN
    );
  }

  // Validate request body
  const validation = await validateRequestBody(request, blogCreateSchema);
  if (!validation.success) {
    return validation.error;
  }

  const { title, slug, content, excerpt, tags, readingMinutes, heroImage, seo, published } = validation.data;

 

  try {
    // Check if slug already exists
    const existingBlog = await query(
      'SELECT id FROM blog_posts WHERE slug = $1',
      [slug]
    );
    
    if (existingBlog.rows.length > 0) {
      return createErrorResponse(
        'A blog with this slug already exists',
        'slug_exists',
        HttpStatus.CONFLICT
      );
    }

    // Insert new blog
    // Generate a CUID for the ID
    const { init } = await import('@paralleldrive/cuid2');
    const createId = init({ length: 25 });
    const blogId = createId();
    
    // Prepare parameters with proper type handling
    // heroImage must be JSON object, not plain string
    let heroImageParam = null;
    if (heroImage) {
      if (typeof heroImage === 'string') {
        // Wrap base64 string or URL in JSON object
        heroImageParam = JSON.stringify({ url: heroImage });
      } else {
        heroImageParam = JSON.stringify(heroImage);
      }
    }
    const seoParam = JSON.stringify(seo || {});
    
    const result = await query(`
      INSERT INTO blog_posts (id, title, slug, body, excerpt, tags, "readingMinutes", "heroImage", seo, "publishedAt", "authorId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, title, slug, body, excerpt, tags, "readingMinutes", "heroImage", seo, "publishedAt", "createdAt", "updatedAt"
    `, [
      blogId,
      title,
      slug,
      content,
      excerpt,
      tags,
      readingMinutes,
      heroImageParam,
      seoParam,
      published ? new Date() : new Date(), // publishedAt is required, so set to now
      tokenPayload.sub
    ]);

    return createSuccessResponse(result.rows[0], HttpStatus.CREATED);

  } catch (error: any) {

    return createErrorResponse(
      `Failed to create blog: ${error.message || 'Unknown error'}`,
      'create_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

// Export the route handlers
export const GET = handleGetBlogs;
export const POST = handleCreateBlog;