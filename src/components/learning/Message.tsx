import React, { useEffect, useState, useRef } from 'react';
import { MessageType } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { Copy, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';

// Enhanced CodeBlock component with syntax highlighting and copy functionality
const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 z-10">
        <button 
          onClick={handleCopy} 
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="bg-gray-800 text-white p-4 pt-10 rounded-md overflow-x-auto my-2 text-sm font-mono">
        <div className="absolute top-0 left-0 w-full h-8 bg-gray-700 flex items-center px-4">
          <span className="text-xs text-gray-300">{language}</span>
        </div>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
};

// Enhanced Mermaid component
const Mermaid: React.FC<{ chart: string }> = ({ chart }) => {
  const containerId = React.useId();
  const [copied, setCopied] = useState(false);
  const [rendered, setRendered] = useState(false);
  
  useEffect(() => {
    let isMounted = true;
    // Dynamically import mermaid to avoid SSR issues
    import('mermaid').then(mermaid => {
      if (!isMounted) return;
      
      mermaid.default.initialize({
        startOnLoad: true,
        theme: 'neutral',
        securityLevel: 'loose',
      });
      
      try {
        // Only render if the container exists and chart is not empty
        if (document.getElementById(containerId) && chart.trim()) {
          mermaid.default.render(containerId, chart).then(({ svg }) => {
            if (!isMounted) return;
            const container = document.getElementById(containerId);
            if (container) {
              container.innerHTML = svg;
              setRendered(true);
            }
          });
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
      }
    });
    
    return () => {
      isMounted = false;
    };
  }, [chart, containerId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group bg-gray-100 p-4 rounded-md my-4">
      <div className="absolute right-2 top-2 z-10">
        <button 
          onClick={handleCopy} 
          className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
          aria-label="Copy diagram code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div id={containerId} className="mermaid-diagram overflow-x-auto min-h-[50px] flex items-center justify-center">
        {!rendered && (
          <div className="text-sm text-gray-500">Rendering diagram...</div>
        )}
        {chart}
      </div>
      <div className="text-xs text-gray-500 text-center mt-2">Mermaid Diagram</div>
    </div>
  );
};

interface MessageProps {
  content: string;
  messageType: MessageType;
  isUser: boolean;
  isStreaming?: boolean;
  metadata?: any;
}

const Message: React.FC<MessageProps> = ({ 
  content, 
  messageType, 
  isUser,
  isStreaming = false,
  metadata = {}
}) => {
  const messageRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to the bottom of the message when content updates
  useEffect(() => {
    if (isStreaming && messageRef.current) {
      const element = messageRef.current;
      const { scrollHeight, clientHeight } = element;
      element.scrollTop = scrollHeight - clientHeight;
    }
  }, [content, isStreaming]);
  
  // Process content for safe rendering
  const processContent = (content: string): string => {
    return content;
  };
  
  // Custom components for ReactMarkdown
  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : 'text';
      const code = String(children).replace(/\n$/, '');

      // Handle mermaid diagrams
      if (language === 'mermaid') {
        return <Mermaid chart={code} />;
      }

      // Handle inline code
      if (inline) {
        return (
          <code className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded font-mono text-sm" {...props}>
            {children}
          </code>
        );
      }

      // Handle code blocks
      return <CodeBlock code={code} language={language} />;
    },
    // Custom styling for markdown elements in ChatGPT style
    h1: (props: any) => <h1 className="text-2xl font-bold mt-6 mb-3 pb-1 border-b border-gray-200" {...props} />,
    h2: (props: any) => <h2 className="text-xl font-bold mt-5 mb-2" {...props} />,
    h3: (props: any) => <h3 className="text-lg font-bold mt-4 mb-1" {...props} />,
    p: (props: any) => <p className="mb-3 leading-relaxed" {...props} />,
    ul: (props: any) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
    ol: (props: any) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
    li: (props: any) => <li className="mb-1" {...props} />,
    a: (props: any) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    blockquote: (props: any) => <blockquote className="border-l-4 border-gray-300 pl-4 py-1 my-3 text-gray-700 bg-gray-50 rounded-r-md" {...props} />,
    hr: (props: any) => <hr className="my-4 border-gray-300" {...props} />,
    table: (props: any) => <div className="overflow-x-auto my-3"><table className="min-w-full border-collapse border border-gray-300 rounded-md" {...props} /></div>,
    thead: (props: any) => <thead className="bg-gray-50" {...props} />,
    tbody: (props: any) => <tbody className="divide-y divide-gray-200" {...props} />,
    th: (props: any) => <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700" {...props} />,
    td: (props: any) => <td className="border border-gray-300 px-4 py-2 text-sm" {...props} />,
    img: (props: any) => <img className="max-w-full h-auto my-3 rounded-md shadow-sm" {...props} alt={props.alt || 'Image'} />,
  };

  // Render user message (simple formatting)
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-[var(--primary)] text-white rounded-lg py-2 px-4 max-w-[80%] shadow-sm">
          <div className="whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }

  // Handle AI response with rich markdown rendering
  return (
    <div className="flex mb-6">
      <div 
        ref={messageRef}
        className={`bg-white rounded-lg py-3 px-4 max-w-[90%] shadow-sm w-full ${isStreaming ? 'streaming-message border-l-4 border-green-400' : ''}`}
      >
        {messageType === 'error' ? (
          <div className="text-red-500 p-2 bg-red-50 rounded border border-red-200">{content}</div>
        ) : messageType === 'markdown' || messageType === 'text' ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={components}
            className="prose prose-sm max-w-none"
          >
            {processContent(content)}
          </ReactMarkdown>
        ) : messageType === 'mermaid' ? (
          <Mermaid chart={content} />
        ) : messageType === 'code' ? (
          <CodeBlock code={content} language="javascript" />
        ) : messageType === 'image' && metadata?.image ? (
          <div className="my-3">
            <img 
              src={metadata.image.url || content} 
              alt={metadata.image.alt || "Generated image"} 
              className="max-w-full h-auto rounded-md shadow-sm" 
            />
          </div>
        ) : (
          // Fallback to simple text display
          <div className="whitespace-pre-wrap">{content}</div>
        )}
        
        {isStreaming && (
          <div className="streaming-message-indicator">
            <div className="dot animate-pulse-dot"></div>
            <div className="dot animate-pulse-dot"></div>
            <div className="dot animate-pulse-dot"></div>
            <span className="text-xs text-gray-500 ml-2">AI is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message; 