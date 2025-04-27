import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

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

// POST - Save a conversation
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

    // Get data from the request body
    const { courseId, messages } = await request.json();

    if (!courseId || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if a conversation exists for this user and course
    const existingConversationSql = `
      SELECT id FROM "Conversations"
      WHERE "userId" = $1 AND "courseId" = $2
    `;

    const existingConversations = await query(existingConversationSql, [userId, courseId]);
    
    let result;
    
    if (existingConversations.length > 0) {
      // Update existing conversation
      const updateSql = `
        UPDATE "Conversations"
        SET "messages" = $1, "updatedAt" = NOW()
        WHERE "userId" = $2 AND "courseId" = $3
        RETURNING id
      `;
      
      result = await query(updateSql, [JSON.stringify(messages), userId, courseId]);
    } else {
      // Create a new conversation
      const insertSql = `
        INSERT INTO "Conversations" ("userId", "courseId", "messages")
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      
      result = await query(insertSql, [userId, courseId, JSON.stringify(messages)]);
    }

    return NextResponse.json({
      success: true,
      conversationId: result[0].id
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to save conversation' },
      { status: 500 }
    );
  }
}

// GET - Retrieve a conversation
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
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Get conversation for this user and course
    const conversationSql = `
      SELECT * FROM "Conversations"
      WHERE "userId" = $1 AND "courseId" = $2
    `;

    const conversations = await query(conversationSql, [userId, courseId]);

    if (conversations.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json(conversations[0]);
  } catch (error) {
    console.error('Error retrieving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve conversation' },
      { status: 500 }
    );
  }
} 