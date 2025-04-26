'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Paperclip, Smile, Code, Image, BarChart, Settings } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, MessageType, StreamingMessage, LearningProfile } from '@/lib/types';
import Message from './Message';
import { useAuth } from '@/components/auth/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsScrollable } from '@/lib/hooks/useIsScrollable';

interface ChatInterfaceProps {
  courseId?: string;
  chapterId?: string;
  chatId?: string;
  learningProfiles?: LearningProfile[];
  onSendMessage?: (message: string, chatId?: string) => Promise<void>;
  messages?: ChatMessage[];
  isLoading?: boolean;
  language?: string;
  onChangeLanguage?: (language: string) => void;
  onSelectLearningProfile?: (profileId: string) => void;
  selectedLearningProfileId?: string;
  streamingMessage?: StreamingMessage | null;
  isConnected?: boolean;
  placeholderText?: string;
  className?: string;
}

const SUPPORTED_LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'german', label: 'German' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'arabic', label: 'Arabic' },
];

export function ChatInterface({
  courseId,
  chapterId,
  chatId,
  learningProfiles = [],
  onSendMessage,
  messages = [],
  isLoading = false,
  language = 'english',
  onChangeLanguage,
  onSelectLearningProfile,
  selectedLearningProfileId,
  streamingMessage,
  isConnected = true,
  placeholderText = "Ask anything about this course...",
  className
}: ChatInterfaceProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const { isScrollable, isNearBottom } = useIsScrollable(messagesContainerRef);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Check if scrollable and near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user is scrolled near bottom (within 100px), maintain auto-scroll
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Default welcome message if there are no messages
  const allMessages = useMemo(() => {
    if (messages.length === 0 && !streamingMessage) {
      return [{
        id: 'welcome',
        chatId: chatId || '',
        content: 'Hello! I\'m your learning assistant. How can I help you with this course?',
        messageType: 'text' as MessageType,
        isUser: false,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }];
    }
    return messages;
  }, [messages, chatId, streamingMessage]);

  // Scroll to bottom when messages change or streaming happens
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [allMessages, streamingMessage, shouldAutoScroll]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!inputValue.trim() || !onSendMessage) return;
    
    try {
      // Send message to parent component which will handle the LLM agent interaction
      await onSendMessage(inputValue, chatId);
      
      // Clear input after successful send
      setInputValue('');
    
      // Scroll to bottom after sending
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      // You might want to show an error toast here
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-xl shadow-sm", className)}>
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
        <h2 className="text-xl font-bold">Learning Assistant</h2>
          <p className="text-gray-500 text-sm flex items-center">
            {courseId ? 'Course-specific assistant' : 'General learning assistant'}
            <span className="ml-2 flex items-center">
              {isConnected ? 
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span> : 
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>
              }
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
      
      {/* Settings Panel (hidden by default) */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => onChangeLanguage?.(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Learning Profile</label>
              <select
                value={selectedLearningProfileId}
                onChange={(e) => onSelectLearningProfile?.(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                disabled={learningProfiles.length === 0}
              >
                {learningProfiles.length === 0 ? (
                  <option value="">No profiles available</option>
                ) : (
                  learningProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {`${profile.processingStyle} · ${profile.perceptionStyle} · ${profile.inputStyle} · ${profile.understandingStyle}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-grow p-4 overflow-y-auto pb-4 space-y-4 px-4"
      >
        {messages.length === 0 && !streamingMessage && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground p-8 max-w-md">
              <h3 className="text-lg font-medium mb-2">No messages yet</h3>
              <p>Start a conversation with your AI learning assistant. Ask questions about course content, request explanations, or get help with exercises.</p>
                </div>
              </div>
        )}
        
        {messages.map((message) => (
          <Message
            key={message.id}
            content={message.content}
            isUser={message.isUser}
            messageType={message.messageType}
            isStreaming={false}
            metadata={message.metadata}
          />
        ))}
        
        {streamingMessage && (
          <Message
            key={streamingMessage.id}
            content={streamingMessage.content}
            isUser={streamingMessage.isUser}
            messageType={streamingMessage.messageType}
            isStreaming={true}
            metadata={streamingMessage.metadata}
          />
        )}
        
        {/* Loading indicator */}
        {isLoading && !streamingMessage && (
          <div className="flex justify-center py-4">
            <div className="animate-bounce flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animation-delay-200"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animation-delay-400"></div>
            </div>
          </div>
        )}
        
          <div ref={messagesEndRef} />
        </div>
      
      {/* Message Type Tools */}
      <div className="px-4 pt-2 flex space-x-2">
        <button 
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Insert code block"
        >
          <Code size={18} />
        </button>
        <button 
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Request image or diagram"
        >
          <Image size={18} />
        </button>
        <button 
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Request data visualization"
        >
          <BarChart size={18} />
        </button>
      </div>
      
      {/* Input Area */}
      <div className="p-4 pt-2">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Add attachment"
          >
            <Paperclip size={20} />
          </button>
          
          <Input
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholderText}
            disabled={!inputValue.trim() || !onSendMessage || !isConnected}
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none min-h-[44px] max-h-[120px]"
          />
          
          <button 
            type="button"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Add emoji"
          >
            <Smile size={20} />
          </button>
          
          <Button 
            type="submit"
            size="sm"
            disabled={!inputValue.trim() || !onSendMessage || !isConnected}
          >
            <Send size={20} />
          </Button>
        </form>
        {!isConnected && (
          <p className="text-xs text-red-500 mt-1">
            Disconnected from AI assistant. Trying to reconnect...
          </p>
        )}
        {isLoading && (
          <p className="text-xs text-muted-foreground mt-1">
            AI assistant is responding...
          </p>
        )}
      </div>
    </div>
  );
} 

export default ChatInterface; 