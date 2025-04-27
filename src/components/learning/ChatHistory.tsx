import React, { FC, useEffect, useState } from 'react';
import { Clock, Search, Plus, RefreshCw } from 'lucide-react';

interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatHistoryProps {
  courseId: string;
  moduleId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  currentChatId: string | null;
  refreshTrigger?: number;
}

export const ChatHistory: FC<ChatHistoryProps> = ({ 
  courseId, 
  moduleId, 
  onSelectChat, 
  onNewChat,
  currentChatId,
  refreshTrigger = 0
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [internalRefreshTrigger, setInternalRefreshTrigger] = useState(0);

  // Combine the external and internal refresh triggers
  const combinedRefreshTrigger = refreshTrigger + internalRefreshTrigger;

  // Fetch conversation history when course, module, or refreshTrigger changes
  useEffect(() => {
    const fetchConversations = async () => {
      if (!courseId || !moduleId) return;
      
      setIsLoading(true);
      setIsRefreshing(true);
      try {
        // Add cache-busting parameter to force fresh data
        const response = await fetch(
          `/api/conversations?courseId=${courseId}&moduleId=${moduleId}&listOnly=true&_t=${Date.now()}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setConversations(data.conversations || []);
        } else {
          console.error('Failed to fetch conversations');
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };
    
    fetchConversations();
  }, [courseId, moduleId, combinedRefreshTrigger]); // Use combined trigger

  // Handle manual refresh
  const handleRefresh = () => {
    if (isRefreshing) return; // Prevent multiple refreshes
    setInternalRefreshTrigger(prev => prev + 1);
  };

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(chat => 
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Chat History</h2>
          <button 
            onClick={handleRefresh}
            className={`p-2 rounded-full hover:bg-white/10 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh chat history"
            disabled={isRefreshing}
          >
            <RefreshCw size={18} className="text-white/80" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg py-2 pl-10 pr-4 text-white placeholder-white/50"
          />
          <Search className="absolute left-3 top-2.5 text-white/60" size={18} />
        </div>
        
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 w-full mt-3 mb-2 bg-white text-[var(--primary)] rounded-lg py-2 font-medium hover:bg-white/90 transition-colors"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60"></div>
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="p-2">
            {filteredConversations.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left p-3 rounded-lg mb-2 flex items-start hover:bg-white/10 transition-colors ${
                  currentChatId === chat.id ? 'bg-white/10' : ''
                }`}
              >
                <div className="flex-1 truncate">
                  <h3 className="font-medium truncate">{chat.title}</h3>
                  <div className="flex items-center text-xs text-white/60 mt-1">
                    <Clock size={12} className="mr-1" />
                    {new Date(chat.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-white/60">
            <p className="text-center px-4">No conversations found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory; 