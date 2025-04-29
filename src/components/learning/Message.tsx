import React from 'react';
import { FC, useMemo, useEffect, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import MermaidDiagram from './MermaidDiagram';
// @ts-ignore
import OpenAI from 'openai';

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
  // Check if the content already contains a stored image
  const storedImage = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.imageBase64) {
        return parsed.imageBase64;
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [content]);

  // Only extract img_gen tags if there's no stored image
  const imgGenTags = useMemo(() => 
    storedImage ? [] : extractImgGenTags(content)
  , [content, storedImage]);
  
  const [images, setImages] = useState<{ [key: number]: string | 'loading' | 'error' }>({});
  const [processedContent, setProcessedContent] = useState(content);
  
  // Always update processedContent when content changes
  // This ensures the component stays in sync with parent updates
  useEffect(() => {
    setProcessedContent(content);
  }, [content]);
  
  // Reference to track if images were stored in the database
  const storedImages = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (imgGenTags.length === 0) return;
    
    imgGenTags.forEach(({ prompt, index }) => {
      if (!images[index]) {
        // Set loading state immediately
        setImages(prev => ({ ...prev, [index]: 'loading' }));
        
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
          setImages(prev => ({ ...prev, [index]: imageUrl }));
          
          // Save the image to the database only once
          if (!storedImages.current.has(index) && conversationContext?.conversationId) {
            saveGeneratedImageToDatabase(imageUrl, index);
            storedImages.current.add(index);
          }
        }).catch((error) => {
          console.error('Error generating image:', error);
          setImages(prev => ({ ...prev, [index]: 'error' }));
        });
      }
    });
  }, [imgGenTags, images, conversationContext?.conversationId]);

  // Save image to conversation and remove img_gen tags from content
  const saveGeneratedImageToDatabase = (imageUrl: string, index: number) => {
    if (!conversationContext || !conversationContext.conversationId) {
      console.log('No conversation context available for saving image');
      return;
    }

    try {
      // Create a new message with just the image
      const newImageMessage = {
        id: `img-${Date.now().toString()}`,
        content: JSON.stringify({ imageBase64: imageUrl }),
        isUser: false,
        accentColor: 'var(--primary)',
        isMarkdown: true,
        timestamp: new Date().toISOString()
      };
      
      // Add the new message with the image
      const updatedMessages = [...conversationContext.messages, newImageMessage];
      
      // Update the original message in the database to remove the img_gen tag
      const currentMessageIndex = conversationContext.messages.length - 1;
      const currentMessage = conversationContext.messages[currentMessageIndex];
      
      if (currentMessage) {
        // Remove the img_gen tag that was processed from content
        const tag = imgGenTags.find(tag => tag.index === index);
        if (tag) {
          // Create the updated message with img_gen tags removed
          const updatedContent = currentMessage.content.replace(tag.raw, '');
          const updatedCurrentMessage = {
            ...currentMessage,
            content: updatedContent
          };
          
          // Update the current message with tags removed
          updatedMessages[currentMessageIndex] = updatedCurrentMessage;
          
          // Also update local state for rendering
          setProcessedContent(prev => {
            const newContent = prev.replace(tag.raw, '');
            console.log('Updated processedContent after removing img_gen:', 
                       newContent.substring(0, 50) + (newContent.length > 50 ? '...' : ''));
            return newContent;
          });
        }
      }
      
      // Save using the existing conversation endpoint
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
        if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
        console.log('Image saved successfully and img_gen tag removed');
      })
      .catch(error => console.error('Error saving image:', error));
      
    } catch (error) {
      console.error('Error preparing image save:', error);
    }
  };

  return { imgGenTags, images, processedContent };
}

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

// Helper to check if content is a JSON-encoded image
function parseStoredImage(content: string): string | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.imageBase64) {
      return parsed.imageBase64;
    }
  } catch (e) {
    // Not JSON or not an image
  }
  return null;
}

// Simplified Message component
export const Message: FC<MessageProps> = ({ 
  content, 
  isUser, 
  accentColor = 'var(--primary)',
  isMarkdown = false,
  conversationContext
}) => {
  // Parse content for stored images (JSON format with imageBase64)
  const storedImage = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      return parsed && parsed.imageBase64 ? parsed.imageBase64 : null;
    } catch (e) {
      return null;
    }
  }, [content]);
  
  // Use processed content from the hook which stays in sync with content changes
  const { imgGenTags, images, processedContent } = useImageGen(content, conversationContext);

  // Extract and remove mermaid diagrams from content
  const { cleanContent, mermaidDiagrams } = useMemo(() => {
    if (!isMarkdown) return { cleanContent: processedContent, mermaidDiagrams: [] };
    return extractAndRemoveMermaidBlocks(processedContent);
  }, [processedContent, isMarkdown]);

  // For debugging
  useEffect(() => {
    console.log(`Message component received updated content (${content.length} chars):`);
    console.log(content.substring(0, 100) + (content.length > 100 ? '...' : ''));
    console.log(`Using processedContent (${processedContent.length} chars)`);
    if (mermaidDiagrams.length > 0) {
      console.log(`Found ${mermaidDiagrams.length} mermaid diagrams to render`);
    }
  }, [content, processedContent, mermaidDiagrams.length]);

  // If this is just a stored image message, render only the image
  if (storedImage) {
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
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center ml-3 mt-0.5">
            <span className="text-base font-semibold">U</span>
          </div>
        )}
      </div>
    );
  }

  // Custom component to render markdown with mermaid placeholders replaced by actual diagrams
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
                  <div className="w-full max-w-4xl border border-gray-200 rounded-lg bg-white shadow-md p-4 flex items-center justify-center min-h-[400px] h-full">
                    <React.Suspense fallback={
                      <div className="flex items-center space-x-2 w-full justify-center min-h-[400px]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-500">Generating diagram...</span>
                      </div>
                    }>
                      <MermaidDiagram chart={diagram.code} />
                    </React.Suspense>
                  </div>
                </div>
              );
            }
          }
          // Otherwise render markdown for this segment
          return segment && (
            <div key={`markdown-${index}`} className="prose prose-base max-w-none prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2 prose-p:mb-2 prose-hr:my-4 prose-ul:pl-5 prose-ol:pl-5">
              <ReactMarkdown>{segment}</ReactMarkdown>
            </div>
          );
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
        {/* Markdown content with mermaid diagrams */}
        {isMarkdown && processedContent && (
          <CustomMarkdownWithDiagrams />
        )}
        
        {/* Plain text content */}
        {!isMarkdown && (
          <div className="whitespace-pre-wrap text-base">{processedContent}</div>
        )}
        
        {/* Image generation placeholders */}
        {imgGenTags.map(({ prompt, index }) => {
          const image = images[index];
          return (
            <div key={`img-gen-${index}`} className="my-4 flex justify-center w-full">
              {image === 'loading' && (
                <div className="flex flex-col items-center space-y-3 w-full justify-center min-h-[200px] p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="text-sm text-gray-500">Generating image...</span>
                </div>
              )}
              {image === 'error' && (
                <div className="flex items-center justify-center w-full min-h-[200px] text-red-500 p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="text-center">
                    <p className="font-medium">Image generation failed</p>
                    <p className="text-sm mt-2">There was an error creating your image</p>
                  </div>
                </div>
              )}
              {typeof image === 'string' && image !== 'loading' && image !== 'error' && (
                <img src={image} alt="Generated visual" className="rounded-lg max-w-full max-h-[500px] border shadow" />
              )}
            </div>
          );
        })}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center ml-3 mt-0.5">
          <span className="text-base font-semibold">U</span>
        </div>
      )}
    </div>
  );
};

export default Message; 