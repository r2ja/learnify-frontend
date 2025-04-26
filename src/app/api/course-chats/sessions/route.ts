import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    // Get the auth token from cookies
    const cookieHeader = req.headers.get('cookie') || '';
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

    const { courseId, virtualChapterId, title, language } = await req.json();

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    // Default learning profile as a JSON string
    const defaultLearningProfile = JSON.stringify({
      style: "conceptual",
      depth: "beginner",
      interaction: "examples"
    });

    // Create new chat session
    const sessionId = uuidv4();
    const now = new Date();

    // Insert the new session - using the right column names
      const insertSql = `
        INSERT INTO "CourseChat" (
          "id", 
          "userId", 
          "courseId", 
          "virtualChapterId",
        "title",
        "language",
        "lastContext",
        "learningProfileId",
        "isActive",
        "createdAt",
        "updatedAt"
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const insertParams = [
        sessionId, 
        userId, 
        courseId, 
      virtualChapterId || null,
      title || 'New Chat Session',
      language || 'english',
      '',
      '018d22c5-2281-4cf1-95db-c49a486d27f3', // Default learning profile ID
      true,
      now,
        now
      ];
      
    const chatSession = await query(insertSql, insertParams);

    return NextResponse.json(chatSession[0]);
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to create chat session' },
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