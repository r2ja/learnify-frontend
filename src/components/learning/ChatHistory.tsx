import { FC } from 'react';
import { Clock, Code, Image, PenSquare, MessageSquare, BarChart2, Book } from 'lucide-react';
import { MessageType } from '@/lib/types';

interface ChatSession {
  id: string;
  title?: string;
  customTitle?: string;
  chapterName?: string;
  courseName?: string;
  createdAt: string;
  lastMessageType?: MessageType;
  lastMessagePreview?: string;
  messageCount?: number;
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  onSelectSession: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  currentSessionId?: string;
  courseContext?: {
    courseId: string;
    courseName: string;
    chapterId?: string;
    chapterName?: string;
  };
}

export const ChatHistory: FC<ChatHistoryProps> = ({ 
  sessions, 
  onSelectSession, 
  onRenameSession,
  onDeleteSession,
  currentSessionId,
  courseContext
}) => {
  // Get message type icon
  const getMessageTypeIcon = (messageType?: MessageType) => {
    switch (messageType) {
      case 'code':
        return <Code size={14} className="text-blue-500" />;
      case 'mermaid':
        return <BarChart2 size={14} className="text-purple-500" />;
      case 'image':
        return <Image size={14} className="text-green-500" />;
      default:
        return <MessageSquare size={14} className="text-gray-400" />;
    }
  };

  // Group sessions by course and date
  const groupedSessions = sessions.reduce((groups, session) => {
    // Get date part only
    const date = new Date(session.createdAt).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {} as Record<string, ChatSession[]>);

  // Sort dates in descending order
  const sortedDates = Object.keys(groupedSessions).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
        <h2 className="text-xl font-semibold text-white">Chat History</h2>
        {courseContext && (
          <div className="text-xs text-white/70 flex items-center gap-1">
            <Book size={12} />
            <span>{courseContext.courseName}</span>
            {courseContext.chapterName && (
              <span className="opacity-75"> › {courseContext.chapterName}</span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2">
        {sortedDates.length > 0 ? (
          sortedDates.map((date) => (
            <div key={date} className="mb-6">
              <div className="text-xs text-white/50 mb-2">{date}</div>
              <div className="flex flex-col gap-1">
                {groupedSessions[date].map((session) => (
                  <div 
                    key={session.id} 
                    className={`text-left py-4 px-4 rounded-lg transition-all duration-200 border-b border-white/5 hover:bg-white/5 group relative ${
                      currentSessionId === session.id ? 'bg-white/10' : ''
                    }`}
                    onClick={() => onSelectSession(session.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectSession(session.id);
                      }
                    }}
                    aria-pressed={currentSessionId === session.id}
                  >
            <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        {getMessageTypeIcon(session.lastMessageType)}
                        <h3 className="text-base font-medium text-white truncate max-w-[200px]">
                          {session.customTitle || session.title || session.lastMessagePreview || session.chapterName || 'New conversation'}
                        </h3>
                      </div>
                      
                      {session.lastMessagePreview && (
                        <p className="text-sm text-white/60 line-clamp-1">
                          {session.lastMessagePreview}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <Clock size={12} />
                          <span>{new Date(session.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        
                        {session.messageCount && (
                          <div className="text-xs text-white/60">
                            {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action buttons - visible on hover */}
                    <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {onRenameSession && (
                        <button
                          className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newTitle = prompt('Enter a new title for this chat:', session.customTitle || session.title);
                            if (newTitle) {
                              onRenameSession(session.id, newTitle);
                            }
                          }}
                          aria-label="Rename chat"
                        >
                          <PenSquare size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-white/60">
            <p>No chat history yet</p>
            <p className="text-sm mt-2">Start a new conversation to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory; 