'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { 
  ChevronDown, ChevronLeft, ChevronRight, Paperclip, 
  Send, Smile, Clock, Settings, Languages 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';
import { 
  ChatMessage, MessageType, MessageMetadata, CourseChat,
  StreamingMessage, LearningProfile
} from '@/lib/types';
import Message from './Message';

// Use Next.js dynamic imports instead of React.lazy
const ChatHistory = dynamic(() => import('./ChatHistory'));
const SuggestedQuestions = dynamic(() => import('./SuggestedQuestions'));
const BackgroundPaths = dynamic(() => import('./BackgroundPaths'));
const ChatInterface = dynamic(() => import('./ChatInterface'));

interface Course {
  id: string;
  title: string;
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  title: string;
  courseId: string;
}

interface Session {
  id: string;
  chapterName: string;
  createdAt: string;
  messages: ChatMessage[];
  customTitle?: string;
}

interface CourseChatWindowProps {
  courseId?: string;
  chapterId?: string;
  sessionId?: string;
}

// Cache for API responses
const apiCache = new Map();

export function CourseChatWindow({ courseId: initialCourseId, chapterId: initialChapterId, sessionId: initialSessionId }: CourseChatWindowProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // State management
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitialState, setIsInitialState] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<{
    id: string; 
    chapterName: string; 
    createdAt: string;
    firstMessage?: string;
    customTitle?: string;
    lastMessageType?: MessageType;
    messageCount?: number;
  }[]>([]);
  
  // New state for LLM features
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [language, setLanguage] = useState<string>('english');
  const [learningProfiles, setLearningProfiles] = useState<LearningProfile[]>([]);
  const [selectedLearningProfileId, setSelectedLearningProfileId] = useState<string>('');
  
  // Refs
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoized values
  const defaultPrompts = useMemo(() => [
    "What are the key concepts in this chapter?",
    "Can you explain this topic in simple terms?",
    "What are some practical applications of this material?",
    "How does this connect to other parts of the course?"
  ], []);

  // Add state for chat renaming
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState<string>('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  // Add WebSocket related state and refs
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Utility function to detect message type from content
  const detectMessageType = useCallback((content: string): { 
    type: MessageType, 
    metadata: MessageMetadata 
  } => {
    let type: MessageType = 'text';
    const metadata: MessageMetadata = {};
    
    // Check for code blocks
    const hasCodeBlock = content.includes('```');
    const hasMermaidDiagram = content.includes('```mermaid') || 
                              content.includes('```Mermaid');
    
    if (hasMermaidDiagram) {
      type = 'markdown';
      metadata.hasMermaid = true;
    } else if (hasCodeBlock) {
      type = 'markdown';
      metadata.hasCode = true;
    } else if (content.includes('$$') || 
               content.includes('$') ||
               content.includes('**') ||
               content.includes('*') ||
               content.includes('- ') ||
               content.includes('1. ') ||
               content.includes('[') ||
               content.includes('|')) {
      // Likely contains markdown formatting
      type = 'markdown';
    }
    
    return { type, metadata };
  }, []);

  // Utility function to safely render streaming content with incomplete code blocks
  const processStreamingContent = useCallback((content: string): string => {
    // Check if there are unclosed code blocks
    const codeBlockMatches = content.match(/```\w*\n[\s\S]*?(?:```|$)/g) || [];
    let processedContent = content;
    
    // Handle unclosed code blocks by adding a temporary closing tag
    for (const match of codeBlockMatches) {
      if (!match.endsWith('```')) {
        const closedMatch = match + '\n```';
        processedContent = processedContent.replace(match, closedMatch);
      }
    }
    
    // Check if there are unclosed mermaid diagrams
    if ((content.includes('```mermaid') || content.includes('```Mermaid')) && 
        !content.match(/```mermaid[\s\S]*?```/)) {
      processedContent = processedContent.replace(/```mermaid([\s\S]*)$/, '```mermaid$1\n```');
    }
    
    // Handle incomplete inline code with single backticks
    const singleBacktickMatches = processedContent.match(/`[^`\n]*$/g);
    if (singleBacktickMatches) {
      for (const match of singleBacktickMatches) {
        processedContent = processedContent.replace(match, match + '`');
      }
    }
    
    // Handle incomplete bold/italic formatting
    const asteriskMatches = processedContent.match(/(\*\*[^*\n]*$)|(\*[^*\n]*$)/g);
    if (asteriskMatches) {
      for (const match of asteriskMatches) {
        if (match.startsWith('**')) {
          processedContent = processedContent.replace(match, match + '**');
        } else if (match.startsWith('*')) {
          processedContent = processedContent.replace(match, match + '*');
        }
      }
    }
    
    // Handle incomplete links
    const linkMatches = processedContent.match(/\[[^\]]*\]\([^\)]*$/g);
    if (linkMatches) {
      for (const match of linkMatches) {
        processedContent = processedContent.replace(match, match + ')');
      }
    }
    
    return processedContent;
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target as Node)) {
        setIsChapterDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch enrolled courses when the component mounts
  useEffect(() => {
    fetchEnrolledCourses();
    
    // Cleanup function to abort any ongoing fetch requests
    return () => {
      if (abortControllerRef.current) {
        try {
        abortControllerRef.current.abort();
        } catch (error) {
          console.error('Error aborting fetch:', error);
        }
      }
    };
  }, []);

  // Ensure URL-safe chapter IDs
  const getUrlSafeChapterId = useCallback((chapterId: string) => {
    return encodeURIComponent(chapterId);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Optimized API fetching with caching
  const fetchWithCache = useCallback(async (url: string, options?: RequestInit) => {
    // Create a cache key from the URL and options
    const cacheKey = `${url}-${JSON.stringify(options || {})}`;
    
    // Check if we have a cached response
    if (apiCache.has(cacheKey)) {
      return apiCache.get(cacheKey);
    }
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    // Add the signal to the options
    const fetchOptions = {
      ...options,
      signal: abortControllerRef.current.signal
    };
    
    // Make the fetch request
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the response
    apiCache.set(cacheKey, data);
    
    return data;
  }, []);

  // Fetch enrolled courses from the API
  const fetchEnrolledCourses = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const coursesData = await fetchWithCache('/api/user/enrolled-courses');
      
      // Transform the courses data to match our interface
      const formattedCourses: Course[] = coursesData.map((course: any) => ({
          id: course.id,
          title: course.title,
        chapters: course.chapters || [] // Ensure chapters is always an array
      }));
      
      setEnrolledCourses(formattedCourses);
      
      // Set default selected course if available
      if (formattedCourses.length > 0) {
        // Use initial courseId if provided, otherwise use first course
        const initialCourse = initialCourseId
          ? formattedCourses.find(c => c.id === initialCourseId) || formattedCourses[0]
          : formattedCourses[0];
        
        setSelectedCourse(initialCourse);
        
        // Set default chapter if available
        if (initialCourse.chapters && initialCourse.chapters.length > 0) {
          const initialChapter = initialChapterId
            ? initialCourse.chapters.find(c => c.id === initialChapterId) || initialCourse.chapters[0]
            : initialCourse.chapters[0];
          
          setSelectedChapter(initialChapter);
          fetchSessions(initialChapter.id);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      setIsLoading(false);
    }
  }, [initialCourseId, initialChapterId, fetchWithCache]);

  // Fetch sessions for a chapter
  const fetchSessions = useCallback(async (chapterId: string) => {
    try {
      setIsLoading(true);
      const safeChapterId = getUrlSafeChapterId(chapterId);
      
      // Force refresh by adding a cache buster
      const cacheBuster = Date.now();
      const sessions = await fetchWithCache(`/api/course-chats/sessions?virtualChapterId=${safeChapterId}&_=${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (sessions.length > 0) {
        // Store all sessions in the history state
        const formattedSessions = sessions.map((session: any) => {
          // Extract the first message for display in history or use custom title if exists
          let firstMessage = 'New conversation';
          
          // Check for custom title first
          if (session.customTitle) {
            firstMessage = session.customTitle;
          } else if (session.messages && Array.isArray(session.messages)) {
            // If no custom title, find the first user message if it exists
            const firstUserMessage = session.messages.find((msg: any) => msg.isUser);
            
            if (firstUserMessage) {
              // Truncate long messages
              firstMessage = firstUserMessage.content.length > 40 
                ? firstUserMessage.content.substring(0, 40) + '...' 
                : firstUserMessage.content;
            } else if (session.messages.length > 0) {
              // If no user message, use the first message
              firstMessage = session.messages[0].content.length > 40 
                ? session.messages[0].content.substring(0, 40) + '...' 
                : session.messages[0].content;
            }
          }
          
          return {
            id: session.id,
            chapterName: session.chapterName || 'Unnamed Chat',
            createdAt: session.createdAt,
            firstMessage: firstMessage,
            customTitle: session.customTitle || null
          };
        });
        
        setSessionHistory(formattedSessions);
        
        // Use the most recent session as the current one
        const session = sessions[0]; // Most recent session
        setCurrentSession(session);
        fetchSessionData(session.id);
      } else {
        // No sessions found, create a new one
        createNewSession(chapterId);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      // If there's an error, try to create a new session
      createNewSession(chapterId);
    }
  }, [getUrlSafeChapterId, fetchWithCache]);

  // Create a new chat session
  const createNewSession = useCallback(async (chapterId: string) => {
    try {
      setIsLoading(true);
      
      // Fix for "No course selected" error
      const courseToUse = selectedCourse || {
        id: 'default-course-id',
        title: 'General Course',
        chapters: []
      };
      
      // Force a new chat creation by adding a timestamp parameter
      // This ensures we always create a new unique chat session
      const response = await fetch('/api/course-chats/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          virtualChapterId: chapterId,
          courseId: courseToUse.id,
          chapterName: selectedChapter?.title || 'Unnamed Chapter',
          forceNew: true,  // Add this flag to indicate we want a new session
          timestamp: Date.now() // Add timestamp to ensure uniqueness
        }),
      });
      
      // Improved error handling
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to create session:', errorData);
        
        // Create a temporary session if API fails
        const tempSessionId = `temp-${Date.now()}`;
        setCurrentSession({
          id: tempSessionId,
          chapterName: selectedChapter?.title || 'Temporary Chat',
          createdAt: new Date().toISOString(),
          messages: []
        });
        
        setMessages([]);
        setSuggestedPrompts(defaultPrompts);
        setIsInitialState(true);
        setIsLoading(false);
        return;
      }
      
      const sessions = await response.json();
      
      if (sessions.length > 0) {
        // Update the session history with the new data
        const formattedSessions = sessions.map((session: any) => {
          // Extract the first message for display in history
          let firstMessage = 'New conversation';
          
          if (session.messages && Array.isArray(session.messages)) {
            // Find the first user message if it exists
            const firstUserMessage = session.messages.find((msg: any) => msg.isUser);
            
            if (firstUserMessage) {
              firstMessage = firstUserMessage.content.length > 40 
                ? firstUserMessage.content.substring(0, 40) + '...' 
                : firstUserMessage.content;
            } else if (session.messages.length > 0) {
              firstMessage = session.messages[0].content.length > 40 
                ? session.messages[0].content.substring(0, 40) + '...' 
                : session.messages[0].content;
            }
          }
          
          return {
            id: session.id,
            chapterName: session.chapterName || 'Unnamed Chat',
            createdAt: session.createdAt,
            firstMessage: firstMessage
          };
        });
        
        // Update the session history state
        setSessionHistory(formattedSessions);
        
        // Set the current session to the newest one (first in the array)
        const session = sessions[0];
        setCurrentSession(session);
        setMessages([]);
        setSuggestedPrompts(defaultPrompts);
        setIsInitialState(true);
      } else {
        // Handle case when no sessions are returned
        const tempSessionId = `temp-${Date.now()}`;
        setCurrentSession({
          id: tempSessionId,
          chapterName: selectedChapter?.title || 'Temporary Chat',
          createdAt: new Date().toISOString(),
          messages: []
        });
        setMessages([]);
        setSuggestedPrompts(defaultPrompts);
        setIsInitialState(true);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error creating new session:', error);
      
      // Create a temporary session on error
      const tempSessionId = `temp-${Date.now()}`;
      setCurrentSession({
        id: tempSessionId,
        chapterName: selectedChapter?.title || 'Temporary Chat',
        createdAt: new Date().toISOString(),
        messages: []
      });
      
      setMessages([]);
      setSuggestedPrompts(defaultPrompts);
      setIsInitialState(true);
      setIsLoading(false);
    }
  }, [selectedCourse, selectedChapter, defaultPrompts]);

  // Fetch session data from the API
  const fetchSessionData = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      
      const data = await fetchWithCache(`/api/course-chats/sessions/${sessionId}`);
      
      // Format messages for display with enhanced types
      const formattedMessages = data.messages.map((msg: any) => ({
        id: msg.id || String(Date.now()),
        chatId: msg.chatId || sessionId,
        content: msg.content,
        messageType: msg.messageType || 'text',
        isUser: msg.isUser,
        metadata: msg.metadata || undefined,
        reasoning: msg.reasoning || undefined,
        order: msg.order || 0,
        createdAt: new Date(msg.createdAt || Date.now()),
        updatedAt: new Date(msg.updatedAt || Date.now())
      }));
      
      setMessages(formattedMessages);
      
      // Set the current session
      setCurrentSession({
        ...data,
        messages: formattedMessages 
      });
      
      // Set language and learning profile if available
      if (data.language) {
        setLanguage(data.language);
      }
      
      if (data.learningProfileId) {
        setSelectedLearningProfileId(data.learningProfileId);
      }
      
      setIsLoading(false);
      
      // Only show initial state if we have no messages
      if (formattedMessages.length > 0) {
      setIsInitialState(false);
      } else if (!isMessageSending) {
        // Only show initial state if we're not in the process of sending a message
        setIsInitialState(true);
      }
      
      // Fetch suggested prompts
      if (selectedChapter) {
        setSuggestedPrompts(defaultPrompts);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
      setMessages([]);
      // Only show initial state if we're not sending a message
      setIsInitialState(!isMessageSending);
      setIsLoading(false);
    }
  }, [fetchWithCache, isMessageSending, selectedChapter, defaultPrompts]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Create WebSocket connection
    socketRef.current = new WebSocket('ws://localhost:8765');
    
    // Connection opened
    socketRef.current.addEventListener('open', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });
    
    // Process the stream chunk to make UI display smoother
    const processStreamChunk = (chunk: string, existingContent: string = ''): string => {
      try {
        // Handle empty or invalid chunks
        if (!chunk || typeof chunk !== 'string') return existingContent;
        
        const combinedContent = existingContent + chunk;
        
        // Process code blocks and mermaid diagrams
        return processStreamingContent(combinedContent);
      } catch (error) {
        console.error("Error processing stream chunk:", error);
        return existingContent + chunk;
      }
    };
    
    // Listen for messages
    socketRef.current.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different types of messages
        if (data.type === 'error') {
          console.error('Error from server:', data.content);
          setMessages(prev => [...prev, {
            id: uuidv4(),
            chatId: currentSession?.id || '',
            content: `Error: ${data.content}`,
            messageType: 'error' as MessageType,
            isUser: false,
            order: prev.length,
            createdAt: new Date(),
            updatedAt: new Date()
          }]);
          setIsMessageSending(false);
          setStreamingMessage(null);
        } else if (data.type === 'complete') {
          console.log('Response complete');
          setIsMessageSending(false);
          
          // If we have a streaming message, finalize it by adding it to messages
          if (streamingMessage) {
            // For better ChatGPT-like experience, always use markdown for final messages
            const finalMessageType: MessageType = 'markdown';
            
            // Add the final streaming message to messages array
            const finalMessage: ChatMessage = {
              id: streamingMessage.id,
              chatId: currentSession?.id || '',
              content: streamingMessage.content,
              messageType: finalMessageType,
              isUser: false,
              metadata: streamingMessage.metadata,
              order: messages.length,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            // Add to messages and clear streaming message
            setMessages(prev => [...prev, finalMessage]);
            setStreamingMessage(null);
            
            // Save assistant message to DB
            if (currentSession?.id) {
              fetch(`/api/course-chats/sessions/${currentSession.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: finalMessage.content,
                  isUser: false,
                  messageType: finalMessage.messageType,
                  metadata: finalMessage.metadata
                })
              }).catch(err => console.error('Error storing response message:', err));
            }
          }
        } else if (data.type === 'text') {
          // Process and handle text streaming
          if (streamingMessage) {
            // Update existing streaming message by appending the new content
            setStreamingMessage(prev => {
              if (!prev) return {
                id: uuidv4(),
                content: data.content,
                messageType: 'markdown', // Always use markdown for streaming
                isUser: false,
                isComplete: false,
                metadata: {}
              };
              
              // Process the content before updating
              const processedContent = processStreamChunk(data.content, prev.content);
              
              // Return updated message with processed content
              return {
                ...prev,
                content: processedContent,
                messageType: 'markdown' // Always treat as markdown
              };
            });
          } else {
            // Create new streaming message
            setStreamingMessage({
              id: uuidv4(),
              content: data.content,
              messageType: 'markdown', // Always use markdown for new messages
              isUser: false,
              isComplete: false,
              metadata: {}
            });
          }
        } else if (data.type === 'mermaid_gen') {
          // Handle standalone mermaid diagram (not part of streaming)
          const newMessage = {
            id: uuidv4(),
            chatId: currentSession?.id || '',
            content: data.content,
            messageType: 'mermaid' as MessageType,
            isUser: false,
            metadata: {
              mermaid: {
                diagram: data.content
              }
            },
            order: messages.length,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setMessages(prev => [...prev, newMessage]);
          
          // Clear any existing streaming message to avoid confusion
          if (streamingMessage) {
            const finalMessage: ChatMessage = {
              id: streamingMessage.id,
              chatId: currentSession?.id || '',
              content: streamingMessage.content,
              messageType: 'markdown',
              isUser: false,
              metadata: streamingMessage.metadata,
              order: messages.length,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            setMessages(prev => [...prev, finalMessage]);
            setStreamingMessage(null);
          }
          
        } else if (data.type === 'img_gen') {
          // Handle image generation (not part of streaming)
          const newMessage = {
            id: uuidv4(),
            chatId: currentSession?.id || '',
            content: data.content,
            messageType: 'image' as MessageType,
            isUser: false,
            metadata: {
              image: {
                url: data.content,
                alt: 'Generated image'
              }
            },
            order: messages.length,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setMessages(prev => [...prev, newMessage]);
          
          // Clear any existing streaming message to avoid confusion
          if (streamingMessage) {
            const finalMessage: ChatMessage = {
              id: streamingMessage.id,
              chatId: currentSession?.id || '',
              content: streamingMessage.content,
              messageType: 'markdown',
              isUser: false,
              metadata: streamingMessage.metadata,
              order: messages.length,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            setMessages(prev => [...prev, finalMessage]);
            setStreamingMessage(null);
          }
        }
        
        // Automatically scroll to the latest content
        scrollToBottom();
        
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setIsMessageSending(false);
      }
    });
    
    // Connection closed
    socketRef.current.addEventListener('close', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });
    
    // Connection error
    socketRef.current.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    });
    
    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [currentSession, messages, scrollToBottom]);

  // Check WebSocket server status using the API endpoint
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch('/api/socket');
        if (response.ok) {
          const data = await response.json();
          setIsConnected(data.isConnected);
          
          if (!data.isConnected) {
            console.warn('WebSocket server is not running. Some features may not work properly.');
          }
        } else {
          console.error('Failed to check WebSocket server status');
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Error checking WebSocket server status:', error);
        setIsConnected(false);
      }
    };
    
    // Check status immediately and then every 30 seconds
    checkServerStatus();
    const intervalId = setInterval(checkServerStatus, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Modify the sendMessage function to use WebSocket
  const sendMessage = useCallback(async (content: string, sessionId: string) => {
    if (!content.trim() || !sessionId) return;
    
    setIsMessageSending(true);
    setIsInitialState(false);
    
    // Optimistically add the message to the UI
    const tempUserId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempUserId,
      chatId: sessionId,
      content,
      messageType: 'text',
        isUser: true,
      order: messages.length,
      createdAt: new Date(),
      updatedAt: new Date()
      };

    setMessages(prev => [...prev, tempMessage]);
      setInputMessage("");

      try {
      // Create metadata for the chat session if it doesn't exist in the database
      // This will be a non-blocking API call, just to record the session and message in the DB
      fetch('/api/course-chats/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          virtualChapterId: selectedChapter?.id || 'general',
          courseId: selectedCourse?.id || 'default-course',
          chapterName: selectedChapter?.title || 'General Chat',
          id: sessionId
        })
      }).catch(err => console.error('Error creating session record:', err));
      
      // Store the message in the database
      fetch(`/api/course-chats/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          isUser: true,
          messageType: 'text'
        })
      }).catch(err => console.error('Error storing message record:', err));
      
      // Try the direct WebSocket connection first
      if (socketRef.current && isConnected) {
        try {
          // Send message to WebSocket server
          const messageData = {
            message: content,
            user_id: user?.id || 'guest-user',
            course_id: selectedCourse?.id || 'default-course',
            chapter_id: selectedChapter?.id,
            session_id: sessionId,
            learning_profile: selectedLearningProfileId ? {
              id: selectedLearningProfileId,
              style: "conceptual", // Default values if not available
              depth: "beginner",
              interaction: "examples"
            } : undefined,
            language
          };
          
          socketRef.current.send(JSON.stringify(messageData));
          
          // Start a streaming message placeholder
          setStreamingMessage({
            id: uuidv4(),
            content: '',
            messageType: 'text',
            isUser: false,
            isComplete: false
          });
          
          console.log('Message sent via direct WebSocket connection');
        } catch (wsError) {
          console.error('Error with direct WebSocket connection, falling back to API:', wsError);
          await sendMessageViaApi(content, sessionId);
        }
      } else {
        // If WebSocket not connected, use the API endpoint
        console.log('WebSocket not connected, using API endpoint');
        await sendMessageViaApi(content, sessionId);
      }
      
      // Update the session title if this is the first message
      if (messages.length === 0 && selectedChapter) {
        // Refresh the chat history
        const safeChapterId = getUrlSafeChapterId(selectedChapter.id);
        
        try {
          const response = await fetch(`/api/course-chats/sessions?virtualChapterId=${safeChapterId}`);
          if (response.ok) {
            const sessions = await response.json();
            
            if (sessions.length > 0) {
          setSessionHistory(prev => {
            return prev.map(session => {
              if (session.id === sessionId) {
                    const truncatedContent = content.length > 40 
                      ? content.substring(0, 40) + '...' 
                      : content;
                return {
                  ...session,
                  firstMessage: truncatedContent
                };
              }
              return session;
            });
          });
            }
          }
        } catch (error) {
          console.error('Error updating session history:', error);
        }
      }
      
      scrollToBottom();
      } catch (error) {
        console.error('Error sending message:', error);
      showToast('error', 'Failed to send message. Please try again.');
      
      // Remove the temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserId));
      setStreamingMessage(null);
      setIsMessageSending(false);
    }
  }, [
    scrollToBottom, 
    showToast, 
    messages.length, 
    selectedChapter, 
    getUrlSafeChapterId,
    selectedLearningProfileId,
    language,
    user?.id,
    selectedCourse?.id,
    isConnected,
    messages,
    streamingMessage
  ]);

  // Helper function to send messages via the API endpoint if WebSocket fails
  const sendMessageViaApi = async (content: string, sessionId: string) => {
    try {
      // Use our new API endpoint as a fallback
      const apiResponse = await fetch('/api/socket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          userId: user?.id || 'guest-user',
          courseId: selectedCourse?.id || 'default-course',
          chapterId: selectedChapter?.id,
          sessionId: sessionId,
          learningProfile: selectedLearningProfileId ? {
            id: selectedLearningProfileId,
            style: "conceptual",
            depth: "beginner",
            interaction: "examples"
          } : undefined,
          language
        })
      });

      if (!apiResponse.ok) {
        throw new Error('API endpoint failed');
      }

      // The API simply forwards to the WebSocket server
      // The WebSocket connection will handle streaming response
      console.log('Message sent via API endpoint');
      
      // Create a placeholder message while we wait for the response
      if (!streamingMessage) {
        setStreamingMessage({
          id: uuidv4(),
          content: '',
          messageType: 'text',
          isUser: false,
          isComplete: false
        });
      }
    } catch (apiError) {
      console.error('Error sending message via API:', apiError);
      // If both direct WebSocket and API fail, show an error
      setMessages(prev => [...prev, {
        id: uuidv4(),
        chatId: sessionId,
        content: "Sorry, I'm having trouble connecting to the AI service right now. Please try again later.",
        messageType: 'error',
        isUser: false,
        order: prev.length,
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
      setIsMessageSending(false);
    }
  };

  // Event handlers
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (selectedChapter && currentSession) {
        sendMessage(inputMessage, currentSession.id);
      }
    }
  }, [selectedChapter, currentSession, inputMessage, sendMessage]);

  const handleCourseChange = useCallback((course: Course) => {
    if (selectedCourse?.id !== course.id) {
    setSelectedCourse(course);
      setSelectedChapter(null);
      setCurrentSession(null);
      setMessages([]);
      setIsInitialState(true);
      setIsLoading(true);
      
      // Set default chapter for the selected course
      if (course.chapters.length > 0) {
        setSelectedChapter(course.chapters[0]);
        fetchSessions(course.chapters[0].id);
      } else {
        setIsLoading(false);
        setSuggestedPrompts(defaultPrompts);
      }
    }
    setIsCourseDropdownOpen(false);
  }, [selectedCourse, fetchSessions, defaultPrompts]);

  const handleChapterChange = useCallback((chapter: Chapter) => {
    if (selectedChapter?.id !== chapter.id) {
      setSelectedChapter(chapter);
      setCurrentSession(null);
      setMessages([]);
      setIsInitialState(true);
      setIsLoading(true);
      fetchSessions(chapter.id);
    }
    setIsChapterDropdownOpen(false);
  }, [selectedChapter, fetchSessions]);

  // Memoize message list to prevent unnecessary re-renders
  const messageList = useMemo(() => (
    messages.map((message) => (
        <Message 
          key={message.id} 
          content={message.content} 
        messageType={message.messageType || 'text'}
          isUser={message.isUser}
        />
    ))
  ), [messages]);

  // Add a new function to start a new chat session
  const startNewChatSession = useCallback(() => {
    if (selectedChapter) {
      createNewSession(selectedChapter.id);
    }
  }, [selectedChapter, createNewSession]);

  // Update the handleSwitchSession function to better handle session switching
  const handleSwitchSession = useCallback((sessionId: string) => {
    if (currentSession?.id !== sessionId) {
      setIsLoading(true);
      // Clear any cached data for this session to ensure we get fresh data
      const cacheKey = `/api/course-chats/sessions/${sessionId}`;
      apiCache.delete(cacheKey);
      
      // Set the current session and fetch its data
      setCurrentSession({id: sessionId} as Session);
      fetchSessionData(sessionId);
    }
    setIsHistoryOpen(false);
  }, [fetchSessionData]);

  // Add effect to refresh history when entering a new chapter
  useEffect(() => {
    if (selectedChapter) {
      fetchSessions(selectedChapter.id);
    }
  }, [selectedChapter, fetchSessions]);

  // Function to handle renaming a chat session
  const handleRenameSession = useCallback(async (sessionId: string) => {
    try {
      if (!newSessionName.trim()) {
        showToast('error', 'Please enter a valid name');
        return;
      }

      const response = await fetch(`/api/course-chats/sessions/${sessionId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          customTitle: newSessionName.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename session');
      }

      // Update the session locally in the history
      setSessionHistory(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, customTitle: newSessionName.trim() }
          : session
      ));

      // Close the rename modal
      setIsRenameModalOpen(false);
      setRenamingSessionId(null);
      setNewSessionName('');
      
      // Show success toast
      showToast('success', 'Chat renamed successfully');
      
      // Clear any cached data for this session
      const cacheKey = `/api/course-chats/sessions?virtualChapterId=${getUrlSafeChapterId(selectedChapter?.id || '')}`;
      apiCache.delete(cacheKey);
      
    } catch (error) {
      console.error('Error renaming session:', error);
      showToast('error', 'Failed to rename chat. Please try again.');
    }
  }, [newSessionName, showToast, getUrlSafeChapterId, selectedChapter]);

  // Function to handle deleting a chat session
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      if (!confirm('Are you sure you want to delete this chat?')) {
        return;
      }

      const response = await fetch(`/api/course-chats/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      // Remove the session from history
      setSessionHistory(prev => prev.filter(session => session.id !== sessionId));
      
      // If the current session was deleted, select another one or create a new one
      if (currentSession?.id === sessionId) {
        if (sessionHistory.length > 1) {
          // Find the next available session
          const nextSession = sessionHistory.find(session => session.id !== sessionId);
          if (nextSession) {
            handleSwitchSession(nextSession.id);
          }
        } else if (selectedChapter) {
          // If no other sessions exist, create a new one
          createNewSession(selectedChapter.id);
        }
      }
      
      // Show success toast
      showToast('success', 'Chat deleted successfully');
      
      // Clear any cached data for sessions list
      const cacheKey = `/api/course-chats/sessions?virtualChapterId=${getUrlSafeChapterId(selectedChapter?.id || '')}`;
      apiCache.delete(cacheKey);
      
    } catch (error) {
      console.error('Error deleting session:', error);
      showToast('error', 'Failed to delete chat. Please try again.');
    }
  }, [currentSession, sessionHistory, handleSwitchSession, selectedChapter, createNewSession, showToast, getUrlSafeChapterId]);

  // Function to fetch user learning profiles
  const fetchLearningProfiles = useCallback(async () => {
    if (!user) return;
    
    try {
      const profiles = await fetchWithCache(`/api/learning-profiles?userId=${user.id}`);
      setLearningProfiles(profiles);
      
      // Select the first profile if available and none is selected
      if (profiles.length > 0 && !selectedLearningProfileId) {
        setSelectedLearningProfileId(profiles[0].id);
      }
    } catch (error) {
      console.error('Error fetching learning profiles:', error);
    }
  }, [user, selectedLearningProfileId, fetchWithCache]);

  // Function to handle language change
  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);
    
    // Update the current session with the new language if available
    if (currentSession) {
      fetch(`/api/course-chats/sessions/${currentSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: newLanguage }),
      }).catch(err => console.error('Error updating session language:', err));
    }
  }, [currentSession]);

  // Function to handle learning profile change
  const handleLearningProfileChange = useCallback((profileId: string) => {
    setSelectedLearningProfileId(profileId);
    
    // Update the current session with the new profile if available
    if (currentSession) {
      fetch(`/api/course-chats/sessions/${currentSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ learningProfileId: profileId }),
      }).catch(err => console.error('Error updating session learning profile:', err));
    }
  }, [currentSession]);
  
  // Fetch learning profiles when user changes
  useEffect(() => {
    fetchLearningProfiles();
  }, [fetchLearningProfiles]);

  // Render
  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div></div>}>
      <BackgroundPaths />
      </Suspense>
      
      <div className="w-full h-full flex z-10">
        <div 
          className={`flex-1 flex flex-col h-full bg-[var(--background)] ${isHistoryOpen ? 'mr-[320px]' : ''} transition-all duration-300`}
        >
          {/* Course Info Header */}
          <header className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex flex-col">
              {/* Course Selector */}
              <div className="relative inline-block" ref={courseDropdownRef}>
                <button 
                  onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                  className="flex items-center gap-2 text-xl font-bold text-black hover:text-[var(--primary)] transition-colors"
                >
                  {selectedCourse ? selectedCourse.title : 'Select a course'}
                  <ChevronDown size={20} className={`transition-transform ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isCourseDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-64 rounded-md shadow-lg bg-white z-30 border border-gray-200">
                    <div className="py-1">
                      {enrolledCourses.map(course => (
                        <button
                          key={course.id}
                          className={`block w-full text-left px-4 py-2 text-sm ${selectedCourse && course.id === selectedCourse.id ? 'bg-gray-100 text-[var(--primary)]' : 'text-gray-700'} hover:bg-gray-50`}
                          onClick={() => handleCourseChange(course)}
                        >
                          {course.title}
                        </button>
                      ))}
                      {enrolledCourses.length === 0 && (
                        <div className="px-4 py-2 text-sm text-gray-500">
                          No enrolled courses found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chapter Selector */}
              {selectedCourse && (
                <div className="relative mt-2" ref={chapterDropdownRef}>
                <button 
                    onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
                    className="flex items-center gap-2 text-md font-medium text-gray-700 hover:text-[var(--primary)] transition-colors"
                >
                    {selectedChapter ? selectedChapter.title : 'Select a chapter'}
                    <ChevronDown size={16} className={`transition-transform ${isChapterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                  {isChapterDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-64 rounded-md shadow-lg bg-white z-30 border border-gray-200">
                      <div className="py-1 max-h-[300px] overflow-y-auto">
                        {selectedCourse.chapters?.map(chapter => (
                        <button
                            key={chapter.id}
                            className={`block w-full text-left px-4 py-2 text-sm ${selectedChapter && chapter.id === selectedChapter.id ? 'bg-gray-100 text-[var(--primary)]' : 'text-gray-700'} hover:bg-gray-50`}
                            onClick={() => handleChapterChange(chapter)}
                          >
                            {chapter.title}
                        </button>
                      ))}
                        {!selectedCourse.chapters || selectedCourse.chapters.length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-500">
                            No chapters found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                )}
            </div>
            
            {/* Chat History Toggle */}
            <div className="flex items-center gap-2">
              <div className={`py-1 px-2 rounded-full text-xs font-medium flex items-center ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[var(--primary)] transition-colors rounded-md hover:bg-gray-100"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            >
              Chat History 
              {isHistoryOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            </div>
          </header>

          {/* Chat Body - Direct implementation instead of ChatInterface */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Messages Area */}
            <div className="flex-grow p-4 overflow-y-auto bg-white/50" ref={messageContainerRef}>
              {isInitialState && !isMessageSending && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Welcome to the Learning Assistant</h3>
                    <p className="text-gray-600 mb-6">Ask me anything about your course material, and I'll help you understand it better.</p>
                    
                  <SuggestedQuestions 
                        questions={suggestedPrompts} 
                        onQuestionClick={(question: string) => {
                          setInputMessage(question);
                          if (currentSession?.id) {
                              sendMessage(question, currentSession.id);
                            }
                          }}
                        />
                  </div>
                </div>
              )}
              
              {!isInitialState && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messageList}

                  {/* Display streaming message */}
                  {streamingMessage && (
                    <Message
                      key={streamingMessage.id}
                      content={processStreamingContent(streamingMessage.content)}
                      messageType={streamingMessage.messageType || 'text'}
                      isUser={streamingMessage.isUser}
                    />
                  )}
                  
                  {/* Loading indicator for message sending */}
                  {isMessageSending && !streamingMessage && (
                    <div className="flex px-4 py-3 bg-white rounded-lg shadow-sm max-w-[80%]">
                      <div className="animate-pulse flex space-x-2">
                        <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                        <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                        <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  </div>
                </div>
              )}
          </div>
              )}
              
              <div ref={endOfMessagesRef} />
          </div>

            {/* Input Form */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2 relative rounded-xl border border-gray-300 shadow-sm focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent bg-white overflow-hidden">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Message the AI assistant..."
                    className="w-full p-3 pr-10 border-none focus:outline-none resize-none min-h-[56px] max-h-[200px] bg-transparent"
                    disabled={isLoading && !currentSession}
                rows={1}
                    style={{ overflowY: 'auto' }}
              />
                  <div className="absolute right-2 bottom-2 flex items-center">
              <button 
                      type="button"
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md"
              >
                <Smile size={20} />
              </button>
              <button
                onClick={() => {
                        if (currentSession?.id) {
                    sendMessage(inputMessage, currentSession.id);
                        } else if (inputMessage.trim()) {
                          // Create a temporary session if needed and send message
                          const tempSessionId = `temp-${Date.now()}`;
                          setCurrentSession({
                            id: tempSessionId,
                            chapterName: selectedChapter?.title || 'Temporary Chat',
                            createdAt: new Date().toISOString(),
                            messages: []
                          });
                          sendMessage(inputMessage, tempSessionId);
                        }
                      }}
                      disabled={!inputMessage.trim() || (isLoading && !currentSession)}
                      className={`p-1.5 rounded-md transition-colors ml-1 ${
                        inputMessage.trim() && (!isLoading || currentSession)
                          ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                      aria-label="Send message"
                    >
                      <Send size={18} />
              </button>
                  </div>
                </div>
                <div className="text-xs text-center text-gray-500 mt-2">
                  The AI assistant may produce inaccurate information about topics outside of your course material.
                  {process.env.NODE_ENV === 'development' && (
                    <button 
                      onClick={async () => {
                        setIsMessageSending(true);
                        setIsInitialState(false);
                        
                        // Add test message
                        const testUserMessage: ChatMessage = {
                          id: uuidv4(),
                          chatId: currentSession?.id || 'test-session',
                          content: "Show me a markdown demo",
                          messageType: 'text',
                          isUser: true,
                          order: messages.length,
                          createdAt: new Date(),
                          updatedAt: new Date()
                        };
                        
                        setMessages(prev => [...prev, testUserMessage]);
                        
                        // Test markdown streaming
                        try {
                          const response = await fetch('/api/chat/markdown', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          
                          if (!response.body) {
                            throw new Error('Response has no body');
                          }
                          
                          const reader = response.body.getReader();
                          const decoder = new TextDecoder();
                          
                          let done = false;
                          while (!done) {
                            const { value, done: readerDone } = await reader.read();
                            done = readerDone;
                            
                            if (value) {
                              const chunk = decoder.decode(value);
                              const messages = chunk.split('\n').filter(Boolean);
                              
                              for (const message of messages) {
                                try {
                                  const data = JSON.parse(message);
                                  
                                  // Process the message like it came from WebSocket
                                  if (data.type === 'text') {
                                    if (streamingMessage) {
                                      setStreamingMessage(prev => {
                                        if (!prev) return {
                                          id: uuidv4(),
                                          content: data.content,
                                          messageType: 'markdown',
                                          isUser: false,
                                          isComplete: false,
                                          metadata: {}
                                        };
                                        
                                        return {
                                          ...prev,
                                          content: prev.content + data.content,
                                          messageType: 'markdown'
                                        };
                                      });
                                    } else {
                                      setStreamingMessage({
                                        id: uuidv4(),
                                        content: data.content,
                                        messageType: 'markdown',
                                        isUser: false,
                                        isComplete: false,
                                        metadata: {}
                                      });
                                    }
                                  } else if (data.type === 'complete') {
                                    if (streamingMessage) {
                                      // Finalize the message
                                      const finalMessage: ChatMessage = {
                                        id: streamingMessage.id,
                                        chatId: currentSession?.id || 'test-session',
                                        content: streamingMessage.content,
                                        messageType: 'markdown',
                                        isUser: false,
                                        order: messages.length + 1,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                      };
                                      
                                      setMessages(prev => [...prev, finalMessage]);
                                      setStreamingMessage(null);
                                      setIsMessageSending(false);
                                    }
                                  }
                                } catch (e) {
                                  console.error('Error parsing chunk:', e);
                                }
                              }
                            }
                          }
                        } catch (error) {
                          console.error('Error testing markdown streaming:', error);
                          setIsMessageSending(false);
                        }
                      }}
                      className="ml-2 text-xs text-blue-500 hover:underline"
                    >
                      [Test Markdown]
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat History Sidebar */}
        <div
          className={`fixed right-0 top-0 h-full w-[320px] bg-[var(--primary)] text-white shadow-lg border-l border-white/10 transform transition-transform duration-300 z-20 ${
            isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="animate-pulse w-full h-12 bg-white/20 rounded-md"></div></div>}>
            <ChatHistory 
              sessions={sessionHistory}
              onSelectSession={handleSwitchSession}
              onRenameSession={handleRenameSession}
              onDeleteSession={handleDeleteSession}
              currentSessionId={currentSession?.id}
              courseContext={selectedCourse ? {
                courseId: selectedCourse.id,
                courseName: selectedCourse.title,
                chapterId: selectedChapter?.id,
                chapterName: selectedChapter?.title
              } : undefined}
            />
          </Suspense>
              </div>
                          </div>
      
      {/* Rename modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Rename Chat</h3>
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Enter a new name"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="flex justify-end gap-2 mt-4">
                        <button
                onClick={() => {
                  setIsRenameModalOpen(false);
                  setRenamingSessionId(null);
                  setNewSessionName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
                        </button>
                        <button
                onClick={() => {
                  if (renamingSessionId) {
                    handleRenameSession(renamingSessionId);
                  }
                  setIsRenameModalOpen(false);
                  setRenamingSessionId(null);
                  setNewSessionName('');
                }}
                className="px-4 py-2 text-white bg-[var(--primary)] rounded-md hover:bg-[var(--primary-hover)]"
                disabled={!newSessionName.trim()}
              >
                Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
    </div>
  );
}

export default CourseChatWindow; 