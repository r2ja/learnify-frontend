import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';
import { verifyToken } from '@/lib/jwt';

// WebSocket server details
const WS_SERVER_URL = "ws://localhost:8765";
const WS_STATUS_URL = "http://localhost:8765/status";

// POST handler to send messages to WebSocket server
export async function POST(request: NextRequest) {
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
    try {
      const payload = verifyToken(authToken);
      if (!payload.userId) {
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    } catch (error) {
      // Allow usage even if token verification fails (for development)
      console.warn('Token verification failed, but continuing for development purposes');
    }

    // Parse the request body
    const body = await request.json();
    const { 
      message, 
      courseId, 
      chapterId, 
      sessionId, 
      learningProfile, 
      language = 'english' 
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if the WebSocket server is running
    const socket = new WebSocket(WS_SERVER_URL);
    
    return new Promise((resolve) => {
      // If the connection opens, send the message
      socket.onopen = () => {
        // Send the message
        const data = {
          message,
          user_id: body.userId || 'web_user',
          course_id: courseId,
          chapter_id: chapterId,
          session_id: sessionId,
          learning_profile: learningProfile || {
            style: "conceptual",
            depth: "beginner",
            interaction: "examples"
          },
          language
        };
        socket.send(JSON.stringify(data));
        
        // The actual message will be streamed via the WebSocket connection
        // This is just a confirmation that the message was sent
        resolve(NextResponse.json({ success: true, message: "Message sent to WebSocket server" }));
        
        // Keep the socket open - it will be closed by the client
      };
      
      // If there's an error, return an error response
      socket.onerror = () => {
        resolve(NextResponse.json(
          { error: "Failed to connect to WebSocket server" },
          { status: 503 }
        ));
      };
      
      // Set a timeout in case the connection hangs
      setTimeout(() => {
        socket.close();
        resolve(NextResponse.json(
          { error: "Connection to WebSocket server timed out" },
          { status: 504 }
        ));
      }, 5000);
    });
  } catch (error) {
    console.error("Error sending message to WebSocket server:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// GET handler to check WebSocket server status
export async function GET() {
  try {
    // Create a WebSocket connection to check if the server is running
    const socket = new WebSocket(WS_SERVER_URL);
    
    return new Promise((resolve) => {
      // If the connection opens, the server is running
      socket.onopen = () => {
        socket.close();
        resolve(NextResponse.json({ isConnected: true }));
      };
      
      // If there's an error, the server is not running
      socket.onerror = () => {
        resolve(NextResponse.json({ isConnected: false }));
      };
      
      // Set a timeout in case the connection hangs
      setTimeout(() => {
        socket.close();
        resolve(NextResponse.json({ isConnected: false }));
      }, 1000);
    });
  } catch (error) {
    console.error("Error checking WebSocket server status:", error);
    return NextResponse.json({ isConnected: false });
  }
}

// Helper function to get a cookie value
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
import WebSocket from 'ws';
import { verifyToken } from '@/lib/jwt';

// WebSocket server details
const WS_SERVER_URL = "ws://localhost:8765";
const WS_STATUS_URL = "http://localhost:8765/status";

// POST handler to send messages to WebSocket server
export async function POST(request: NextRequest) {
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
    try {
      const payload = verifyToken(authToken);
      if (!payload.userId) {
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    } catch (error) {
      // Allow usage even if token verification fails (for development)
      console.warn('Token verification failed, but continuing for development purposes');
    }

    // Parse the request body
    const body = await request.json();
    const { 
      message, 
      courseId, 
      chapterId, 
      sessionId, 
      learningProfile, 
      language = 'english' 
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if the WebSocket server is running
    const socket = new WebSocket(WS_SERVER_URL);
    
    return new Promise((resolve) => {
      // If the connection opens, send the message
      socket.onopen = () => {
        // Send the message
        const data = {
          message,
          user_id: body.userId || 'web_user',
          course_id: courseId,
          chapter_id: chapterId,
          session_id: sessionId,
          learning_profile: learningProfile || {
            style: "conceptual",
            depth: "beginner",
            interaction: "examples"
          },
          language
        };
        socket.send(JSON.stringify(data));
        
        // The actual message will be streamed via the WebSocket connection
        // This is just a confirmation that the message was sent
        resolve(NextResponse.json({ success: true, message: "Message sent to WebSocket server" }));
        
        // Keep the socket open - it will be closed by the client
      };
      
      // If there's an error, return an error response
      socket.onerror = () => {
        resolve(NextResponse.json(
          { error: "Failed to connect to WebSocket server" },
          { status: 503 }
        ));
      };
      
      // Set a timeout in case the connection hangs
      setTimeout(() => {
        socket.close();
        resolve(NextResponse.json(
          { error: "Connection to WebSocket server timed out" },
          { status: 504 }
        ));
      }, 5000);
    });
  } catch (error) {
    console.error("Error sending message to WebSocket server:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// GET handler to check WebSocket server status
export async function GET() {
  try {
    // Create a WebSocket connection to check if the server is running
    const socket = new WebSocket(WS_SERVER_URL);
    
    return new Promise((resolve) => {
      // If the connection opens, the server is running
      socket.onopen = () => {
        socket.close();
        resolve(NextResponse.json({ isConnected: true }));
      };
      
      // If there's an error, the server is not running
      socket.onerror = () => {
        resolve(NextResponse.json({ isConnected: false }));
      };
      
      // Set a timeout in case the connection hangs
      setTimeout(() => {
        socket.close();
        resolve(NextResponse.json({ isConnected: false }));
      }, 1000);
    });
  } catch (error) {
    console.error("Error checking WebSocket server status:", error);
    return NextResponse.json({ isConnected: false });
  }
}

// Helper function to get a cookie value
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