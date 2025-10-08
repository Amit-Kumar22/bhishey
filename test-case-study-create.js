require('dotenv').config();
const { Pool } = require('pg');
const { init } = require('@paralleldrive/cuid2');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const createId = init({ length: 25 });

async function test() {
  try {
    const caseStudyId = createId();
    
    console.log('Attempting to create case study...');
    const result = await pool.query(`
      INSERT INTO case_studies (
        id, title, slug, "clientName", industry, challenge, solution, 
        results, "techStack", "heroImage", "publishedAt", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      caseStudyId,
      'Test Case Study',
      'test-case-' + Date.now(),
      'Acme Corp',
      'Technology',
      'Challenge text',
      'Solution text',
      JSON.stringify([{metric: "Test", value: "100%"}]),
      ['React', 'Node.js'],
      JSON.stringify({url: "https://example.com/image.jpg", alt: "Test"}),
      new Date()
    ]);
    
    console.log('Success!');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

test();
