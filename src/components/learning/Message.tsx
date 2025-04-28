import { FC } from 'react';
import ReactMarkdown from 'react-markdown';

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
          {isMarkdown ? (
            <div className="prose prose-base max-w-none prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2 prose-p:mb-2 prose-hr:my-4 prose-ul:pl-5 prose-ol:pl-5">
              <ReactMarkdown>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            content
          )}
        </div>
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