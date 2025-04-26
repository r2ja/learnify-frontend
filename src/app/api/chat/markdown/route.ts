import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

// Process the message in chunks to simulate streaming
export function processMarkdownInChunks(markdown: string): ReadableStream<Uint8Array> {
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
      
      // Split markdown into chunks for streaming simulation
      const chunks = splitMarkdownIntoChunks(markdown, 15);
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
          // Vary the timing a bit to simulate human typing
          const delay = Math.floor(Math.random() * 30) + 30; // 30-60ms
          setTimeout(sendNextChunk, delay);
        } else {
          // Send final message indicating completion
          controller.enqueue(encoder.encode(JSON.stringify({
            id: messageId,
            type: 'complete', 
            content: 'Response complete',
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

// Helper function to split markdown into multiple chunks, preserving structure
function splitMarkdownIntoChunks(markdown: string, numChunks: number): string[] {
  const chunks: string[] = [];
  
  // Special case: detect code blocks, headers, etc.
  const specialElements = [
    { type: 'codeblock', regex: /```[\s\S]*?```/g },
    { type: 'header', regex: /^#{1,6}.*$/gm },
    { type: 'list', regex: /^[\s]*[-*+].*(?:\n[\s]*[-*+].*)*$/gm },
    { type: 'numbered-list', regex: /^[\s]*\d+\..*(?:\n[\s]*\d+\..*)*$/gm },
    { type: 'blockquote', regex: /^>.*(?:\n>.*)*$/gm },
    { type: 'table', regex: /\|.*\|[\s]*\n\|[\s]*[-:]+[-|\s:]*[\s]*\n[\s\S]*?\n\n/g }
  ];
  
  // Extract special elements
  let specialMatches: {type: string, content: string, index: number}[] = [];
  
  specialElements.forEach(({type, regex}) => {
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      specialMatches.push({
        type,
        content: match[0],
        index: match.index
      });
    }
  });
  
  // Sort special matches by index
  specialMatches.sort((a, b) => a.index - b.index);
  
  // If no special elements or very short text, fallback to simple splitting
  if (specialMatches.length === 0 || markdown.length < 100) {
    return splitTextIntoChunks(markdown, numChunks);
  }
  
  // Process text around and including special elements
  let lastIndex = 0;
  let currentChunk = '';
  const chunkLength = Math.ceil(markdown.length / numChunks);
  
  for (const match of specialMatches) {
    // Add text before the special element
    if (match.index > lastIndex) {
      const textBefore = markdown.substring(lastIndex, match.index);
      // Split this regular text if needed
      if (textBefore.length > chunkLength) {
        const textChunks = splitTextIntoChunks(textBefore, Math.ceil(textBefore.length / chunkLength));
        chunks.push(...textChunks);
      } else {
        currentChunk += textBefore;
        
        // If chunk is getting large, add it and reset
        if (currentChunk.length >= chunkLength) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      }
    }
    
    // Handle the special element based on type
    if (match.type === 'codeblock') {
      // For code blocks, add the opening, then content in chunks, then closing
      const codeLines = match.content.split('\n');
      
      // Add opening ``` line
      currentChunk += codeLines[0] + '\n';
      chunks.push(currentChunk);
      currentChunk = '';
      
      // Add code content lines gradually
      const codeContent = codeLines.slice(1, -1).join('\n');
      const codeChunks = splitTextIntoChunks(codeContent, Math.ceil(codeContent.length / (chunkLength * 0.8)));
      
      for (const codeChunk of codeChunks) {
        chunks.push(codeChunk);
      }
      
      // Add closing ``` line
      chunks.push(codeLines[codeLines.length - 1]);
    } else if (match.type === 'header' || match.type === 'list' || match.type === 'numbered-list') {
      // For headers and lists, add line by line
      const lines = match.content.split('\n');
      currentChunk += lines[0];
      chunks.push(currentChunk);
      currentChunk = '';
      
      // Add remaining lines
      for (let i = 1; i < lines.length; i++) {
        chunks.push(lines[i]);
      }
    } else {
      // For other elements, split normally if they're big
      if (match.content.length > chunkLength) {
        const elementChunks = splitTextIntoChunks(match.content, Math.ceil(match.content.length / chunkLength));
        chunks.push(...elementChunks);
      } else {
        currentChunk += match.content;
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
    
    lastIndex = match.index + match.content.length;
  }
  
  // Add any remaining text
  if (lastIndex < markdown.length) {
    const remainingText = markdown.substring(lastIndex);
    if (remainingText.length > chunkLength) {
      const remainingChunks = splitTextIntoChunks(remainingText, Math.ceil(remainingText.length / chunkLength));
      chunks.push(...remainingChunks);
    } else if (remainingText.trim().length > 0) {
      chunks.push(remainingText);
    }
  }
  
  // Add any final accumulated chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
}

// Simple text splitting for regular paragraphs
function splitTextIntoChunks(text: string, numChunks: number): string[] {
  const chunks: string[] = [];
  const chunkSize = Math.ceil(text.length / numChunks);
  
  let currentIndex = 0;
  while (currentIndex < text.length) {
    // Find a good breaking point - prefer to break at spaces, periods or commas
    let breakPoint = Math.min(currentIndex + chunkSize, text.length);
    
    // If we're not at the end and we're in the middle of a word, try to find a better break point
    if (breakPoint < text.length && text[breakPoint] !== ' ' && text[breakPoint-1] !== ' ') {
      // Look backward for a good breaking character
      const breakChars = [' ', '.', ',', ':', ';', '!', '?', '\n'];
      
      for (let i = 0; i < 20 && breakPoint > currentIndex; i++) {
        if (breakChars.includes(text[breakPoint - 1])) {
          break;
        }
        breakPoint--;
      }
      
      // If we couldn't find a good break point, just use the calculated one
      if (breakPoint <= currentIndex) {
        breakPoint = Math.min(currentIndex + chunkSize, text.length);
      }
    }
    
    chunks.push(text.substring(currentIndex, breakPoint));
    currentIndex = breakPoint;
  }
  
  return chunks;
}

// Generate a sample markdown response
function generateMarkdownResponse(): string {
  return `# Markdown Demo

Welcome to the Markdown demonstration. This document shows how the app can render streaming markdown content like ChatGPT.

## Code Examples

Here's a simple React component:

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

## Lists and Tables

Here's an ordered list:

1. First item
2. Second item
3. Third item with **bold text**

And an unordered list:

- Item one
- Item two
- *Italic item*

Here's a simple table:

| Name | Type | Description |
|------|------|-------------|
| id | string | Unique identifier |
| title | string | The title of the item |
| createdAt | date | When the item was created |

## Blockquotes and Mathematics

> This is a blockquote that can be used to highlight important information.
> It can span multiple lines and include *formatting*.

You can also include mathematical expressions:

$E = mc^2$

## Diagrams

And finally, here's a flowchart diagram:

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

This example demonstrates how the app can render various markdown elements with proper streaming support.`;
}

export async function POST(request: NextRequest) {
  try {
    // Generate markdown response
    const markdownContent = generateMarkdownResponse();
    
    // Process and stream the response in chunks
    const stream = processMarkdownInChunks(markdownContent);
    
    return new NextResponse(stream);
  } catch (error) {
    console.error("Error in streaming markdown response:", error);
    return NextResponse.json(
      { error: "Failed to process streaming markdown response" },
      { status: 500 }
    );
  }
} 
import { v4 as uuidv4 } from 'uuid';

// Process the message in chunks to simulate streaming
export function processMarkdownInChunks(markdown: string): ReadableStream<Uint8Array> {
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
      
      // Split markdown into chunks for streaming simulation
      const chunks = splitMarkdownIntoChunks(markdown, 15);
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
          // Vary the timing a bit to simulate human typing
          const delay = Math.floor(Math.random() * 30) + 30; // 30-60ms
          setTimeout(sendNextChunk, delay);
        } else {
          // Send final message indicating completion
          controller.enqueue(encoder.encode(JSON.stringify({
            id: messageId,
            type: 'complete', 
            content: 'Response complete',
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

// Helper function to split markdown into multiple chunks, preserving structure
function splitMarkdownIntoChunks(markdown: string, numChunks: number): string[] {
  const chunks: string[] = [];
  
  // Special case: detect code blocks, headers, etc.
  const specialElements = [
    { type: 'codeblock', regex: /```[\s\S]*?```/g },
    { type: 'header', regex: /^#{1,6}.*$/gm },
    { type: 'list', regex: /^[\s]*[-*+].*(?:\n[\s]*[-*+].*)*$/gm },
    { type: 'numbered-list', regex: /^[\s]*\d+\..*(?:\n[\s]*\d+\..*)*$/gm },
    { type: 'blockquote', regex: /^>.*(?:\n>.*)*$/gm },
    { type: 'table', regex: /\|.*\|[\s]*\n\|[\s]*[-:]+[-|\s:]*[\s]*\n[\s\S]*?\n\n/g }
  ];
  
  // Extract special elements
  let specialMatches: {type: string, content: string, index: number}[] = [];
  
  specialElements.forEach(({type, regex}) => {
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      specialMatches.push({
        type,
        content: match[0],
        index: match.index
      });
    }
  });
  
  // Sort special matches by index
  specialMatches.sort((a, b) => a.index - b.index);
  
  // If no special elements or very short text, fallback to simple splitting
  if (specialMatches.length === 0 || markdown.length < 100) {
    return splitTextIntoChunks(markdown, numChunks);
  }
  
  // Process text around and including special elements
  let lastIndex = 0;
  let currentChunk = '';
  const chunkLength = Math.ceil(markdown.length / numChunks);
  
  for (const match of specialMatches) {
    // Add text before the special element
    if (match.index > lastIndex) {
      const textBefore = markdown.substring(lastIndex, match.index);
      // Split this regular text if needed
      if (textBefore.length > chunkLength) {
        const textChunks = splitTextIntoChunks(textBefore, Math.ceil(textBefore.length / chunkLength));
        chunks.push(...textChunks);
      } else {
        currentChunk += textBefore;
        
        // If chunk is getting large, add it and reset
        if (currentChunk.length >= chunkLength) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      }
    }
    
    // Handle the special element based on type
    if (match.type === 'codeblock') {
      // For code blocks, add the opening, then content in chunks, then closing
      const codeLines = match.content.split('\n');
      
      // Add opening ``` line
      currentChunk += codeLines[0] + '\n';
      chunks.push(currentChunk);
      currentChunk = '';
      
      // Add code content lines gradually
      const codeContent = codeLines.slice(1, -1).join('\n');
      const codeChunks = splitTextIntoChunks(codeContent, Math.ceil(codeContent.length / (chunkLength * 0.8)));
      
      for (const codeChunk of codeChunks) {
        chunks.push(codeChunk);
      }
      
      // Add closing ``` line
      chunks.push(codeLines[codeLines.length - 1]);
    } else if (match.type === 'header' || match.type === 'list' || match.type === 'numbered-list') {
      // For headers and lists, add line by line
      const lines = match.content.split('\n');
      currentChunk += lines[0];
      chunks.push(currentChunk);
      currentChunk = '';
      
      // Add remaining lines
      for (let i = 1; i < lines.length; i++) {
        chunks.push(lines[i]);
      }
    } else {
      // For other elements, split normally if they're big
      if (match.content.length > chunkLength) {
        const elementChunks = splitTextIntoChunks(match.content, Math.ceil(match.content.length / chunkLength));
        chunks.push(...elementChunks);
      } else {
        currentChunk += match.content;
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
    
    lastIndex = match.index + match.content.length;
  }
  
  // Add any remaining text
  if (lastIndex < markdown.length) {
    const remainingText = markdown.substring(lastIndex);
    if (remainingText.length > chunkLength) {
      const remainingChunks = splitTextIntoChunks(remainingText, Math.ceil(remainingText.length / chunkLength));
      chunks.push(...remainingChunks);
    } else if (remainingText.trim().length > 0) {
      chunks.push(remainingText);
    }
  }
  
  // Add any final accumulated chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
}

// Simple text splitting for regular paragraphs
function splitTextIntoChunks(text: string, numChunks: number): string[] {
  const chunks: string[] = [];
  const chunkSize = Math.ceil(text.length / numChunks);
  
  let currentIndex = 0;
  while (currentIndex < text.length) {
    // Find a good breaking point - prefer to break at spaces, periods or commas
    let breakPoint = Math.min(currentIndex + chunkSize, text.length);
    
    // If we're not at the end and we're in the middle of a word, try to find a better break point
    if (breakPoint < text.length && text[breakPoint] !== ' ' && text[breakPoint-1] !== ' ') {
      // Look backward for a good breaking character
      const breakChars = [' ', '.', ',', ':', ';', '!', '?', '\n'];
      
      for (let i = 0; i < 20 && breakPoint > currentIndex; i++) {
        if (breakChars.includes(text[breakPoint - 1])) {
          break;
        }
        breakPoint--;
      }
      
      // If we couldn't find a good break point, just use the calculated one
      if (breakPoint <= currentIndex) {
        breakPoint = Math.min(currentIndex + chunkSize, text.length);
      }
    }
    
    chunks.push(text.substring(currentIndex, breakPoint));
    currentIndex = breakPoint;
  }
  
  return chunks;
}

// Generate a sample markdown response
function generateMarkdownResponse(): string {
  return `# Markdown Demo

Welcome to the Markdown demonstration. This document shows how the app can render streaming markdown content like ChatGPT.

## Code Examples

Here's a simple React component:

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

## Lists and Tables

Here's an ordered list:

1. First item
2. Second item
3. Third item with **bold text**

And an unordered list:

- Item one
- Item two
- *Italic item*

Here's a simple table:

| Name | Type | Description |
|------|------|-------------|
| id | string | Unique identifier |
| title | string | The title of the item |
| createdAt | date | When the item was created |

## Blockquotes and Mathematics

> This is a blockquote that can be used to highlight important information.
> It can span multiple lines and include *formatting*.

You can also include mathematical expressions:

$E = mc^2$

## Diagrams

And finally, here's a flowchart diagram:

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

This example demonstrates how the app can render various markdown elements with proper streaming support.`;
}

export async function POST(request: NextRequest) {
  try {
    // Generate markdown response
    const markdownContent = generateMarkdownResponse();
    
    // Process and stream the response in chunks
    const stream = processMarkdownInChunks(markdownContent);
    
    return new NextResponse(stream);
  } catch (error) {
    console.error("Error in streaming markdown response:", error);
    return NextResponse.json(
      { error: "Failed to process streaming markdown response" },
      { status: 500 }
    );
  }
} 