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
}

// Helper to determine if a content block might contain a mermaid diagram
const containsMermaidDiagram = (content: string): boolean => {
  // Look for common Mermaid diagram identifiers
  const mermaidIdentifiers = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
    'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie'
  ];
  
  const lowerContent = content.toLowerCase();
  return mermaidIdentifiers.some(id => lowerContent.includes(id));
};

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

// Helper to remove img_gen tags and replace with placeholders
const processImgGenTags = (content: string): { processedContent: string, imgGenTags: { prompt: string, index: number, raw: string }[] } => {
  const tags: { prompt: string, index: number, raw: string }[] = [];
  // Updated pattern to handle both <img_gen> and <img_gen:description> formats
  const imgGenPattern = /<img_gen(?:\:description)?>([\s\S]*?)(?:<\/img_gen>|$)/g;
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
  // Remove <img_gen>...</img_gen> or <img_gen>... (no closing tag)
  return content.replace(/<img_gen(?:\:description)?>([\s\S]*?)(?:<\/img_gen>|$)/g, '').replace(/__IMAGE_\d+__/g, '');
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
  const { processedContent: initialProcessedContent, imgGenTags } = useMemo(() => 
    processImgGenTags(content), [content]
  );
  
  const [images, setImages] = useState<{ [key: number]: string | 'loading' | 'error' }>({});
  const [processedContent] = useState<string>(initialProcessedContent);
  
  // Reference to track if images were stored in the database
  const storedImages = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (imgGenTags.length === 0) return;
    
    console.log(`Found ${imgGenTags.length} image generation tags`);
    
    imgGenTags.forEach(({ prompt, index }) => {
      console.log(`Processing image generation tag ${index}: ${prompt.substring(0, 30)}...`);
      
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
            saveImageToConversation(imageUrl);
            storedImages.current.add(index);
          }
        }).catch((error) => {
          console.error('Error generating image:', error);
          setImages(prev => ({ ...prev, [index]: 'error' }));
        });
      }
    });
  }, [imgGenTags, images, conversationContext?.conversationId]);

  // Save image to conversation - only if we have context
  const saveImageToConversation = (imageUrl: string) => {
    if (!conversationContext || !conversationContext.conversationId) {
      console.log('No conversation context available for saving image');
      return;
    }

    try {
      // Add a new message with just the image
      const newImageMessage = {
        id: `img-${Date.now().toString()}`,
        content: JSON.stringify({ imageBase64: imageUrl }),
        isUser: false,
        accentColor: 'var(--primary)',
        isMarkdown: true,
        timestamp: new Date().toISOString()
      };
      
      // Save the current messages but with processed content
      // This ensures img_gen tags are converted to placeholders
      const currentMessages = conversationContext.messages.map(msg => {
        if (msg.content === content) {
          return { ...msg, content: processedContent };
        }
        return msg;
      });
      
      // Add the new message with the image
      const updatedMessages = [...currentMessages, newImageMessage];
      
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
        console.log('Image saved successfully');
      })
      .catch(error => console.error('Error saving image:', error));
      
    } catch (error) {
      console.error('Error preparing image save:', error);
    }
  };

  return { imgGenTags, images, processedContent };
}

// Helper to remove mermaid code blocks from markdown
const removeMermaidBlocks = (content: string): string => {
  // Also remove any 'MERMAID_0' text that may appear in the markdown
  return content.replace(/```mermaid[\s\S]*?```/g, '').replace(/MERMAID_\d+/g, '');
};

export const Message: FC<MessageProps & {
  conversationContext?: {
    conversationId: string;
    courseId: string;
    moduleId: string;
    messages: any[];
    title?: string;
  }
}> = ({ 
  content, 
  isUser, 
  accentColor = 'var(--primary)',
  isMarkdown = false,
  conversationContext
}) => {
  // Parse content if it's JSON to check for stored imageBase64
  const [parsedContent, storedImage] = useMemo(() => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      // Check if it contains imageBase64 property
      if (parsed && parsed.imageBase64) {
        return ["", parsed.imageBase64];
      }
      // If it's JSON but doesn't have imageBase64, return the stringified version
      return [content, null];
    } catch (e) {
      // Not JSON, return original content
      return [content, null];
    }
  }, [content]);

  // Image generation logic
  const { imgGenTags, images, processedContent } = useImageGen(parsedContent, conversationContext);

  // Extract and process Mermaid diagrams from content
  const { processedContent: mermaidProcessedContent, mermaidCharts } = useMemo(() => {
    if (!isMarkdown) {
      return { processedContent: processedContent, mermaidCharts: [] };
    }
    // Simple, focused regex for extracting Mermaid code blocks
    const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
    const charts: string[] = [];
    let matchCount = 0;
    let processedText = processedContent.replace(mermaidPattern, (_, chartContent) => {
      const placeholder = `__MERMAID_${matchCount++}__`;
      charts.push(chartContent.trim());
      return placeholder;
    });
    return { processedContent: processedText, mermaidCharts: charts };
  }, [processedContent, isMarkdown]);

  // Final content with img_gen tags and mermaid code blocks replaced with placeholders
  const finalContent = useMemo(() => {
    if (!isMarkdown) return mermaidProcessedContent;
    
    // The content already has placeholders for images and mermaid diagrams
    return mermaidProcessedContent;
  }, [mermaidProcessedContent, isMarkdown]);

  // Render generated images in place of placeholders
  const renderGeneratedImages = () => {
    if (imgGenTags.length === 0) return null;
    
    console.log(`Rendering ${imgGenTags.length} image placeholders`);
    
    // First, render all image placeholders regardless of whether they're in the content
    // This ensures loading indicators appear even if placeholders aren't correctly inserted
    return imgGenTags.map(({ prompt, index }) => {
      const image = images[index];
      const placeholder = `__IMAGE_${index}__`;
      
      console.log(`Rendering image ${index}: ${image === 'loading' ? 'LOADING' : image === 'error' ? 'ERROR' : 'READY'}`);
      
      return (
        <div key={`img-gen-${index}`} className="my-4 flex justify-center w-full" id={placeholder}>
          {image === 'loading' && (
            <div className="flex flex-col items-center space-y-3 w-full justify-center min-h-[200px] p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-500">Generating image from prompt...</span>
              <div className="text-xs text-gray-400 max-w-md overflow-hidden text-ellipsis">{prompt.substring(0, 50)}...</div>
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
            <img src={image} alt="Generated visual representation" className="rounded-lg max-w-full max-h-[500px] border shadow" />
          )}
        </div>
      );
    });
  };

  // Render stored image from the parsed content
  const renderStoredImage = () => {
    if (!storedImage) return null;
    return (
      <div className="my-4 flex justify-center w-full">
        <img 
          src={storedImage} 
          alt="Generated visual" 
          className="rounded-lg max-w-full max-h-[500px] border shadow" 
        />
      </div>
    );
  };

  // Helper to render mermaid diagrams with placeholders
  const renderMermaidDiagrams = () => {
    if (mermaidCharts.length === 0) return null;
    return mermaidCharts.map((chart, index) => (
      <div key={`mermaid-diagram-${index}`} className="my-4 flex justify-center w-full">
        <div
          className="w-full max-w-4xl cursor-pointer border border-gray-200 rounded-lg bg-white shadow-md p-4 flex items-center justify-center min-h-[400px] h-full"
          style={{ minHeight: 400 }}
          onClick={() => { setModalChart(chart); setModalOpen(true); }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <React.Suspense fallback={<div className="flex items-center space-x-2 w-full justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><span className="text-sm text-gray-500">Generating diagram...</span></div>}>
              <MermaidDiagram chart={chart} />
            </React.Suspense>
          </div>
        </div>
      </div>
    ));
  };

  // Modal state for viewing diagrams
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChart, setModalChart] = useState<string | null>(null);

  // Modal for full-size diagram view
  const renderModal = () => {
    if (!modalOpen || !modalChart) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setModalOpen(false)}>
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full relative" onClick={e => e.stopPropagation()}>
          <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl" onClick={() => setModalOpen(false)}>&times;</button>
          <div className="flex justify-center items-center w-full min-h-[480px]">
            <MermaidDiagram chart={modalChart} />
          </div>
        </div>
      </div>
    );
  };

  // If content is empty and there's a stored image, only render the image
  if (finalContent.trim() === "" && storedImage) {
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
          {renderStoredImage()}
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center ml-3 mt-0.5">
            <span className="text-base font-semibold">U</span>
          </div>
        )}
      </div>
    );
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
        <div className={`text-base ${!isMarkdown ? 'whitespace-pre-wrap' : ''}`}> 
          {finalContent && (
            <ReactMarkdown>
              {finalContent}
            </ReactMarkdown>
          )}
          {/* Render stored image if present */}
          {renderStoredImage()}
          {/* Render generated images in place of placeholders */}
          {renderGeneratedImages()}
          {/* Render Mermaid diagrams with placeholders */}
          {renderMermaidDiagrams()}
        </div>
        {renderModal()}
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