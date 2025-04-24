import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(
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

    // Fetch the chat session
    const sessionSql = `
      SELECT * FROM "CourseChat"
      WHERE "id" = $1 AND "userId" = $2
    `;

    const sessions = await query(sessionSql, [sessionId, userId]);

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    const session = sessions[0];
    
    // Parse messages from JSONB
    let messages = [];
    try {
      messages = typeof session.messages === 'string'
        ? JSON.parse(session.messages)
        : session.messages || [];
    } catch (error) {
      console.error('Error parsing messages:', error);
    }

    return NextResponse.json({
      id: session.id,
      userId: session.userId,
      courseId: session.courseId,
      virtualChapterId: session.virtualChapterId,
      chapterName: session.chapterName,
      customTitle: session.customTitle,
      messages: messages,
      createdAt: session.createdAt
    });
  } catch (error) {
    console.error('Error fetching chat session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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

    // Get the message from the request body
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Fetch the current session
    const sessionSql = `
      SELECT * FROM "CourseChat"
      WHERE "id" = $1 AND "userId" = $2
    `;

    const sessions = await query(sessionSql, [sessionId, userId]);

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    const session = sessions[0];
    
    // Parse existing messages
    let messages = [];
    try {
      messages = typeof session.messages === 'string'
        ? JSON.parse(session.messages)
        : session.messages || [];
    } catch (error) {
      console.error('Error parsing messages:', error);
      messages = [];
    }
    
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
      timestamp: new Date().toISOString()
    };
    
    // Add AI response (dummy for now)
    const aiMessage = {
      id: (Date.now() + 1).toString(),
      content: generateResponse(message),
      isUser: false,
      timestamp: new Date().toISOString()
    };
    
    // Update messages array
    messages.push(userMessage, aiMessage);
    
    // Update the session with new messages
    const updateSql = `
      UPDATE "CourseChat"
      SET 
        "messages" = $1,
        "updatedAt" = $2
      WHERE "id" = $3 AND "userId" = $4
      RETURNING *
    `;
    
    const updatedSessions = await query(updateSql, [
      JSON.stringify(messages),
      new Date(),
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
      userMessage,
      aiMessage
    });
  } catch (error) {
    console.error('Error updating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to update chat session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify the session exists and belongs to the user
    const sessionCheckSql = `
      SELECT * FROM "CourseChat"
      WHERE "id" = $1 AND "userId" = $2
    `;

    const sessions = await query(sessionCheckSql, [sessionId, userId]);

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'Chat session not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

    // Delete the session
    const deleteSql = `
      DELETE FROM "CourseChat"
      WHERE "id" = $1 AND "userId" = $2
      RETURNING id
    `;

    const deletedSessions = await query(deleteSql, [sessionId, userId]);

    if (deletedSessions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete chat session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Chat session deleted successfully',
      id: deletedSessions[0].id
    });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Function to generate a dummy AI response
function generateResponse(message: string): string {
  const responses = [
    `That's an interesting question about this topic! I'd be happy to help you understand ${message.length > 20 ? message.substring(0, 20) + '...' : message} better.`,
    "Great question! Based on the material in this chapter, I can tell you that the key concepts involve understanding the fundamentals thoroughly.",
    "I see you're curious about this topic. Let me explain how this works in a simple way...",
    "That's a common question students have. Let me clarify: the important thing to remember is that practice makes perfect.",
    "I understand your question. From a learning perspective, it's important to approach this methodically. First, understand the basic concepts, then build on that foundation.",
    "Thanks for asking! This particular topic requires careful attention to detail. Let me break it down step by step...",
    "Excellent question! Many students find this challenging at first. The trick is to think about it from a different angle.",
    "I appreciate your interest in this topic. The material covers this in depth, but here's a simplified explanation to get you started."
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
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