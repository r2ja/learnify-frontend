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
    const { courseId, moduleId, messages, conversationId, title } = await request.json();

    if (!courseId || !moduleId || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result;
    
    if (conversationId) {
      // Update existing conversation
      const updateSql = `
        UPDATE "Conversations"
        SET "messages" = $1, "updatedAt" = NOW(), "title" = COALESCE($2, "title")
        WHERE "id" = $3 AND "userId" = $4
        RETURNING id, title
      `;
      
      result = await query(updateSql, [
        JSON.stringify(messages), 
        title || null, 
        conversationId, 
        userId
      ]);
      
      if (result.length === 0) {
        return NextResponse.json(
          { error: 'Conversation not found or access denied' },
          { status: 404 }
        );
      }
    } else {
      // Create a new conversation
      const chatTitle = title || `Chat - ${new Date().toLocaleString()}`;
      
      const insertSql = `
        INSERT INTO "Conversations" ("userId", "courseId", "moduleId", "messages", "title")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title
      `;
      
      result = await query(insertSql, [
        userId, 
        courseId, 
        moduleId, 
        JSON.stringify(messages),
        chatTitle
      ]);
    }

    return NextResponse.json({
      success: true,
      conversationId: result[0].id,
      title: result[0].title
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to save conversation' },
      { status: 500 }
    );
  }
}

// GET - Retrieve conversations
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
    const moduleId = searchParams.get('moduleId');
    const conversationId = searchParams.get('conversationId');
    const listOnly = searchParams.get('listOnly') === 'true';

    if (!courseId || !moduleId) {
      return NextResponse.json(
        { error: 'Course ID and Module ID are required' },
        { status: 400 }
      );
    }

    // If conversationId is provided, get specific conversation
    if (conversationId && !listOnly) {
      const conversationSql = `
        SELECT * FROM "Conversations"
        WHERE "id" = $1 AND "userId" = $2
      `;

      const conversations = await query(conversationSql, [conversationId, userId]);

      if (conversations.length === 0) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(conversations[0]);
    }
    
    // Otherwise, list conversations for this module
    const listSql = `
      SELECT id, title, "createdAt", "updatedAt", "isActive" 
      FROM "Conversations"
      WHERE "userId" = $1 AND "courseId" = $2 AND "moduleId" = $3
      ORDER BY "updatedAt" DESC
    `;

    const conversations = await query(listSql, [userId, courseId, moduleId]);

    // If requesting a list or there are no conversations yet
    if (listOnly || conversations.length === 0) {
      return NextResponse.json({ conversations });
    }

    // Otherwise, return the most recent conversation with messages
    const recentConversationSql = `
      SELECT * FROM "Conversations"
      WHERE "userId" = $1 AND "courseId" = $2 AND "moduleId" = $3
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;

    const recentConversation = await query(recentConversationSql, [userId, courseId, moduleId]);
    
    return NextResponse.json(recentConversation[0]);
  } catch (error) {
    console.error('Error retrieving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve conversation' },
      { status: 500 }
    );
  }
} 