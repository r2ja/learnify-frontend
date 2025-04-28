import React, { FC, useEffect, useState } from 'react';
import { Clock, Search, Plus, RefreshCw, Trash2 } from 'lucide-react';

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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

  // Handle conversation deletion
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent triggering the parent button's onClick
    
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      setIsDeleting(id);
      
      try {
        const response = await fetch(`/api/conversations?id=${id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          // If the current chat was deleted, trigger a new chat
          if (currentChatId === id) {
            onNewChat();
          }
          
          // Refresh the conversation list
          setInternalRefreshTrigger(prev => prev + 1);
        } else {
          console.error('Failed to delete conversation');
          alert('Failed to delete conversation. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('An error occurred while deleting the conversation.');
      } finally {
        setIsDeleting(null);
      }
    }
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
              <div 
                key={chat.id}
                className={`w-full text-left p-3 rounded-lg mb-2 flex items-start hover:bg-white/10 transition-colors group ${
                  currentChatId === chat.id ? 'bg-white/10' : ''
                }`}
              >
                <button 
                  onClick={() => onSelectChat(chat.id)}
                  className="flex-1 text-left flex items-start"
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
                <button
                  onClick={(e) => handleDelete(e, chat.id)}
                  className={`ml-2 p-1.5 rounded-full text-white/60 hover:text-white/90 hover:bg-red-500/30 transition-colors ${
                    isDeleting === chat.id ? 'opacity-50 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Delete conversation"
                  disabled={isDeleting === chat.id}
                >
                  {isDeleting === chat.id ? (
                    <div className="w-4 h-4 border-2 border-t-transparent border-white/60 rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
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