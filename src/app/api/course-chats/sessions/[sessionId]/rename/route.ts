import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function PUT(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Fix for NextJS params awaiting issue
    const { sessionId } = await Promise.resolve(params);
    
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

    // Get the customTitle from the request body
    const { customTitle } = await request.json();

    if (!customTitle || typeof customTitle !== 'string') {
      return NextResponse.json(
        { error: 'Custom title is required' },
        { status: 400 }
      );
    }

    // Verify that the session exists and belongs to the user
    const existsSessionSql = `
      SELECT * FROM "CourseChat"
      WHERE "id" = $1 AND "userId" = $2
    `;

    const existingSessions = await query(existsSessionSql, [sessionId, userId]);

    if (existingSessions.length === 0) {
      return NextResponse.json(
        { error: 'Chat session not found or you do not have permission to rename it' },
        { status: 404 }
      );
    }

    // Update the session with the custom title
    const updateSql = `
      UPDATE "CourseChat"
      SET 
        "customTitle" = $1,
        "updatedAt" = $2
      WHERE "id" = $3 AND "userId" = $4
      RETURNING *
    `;

    const now = new Date();
    const updatedSessions = await query(updateSql, [
      customTitle,
      now,
      sessionId,
      userId
    ]);

    if (updatedSessions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update chat session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: updatedSessions[0]
    });
  } catch (error) {
    console.error('Error renaming chat session:', error);
    return NextResponse.json(
      { error: 'Failed to rename chat session', details: error instanceof Error ? error.message : 'Unknown error' },
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