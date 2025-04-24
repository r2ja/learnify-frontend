import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    // Wait for params to be available
    const { courseId } = await Promise.resolve(params);
    
    // Get auth token from cookies directly
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify the token directly within this route
    let userData: any;
    try {
      userData = verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    if (!userData || !userData.id) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    // Fetch the latest chapter progress for this course
    const result = await pool.query(
      `SELECT chapter_id FROM chapter_progress 
       WHERE user_id = $1 AND course_id = $2
       ORDER BY last_accessed DESC
       LIMIT 1`,
      [userData.id, courseId]
    );
    
    // Determine the chapter ID to use (default to first chapter if no progress)
    const chapterId = result.rows.length > 0 
      ? result.rows[0].chapter_id 
      : `${courseId}-chapter-0`;
    
    // Now get or create a chat session for this chapter
    const sessionResult = await pool.query(
      `SELECT id FROM chat_sessions 
       WHERE chapter_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [chapterId, userData.id]
    );
    
    let sessionId;
    
    if (sessionResult.rows.length > 0) {
      // Use existing session
      sessionId = sessionResult.rows[0].id;
    } else {
      // Create a new session
      const newSessionResult = await pool.query(
        `INSERT INTO chat_sessions (user_id, chapter_id, created_at) 
         VALUES ($1, $2, NOW()) 
         RETURNING id`,
        [userData.id, chapterId]
      );
      sessionId = newSessionResult.rows[0].id;
    }
    
    // Return the chapter ID and session ID
    return NextResponse.json({
      chapterId,
      sessionId,
      isNew: result.rows.length === 0
    });
    
  } catch (error) {
    console.error('Error getting course progress:', error);
    return NextResponse.json(
      { error: 'Failed to get course progress' },
      { status: 500 }
    );
  }
}

// Also support POST for backward compatibility
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  return GET(request, { params });
} 