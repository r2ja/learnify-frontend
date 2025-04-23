const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Configure PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Courses to delete
const courseIds = [
  '6c1e7e9f-3a2e-4d7f-9ac3-58a7e2b3a4d9',
  'b1f4a3d2-c9e7-4f2a-9b7d-5f1e6a3c0d4f',
  'd3e2f1b4-7a9c-4d5e-8f2a-6c7b9e0d1f2a',
  'f7a8b9c0-d1e2-4f3a-9b8c-7d6e5f4a3b2c'
];

async function deleteCourses() {
  const client = await pool.connect();
  
  try {
    console.log('Starting deletion process...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // First, delete all course enrollments for these courses
    const deleteEnrollmentsQuery = `
      DELETE FROM "CourseEnrollment"
      WHERE "courseId" IN (${courseIds.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING *
    `;
    
    const enrollmentResult = await client.query(deleteEnrollmentsQuery, courseIds);
    console.log(`Deleted ${enrollmentResult.rowCount} course enrollments.`);
    
    // Delete all courses
    const deleteCoursesQuery = `
      DELETE FROM "Course"
      WHERE "id" IN (${courseIds.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING *
    `;
    
    const courseResult = await client.query(deleteCoursesQuery, courseIds);
    console.log(`Deleted ${courseResult.rowCount} courses.`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Deletion completed successfully!');
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error deleting courses:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the deletion function
deleteCourses(); 