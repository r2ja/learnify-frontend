import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    // Get the auth token from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const authToken = getCookieValue(cookieHeader, 'auth_token');

    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token to get the user ID
    const payload = verifyToken(authToken);
    const userId = payload.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get the data from the request body
    const { virtualChapterId, courseId, chapterName, forceNew, timestamp } = await request.json();

    if (!virtualChapterId || !courseId) {
      return NextResponse.json(
        { error: 'Chapter ID and course ID are required' },
        { status: 400 }
      );
    }

    // Check if we should force a new session or look for existing ones
    if (!forceNew) {
      // Try to find an existing session
      const findSessionSql = `
        SELECT * FROM "CourseChat" 
        WHERE "userId" = $1 AND "virtualChapterId" = $2
        ORDER BY "createdAt" DESC
      `;

      const existingSessions = await query(findSessionSql, [userId, virtualChapterId]);

      if (existingSessions.length > 0) {
        // Return the existing session
        return NextResponse.json(existingSessions);
      }
    }

    // Create a new session
    const sessionId = uuidv4();
    const now = new Date();

    try {
      // Check if CourseChat table exists, if not create it
      const checkTableSql = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'CourseChat'
        );
      `;
      
      const tableCheck = await query(checkTableSql, []);
      
      if (!tableCheck[0].exists) {
        // Create the table
        const createTableSql = `
          CREATE TABLE "CourseChat" (
            "id" UUID PRIMARY KEY,
            "userId" UUID NOT NULL,
            "courseId" UUID NOT NULL,
            "virtualChapterId" TEXT NOT NULL,
            "chapterName" TEXT,
            "messages" JSONB DEFAULT '[]'::jsonb,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
            "updatedAt" TIMESTAMP WITH TIME ZONE
          );
        `;
        
        await query(createTableSql, []);
      }

      // Insert the new session
      const insertSql = `
        INSERT INTO "CourseChat" (
          "id", 
          "userId", 
          "courseId", 
          "virtualChapterId",
          "chapterName",
          "messages",
          "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const messages = JSON.stringify([]);
      const insertParams = [
        sessionId, 
        userId, 
        courseId, 
        virtualChapterId,
        chapterName || 'Unnamed Chapter',
        messages,
        now
      ];
      
      const newSession = await query(insertSql, insertParams);

      // After creating a new session, return all sessions for this chapter
      // to update the client's session history
      if (forceNew) {
        const sessionsSql = `
          SELECT * FROM "CourseChat"
          WHERE "userId" = $1 AND "virtualChapterId" = $2
          ORDER BY "createdAt" DESC
        `;

        const sessions = await query(sessionsSql, [userId, virtualChapterId]);
        return NextResponse.json(sessions);
      } else {
        return NextResponse.json(newSession);
      }
    } catch (error) {
      console.error('Error creating chat session:', error);
      return NextResponse.json(
        { error: 'Failed to create chat session', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error handling chat session:', error);
    return NextResponse.json(
      { error: 'Failed to handle chat session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Get the auth token from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const authToken = getCookieValue(cookieHeader, 'auth_token');

    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token to get the user ID
    const payload = verifyToken(authToken);
    const userId = payload.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const virtualChapterId = searchParams.get('virtualChapterId');

    if (!virtualChapterId) {
      return NextResponse.json(
        { error: 'Virtual chapter ID is required' },
        { status: 400 }
      );
    }

    // Get sessions for the specified virtual chapter
    const sessionsSql = `
      SELECT * FROM "CourseChat"
      WHERE "userId" = $1 AND "virtualChapterId" = $2
      ORDER BY "createdAt" DESC
    `;

    const sessions = await query(sessionsSql, [userId, virtualChapterId]);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to extract cookie value
function getCookieValue(cookieString: string, cookieName: string): string | null {
  const cookies = cookieString.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName) {
      return value;
    }
  }
  return null;
} 