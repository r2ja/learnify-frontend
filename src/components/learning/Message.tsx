import { FC, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import MermaidDiagram from './MermaidDiagram';

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

export const Message: FC<MessageProps> = ({ 
  content, 
  isUser, 
  accentColor = 'var(--primary)',
  isMarkdown = false
}) => {
  // Extract and process Mermaid diagrams from content
  const { processedContent, mermaidCharts } = useMemo(() => {
    if (!isMarkdown) {
      return { processedContent: content, mermaidCharts: [] };
    }

    // Simple, focused regex for extracting Mermaid code blocks
    const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
    const charts: string[] = [];
    let lastIndex = 0;
    let result = '';
    let match;

    // Replace all Mermaid code blocks with placeholders
    let processedText = content;
    let matchCount = 0;

    processedText = content.replace(mermaidPattern, (_, chartContent) => {
      const placeholder = `__MERMAID_${matchCount++}__`;
      charts.push(chartContent.trim());
      return placeholder;
    });

    return { processedContent: processedText, mermaidCharts: charts };
  }, [content, isMarkdown]);

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
                {processedContent}
              </ReactMarkdown>
              
              {/* Render Mermaid diagrams separately - cleaner approach */}
              {mermaidCharts.map((chart, index) => (
                <MermaidDiagram 
                  key={`mermaid-${index}`} 
                  chart={chart} 
                />
              ))}
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