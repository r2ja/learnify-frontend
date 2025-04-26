import { NextRequest, NextResponse } from 'next/server';
import { v4 as generateUuid } from 'uuid';
import { MessageType } from '@/lib/types';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Stream LLM responses using the existing Python Learnify-Agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const sessionId = params.sessionId;
    const { content, courseId, virtualChapterId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify chat session exists and belongs to user
    const checkSessionSql = `
      SELECT * FROM "CourseChat" 
      WHERE "id" = $1 AND "userId" = $2
    `;
    const sessionResult = await query(checkSessionSql, [sessionId, userId]);
    
    if (sessionResult.length === 0) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    const chatSession = sessionResult[0];

    // Store the user message
    const messagesSql = `
      SELECT COUNT(*) as count FROM "ChatMessage" 
      WHERE "chatId" = $1
    `;
    const messagesCountResult = await query(messagesSql, [sessionId]);
    const nextOrder = parseInt(messagesCountResult[0].count);

    // Create user message
    const insertUserMessageSql = `
      INSERT INTO "ChatMessage" (
        "id",
        "chatId",
        "content",
        "messageType",
        "isUser",
        "order",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await query(insertUserMessageSql, [
      generateUuid(),
      sessionId,
      content,
      'text',
      true,
      nextOrder,
      new Date(),
      new Date()
    ]);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Find the Python script path
          const scriptPath = path.resolve(process.cwd(), '../LLM/Learnify-Agent-0.85/agent_stream.py');
          
          // Create a temporary script if it doesn't exist
          if (!fs.existsSync(scriptPath)) {
            createTempAgentScript(scriptPath);
          }
          
          // Parse learning profile (handle potential JSON string)
          let learningProfile = chatSession.learningProfile;
          if (typeof learningProfile === 'string') {
            try {
              learningProfile = JSON.parse(learningProfile);
            } catch (e) {
              console.error('Error parsing learning profile:', e);
              learningProfile = {
                style: "conceptual",
                depth: "beginner",
                interaction: "examples"
              };
            }
          }
          
          // Spawn Python process
          const pythonProcess = spawn('python', [scriptPath], {
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1', // Keep Python output unbuffered
              PYTHONPATH: path.resolve(process.cwd(), '../LLM/Learnify-Agent-0.85')
            }
          });
          
          // Prepare the request input
          const agentInput = JSON.stringify({
            userId: userId,
            courseId: courseId || chatSession.courseId,
            chapterId: virtualChapterId || chatSession.virtualChapterId,
            prompt: content,
            language: chatSession.language || 'english',
            learningProfile: learningProfile,
            session_id: sessionId
          });
          
          // Response buffer and variables for streaming
          let responseBuffer = '';
          let fullContent = '';
          let isFirstChunk = true;
          
          // Process data coming from the Python script
          pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            responseBuffer += chunk;
            
            try {
              // Try to parse the chunk as JSON (from the agent)
              if (chunk.includes('{"type":')) {
                const jsonStart = chunk.indexOf('{');
                const jsonEnd = chunk.lastIndexOf('}') + 1;
                const jsonString = chunk.substring(jsonStart, jsonEnd);
                const streamData = JSON.parse(jsonString);
                
                // Filter out reasoning as requested by user
                if (streamData.type === 'reasoning') {
                  return;
                }
                
                if (streamData.type === 'text' || streamData.type === 'content') {
                  // Accumulate complete content
                  const contentText = streamData.content || streamData.text || '';
                  fullContent += contentText;
                  
                  // For the first chunk, send immediately to show activity
                  if (isFirstChunk) {
                    const data = {
                      content: fullContent,
                      messageType: 'text',
                      isComplete: false
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                    isFirstChunk = false;
                    return;
                  }
                  
                  // For subsequent chunks, detect paragraph or sentence boundaries
                  const hasCompleteSentence = contentText.match(/[.!?]\s/) || 
                                             contentText.includes('\n\n') || 
                                             contentText.length > 100;
                                              
                  if (hasCompleteSentence) {
                    const data = {
                      content: fullContent, // Send the full accumulated content
                      messageType: 'text',
                      isComplete: false
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                  }
                } else if (streamData.type === 'mermaid_gen') {
                  // For mermaid diagrams, send as a whole
                  const data = {
                    content: streamData.content,
                    messageType: 'mermaid',
                    isComplete: false
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                  fullContent = streamData.content;
                } else if (streamData.type === 'img_gen') {
                  // For generated images, send as a whole
                  const data = {
                    content: streamData.content,
                    messageType: 'code',
                    isComplete: false
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                  fullContent = streamData.content;
                }
              }
            } catch (e) {
              // If parsing fails, accumulate and send complete sentences
              const hasCompleteSentence = chunk.match(/[.!?]\s/) || 
                                         chunk.includes('\n\n') ||
                                         responseBuffer.length > 100;
                                           
              if (isFirstChunk || hasCompleteSentence) {
                const data = {
                  content: responseBuffer,
                  messageType: 'text',
                  isComplete: false
                };
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                fullContent = responseBuffer;
                isFirstChunk = false;
              }
            }
          });
          
          // Handle process completion
          pythonProcess.on('close', async (code) => {
            // Send completion message
            const finalData = {
              content: '',
              messageType: 'text',
              isComplete: true
            };
            controller.enqueue(encoder.encode(JSON.stringify(finalData) + '\n'));
            
            // Save the AI response in database
            try {
              const insertAIMessageSql = `
                INSERT INTO "ChatMessage" (
                  "id",
                  "chatId",
                  "content",
                  "messageType",
                  "isUser",
                  "order",
                  "createdAt",
                  "updatedAt"
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `;
              
              await query(insertAIMessageSql, [
                generateUuid(),
                sessionId,
                fullContent,  // Use fullContent for database storage
                'text',
                false,
                nextOrder + 1,
                new Date(),
                new Date()
              ]);
            } catch (dbError) {
              console.error('Error saving AI message to database:', dbError);
            }
            
            controller.close();
          });
          
          // Handle errors
          pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data.toString()}`);
            const errorData = {
              content: `Error: ${data.toString()}`,
              messageType: 'error',
              isComplete: true
            };
            controller.enqueue(encoder.encode(JSON.stringify(errorData) + '\n'));
          });
          
          // Send the input to the Python script
          pythonProcess.stdin.write(agentInput + '\n');
          pythonProcess.stdin.end();
          
        } catch (error) {
          console.error("Error in LLM streaming:", error);
          controller.error(error);
        }
      }
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error in stream route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create a temporary agent script that will interface with the agent module
 */
function createTempAgentScript(scriptPath: string): void {
  const scriptContent = `
import sys
import os
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the parent directory to the Python path
parent_path = str(Path(__file__).parent)
if parent_path not in sys.path:
    sys.path.append(parent_path)

# Try to import the agent module
try:
    from agent.run_chat_agent import run_chat_agent
except ImportError as e:
    logger.error(f"Error importing agent module: {e}")
    print(json.dumps({"type": "error", "content": f"Import error: {str(e)}"}))
    sys.exit(1)

def stream_callback(chunk):
    """Process stream chunks from the agent and output in JSON format."""
    # Print the chunk as JSON
    print(json.dumps(chunk), flush=True)

def main():
    """Main function to run the agent."""
    try:
        # Read input from stdin (sent by the NextJS API)
        input_data = sys.stdin.readline().strip()
        request = json.loads(input_data)
        
        # Extract parameters
        user_id = request.get("userId", "web_user")
        course_id = request.get("courseId", "CS101")
        prompt = request.get("prompt", "")
        language = request.get("language", "english")
        chapter_id = request.get("chapterId")
        session_id = request.get("session_id")
        learning_profile = request.get("learningProfile", {
            "style": "conceptual",
            "depth": "beginner",
            "interaction": "examples"
        })
        
        # Run the agent with streaming enabled
        result = run_chat_agent(
            user_id=user_id,
            course_id=course_id,
            prompt=prompt,
            learning_profile=learning_profile,
            language=language,
            chapter_id=chapter_id,
            session_id=session_id,
            stream=True,
            stream_callback=stream_callback
        )
        
    except Exception as e:
        logger.error(f"Error in agent execution: {e}")
        print(json.dumps({"type": "error", "content": f"Error: {str(e)}"}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  
  fs.writeFileSync(scriptPath, scriptContent);
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
import { v4 as generateUuid } from 'uuid';
import { MessageType } from '@/lib/types';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Stream LLM responses using the existing Python Learnify-Agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const sessionId = params.sessionId;
    const { content, courseId, virtualChapterId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify chat session exists and belongs to user
    const checkSessionSql = `
      SELECT * FROM "CourseChat" 
      WHERE "id" = $1 AND "userId" = $2
    `;
    const sessionResult = await query(checkSessionSql, [sessionId, userId]);
    
    if (sessionResult.length === 0) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    const chatSession = sessionResult[0];

    // Store the user message
    const messagesSql = `
      SELECT COUNT(*) as count FROM "ChatMessage" 
      WHERE "chatId" = $1
    `;
    const messagesCountResult = await query(messagesSql, [sessionId]);
    const nextOrder = parseInt(messagesCountResult[0].count);

    // Create user message
    const insertUserMessageSql = `
      INSERT INTO "ChatMessage" (
        "id",
        "chatId",
        "content",
        "messageType",
        "isUser",
        "order",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await query(insertUserMessageSql, [
      generateUuid(),
      sessionId,
      content,
      'text',
      true,
      nextOrder,
      new Date(),
      new Date()
    ]);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Find the Python script path
          const scriptPath = path.resolve(process.cwd(), '../LLM/Learnify-Agent-0.85/agent_stream.py');
          
          // Create a temporary script if it doesn't exist
          if (!fs.existsSync(scriptPath)) {
            createTempAgentScript(scriptPath);
          }
          
          // Parse learning profile (handle potential JSON string)
          let learningProfile = chatSession.learningProfile;
          if (typeof learningProfile === 'string') {
            try {
              learningProfile = JSON.parse(learningProfile);
            } catch (e) {
              console.error('Error parsing learning profile:', e);
              learningProfile = {
                style: "conceptual",
                depth: "beginner",
                interaction: "examples"
              };
            }
          }
          
          // Spawn Python process
          const pythonProcess = spawn('python', [scriptPath], {
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1', // Keep Python output unbuffered
              PYTHONPATH: path.resolve(process.cwd(), '../LLM/Learnify-Agent-0.85')
            }
          });
          
          // Prepare the request input
          const agentInput = JSON.stringify({
            userId: userId,
            courseId: courseId || chatSession.courseId,
            chapterId: virtualChapterId || chatSession.virtualChapterId,
            prompt: content,
            language: chatSession.language || 'english',
            learningProfile: learningProfile,
            session_id: sessionId
          });
          
          // Response buffer and variables for streaming
          let responseBuffer = '';
          let fullContent = '';
          let isFirstChunk = true;
          
          // Process data coming from the Python script
          pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            responseBuffer += chunk;
            
            try {
              // Try to parse the chunk as JSON (from the agent)
              if (chunk.includes('{"type":')) {
                const jsonStart = chunk.indexOf('{');
                const jsonEnd = chunk.lastIndexOf('}') + 1;
                const jsonString = chunk.substring(jsonStart, jsonEnd);
                const streamData = JSON.parse(jsonString);
                
                // Filter out reasoning as requested by user
                if (streamData.type === 'reasoning') {
                  return;
                }
                
                if (streamData.type === 'text' || streamData.type === 'content') {
                  // Accumulate complete content
                  const contentText = streamData.content || streamData.text || '';
                  fullContent += contentText;
                  
                  // For the first chunk, send immediately to show activity
                  if (isFirstChunk) {
                    const data = {
                      content: fullContent,
                      messageType: 'text',
                      isComplete: false
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                    isFirstChunk = false;
                    return;
                  }
                  
                  // For subsequent chunks, detect paragraph or sentence boundaries
                  const hasCompleteSentence = contentText.match(/[.!?]\s/) || 
                                             contentText.includes('\n\n') || 
                                             contentText.length > 100;
                                              
                  if (hasCompleteSentence) {
                    const data = {
                      content: fullContent, // Send the full accumulated content
                      messageType: 'text',
                      isComplete: false
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                  }
                } else if (streamData.type === 'mermaid_gen') {
                  // For mermaid diagrams, send as a whole
                  const data = {
                    content: streamData.content,
                    messageType: 'mermaid',
                    isComplete: false
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                  fullContent = streamData.content;
                } else if (streamData.type === 'img_gen') {
                  // For generated images, send as a whole
                  const data = {
                    content: streamData.content,
                    messageType: 'code',
                    isComplete: false
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                  fullContent = streamData.content;
                }
              }
            } catch (e) {
              // If parsing fails, accumulate and send complete sentences
              const hasCompleteSentence = chunk.match(/[.!?]\s/) || 
                                         chunk.includes('\n\n') ||
                                         responseBuffer.length > 100;
                                           
              if (isFirstChunk || hasCompleteSentence) {
                const data = {
                  content: responseBuffer,
                  messageType: 'text',
                  isComplete: false
                };
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                fullContent = responseBuffer;
                isFirstChunk = false;
              }
            }
          });
          
          // Handle process completion
          pythonProcess.on('close', async (code) => {
            // Send completion message
            const finalData = {
              content: '',
              messageType: 'text',
              isComplete: true
            };
            controller.enqueue(encoder.encode(JSON.stringify(finalData) + '\n'));
            
            // Save the AI response in database
            try {
              const insertAIMessageSql = `
                INSERT INTO "ChatMessage" (
                  "id",
                  "chatId",
                  "content",
                  "messageType",
                  "isUser",
                  "order",
                  "createdAt",
                  "updatedAt"
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `;
              
              await query(insertAIMessageSql, [
                generateUuid(),
                sessionId,
                fullContent,  // Use fullContent for database storage
                'text',
                false,
                nextOrder + 1,
                new Date(),
                new Date()
              ]);
            } catch (dbError) {
              console.error('Error saving AI message to database:', dbError);
            }
            
            controller.close();
          });
          
          // Handle errors
          pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data.toString()}`);
            const errorData = {
              content: `Error: ${data.toString()}`,
              messageType: 'error',
              isComplete: true
            };
            controller.enqueue(encoder.encode(JSON.stringify(errorData) + '\n'));
          });
          
          // Send the input to the Python script
          pythonProcess.stdin.write(agentInput + '\n');
          pythonProcess.stdin.end();
          
        } catch (error) {
          console.error("Error in LLM streaming:", error);
          controller.error(error);
        }
      }
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error in stream route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create a temporary agent script that will interface with the agent module
 */
function createTempAgentScript(scriptPath: string): void {
  const scriptContent = `
import sys
import os
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the parent directory to the Python path
parent_path = str(Path(__file__).parent)
if parent_path not in sys.path:
    sys.path.append(parent_path)

# Try to import the agent module
try:
    from agent.run_chat_agent import run_chat_agent
except ImportError as e:
    logger.error(f"Error importing agent module: {e}")
    print(json.dumps({"type": "error", "content": f"Import error: {str(e)}"}))
    sys.exit(1)

def stream_callback(chunk):
    """Process stream chunks from the agent and output in JSON format."""
    # Print the chunk as JSON
    print(json.dumps(chunk), flush=True)

def main():
    """Main function to run the agent."""
    try:
        # Read input from stdin (sent by the NextJS API)
        input_data = sys.stdin.readline().strip()
        request = json.loads(input_data)
        
        # Extract parameters
        user_id = request.get("userId", "web_user")
        course_id = request.get("courseId", "CS101")
        prompt = request.get("prompt", "")
        language = request.get("language", "english")
        chapter_id = request.get("chapterId")
        session_id = request.get("session_id")
        learning_profile = request.get("learningProfile", {
            "style": "conceptual",
            "depth": "beginner",
            "interaction": "examples"
        })
        
        # Run the agent with streaming enabled
        result = run_chat_agent(
            user_id=user_id,
            course_id=course_id,
            prompt=prompt,
            learning_profile=learning_profile,
            language=language,
            chapter_id=chapter_id,
            session_id=session_id,
            stream=True,
            stream_callback=stream_callback
        )
        
    except Exception as e:
        logger.error(f"Error in agent execution: {e}")
        print(json.dumps({"type": "error", "content": f"Error: {str(e)}"}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  
  fs.writeFileSync(scriptPath, scriptContent);
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