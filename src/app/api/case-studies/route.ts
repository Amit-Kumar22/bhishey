import { NextRequest } from 'next/server';
import { z } from 'zod';
import { 
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
const caseStudyCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug too long'),
  clientName: z.string().min(1, 'Client name is required'),
  industry: z.string().min(1, 'Industry is required'),
  challenge: z.string().min(1, 'Challenge is required'),
  solution: z.string().min(1, 'Solution is required'),
  results: z.array(z.object({
    metric: z.string(),
    value: z.string()
  })).default([]),
  techStack: z.array(z.string()).default([]),
  heroImage: z.union([
    z.object({
      url: z.string(),
      alt: z.string().optional()
    }),
    z.string()
  ]),
  published: z.boolean().default(true)
});

const caseStudyUpdateSchema = caseStudyCreateSchema.partial();

/**
 * GET /api/case-studies
 * List all published case studies with pagination
 */
async function handleGetCaseStudies(request: NextRequest) {
  try {
    const page = getNumericQueryParam(request, 'page', 1) || 1;
    const limit = Math.min(getNumericQueryParam(request, 'limit', 10) || 10, 50); // Max 50 per page
    const industry = getQueryParam(request, 'industry');
    const search = getQueryParam(request, 'search');
    
    const offset = (page - 1) * limit;
    
    // Build dynamic query
    let baseQuery = `
      SELECT id, title, slug, "clientName", industry, challenge, solution, results, "techStack", "heroImage", "publishedAt", "createdAt", "updatedAt"
      FROM case_studies 
      WHERE "publishedAt" IS NOT NULL
    `;
    
    const queryParams: any[] = [];
    let paramCounter = 1;
    
    // Add filters
    if (industry) {
      baseQuery += ` AND industry ILIKE $${paramCounter}`;
      queryParams.push(`%${industry}%`);
      paramCounter++;
    }
    
    if (search) {
      baseQuery += ` AND (title ILIKE $${paramCounter} OR "clientName" ILIKE $${paramCounter} OR challenge ILIKE $${paramCounter})`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }
    
    // Add ordering and pagination
    baseQuery += ` ORDER BY "createdAt" DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    queryParams.push(limit, offset);
    
    const result = await query(baseQuery, queryParams);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM case_studies WHERE "publishedAt" IS NOT NULL';
    const countParams: any[] = [];
    let countParamCounter = 1;
    
    if (industry) {
      countQuery += ` AND industry ILIKE $${countParamCounter}`;
      countParams.push(`%${industry}%`);
      countParamCounter++;
    }
    
    if (search) {
      countQuery += ` AND (title ILIKE $${countParamCounter} OR "clientName" ILIKE $${countParamCounter} OR challenge ILIKE $${countParamCounter})`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    return createSuccessResponse({
      caseStudies: result.rows,
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
    console.error('List case studies error:', error);
    return createErrorResponse(
      'Failed to fetch case studies',
      'fetch_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/case-studies
 * Create new case study (requires ADMIN role)
 */
async function handleCreateCaseStudy(request: NextRequest) {
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
  const validation = await validateRequestBody(request, caseStudyCreateSchema);
  if (!validation.success) {
    return validation.error;
  }

  const { title, slug, clientName, industry, challenge, solution, results, techStack, heroImage, published } = validation.data;

  try {
    // Check if slug already exists
    const existingCaseStudy = await query(
      'SELECT id FROM case_studies WHERE slug = $1',
      [slug]
    );
    
    if (existingCaseStudy.rows.length > 0) {
      return createErrorResponse(
        'A case study with this slug already exists',
        'slug_exists',
        HttpStatus.CONFLICT
      );
    }

    // Insert new case study
    // Generate a CUID for the ID
    const { init } = await import('@paralleldrive/cuid2');
    const createId = init({ length: 25 });
    const caseStudyId = createId();
    
    const result = await query(`
      INSERT INTO case_studies (id, title, slug, "clientName", industry, challenge, solution, results, "techStack", "heroImage", "publishedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, title, slug, "clientName", industry, challenge, solution, results, "techStack", "heroImage", "publishedAt", "createdAt", "updatedAt"
    `, [
      caseStudyId,
      title,
      slug,
      clientName,
      industry,
      challenge,
      solution,
      results.map(r => JSON.stringify(r)), // Array of JSON strings for Json[] type
      techStack,
      typeof heroImage === 'string' ? JSON.stringify({ url: heroImage }) : JSON.stringify(heroImage),
      published ? new Date() : new Date() // publishedAt is required, always set it
    ]);

    return createSuccessResponse(result.rows[0], HttpStatus.CREATED);

  } catch (error: any) {
    console.error('Create case study error:', error);
    console.error('Error details:', error.message, error.detail);
    return createErrorResponse(
      'Failed to create case study',
      'create_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

// Export the route handlers
export const GET = handleGetCaseStudies;
export const POST = handleCreateCaseStudy;
