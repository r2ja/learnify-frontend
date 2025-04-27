import { FC } from 'react';

interface ChatItem {
  id: string;
  title: string;
  date: string;
  courseId?: string;
  virtualChapterId?: string;
}

interface ChatHistoryProps {
  chats: ChatItem[];
  onSelectChat?: (chatId: string) => void;
  isLoading?: boolean;
}

export const ChatHistory: FC<ChatHistoryProps> = ({ 
  chats, 
  onSelectChat,
  isLoading = false 
}) => {
  return (
    <div className="w-full h-full flex flex-col p-4">
      <h2 className="text-xl font-bold text-white mb-4">Chat History</h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
          </div>
        </div>
      ) : chats.length > 0 ? (
        <div className="overflow-y-auto flex-1">
          {chats.map((chat) => (
            <div 
              key={chat.id}
              onClick={() => onSelectChat && onSelectChat(chat.id)}
              className="p-3 mb-2 bg-white/10 rounded-lg cursor-pointer hover:bg-white/20 transition-colors"
            >
              <div className="text-sm font-medium text-white">{chat.title}</div>
              <div className="text-xs text-white/60">{chat.date}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/70 text-sm">No chat history found</p>
        </div>
      )}
    </div>
  );
};

export default ChatHistory; 