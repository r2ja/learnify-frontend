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

// Cache for API connectivity test to prevent multiple calls
let apiConnectivityCache: { isWorking: boolean; timestamp: number } | null = null;
const API_CACHE_DURATION = 30000; // 30 seconds

// Helper function to test API connectivity
const testApiConnectivity = async (): Promise<boolean> => {
  try {
    // Check cache first
    const now = Date.now();
    if (apiConnectivityCache && (now - apiConnectivityCache.timestamp < API_CACHE_DURATION)) {
      console.log('Using cached API connectivity result:', apiConnectivityCache.isWorking);
      return apiConnectivityCache.isWorking;
    }
    
    console.log('Testing API connectivity...');
    const response = await fetch('/api/test');
    
    if (response.ok) {
      const data = await response.json();
      console.log('API test successful:', data);
      
      // Cache the result
      apiConnectivityCache = { isWorking: true, timestamp: now };
      return true;
    } else {
      console.error('API test failed with status:', response.status);
      apiConnectivityCache = { isWorking: false, timestamp: now };
      return false;
    }
  } catch (error) {
    console.error('API test failed with error:', error);
    apiConnectivityCache = { isWorking: false, timestamp: Date.now() };
    return false;
  }
};

// Helper to extract img_gen tags (handles missing closing tag)
const extractImgGenTags = (content: string): { prompt: string, index: number, raw: string }[] => {
  const tags: { prompt: string, index: number, raw: string }[] = [];
  // Updated pattern to handle malformed closing tags and spaces in tags
  const imgGenPattern = /<\s*img_gen(?:\:description)?\s*>([\s\S]*?)(?:<\s*\/\s*img_g[^>]*>|<\s*\/\s*img_gen\s*>|$)/g;
  let match;
  let idx = 0;
  while ((match = imgGenPattern.exec(content)) !== null) {
    const prompt = match[1].trim();
    if (prompt) tags.push({ prompt, index: idx++, raw: match[0] });
  }
  return tags;
};

// Helper to process img_gen tags and replace with placeholders
const processImgGenTags = (content: string): { processedContent: string, imgGenTags: { prompt: string, index: number, raw: string }[] } => {
  // For streaming content, don't process partial tags - check for both with and without spaces
  if (content.length < 100 && 
      (content.includes('<img_gen') || content.includes('< img_gen')) && 
      !content.includes('</img_gen') && !content.includes('< /img_gen')) {
    console.log('Detected partial img_gen tag in streaming response, not processing');
    return { processedContent: content, imgGenTags: [] };
  }

  // Skip processing if content has already been processed (contains placeholder markers)
  if (content.includes('__IMAGE_')) {
    console.log('Content already contains image placeholders, skipping processing');
    
    // Extract the already processed tags for reference
    const existingTags: { prompt: string, index: number, raw: string }[] = [];
    const tagMatches = content.match(/__IMAGE_(\d+)__/g);
    
    if (tagMatches) {
      console.log(`Found ${tagMatches.length} existing image placeholders`);
    }
    
    return { processedContent: content, imgGenTags: existingTags };
  }

  const tags: { prompt: string, index: number, raw: string }[] = [];
  // Updated pattern to handle malformed closing tags and spaces in tags
  const imgGenPattern = /<\s*img_gen(?:\:description)?\s*>([\s\S]*?)(?:<\s*\/\s*img_g[^>]*>|<\s*\/\s*img_gen\s*>|$)/g;
  let matchCount = 0;
  
  // Replace img_gen tags with placeholders
  const processedContent = content.replace(imgGenPattern, (match, prompt) => {
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt) {
      tags.push({ prompt: trimmedPrompt, index: matchCount, raw: match });
      return `__IMAGE_${matchCount++}__`;
    }
    return '';
  });
  
  return { processedContent, imgGenTags: tags };
};

// Helper to remove img_gen tags from content
const removeImgGenTags = (content: string): string => {
  // Remove img_gen tags with malformed closing tags, including versions with spaces
  return content.replace(/<\s*img_gen(?:\:description)?\s*>([\s\S]*?)(?:<\s*\/\s*img_g[^>]*>|<\s*\/\s*img_gen\s*>|$)/g, '')
    .replace(/__IMAGE_\d+__/g, '');
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
  // First process img_gen tags, replacing with placeholders
  const { processedContent: initialProcessedContent, imgGenTags } = useMemo(() => {
    // Important: For streaming responses, we need to be careful about modifying content
    // Check if this appears to be a stream chunk (usually much shorter and may be incomplete)
    if (content.length < 100 && !content.includes('<img_gen') && !content.includes('< img_gen')) {
      // For small chunks without img_gen tags, don't process
      return { processedContent: content, imgGenTags: [] };
    }
    
    // Log for debugging img_gen tag detection
    if (content.includes('<img_gen') || content.includes('< img_gen')) {
      console.log('Detected img_gen tag in content:', content.substring(0, 100) + '...');
    }
    
    return processImgGenTags(content);
  }, [content]);

  // Log found img_gen tags
  useEffect(() => {
    if (imgGenTags.length > 0) {
      console.log(`Found ${imgGenTags.length} img_gen tags to process with prompts:`, 
        imgGenTags.map(tag => tag.prompt.substring(0, 30) + '...'));
    }
  }, [imgGenTags]);
  
  const [images, setImages] = useState<{ [key: number]: string | 'loading' | 'error' }>({});
  // Use the processed content directly instead of storing it in state
  // This ensures it updates properly with each render as content changes
  const processedContent = initialProcessedContent;
  
  // Reference to track if images were stored
  const storedImages = useRef<Set<number>>(new Set());

  // Use a ref to track which image tags we've started processing
  // This is crucial to prevent multiple API calls during streaming
  const processingImages = useRef<Set<string>>(new Set());

  // Process image gen tags
  useEffect(() => {
    if (imgGenTags.length === 0) return;
    
    console.log(`Found ${imgGenTags.length} image generation tags`);
    
    // Create a cleanup function array
    const cleanupFunctions: Array<() => void> = [];
    
    // Use a ref to track if this effect has run for these specific tags
    const effectKey = JSON.stringify(imgGenTags.map(tag => tag.prompt + '-' + tag.index));
    console.log(`Running image generation effect with key: ${effectKey.substring(0, 40)}...`);
    
    // First test API connectivity
    testApiConnectivity().then(isApiWorking => {
      // Skip if component has been unmounted
      // if (cleanupFunctions.length === 0) return;
      
      if (!isApiWorking) {
        console.error('API connectivity test failed, will not attempt to save images');
        // Still generate images but don't try to save them
        imgGenTags.forEach(({ prompt, index }) => {
          // Create a unique key for this prompt+index combination
          const imageKey = `${prompt.substring(0, 50)}-${index}`;
          
          // Skip if we've already started processing this image
          if (processingImages.current.has(imageKey)) {
            console.log(`Skipping duplicate image generation for ${imageKey} - already being processed`);
            return;
          }
          
          // Mark this image as being processed
          processingImages.current.add(imageKey);
          
          const cleanup = processImageGeneration(prompt, index, false);
          if (cleanup) cleanupFunctions.push(cleanup);
        });
      } else {
        // API is working, proceed with normal operation
    imgGenTags.forEach(({ prompt, index }) => {
          // Create a unique key for this prompt+index combination
          const imageKey = `${prompt.substring(0, 50)}-${index}`;
          
          // Skip if we've already started processing this image
          if (processingImages.current.has(imageKey)) {
            console.log(`Skipping duplicate image generation for ${imageKey} - already being processed`);
            return;
          }
          
          // Mark this image as being processed
          processingImages.current.add(imageKey);
          
          const cleanup = processImageGeneration(prompt, index, true);
          if (cleanup) cleanupFunctions.push(cleanup);
        });
      }
    });
    
    // Cleanup function to cancel any pending image generation requests
    return () => {
      console.log(`Cleaning up image generation effect`);
      cleanupFunctions.forEach(cleanup => cleanup());
      cleanupFunctions.length = 0; // Clear the array
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Only run this effect when the unique string representation of the tags changes
    JSON.stringify(imgGenTags.map(tag => tag.prompt + '-' + tag.index)),
    // Don't include conversationContext as it may change too frequently
    conversationContext?.conversationId
  ]);

  // Move the image generation logic to a separate function for cleaner code
  const processImageGeneration = (prompt: string, index: number, shouldSave: boolean) => {
    // console.log(`Processing image generation tag ${index}: ${prompt.substring(0, 30)}...`);
    
    // Check if we're already loading this image or have it
    // if (images[index] === 'loading' || (images[index] && images[index] !== 'error')) {
      // console.log(`Skipping duplicate image generation for tag ${index} - already in progress or completed`);
      // return null; // Return null to indicate no cleanup needed
    // }
    
        // Set loading state immediately
    setImages(prev => {
      // Additional check to prevent race conditions
      if (prev[index] === 'loading' || (prev[index] && prev[index] !== 'error')) {
        console.log(`Prevented duplicate image generation for tag ${index} due to race condition`);
        return prev;
      }
      return { ...prev, [index]: 'loading' };
    });
    
    // Use a local variable to track if this request has been handled
    let isHandled = false;
    
    // Add a debounce by setting a timeout
    const requestTimeout = setTimeout(() => {
      if (isHandled) return;
      
      console.log(`🔄 SENDING OpenAI image generation request for tag ${index}:
      Prompt: "${prompt.substring(0, 50)}..."
      Time: ${new Date().toISOString()}`);
        
        // Use OpenAI SDK in browser
        const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
      
        openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          size: '1024x1024',
          quality: 'low',
        }).then((result: any) => {
        if (isHandled) return;
        isHandled = true;
        
        console.log(`✅ RECEIVED OpenAI image generation response for tag ${index}:
        Time: ${new Date().toISOString()}
        Status: Success`);
        
          const imageBase64 = result.data[0].b64_json;
          const imageUrl = `data:image/png;base64,${imageBase64}`;
        console.log(`Image generation successful for tag ${index}`);
        
          setImages(prev => ({ ...prev, [index]: imageUrl }));
          
        // Save the image to the filesystem if we're supposed to
        if (shouldSave && !storedImages.current.has(index) && conversationContext?.conversationId) {
          console.log(`baka Saving image to filesystem for tag ${index}`);
          saveImageToFilesystem(imageUrl, prompt, index);
            storedImages.current.add(index);
          }
        }).catch((error) => {
        if (isHandled) return;
        isHandled = true;
        
        console.error(`❌ ERROR in OpenAI image generation for tag ${index}:
        Time: ${new Date().toISOString()}
        Error: ${error.message || error}`);
        
          setImages(prev => ({ ...prev, [index]: 'error' }));
        });
    }, 500); // Increase delay to 500ms to further reduce chance of duplicate calls
    
    // Clean up if component unmounts during the timeout
    return () => {
      clearTimeout(requestTimeout);
      isHandled = true; // Mark as handled to prevent late responses
    };
  };

  // Save image to filesystem instead of conversation
  const saveImageToFilesystem = async (imageUrl: string, prompt: string, index: number) => {
    if (!conversationContext || !conversationContext.conversationId) {
      console.log('No conversation context available for saving image');
      return;
    }

    try {
      console.log(`Attempting to save image to filesystem for index ${index} with prompt: ${prompt.substring(0, 30)}...`);
      
      // Skip test API call since we've already tested connectivity
      console.log('Making API call to /api/saveImage');
      
      const saveResponse = await fetch('/api/saveImage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          imageData: imageUrl,
          prompt: prompt
        })
      });
      
      console.log(`saveImage API response status: ${saveResponse.status}`);
      
      if (!saveResponse.ok) {
        throw new Error(`Failed to save image: ${saveResponse.status}`);
      }
      
      let data;
      try {
        data = await saveResponse.json();
        console.log(`✅ IMAGE SAVED SUCCESSFULLY:
        File path: ${data.filePath}
        Filename: ${data.filename}
        Location: C:/Users/inaya/OneDrive/Desktop/FYP/images/${data.filename}
        Time: ${new Date().toISOString()}`);
      } catch (jsonError) {
        console.error('Error parsing save response JSON:', jsonError);
        throw new Error('Failed to parse save response');
      }
      
      // Add a new message with just the image reference
      const newImageMessage = {
        id: `img-${Date.now().toString()}`,
        content: JSON.stringify({ 
          filePath: data.filePath, 
          filename: data.filename,
          prompt: prompt,
          originalPrompt: prompt
        }),
        isUser: false,
        accentColor: 'var(--primary)',
        isMarkdown: true,
        timestamp: new Date().toISOString()
      };
      
      console.log('Creating new message with image reference:', newImageMessage.id);
      
      // Save the current messages with processed content
      const currentMessages = conversationContext.messages.map(msg => {
        if (msg.content === content) {
          return { ...msg, content: processedContent };
        }
        return msg;
      });
      
      // Add the new message with the image reference
      const updatedMessages = [...currentMessages, newImageMessage];
      
      console.log(`Saving conversation with image reference. Total messages: ${updatedMessages.length}`);
      
      // Save using the existing conversation endpoint
      const conversationResponse = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationContext.conversationId,
          courseId: conversationContext.courseId,
          moduleId: conversationContext.moduleId,
          messages: updatedMessages,
          title: conversationContext.title || 'Chat'
        })
      });
      
      console.log(`Conversation API response status: ${conversationResponse.status}`);
      
      if (!conversationResponse.ok) {
        throw new Error(`Failed to save image reference: ${conversationResponse.status}`);
      }
      
      console.log(`Image reference saved successfully to conversation`);
      
    } catch (error) {
      console.error('Error saving image or updating conversation:', error);
      // Update the image state to error if we failed to save
      setImages(prev => {
        if (prev[index] !== 'error') {
          return { ...prev, [index]: 'error' };
        }
        return prev;
      });
    }
  };

  // Extract mermaid diagrams if isMarkdown is true
  const { cleanContent, mermaidDiagrams } = useMemo(() => {
    if (!processedContent || processedContent.trim() === '') {
      return { cleanContent: processedContent, mermaidDiagrams: [] };
    }
    return extractAndRemoveMermaidBlocks(processedContent);
  }, [processedContent]);

  return { 
    imgGenTags, 
    images, 
    processedContent,
    cleanContent,
    mermaidDiagrams
  };
}

// Add a component for image loading
const ImageFromFile = ({ filePath, prompt }: { filePath: string, prompt?: string }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!filePath) {
      setError('No file path provided');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    fetch(`/api/getImage?filePath=${encodeURIComponent(filePath)}`)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load image: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        const imageUrl = URL.createObjectURL(blob);
        setImageSrc(imageUrl);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading image:', error);
        setError(error.message);
        setIsLoading(false);
      });
      
    // Cleanup function to revoke object URL when component unmounts
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [filePath]);
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 w-full bg-gray-100 rounded-lg p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
        <p className="text-sm text-gray-500">Loading image...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 w-full bg-red-50 text-red-500 rounded-lg p-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm">Failed to load image</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center">
      <img 
        src={imageSrc || ''} 
        alt="Generated image" 
        className="rounded-lg max-w-full max-h-[500px] border shadow"
      />
      {prompt && (
        <p className="text-xs text-gray-500 mt-2 italic">
          Generated from: "{prompt.substring(0, 50)}{prompt.length > 50 ? '...' : ''}"
        </p>
      )}
    </div>
  );
};

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

// Helper function to check if a string is a JSON object with imageBase64 or filePath
function isImageJSON(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed && (typeof parsed.imageBase64 === 'string' || typeof parsed.filePath === 'string');
  } catch (e) {
    return false;
  }
}

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
  
  // Parse content for stored images (JSON format with imageBase64 or filePath)
  const [storedImage, filePath, promptFromImage] = useMemo(() => {
    if (isImageOnlyMessage) {
    try {
      const parsed = JSON.parse(content);
        if (parsed.imageBase64) {
          return [parsed.imageBase64, null, parsed.originalPrompt || parsed.prompt || null];
        }
        if (parsed.filePath) {
          return [null, parsed.filePath, parsed.originalPrompt || parsed.prompt || null];
        }
    } catch (e) {
        return [null, null, null];
      }
    }
    return [null, null, null];
  }, [content, isImageOnlyMessage]);
  
  // Use the image generation hook
  const { imgGenTags, images, processedContent, cleanContent, mermaidDiagrams } = useImageGen(content, conversationContext);

  // For debugging
  useEffect(() => {
    console.log(`Message component received content (${content.length} chars), isImageOnlyMessage: ${isImageOnlyMessage}`);
    if (imgGenTags.length > 0) {
      console.log(`Found ${imgGenTags.length} img_gen tags to process`);
    }
    if (mermaidDiagrams.length > 0) {
      console.log(`Found ${mermaidDiagrams.length} mermaid diagrams to render`);
    }
  }, [content, imgGenTags.length, mermaidDiagrams.length, isImageOnlyMessage]);

  // If this is just a stored image message, render only the image
  if (isImageOnlyMessage) {
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
            {storedImage ? (
            <img 
              src={storedImage} 
              alt="Generated visual" 
              className="rounded-lg max-w-full max-h-[500px] border shadow" 
            />
            ) : filePath ? (
              <ImageFromFile filePath={filePath} prompt={promptFromImage} />
            ) : null}
          </div>
          {/* Show the original prompt if available */}
          {promptFromImage && !filePath && (
            <div className="mt-2 text-xs text-gray-500 italic">
              Generated from: "{promptFromImage.substring(0, 50)}{promptFromImage.length > 50 ? '...' : ''}"
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
                    className="w-full max-w-full overflow-hidden border border-gray-200 rounded-lg bg-white shadow-md p-4 flex flex-col items-center justify-center min-h-[350px] cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => openModal(diagram.code, 'mermaid')}
                  >
                    <div className="max-w-full w-full h-full flex-1 overflow-auto flex justify-center">
                      <div className="transform scale-95 origin-center" style={{ maxWidth: '100%', minHeight: '300px' }}>
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
          
          // Otherwise render markdown for this segment
          return (
            <div key={`markdown-${index}`} className="prose prose-base max-w-none prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2 prose-p:mb-2 prose-hr:my-4 prose-ul:pl-5 prose-ol:pl-5">
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
                {segment}
              </ReactMarkdown>
            </div>
          );
        })}
      </>
    );
  };

  // Function to render image placeholders
  const renderImagePlaceholders = () => {
    if (imgGenTags.length === 0) return null;
    
    return imgGenTags.map(({ prompt, index }) => {
      const image = images[index];
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
    });
  };

  // Determine if this content is likely a stream chunk in progress
  const isStreamingChunk = useMemo(() => {
    // Check for hallmarks of a partial chunk during streaming:
    // 1. Short content (but not too short)
    // 2. No complete sentences (no periods followed by space or newline)
    // 3. No markdown or img_gen tags
    // 4. For very short content, it's almost always a stream chunk
    if (content.length <= 2) return true;
    
    // For slightly longer content, use more heuristics
    const isStream = content.length > 0 && 
           content.length < 300 && 
           (!content.match(/\.\s|\.\n/) || !content.includes(' ')) &&  // No sentences or no spaces
           !content.includes('```') && 
           !content.includes('<img_gen') &&
           !content.includes('\n\n');  // Double line breaks usually indicate complete message
    
    // For debugging streaming issues
    if (isStream) {
      console.log(`Detected streaming chunk: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}" (${content.length} chars)`);
    }
    
    return isStream;
  }, [content]);

  // For streaming chunks, keep rendering simple to avoid interfering with accumulation
  if (isStreamingChunk) {
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
          {/* Keep this extremely simple for streaming chunks - no markdown or processing at all */}
          <div className="whitespace-pre-wrap text-base">
            {content}
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
          <div className="whitespace-pre-wrap text-base">
            {processedContent}
          </div>
        )}
        
        {/* Image generation placeholders */}
        {renderImagePlaceholders()}
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
            className="bg-white rounded-lg max-w-[95vw] max-h-[95vh] w-auto h-auto overflow-auto shadow-xl"
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
                <div className="w-full min-w-[800px] min-h-[500px] max-w-[1200px] mx-auto flex items-center justify-center">
                  <React.Suspense fallback={
                    <div className="flex items-center space-x-2 w-full justify-center h-[500px]">
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