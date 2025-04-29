import React from 'react';
import { FC, useMemo, useEffect, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import MermaidDiagram from './MermaidDiagram';
// @ts-ignore
import OpenAI from 'openai';

// Add imports for code block and modal handling
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageProps {
  content: string;
  isUser: boolean;
  accentColor?: string;
  isMarkdown?: boolean;
  conversationContext?: {
    conversationId: string;
    courseId: string;
    moduleId: string;
    messages: any[];
    title?: string;
  }
}

// New interfaces for dialog state
interface ModalState {
  isOpen: boolean;
  content: string;
  type: 'mermaid' | 'code';
  language?: string;
}

// Helper to extract img_gen tags (handles missing closing tag)
const extractImgGenTags = (content: string): { prompt: string, index: number, raw: string }[] => {
  const tags: { prompt: string, index: number, raw: string }[] = [];
  // Updated pattern to handle both <img_gen> and <img_gen:description> formats
  const imgGenPattern = /<img_gen(?:\:description)?>([\s\S]*?)(?:<\/img_gen>|$)/g;
  let match;
  let idx = 0;
  while ((match = imgGenPattern.exec(content)) !== null) {
    const prompt = match[1].trim();
    if (prompt) tags.push({ prompt, index: idx++, raw: match[0] });
  }
  return tags;
};

// Helper to remove mermaid code blocks from markdown content but keep their positions for rendering
const extractAndRemoveMermaidBlocks = (content: string): { 
  cleanContent: string, 
  mermaidDiagrams: { code: string, placeholder: string }[] 
} => {
  const mermaidBlocks: { code: string, placeholder: string }[] = [];
  const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
  
  // Replace mermaid blocks with custom placeholders that we can render separately
  let cleanContent = content;
  let match;
  let index = 0;
  
  while ((match = mermaidPattern.exec(content)) !== null) {
    const fullMatch = match[0]; // The entire mermaid block
    const code = match[1].trim(); // Just the mermaid code
    const placeholder = `<mermaid-diagram-${index}></mermaid-diagram-${index}>`;
    
    // Replace the mermaid block with the placeholder
    cleanContent = cleanContent.replace(fullMatch, placeholder);
    
    // Store the mermaid code and its placeholder for later rendering
    mermaidBlocks.push({ code, placeholder });
    index++;
  }
  
  return { cleanContent, mermaidDiagrams: mermaidBlocks };
};

// Helper function to replace img_gen tags with identifiable placeholders
function replaceImgGenTagsWithPlaceholders(content: string): { newContent: string, placeholders: {id: string, prompt: string, raw: string}[] } {
  const placeholders: {id: string, prompt: string, raw: string}[] = [];
  const imgGenPattern = /<img_gen(?:\:description)?>([\s\S]*?)(?:<\/img_gen>|$)/g;
  
  // Replace each img_gen tag with a placeholder like [IMAGE:123]
  let newContent = content;
  let match;
  
  while ((match = imgGenPattern.exec(content)) !== null) {
    const raw = match[0];
    const prompt = match[1].trim();
    if (prompt) {
      // Create unique ID for this placeholder
      const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const placeholder = `[IMAGE:${id}]`;
      
      // Store placeholder info
      placeholders.push({ id, prompt, raw });
      
      // Replace the tag with the placeholder
      newContent = newContent.replace(raw, placeholder);
    }
  }
  
  return { newContent, placeholders };
}

// Monkey patch the fetch API to handle img_gen tags and save generated images
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
  // Check if this is a POST request to the conversations API
  if (
    (typeof input === 'string' && input.includes('/api/conversations')) || 
    (input instanceof Request && input.url.includes('/api/conversations'))
  ) {
    if (init?.method === 'POST' && init?.body) {
      try {
        // Parse the request body
        const body = JSON.parse(init.body.toString());
        
        // If this contains messages, process img_gen tags in each message
        if (body.messages && Array.isArray(body.messages)) {
          // Track if we made any changes to messages
          let messagesChanged = false;
          
          // Process each message
          body.messages = body.messages.map((msg: any) => {
            if (msg.content && typeof msg.content === 'string') {
              // Skip if this message already has an images property (already processed)
              if (msg.images) {
                return msg;
              }
              
              // Replace img_gen tags with identifiable placeholders
              const { newContent, placeholders } = replaceImgGenTagsWithPlaceholders(msg.content);
              
              // If no replacements were made, return the original message
              if (placeholders.length === 0) {
                return msg;
              }
              
              // Mark that we made changes
              messagesChanged = true;
              
              // Set up the images property if needed
              if (!msg.images) {
                msg.images = {};
              }
              
              // Return the updated message with placeholders
              return {
                ...msg,
                content: newContent,
                pendingImagePlaceholders: placeholders.map(p => ({ id: p.id, prompt: p.prompt }))
              };
            }
            return msg;
          });
          
          // Update the request with the modified messages
          if (messagesChanged) {
            init.body = JSON.stringify(body);
            console.log('Modified messages for API call, replaced img_gen tags with placeholders');
          }
        }
      } catch (e) {
        console.error('Error processing img_gen tags in request:', e);
      }
    }
  }
  
  // Call the original fetch function with the potentially modified input and init
  return originalFetch.call(window, input, init);
} as typeof window.fetch;

// Custom hook to manage image generation
function useImageGen(
  content: string, 
  conversationContext?: { 
    conversationId: string;
    courseId: string;
    moduleId: string;
    messages: any[];
    title?: string;
  }
) {
  // Extract img_gen tags from content
  const imgGenTags = useMemo(() => 
    extractImgGenTags(content)
  , [content]);
  
  // Extract image placeholders ([IMAGE:id]) from content
  const imagePlaceholders = useMemo(() => {
    const placeholders: { id: string, index: number, placeholder: string }[] = [];
    const placeholderPattern = /\[IMAGE:([^\]]+)\]/g;
    let match;
    let idx = 0;
    
    while ((match = placeholderPattern.exec(content)) !== null) {
      const id = match[1];
      placeholders.push({ id, index: idx++, placeholder: match[0] });
    }
    
    return placeholders;
  }, [content]);
  
  const [images, setImages] = useState<{ [key: string]: string | 'loading' | 'error' }>({});
  const [processedContent, setProcessedContent] = useState(content);
  
  // Always update processedContent when content changes
  useEffect(() => {
    setProcessedContent(content);
  }, [content]);
  
  // Reference to track if images were stored in the database
  const storedImages = useRef<Set<string>>(new Set());

  // Process image gen tags
  useEffect(() => {
    if (imgGenTags.length === 0) return;
    
    imgGenTags.forEach(({ prompt, index, raw }) => {
      const imageId = `imggen-${index}-${Date.now()}`;
      if (!images[imageId]) {
        // Set loading state immediately
        setImages(prev => ({ ...prev, [imageId]: 'loading' }));
        
        // Use OpenAI SDK in browser
        const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
        openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          size: '1024x1024',
          quality: 'low',
        }).then((result: any) => {
          const imageBase64 = result.data[0].b64_json;
          const imageUrl = `data:image/png;base64,${imageBase64}`;
          setImages(prev => ({ ...prev, [imageId]: imageUrl }));
          
          // Save the image to the database
          if (!storedImages.current.has(imageId) && conversationContext?.conversationId) {
            saveGeneratedImageToDatabase(imageUrl, prompt, raw, imageId);
            storedImages.current.add(imageId);
          }
        }).catch((error) => {
          console.error('Error generating image:', error);
          setImages(prev => ({ ...prev, [imageId]: 'error' }));
        });
      }
    });
  }, [imgGenTags, conversationContext?.conversationId]);
  
  // Process existing placeholders from server
  useEffect(() => {
    if (imagePlaceholders.length === 0 || !conversationContext) return;
    
    // Find the message in conversation context
    const message = conversationContext.messages.find(msg => msg.content === content);
    if (!message || !message.images) return;
    
    // Check each placeholder for an existing image
    imagePlaceholders.forEach(({ id, placeholder }) => {
      // If we already loaded this image, skip
      if (images[id] && images[id] !== 'loading' && images[id] !== 'error') return;
      
      // Check if we have this image in the message's images property
      const imageData = message.images[placeholder] || message.images[`[IMAGE:${id}]`];
      if (imageData && imageData.base64) {
        // We found an existing image for this placeholder
        setImages(prev => ({ ...prev, [id]: imageData.base64 }));
      }
    });
  }, [imagePlaceholders, conversationContext, content, images]);

  // Save image to conversation after generation
  const saveGeneratedImageToDatabase = (imageUrl: string, prompt: string, tagRaw: string, imageId: string) => {
    if (!conversationContext || !conversationContext.conversationId) {
      console.log('No conversation context available for saving image');
      return;
    }

    try {
      console.log('Saving generated image to database...');
      
      // Create a deep copy of the messages to modify
      const updatedMessages = JSON.parse(JSON.stringify(conversationContext.messages));
      
      // Find the message containing the img_gen tag
      const messageIndex = updatedMessages.findIndex((msg: any) => 
        msg.content && msg.content.includes(tagRaw)
      );
      
      if (messageIndex === -1) {
        console.error('Could not find message containing image tag');
        return;
      }
      
      // Create a placeholder for this image
      const imagePlaceholder = `[IMAGE:${imageId}]`;
      
      // Get the message to update
      const message = updatedMessages[messageIndex];
      
      // Replace the img_gen tag with the placeholder
      message.content = message.content.replace(tagRaw, imagePlaceholder);
      
      // Add or update the images property
      if (!message.images) {
        message.images = {};
      }
      
      // Store the image data with the placeholder
      message.images[imagePlaceholder] = {
        base64: imageUrl,
        prompt: prompt
      };
      
      // Remove any pendingImagePlaceholders property if it exists
      if (message.pendingImagePlaceholders) {
        delete message.pendingImagePlaceholders;
      }
      
      console.log(`Saving message with image placeholder: ${imagePlaceholder}`);
      
      // Save using the conversation endpoint
      fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationContext.conversationId,
          courseId: conversationContext.courseId,
          moduleId: conversationContext.moduleId,
          messages: updatedMessages,
          title: conversationContext.title || 'Chat'
        })
      })
      .then(response => {
        if (!response.ok) throw new Error(`Failed to save image: ${response.status}`);
        console.log(`Image saved successfully with placeholder ${imagePlaceholder}`);
      })
      .catch(error => console.error('Error saving image to database:', error));
      
    } catch (error) {
      console.error('Error preparing image save:', error);
    }
  };

  return { 
    imgGenTags, 
    images, 
    processedContent,
    imagePlaceholders
  };
}

// New function to add line breaks to long single lines in code blocks
const addLineBreaksToLongLines = (code: string, maxLineLength: number = 80): string => {
  // If code is already multiline, leave it as is
  if (code.includes('\n')) {
    return code;
  }
  
  // For single lines over the max length, break them up
  if (code.length > maxLineLength) {
    let result = '';
    let currentLineLength = 0;
    
    // Split by space to avoid breaking words
    const words = code.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // If adding this word would exceed the limit, add a line break
      if (currentLineLength + word.length + 1 > maxLineLength) {
        result += '\n' + word + ' ';
        currentLineLength = word.length + 1;
      } else {
        result += word + ' ';
        currentLineLength += word.length + 1;
      }
    }
    
    return result.trim();
  }
  
  return code;
};

// Custom hook to handle mermaid diagrams
function useMermaidDiagrams(content: string, isMarkdown: boolean) {
  return useMemo(() => {
    if (!isMarkdown) return { charts: [] };
    
    // Extract mermaid diagrams from the content
    const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
    const charts: string[] = [];
    let match;
    
    while ((match = mermaidPattern.exec(content)) !== null) {
      charts.push(match[1].trim());
    }
    
    return { charts };
  }, [content, isMarkdown]);
}

// Helper function to check if a string is a JSON object with imageBase64
function isImageJSON(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed.imageBase64 === 'string';
  } catch (e) {
    return false;
  }
}

// Helper function to filter out all img_gen tags from text content
function filterImgGenTags(content: string): string {
  // This regex matches both opening and closing img_gen tags with or without description
  return content.replace(/<img_gen(?:\:description)?>([\s\S]*?)(?:<\/img_gen>|$)/g, '');
}

// Helper to check if content has an 'images' property with placeholders
const hasImagePlaceholders = (content: string, images?: Record<string, any>): boolean => {
  if (!images) return false;
  
  // Check if any image placeholder exists in the content
  return Object.keys(images).some(placeholder => content.includes(placeholder));
};

// Helper to extract image placeholders from content
const extractImagePlaceholders = (content: string, images?: Record<string, any>): {placeholder: string, imageData: any}[] => {
  if (!images) return [];
  
  const placeholders: {placeholder: string, imageData: any}[] = [];
  
  Object.keys(images).forEach(placeholder => {
    if (content.includes(placeholder)) {
      placeholders.push({
        placeholder,
        imageData: images[placeholder]
      });
    }
  });
  
  return placeholders;
};

// Simplified Message component
export const Message: FC<MessageProps> = ({ 
  content, 
  isUser, 
  accentColor = 'var(--primary)',
  isMarkdown = false,
  conversationContext
}) => {
  // Add state for modal/dialog
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    content: '',
    type: 'code'
  });
  
  // Function to open modal with content
  const openModal = (content: string, type: 'mermaid' | 'code', language?: string) => {
    setModal({
      isOpen: true,
      content,
      type,
      language
    });
  };
  
  // Function to close modal
  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };
  
  // Check if this message is just a stored image
  const isImageOnlyMessage = useMemo(() => isImageJSON(content), [content]);
  
  // Parse content for stored images (JSON format with imageBase64)
  const storedImage = useMemo(() => {
    if (isImageOnlyMessage) {
      try {
        const parsed = JSON.parse(content);
        return parsed.imageBase64;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [content, isImageOnlyMessage]);
  
  // Use the image generation hook
  const { imgGenTags, images, processedContent, imagePlaceholders } = useImageGen(content, conversationContext);

  // Create a display version of content with img_gen tags hidden
  const displayContent = useMemo(() => {
    // Start with the processed content
    let result = processedContent;
    
    // Hide img_gen tags
    imgGenTags.forEach(tag => {
      result = result.replace(tag.raw, '');
    });
    
    return result;
  }, [processedContent, imgGenTags]);

  // Extract and remove mermaid diagrams from content
  const { cleanContent, mermaidDiagrams } = useMemo(() => {
    if (!isMarkdown) return { cleanContent: displayContent, mermaidDiagrams: [] };
    return extractAndRemoveMermaidBlocks(displayContent);
  }, [displayContent, isMarkdown]);

  // Check for image placeholders in the message from the database
  const [databaseImages, setDatabaseImages] = useState<{[key: string]: {base64: string, prompt: string}}>({});
  
  // Extract image placeholders from the message's images property
  useEffect(() => {
    if (conversationContext?.messages) {
      // Find the current message in the context
      const message = conversationContext.messages.find(msg => msg.content === content);
      
      if (message?.images) {
        setDatabaseImages(message.images);
        console.log(`Found ${Object.keys(message.images).length} image placeholders in message from database`);
      }
    }
  }, [content, conversationContext?.messages]);

  // For debugging
  useEffect(() => {
    console.log(`Message component received content (${content.length} chars), isImageOnlyMessage: ${isImageOnlyMessage}`);
    if (imgGenTags.length > 0) {
      console.log(`Found ${imgGenTags.length} img_gen tags to process`);
    }
    if (imagePlaceholders.length > 0) {
      console.log(`Found ${imagePlaceholders.length} image placeholders in content`);
    }
    if (mermaidDiagrams.length > 0) {
      console.log(`Found ${mermaidDiagrams.length} mermaid diagrams to render`);
    }
    if (Object.keys(databaseImages).length > 0) {
      console.log(`Found ${Object.keys(databaseImages).length} image placeholders from database`);
    }
  }, [content, imgGenTags.length, mermaidDiagrams.length, isImageOnlyMessage, databaseImages, imagePlaceholders.length]);

  // If this is just a stored image message, render only the image
  if (isImageOnlyMessage && storedImage) {
    // Extract original prompt from content if available
    let originalPrompt = null;
    try {
      const parsed = JSON.parse(content);
      if (parsed.originalPrompt) {
        originalPrompt = parsed.originalPrompt;
      }
    } catch (e) {
      // Ignore parsing errors
    }

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-center'} mb-4 px-4 sm:px-8 md:px-12 lg:px-20`}>
        {!isUser && (
          <div className="flex-shrink-0 w-9 h-9 rounded-md bg-[var(--primary)] text-white flex items-center justify-center mr-3 mt-0.5">
            <span className="text-base font-semibold">L</span>
          </div>
        )}
        <div 
          className={`relative max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[65%] py-4 px-5 rounded-lg ${
            isUser 
              ? 'bg-[var(--primary)] text-white' 
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          <div className="my-2 flex justify-center">
            <img 
              src={storedImage} 
              alt="Generated visual" 
              className="rounded-lg max-w-full max-h-[500px] border shadow" 
            />
          </div>
          {/* Show the original prompt if available */}
          {originalPrompt && (
            <div className="mt-2 text-xs text-gray-500 italic">
              Generated from: "{originalPrompt.substring(0, 50)}{originalPrompt.length > 50 ? '...' : ''}"
            </div>
          )}
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center ml-3 mt-0.5">
            <span className="text-base font-semibold">U</span>
          </div>
        )}
      </div>
    );
  }

  // Process content to render image placeholders from database
  const processContentWithDatabaseImages = (content: string): React.ReactNode[] => {
    if (!databaseImages || Object.keys(databaseImages).length === 0) {
      return [content];
    }
    
    // Split the content by image placeholders
    const result: React.ReactNode[] = [];
    let remainingContent = content;
    
    Object.keys(databaseImages).forEach(placeholder => {
      if (remainingContent.includes(placeholder)) {
        const parts = remainingContent.split(placeholder);
        if (parts.length === 2) {
          // Add text before placeholder
          if (parts[0]) {
            result.push(parts[0]);
          }
          
          // Add image component
          const imageData = databaseImages[placeholder];
          result.push(
            <div key={placeholder} className="my-4 flex justify-center w-full">
              <div className="flex flex-col items-center">
                <img 
                  src={imageData.base64} 
                  alt="Generated image" 
                  className="rounded-lg max-w-full max-h-[500px] border shadow"
                />
                {imageData.prompt && (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Generated from: "{imageData.prompt.substring(0, 50)}{imageData.prompt.length > 50 ? '...' : ''}"
                  </p>
                )}
              </div>
            </div>
          );
          
          // Update remaining content
          remainingContent = parts[1];
        }
      }
    });
    
    // Add any remaining content
    if (remainingContent) {
      result.push(remainingContent);
    }
    
    return result;
  };

  // Custom component to render markdown with mermaid diagrams
  const CustomMarkdownWithDiagrams = () => {
    // Split content by mermaid placeholders
    const contentSegments = mermaidDiagrams.reduce((acc, diagram, index) => {
      const parts = acc[acc.length - 1].split(diagram.placeholder);
      if (parts.length === 2) {
        // Replace the last segment with the first part
        acc[acc.length - 1] = parts[0];
        // Add a placeholder for the diagram
        acc.push(`mermaid-diagram-${index}`);
        // Add the second part as a new segment
        acc.push(parts[1]);
      }
      return acc;
    }, [cleanContent]);

    return (
      <>
        {contentSegments.map((segment, index) => {
          // Check if this is a mermaid diagram placeholder
          if (segment.startsWith('mermaid-diagram-')) {
            const diagramIndex = parseInt(segment.split('-').pop() || '0', 10);
            const diagram = mermaidDiagrams[diagramIndex];
            if (diagram) {
              return (
                <div key={`mermaid-diagram-${index}`} className="my-4 flex justify-center w-full">
                  <div 
                    className="w-full max-w-full overflow-hidden border border-gray-200 rounded-lg bg-white shadow-md p-4 flex flex-col items-center justify-center max-h-[400px] cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => openModal(diagram.code, 'mermaid')}
                  >
                    <div className="max-w-full w-full flex-shrink-0 overflow-auto flex justify-center">
                      <div className="transform scale-75 origin-center" style={{ maxWidth: '100%' }}>
                        <React.Suspense fallback={
                          <div className="flex items-center space-x-2 w-full justify-center h-[300px]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span className="text-sm text-gray-500">Generating diagram...</span>
                          </div>
                        }>
                          <MermaidDiagram chart={diagram.code} />
                        </React.Suspense>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 w-full text-center">
                      Click to expand diagram
                    </div>
                  </div>
                </div>
              );
            }
          }
          
          // Otherwise render markdown for this segment with database images
          const segmentParts = processContentWithDatabaseImages(segment);
          
          return segmentParts.map((part, partIndex) => {
            if (typeof part === 'string') {
              return (
                <div key={`markdown-${index}-${partIndex}`} className="prose prose-base max-w-none prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2 prose-p:mb-2 prose-hr:my-4 prose-ul:pl-5 prose-ol:pl-5">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const code = String(children).replace(/\n$/, '');
                        
                        if (!inline && match) {
                          // Process long single-line code blocks
                          const processedCode = addLineBreaksToLongLines(code, 80);
                          
                          return (
                            <div className="relative">
                              <SyntaxHighlighter
                                {...props}
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  lineHeight: '1.25rem',
                                  maxWidth: '100%',
                                  overflowX: 'auto',
                                }}
                                wrapLines={true}
                                wrapLongLines={true}
                              >
                                {processedCode}
                              </SyntaxHighlighter>
                              <button 
                                onClick={() => openModal(code, 'code', match[1])}
                                className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 text-white rounded opacity-70 hover:opacity-100 transition-opacity"
                              >
                                Expand
                              </button>
                            </div>
                          );
                        } else if (!inline) {
                          // Handle code blocks without language specification
                          const processedCode = addLineBreaksToLongLines(code, 80);
                          return (
                            <div className="relative">
                              <SyntaxHighlighter
                                {...props}
                                style={vscDarkPlus}
                                language="text"
                                PreTag="div"
                                customStyle={{
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  lineHeight: '1.25rem',
                                  maxWidth: '100%',
                                  overflowX: 'auto',
                                }}
                                wrapLines={true}
                                wrapLongLines={true}
                              >
                                {processedCode}
                              </SyntaxHighlighter>
                              <button 
                                onClick={() => openModal(code, 'code')}
                                className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 text-white rounded opacity-70 hover:opacity-100 transition-opacity"
                              >
                                Expand
                              </button>
                            </div>
                          );
                        }
                        
                        return <code {...props} className={className}>{children}</code>;
                      }
                    }}
                  >
                    {part}
                  </ReactMarkdown>
                </div>
              );
            } else {
              return part; // This is an image component
            }
          });
        })}
      </>
    );
  };

  // Render message with content, images, and diagrams
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-center'} mb-4 px-4 sm:px-8 md:px-12 lg:px-20`}>
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-md bg-[var(--primary)] text-white flex items-center justify-center mr-3 mt-0.5">
          <span className="text-base font-semibold">L</span>
        </div>
      )}
      <div 
        className={`relative max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[65%] py-4 px-5 rounded-lg ${
          isUser 
            ? 'bg-[var(--primary)] text-white' 
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {/* Hidden div containing the original content with tags - used for API calls */}
        <div className="hidden">{processedContent}</div>
        
        {/* Markdown content with mermaid diagrams - using displayContent (tags hidden) */}
        {isMarkdown && processedContent && (
          <CustomMarkdownWithDiagrams />
        )}
        
        {/* Plain text content - using displayContent (tags hidden) */}
        {!isMarkdown && (
          <div className="whitespace-pre-wrap text-base">
            {processContentWithDatabaseImages(displayContent).map((part, index) => 
              typeof part === 'string' ? <span key={index}>{part}</span> : part
            )}
          </div>
        )}
        
        {/* Image generation loading indicators and results */}
        {imgGenTags.map(({ prompt, index }) => {
          const imageId = `imggen-${index}-${Date.now()}`;
          const image = images[imageId];
          return (
            <div key={`img-gen-${index}`} className="my-4 flex justify-center w-full">
              {(!image || image === 'loading') && (
                <div className="flex flex-col items-center space-y-3 w-full justify-center min-h-[200px] p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="text-sm text-gray-500">Generating image...</span>
                  <span className="text-xs text-gray-400 max-w-md text-center">
                    Creating an image based on: "{prompt.substring(0, 50)}{prompt.length > 50 ? '...' : ''}"
                  </span>
                </div>
              )}
              {image === 'error' && (
                <div className="flex items-center justify-center w-full min-h-[200px] text-red-500 p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="text-center">
                    <p className="font-medium">Image generation failed</p>
                    <p className="text-sm mt-2">There was an error creating your image</p>
                    <p className="text-xs mt-1 text-gray-500">Prompt: "{prompt.substring(0, 50)}{prompt.length > 50 ? '...' : ''}"</p>
                  </div>
                </div>
              )}
              {image && image !== 'loading' && image !== 'error' && (
                <div className="flex flex-col items-center">
                  <img src={image} alt="Generated visual" className="rounded-lg max-w-full max-h-[500px] border shadow" />
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Generated from: "{prompt.substring(0, 50)}{prompt.length > 50 ? '...' : ''}"
                  </p>
                </div>
              )}
            </div>
          );
        })}
        
        {/* Render images from placeholders */}
        {imagePlaceholders.map(({ id, placeholder }) => {
          const image = images[id];
          if (!image || image === 'loading' || image === 'error') return null;
          
          return (
            <div key={`placeholder-${id}`} className="my-4 flex justify-center w-full">
              <div className="flex flex-col items-center">
                <img src={image} alt="Generated visual" className="rounded-lg max-w-full max-h-[500px] border shadow" />
                <p className="text-xs text-gray-500 mt-2 italic">
                  Generated image
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center ml-3 mt-0.5">
          <span className="text-base font-semibold">U</span>
        </div>
      )}
      
      {/* Modal for expanded diagrams and code */}
      {modal.isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-lg max-w-[90vw] max-h-[90vh] overflow-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {modal.type === 'mermaid' ? 'Diagram' : `Code${modal.language ? ` (${modal.language})` : ''}`}
              </h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={closeModal}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {modal.type === 'mermaid' ? (
                <div className="w-full max-w-4xl mx-auto">
                  <React.Suspense fallback={
                    <div className="flex items-center space-x-2 w-full justify-center h-[400px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="text-sm text-gray-500">Generating diagram...</span>
                    </div>
                  }>
                    <MermaidDiagram chart={modal.content} />
                  </React.Suspense>
                </div>
              ) : (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={modal.language || 'text'}
                  customStyle={{
                    borderRadius: '0.375rem',
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    overflow: 'auto',
                  }}
                  wrapLongLines={true}
                >
                  {modal.content}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message; 