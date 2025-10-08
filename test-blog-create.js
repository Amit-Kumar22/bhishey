require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    // Check table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts'
      ORDER BY ordinal_position
    `);
    console.log('Table structure:');
    console.log(JSON.stringify(structure.rows, null, 2));
    
    // Try to insert a blog
    console.log('\n\nAttempting to create blog...');
    const result = await pool.query(`
      INSERT INTO blog_posts (
        title, slug, body, excerpt, tags, "readingMinutes", 
        "heroImage", seo, "publishedAt", "authorId", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
      'Test Blog',
      'test-blog-' + Date.now(),
      'This is test content',
      'Test excerpt',
      ['test'],
      5,
      null,
      JSON.stringify({}),
      new Date(),
      'cmgaxz4b30000q54wh2o6aoo9' // Your admin user ID
    ]);
    
    console.log('Success!');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

test();
