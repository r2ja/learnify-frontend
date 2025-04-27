import { FC, useEffect, useState } from 'react';

interface MessageProps {
  content: string;
  isUser: boolean;
  accentColor?: string;
  isMarkdown?: boolean;
}

export const Message: FC<MessageProps> = ({ 
  content, 
  isUser, 
  accentColor = 'var(--primary)',
  isMarkdown = false
}) => {
  const [formattedContent, setFormattedContent] = useState<string>(content);

  // Apply basic formatting for code blocks and formatting
  useEffect(() => {
    if (isMarkdown) {
      // Simple regex-based markdown formatting for client-side
      let formatted = content
        // Format code blocks
        .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        // Format inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Format bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Format italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Format links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">$1</a>')
        // Format lists
        .replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>')
        // Convert newlines to breaks
        .replace(/\n/g, '<br />');
      
      setFormattedContent(formatted);
    }
  }, [content, isMarkdown]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-[var(--primary)] text-white flex items-center justify-center mr-3 mt-0.5">
          <span className="text-sm font-semibold">L</span>
        </div>
      )}
      
      <div 
        className={`relative max-w-[70%] py-3 px-4 rounded-lg ${
          isUser 
            ? 'bg-[var(--primary)] text-white' 
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        <div className={`text-sm ${!isMarkdown ? 'whitespace-pre-wrap' : 'prose prose-sm max-w-none'}`}>
          {isMarkdown ? (
            <div 
              className="prose prose-sm max-w-none prose-pre:bg-gray-200 prose-pre:text-gray-800 prose-pre:p-2 prose-pre:rounded-md"
              dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
          ) : (
            content
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center ml-3 mt-0.5">
          <span className="text-sm font-semibold">U</span>
        </div>
      )}
    </div>
  );
};

export default Message; 