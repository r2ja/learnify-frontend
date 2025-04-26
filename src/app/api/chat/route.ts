import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// POST /api/chat
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
    const userId = payload?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { message, sessionId, learningProfileId, language = 'english' } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Create a new chat message in the database
    const messageId = crypto.randomUUID();
    const timestamp = new Date();

    const insertMessageSql = `
      INSERT INTO "ChatMessage" (
        id, "chatId", content, "messageType", "isUser",
        "order", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const messageParams = [
      messageId,
      sessionId,
      message,
      'text',
      true,
      0, // order will be updated after getting all messages
      timestamp,
      timestamp
    ];

    await query(insertMessageSql, messageParams);

    // Call the Python LLM agent
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'LLM', 'Learnify-Agent-0.85', 'interactive_test.py')
    ]);

    let response = '';
    let error = '';

    // Handle agent output
    pythonProcess.stdout.on('data', (data) => {
      response += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Send the message to the agent
    pythonProcess.stdin.write(message + '\n');

    // Wait for the agent to process and respond
    await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });

    if (error) {
      console.error('LLM Agent Error:', error);
      return NextResponse.json(
        { error: 'Failed to process message' },
        { status: 500 }
      );
    }

    // Store the agent's response in the database
    const responseMessageId = crypto.randomUUID();
    const responseParams = [
      responseMessageId,
      sessionId,
      response,
      'text',
      false,
      1, // order will be updated
      timestamp,
      timestamp
    ];

    await query(insertMessageSql, responseParams);

    // Return both messages
    return NextResponse.json({
      userMessage: {
        id: messageId,
        content: message,
        messageType: 'text',
        isUser: true,
        createdAt: timestamp
      },
      agentResponse: {
        id: responseMessageId,
        content: response,
        messageType: 'text',
        isUser: false,
        createdAt: timestamp
      }
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to get cookie value
function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies[name] || null;
} 
import { spawn } from 'child_process';
import path from 'path';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// POST /api/chat
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
    const userId = payload?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { message, sessionId, learningProfileId, language = 'english' } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Create a new chat message in the database
    const messageId = crypto.randomUUID();
    const timestamp = new Date();

    const insertMessageSql = `
      INSERT INTO "ChatMessage" (
        id, "chatId", content, "messageType", "isUser",
        "order", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const messageParams = [
      messageId,
      sessionId,
      message,
      'text',
      true,
      0, // order will be updated after getting all messages
      timestamp,
      timestamp
    ];

    await query(insertMessageSql, messageParams);

    // Call the Python LLM agent
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'LLM', 'Learnify-Agent-0.85', 'interactive_test.py')
    ]);

    let response = '';
    let error = '';

    // Handle agent output
    pythonProcess.stdout.on('data', (data) => {
      response += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Send the message to the agent
    pythonProcess.stdin.write(message + '\n');

    // Wait for the agent to process and respond
    await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });

    if (error) {
      console.error('LLM Agent Error:', error);
      return NextResponse.json(
        { error: 'Failed to process message' },
        { status: 500 }
      );
    }

    // Store the agent's response in the database
    const responseMessageId = crypto.randomUUID();
    const responseParams = [
      responseMessageId,
      sessionId,
      response,
      'text',
      false,
      1, // order will be updated
      timestamp,
      timestamp
    ];

    await query(insertMessageSql, responseParams);

    // Return both messages
    return NextResponse.json({
      userMessage: {
        id: messageId,
        content: message,
        messageType: 'text',
        isUser: true,
        createdAt: timestamp
      },
      agentResponse: {
        id: responseMessageId,
        content: response,
        messageType: 'text',
        isUser: false,
        createdAt: timestamp
      }
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to get cookie value
function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies[name] || null;
} 