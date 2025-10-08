import { NextRequest } from 'next/server';
import { z } from 'zod';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequestBody,
  HttpStatus
} from '../../../../../lib/api-utils';
import { verifyRequestToken, hasRole } from '../../../../../lib/jwt';
import { query } from '../../../../../lib/db';

// Validation schema for case study updates
const caseStudyUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug too long').optional(),
  clientName: z.string().min(1, 'Client name is required').optional(),
  industry: z.string().min(1, 'Industry is required').optional(),
  challenge: z.string().min(1, 'Challenge is required').optional(),
  solution: z.string().min(1, 'Solution is required').optional(),
  results: z.array(z.object({
    metric: z.string(),
    value: z.string()
  })).optional(),
  techStack: z.array(z.string()).optional(),
  heroImage: z.union([
    z.object({
      url: z.string(),
      alt: z.string().optional()
    }),
    z.string(),
    z.null()
  ]).optional(),
  published: z.boolean().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  try {
    const result = await query(`
      SELECT 
        cs.id, cs.title, cs.slug, cs."clientName", cs.industry, cs.challenge, cs.solution, 
        cs.results, cs."techStack", cs."heroImage", cs."publishedAt", cs."createdAt", cs."updatedAt"
      FROM case_studies cs
      WHERE cs.slug = $1 AND cs."publishedAt" IS NOT NULL
    `, [slug]);

    if (result.rows.length === 0) {
      return createErrorResponse(
        'Case study not found',
        'not_found',
        HttpStatus.NOT_FOUND
      );
    }

    const caseStudy = result.rows[0];
    
    return createSuccessResponse(caseStudy);
  } catch (error) {
    console.error('Database error in GET /api/case-studies/[slug]:', error);
    return createErrorResponse(
      'Failed to retrieve case study',
      'database_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
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
  const validation = await validateRequestBody(request, caseStudyUpdateSchema);
  if (!validation.success) {
    return validation.error;
  }

  const updateData = validation.data;

  try {
    // Check if case study exists - support both slug and id
    const checkResult = await query(
      'SELECT id, slug FROM case_studies WHERE slug = $1 OR id = $1',
      [slug]
    );

    if (checkResult.rows.length === 0) {
      return createErrorResponse(
        'Case study not found',
        'not_found',
        HttpStatus.NOT_FOUND
      );
    }
    
    const caseStudyId = checkResult.rows[0].id;
    const actualSlug = checkResult.rows[0].slug;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (updateData.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(updateData.title);
    }

    if (updateData.slug !== undefined) {
      // Check if new slug already exists (excluding current case study)
      const slugCheck = await query(
        'SELECT id FROM case_studies WHERE slug = $1 AND id != $2',
        [updateData.slug, caseStudyId]
      );
      
      if (slugCheck.rows.length > 0) {
        return createErrorResponse(
          'Case study with this slug already exists',
          'duplicate_slug',
          HttpStatus.CONFLICT
        );
      }
      
      updateFields.push(`slug = $${paramIndex++}`);
      updateValues.push(updateData.slug);
    }

    if (updateData.clientName !== undefined) {
      updateFields.push(`"clientName" = $${paramIndex++}`);
      updateValues.push(updateData.clientName);
    }

    if (updateData.industry !== undefined) {
      updateFields.push(`industry = $${paramIndex++}`);
      updateValues.push(updateData.industry);
    }

    if (updateData.challenge !== undefined) {
      updateFields.push(`challenge = $${paramIndex++}`);
      updateValues.push(updateData.challenge);
    }

    if (updateData.solution !== undefined) {
      updateFields.push(`solution = $${paramIndex++}`);
      updateValues.push(updateData.solution);
    }

    if (updateData.results !== undefined) {
      updateFields.push(`results = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updateData.results));
    }

    if (updateData.techStack !== undefined) {
      updateFields.push(`"techStack" = $${paramIndex++}`);
      updateValues.push(updateData.techStack);
    }

    if (updateData.heroImage !== undefined) {
      updateFields.push(`"heroImage" = $${paramIndex++}`);
      let heroImageValue = null;
      if (updateData.heroImage) {
        if (typeof updateData.heroImage === 'string') {
          // Wrap string (base64 or URL) in JSON object
          heroImageValue = JSON.stringify({ url: updateData.heroImage });
        } else {
          heroImageValue = JSON.stringify(updateData.heroImage);
        }
      }
      updateValues.push(heroImageValue);
    }

    if (updateData.published !== undefined) {
      updateFields.push(`"publishedAt" = $${paramIndex++}`);
      updateValues.push(updateData.published ? new Date() : null);
    }

    if (updateFields.length === 0) {
      return createErrorResponse(
        'No fields to update',
        'validation_error',
        HttpStatus.BAD_REQUEST
      );
    }

    // Add updated_at timestamp
    updateFields.push(`"updatedAt" = $${paramIndex++}`);
    updateValues.push(new Date());

    // Add WHERE condition using ID (more reliable than slug which can change)
    updateValues.push(caseStudyId);

    const updateQuery = `
      UPDATE case_studies 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, title, slug, "clientName", industry, challenge, solution, results, "techStack", "heroImage", "publishedAt", "createdAt", "updatedAt"
    `;

    const result = await query(updateQuery, updateValues);
    const updatedCaseStudy = result.rows[0];

    return createSuccessResponse(updatedCaseStudy);
  } catch (error) {
    console.error('Database error in PUT /api/case-studies/[slug]:', error);
    return createErrorResponse(
      'Failed to update case study',
      'database_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  // Verify authentication and authorization
  const tokenPayload = verifyRequestToken(request);
  
  if (!tokenPayload || !hasRole(tokenPayload, 'ADMIN')) {
    return createErrorResponse(
      'Admin access required',
      'forbidden',
      HttpStatus.FORBIDDEN
    );
  }

  try {
    // Support both slug and id for deletion
    const result = await query(
      'DELETE FROM case_studies WHERE slug = $1 OR id = $1 RETURNING id',
      [slug]
    );

    if (result.rows.length === 0) {
      return createErrorResponse(
        'Case study not found',
        'not_found',
        HttpStatus.NOT_FOUND
      );
    }

    return createSuccessResponse(
      { message: 'Case study deleted successfully' },
      HttpStatus.OK
    );
  } catch (error) {
    console.error('Database error in DELETE /api/case-studies/[slug]:', error);
    return createErrorResponse(
      'Failed to delete case study',
      'database_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
