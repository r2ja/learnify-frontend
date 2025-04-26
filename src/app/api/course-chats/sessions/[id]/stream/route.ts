import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

// Process the message in chunks to simulate streaming
export function processMessageInChunks(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const messageId = uuidv4();
      
      // Initial message to initialize the streaming
      controller.enqueue(encoder.encode(JSON.stringify({
        id: messageId,
        type: 'text',
        content: '',
        done: false
      }) + '\n'));
      
      // Split message into chunks for streaming simulation
      const chunks = splitIntoChunks(message, 10);
      let chunkIndex = 0;
      
      const sendNextChunk = () => {
        if (chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex];
          controller.enqueue(encoder.encode(JSON.stringify({
            id: messageId,
            type: 'text',
            content: chunk,
            done: false
          }) + '\n'));
          
          chunkIndex++;
          setTimeout(sendNextChunk, 50); // Stream chunks at 50ms intervals
        } else {
          // Send final message indicating completion
          controller.enqueue(encoder.encode(JSON.stringify({
            id: messageId,
            type: 'text', 
            content: '',
            done: true
          }) + '\n'));
          
          controller.close();
        }
      };
      
      // Start sending chunks
      setTimeout(sendNextChunk, 50);
    }
  });
}

// Helper function to split text into multiple chunks
function splitIntoChunks(text: string, numChunks: number): string[] {
  const chunks: string[] = [];
  const chunkSize = Math.ceil(text.length / numChunks);
  
  let currentIndex = 0;
  while (currentIndex < text.length) {
    // Find a good breaking point - prefer to break at spaces or punctuation
    let breakPoint = Math.min(currentIndex + chunkSize, text.length);
    
    // If we're not at the end and we're in the middle of a word, try to find a better break point
    if (breakPoint < text.length && text[breakPoint] !== ' ' && text[breakPoint-1] !== ' ') {
      // Look backward for a space
      const spaceIndex = text.lastIndexOf(' ', breakPoint);
      // Look for special markdown characters to avoid breaking in the middle
      const markdownBreakPoints = ['\n', '.', ',', ':', ';', '!', '?', ')', ']', '}'];
      
      // Find closest markdown-friendly breakpoint
      let mdBreakPoint = -1;
      for (const char of markdownBreakPoints) {
        const index = text.lastIndexOf(char, breakPoint);
        if (index > mdBreakPoint && index > currentIndex) {
          mdBreakPoint = index + 1; // Break after the punctuation
        }
      }
      
      // Prefer markdown breakpoints, then spaces, but only if they're not too far from our target
      if (mdBreakPoint > 0 && mdBreakPoint > currentIndex + Math.floor(chunkSize * 0.5)) {
        breakPoint = mdBreakPoint;
      } else if (spaceIndex > 0 && spaceIndex > currentIndex + Math.floor(chunkSize * 0.5)) {
        breakPoint = spaceIndex + 1; // Break after the space
      }
      
      // Special handling to avoid breaking inside code blocks, headers, etc.
      const codeBlockStart = text.lastIndexOf('```', breakPoint);
      const codeBlockEnd = text.lastIndexOf('```\n', breakPoint);
      if (codeBlockStart > codeBlockEnd && codeBlockStart > currentIndex) {
        // We're inside a code block, try to find the next ``` or go to the end of the current chunk
        const nextCodeBlockEnd = text.indexOf('```', breakPoint);
        if (nextCodeBlockEnd > 0 && nextCodeBlockEnd - currentIndex < chunkSize * 2) {
          // If the code block end is within reasonable distance, include the whole block
          breakPoint = nextCodeBlockEnd + 3;
        }
      }
    }
    
    chunks.push(text.substring(currentIndex, breakPoint));
    currentIndex = breakPoint;
  }
  
  return chunks;
}

// Generate a sample response based on the user message
function generateResponse(userMessage: string): string {
  // Create a more realistic Markdown response with various elements
  if (userMessage.toLowerCase().includes('code') || userMessage.toLowerCase().includes('example')) {
    return `
# Here's a code example

You asked for some code, so here's a React component example:

\`\`\`jsx
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
    </div>
  );
}

export default Counter;
\`\`\`

You can use this component like this:

\`\`\`jsx
import Counter from './Counter';

function App() {
  return (
    <div>
      <h1>My Counter App</h1>
      <Counter />
    </div>
  );
}
\`\`\`

Let me know if you need any clarification!
`;
  } else if (userMessage.toLowerCase().includes('diagram') || userMessage.toLowerCase().includes('mermaid')) {
    return `
# Flowchart Example

Here's a flowchart diagram of a simple process:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Fix issues]
    E --> B
    C --> F[Continue]
    F --> G[End]
\`\`\`

This diagram shows a troubleshooting workflow. When encountering an issue:
1. Check if the system is working
2. If yes, continue with the process
3. If no, debug and fix the issues, then check again

Does this help with your question?
`;
  } else {
    return `
# Response to your question

Thank you for asking about "${userMessage}". Here are some key points to consider:

## Main concepts
- The first important concept is **understanding the basics**
- Next, we need to consider *how these ideas connect*
- Finally, practical application is essential

## Detailed explanation
When we examine this topic more closely, we find several interconnected elements:

1. Component A relates to Component B through relationship X
2. Component B influences Component C in the following ways:
   - Interaction 1
   - Interaction 2
   - Interaction 3

### Additional considerations
> Sometimes we need to think outside the conventional approach to find innovative solutions.

Is there any specific part of this you'd like me to elaborate on?
`;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const { message, chapter_id } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    // Generate response based on the message
    const responseContent = generateResponse(message);
    
    // Process and stream the response in chunks
    const stream = processMessageInChunks(responseContent);
    
    return new NextResponse(stream);
  } catch (error) {
    console.error("Error in streaming response:", error);
    return NextResponse.json(
      { error: "Failed to process streaming response" },
      { status: 500 }
    );
  }
} 
import { v4 as uuidv4 } from 'uuid';

// Process the message in chunks to simulate streaming
export function processMessageInChunks(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const messageId = uuidv4();
      
      // Initial message to initialize the streaming
      controller.enqueue(encoder.encode(JSON.stringify({
        id: messageId,
        type: 'text',
        content: '',
        done: false
      }) + '\n'));
      
      // Split message into chunks for streaming simulation
      const chunks = splitIntoChunks(message, 10);
      let chunkIndex = 0;
      
      const sendNextChunk = () => {
        if (chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex];
          controller.enqueue(encoder.encode(JSON.stringify({
            id: messageId,
            type: 'text',
            content: chunk,
            done: false
          }) + '\n'));
          
          chunkIndex++;
          setTimeout(sendNextChunk, 50); // Stream chunks at 50ms intervals
        } else {
          // Send final message indicating completion
          controller.enqueue(encoder.encode(JSON.stringify({
            id: messageId,
            type: 'text', 
            content: '',
            done: true
          }) + '\n'));
          
          controller.close();
        }
      };
      
      // Start sending chunks
      setTimeout(sendNextChunk, 50);
    }
  });
}

// Helper function to split text into multiple chunks
function splitIntoChunks(text: string, numChunks: number): string[] {
  const chunks: string[] = [];
  const chunkSize = Math.ceil(text.length / numChunks);
  
  let currentIndex = 0;
  while (currentIndex < text.length) {
    // Find a good breaking point - prefer to break at spaces or punctuation
    let breakPoint = Math.min(currentIndex + chunkSize, text.length);
    
    // If we're not at the end and we're in the middle of a word, try to find a better break point
    if (breakPoint < text.length && text[breakPoint] !== ' ' && text[breakPoint-1] !== ' ') {
      // Look backward for a space
      const spaceIndex = text.lastIndexOf(' ', breakPoint);
      // Look for special markdown characters to avoid breaking in the middle
      const markdownBreakPoints = ['\n', '.', ',', ':', ';', '!', '?', ')', ']', '}'];
      
      // Find closest markdown-friendly breakpoint
      let mdBreakPoint = -1;
      for (const char of markdownBreakPoints) {
        const index = text.lastIndexOf(char, breakPoint);
        if (index > mdBreakPoint && index > currentIndex) {
          mdBreakPoint = index + 1; // Break after the punctuation
        }
      }
      
      // Prefer markdown breakpoints, then spaces, but only if they're not too far from our target
      if (mdBreakPoint > 0 && mdBreakPoint > currentIndex + Math.floor(chunkSize * 0.5)) {
        breakPoint = mdBreakPoint;
      } else if (spaceIndex > 0 && spaceIndex > currentIndex + Math.floor(chunkSize * 0.5)) {
        breakPoint = spaceIndex + 1; // Break after the space
      }
      
      // Special handling to avoid breaking inside code blocks, headers, etc.
      const codeBlockStart = text.lastIndexOf('```', breakPoint);
      const codeBlockEnd = text.lastIndexOf('```\n', breakPoint);
      if (codeBlockStart > codeBlockEnd && codeBlockStart > currentIndex) {
        // We're inside a code block, try to find the next ``` or go to the end of the current chunk
        const nextCodeBlockEnd = text.indexOf('```', breakPoint);
        if (nextCodeBlockEnd > 0 && nextCodeBlockEnd - currentIndex < chunkSize * 2) {
          // If the code block end is within reasonable distance, include the whole block
          breakPoint = nextCodeBlockEnd + 3;
        }
      }
    }
    
    chunks.push(text.substring(currentIndex, breakPoint));
    currentIndex = breakPoint;
  }
  
  return chunks;
}

// Generate a sample response based on the user message
function generateResponse(userMessage: string): string {
  // Create a more realistic Markdown response with various elements
  if (userMessage.toLowerCase().includes('code') || userMessage.toLowerCase().includes('example')) {
    return `
# Here's a code example

You asked for some code, so here's a React component example:

\`\`\`jsx
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
    </div>
  );
}

export default Counter;
\`\`\`

You can use this component like this:

\`\`\`jsx
import Counter from './Counter';

function App() {
  return (
    <div>
      <h1>My Counter App</h1>
      <Counter />
    </div>
  );
}
\`\`\`

Let me know if you need any clarification!
`;
  } else if (userMessage.toLowerCase().includes('diagram') || userMessage.toLowerCase().includes('mermaid')) {
    return `
# Flowchart Example

Here's a flowchart diagram of a simple process:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Fix issues]
    E --> B
    C --> F[Continue]
    F --> G[End]
\`\`\`

This diagram shows a troubleshooting workflow. When encountering an issue:
1. Check if the system is working
2. If yes, continue with the process
3. If no, debug and fix the issues, then check again

Does this help with your question?
`;
  } else {
    return `
# Response to your question

Thank you for asking about "${userMessage}". Here are some key points to consider:

## Main concepts
- The first important concept is **understanding the basics**
- Next, we need to consider *how these ideas connect*
- Finally, practical application is essential

## Detailed explanation
When we examine this topic more closely, we find several interconnected elements:

1. Component A relates to Component B through relationship X
2. Component B influences Component C in the following ways:
   - Interaction 1
   - Interaction 2
   - Interaction 3

### Additional considerations
> Sometimes we need to think outside the conventional approach to find innovative solutions.

Is there any specific part of this you'd like me to elaborate on?
`;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const { message, chapter_id } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    // Generate response based on the message
    const responseContent = generateResponse(message);
    
    // Process and stream the response in chunks
    const stream = processMessageInChunks(responseContent);
    
    return new NextResponse(stream);
  } catch (error) {
    console.error("Error in streaming response:", error);
    return NextResponse.json(
      { error: "Failed to process streaming response" },
      { status: 500 }
    );
  }
} 