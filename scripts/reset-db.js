const { Pool } = require('pg');

// Create a PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
  let client = null;
  
  try {
    console.log('Resetting database...');
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');

    // Delete data from all tables in the correct order (respecting foreign key constraints)
    // Start with tables referencing others
    await client.query('DELETE FROM public."GeneralQueryChatSession"');
    await client.query('DELETE FROM public."QuizResponse"');
    await client.query('DELETE FROM public."QuizInstance"'); // References Chapter, User, Course
    await client.query('DELETE FROM public."Chapter"'); // References Course
    await client.query('DELETE FROM public."CourseEnrollment"'); // References User, Course
    await client.query('DELETE FROM public."LearningProfile"'); // References User

    // Finally, delete from the core tables
    await client.query('DELETE FROM public."User"');
    await client.query('DELETE FROM public."Course"');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Database reset successfully!');
  } catch (error) {
    // Rollback transaction on error
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    
    // Close pool
    await pool.end();
  }
}

resetDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 