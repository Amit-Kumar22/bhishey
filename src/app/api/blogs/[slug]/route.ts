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

// Validation schema for blog updates
const blogUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug too long').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  readingMinutes: z.number().int().positive().optional(),
  heroImage: z.union([
    z.object({
      url: z.string(),
      alt: z.string().optional()
    }),
    z.string(),
    z.null()
  ]).optional(),
  seo: z.union([
    z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional()
    }),
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
        b.id, b.title, b.slug, b.body as content, b.excerpt, b.tags, 
        b."readingMinutes", b."heroImage", b.seo, b."publishedAt", b."authorId", 
        b."createdAt", b."updatedAt",
        u.email as "authorEmail", u.name as "authorName"
      FROM blog_posts b
      LEFT JOIN users u ON b."authorId" = u.id
      WHERE b.slug = $1 AND b."publishedAt" IS NOT NULL
    `, [slug]);

    if (result.rows.length === 0) {
      return createErrorResponse(
        'Blog not found',
        'not_found',
        HttpStatus.NOT_FOUND
      );
    }

    const blog = result.rows[0];
    
    // Parse JSON fields
    const processedBlog = {
      ...blog,
      tags: blog.tags || [],
      heroImage: blog.heroImage || null
    };

    return createSuccessResponse(processedBlog);
  } catch (error) {
    console.error('Database error in GET /api/blogs/[slug]:', error);
    return createErrorResponse(
      'Failed to retrieve blog',
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
  const validation = await validateRequestBody(request, blogUpdateSchema);
  if (!validation.success) {
    return validation.error;
  }

  const updateData = validation.data;

  try {
    // Check if blog exists - support both slug and id
    const checkResult = await query(
      'SELECT id, slug FROM blog_posts WHERE slug = $1 OR id = $1',
      [slug]
    );

    if (checkResult.rows.length === 0) {
      return createErrorResponse(
        'Blog not found',
        'not_found',
        HttpStatus.NOT_FOUND
      );
    }
    
    const blogId = checkResult.rows[0].id;
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
      // Check if new slug already exists (excluding current blog)
      const slugCheck = await query(
        'SELECT id FROM blog_posts WHERE slug = $1 AND id != $2',
        [updateData.slug, blogId]
      );
      
      if (slugCheck.rows.length > 0) {
        return createErrorResponse(
          'Blog with this slug already exists',
          'duplicate_slug',
          HttpStatus.CONFLICT
        );
      }
      
      updateFields.push(`slug = $${paramIndex++}`);
      updateValues.push(updateData.slug);
    }

    if (updateData.content !== undefined) {
      updateFields.push(`body = $${paramIndex++}`);
      updateValues.push(updateData.content);
    }

    if (updateData.excerpt !== undefined) {
      updateFields.push(`excerpt = $${paramIndex++}`);
      updateValues.push(updateData.excerpt);
    }

    if (updateData.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex++}`);
      updateValues.push(updateData.tags);
    }

    if (updateData.readingMinutes !== undefined) {
      updateFields.push(`"readingMinutes" = $${paramIndex++}`);
      updateValues.push(updateData.readingMinutes);
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

    if (updateData.seo !== undefined) {
      updateFields.push(`seo = $${paramIndex++}`);
      updateValues.push(updateData.seo ? JSON.stringify(updateData.seo) : null);
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
    updateValues.push(blogId);

    const updateQuery = `
      UPDATE blog_posts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, title, slug, body as content, excerpt, tags, "readingMinutes", "heroImage", seo, "publishedAt", "authorId", "createdAt", "updatedAt"
    `;

    const result = await query(updateQuery, updateValues);
    const updatedBlog = result.rows[0];

    // Parse JSON fields
    const processedBlog = {
      ...updatedBlog,
      tags: updatedBlog.tags || [],
      heroImage: updatedBlog.heroImage || null
    };

    return createSuccessResponse(processedBlog);
  } catch (error) {
    console.error('Database error in PUT /api/blogs/[slug]:', error);
    return createErrorResponse(
      'Failed to update blog',
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
      'DELETE FROM blog_posts WHERE slug = $1 OR id = $1 RETURNING id',
      [slug]
    );

    if (result.rows.length === 0) {
      return createErrorResponse(
        'Blog not found',
        'not_found',
        HttpStatus.NOT_FOUND
      );
    }

    return createSuccessResponse(
      { message: 'Blog deleted successfully' },
      HttpStatus.OK
    );
  } catch (error) {
    console.error('Database error in DELETE /api/blogs/[slug]:', error);
    return createErrorResponse(
      'Failed to delete blog',
      'database_error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}