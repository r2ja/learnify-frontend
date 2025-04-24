'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Paperclip, Send, Smile, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';

// Optimize imports with React.lazy
const Message = React.lazy(() => import('./Message'));
const ChatHistory = React.lazy(() => import('./ChatHistory'));
const SuggestedQuestions = React.lazy(() => import('./SuggestedQuestions'));
const BackgroundPaths = React.lazy(() => import('./BackgroundPaths'));

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  accentColor: string;
}

interface Course {
  id: string;
  title: string;
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  name: string;
  description?: string;
  completed?: boolean;
  lastViewed?: Date;
  courseId: string;
}

interface Session {
  id: string;
  chapterId: string;
  createdAt: Date;
}

interface CourseChatWindowProps {
  courseId?: string;
  chapterId?: string;
  sessionId?: string;
}

const chatHistory = [
  { id: 1, title: "Introduction to React", date: "2024-02-07" },
  { id: 2, title: "JavaScript Basics", date: "2024-02-06" },
  { id: 3, title: "CSS Fundamentals", date: "2024-02-05" },
];

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
  }[]>([]);
  
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
        abortControllerRef.current.abort();
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
      const formattedCourses: Course[] = coursesData.map((course: any) => {
        // Extract chapters from the syllabus if it exists
        let chapters: Chapter[] = [];
        
        if (course.syllabus && Array.isArray(course.syllabus)) {
          chapters = course.syllabus.map((item: any, index: number) => ({
            id: `${course.id}-chapter-${index}`,
            name: item.title || `Chapter ${index + 1}`,
            description: item.content || '',
            courseId: course.id
          }));
        } else {
          // If no syllabus exists, create a default chapter
          chapters = [
            { 
              id: `${course.id}-chapter-default`, 
              name: 'General',
              courseId: course.id
            }
          ];
        }
        
        return {
          id: course.id,
          title: course.title,
          chapters: chapters
        };
      });
      
      setEnrolledCourses(formattedCourses);
      
      // Set default selected course if available
      if (formattedCourses.length > 0) {
        // Use initial courseId if provided, otherwise use first course
        const initialCourse = initialCourseId
          ? formattedCourses.find(c => c.id === initialCourseId) || formattedCourses[0]
          : formattedCourses[0];
        
        setSelectedCourse(initialCourse);
        
        // Set default chapter
        if (initialCourse.chapters.length > 0) {
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
      
      if (!selectedCourse) {
        throw new Error('No course selected');
      }
      
      // Force a new chat creation by adding a timestamp parameter
      // This ensures we always create a new unique chat session
      const response = await fetch('/api/course-chats/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          virtualChapterId: chapterId,
          courseId: selectedCourse.id,
          chapterName: selectedChapter?.name || 'Unnamed Chapter',
          forceNew: true,  // Add this flag to indicate we want a new session
          timestamp: Date.now() // Add timestamp to ensure uniqueness
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
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
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error creating new session:', error);
      setIsLoading(false);
    }
  }, [selectedCourse, selectedChapter, defaultPrompts]);

  // Fetch session data from the API
  const fetchSessionData = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      
      const data = await fetchWithCache(`/api/course-chats/sessions/${sessionId}`);
      
      // Format messages for display
      const formattedMessages = data.messages.map((msg: any) => ({
        id: msg.id || String(Date.now()),
        content: msg.content,
        isUser: msg.isUser,
        accentColor: msg.isUser ? "var(--primary)" : "var(--secondary)",
      }));
      
      setMessages(formattedMessages);
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

  // Send a new message from the user to the API
  const sendMessage = useCallback(async (content: string, sessionId: string) => {
    if (!content.trim() || !sessionId) return;
    
    setIsMessageSending(true);
    // Immediately change from initial state when sending a message
    setIsInitialState(false);
    
    // Optimistically add the message to the UI
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
        isUser: true,
        accentColor: "var(--primary)",
      };

    setMessages(prev => [...prev, tempMessage]);
      setInputMessage("");

      try {
      const response = await fetch(`/api/course-chats/sessions/${sessionId}`, {
        method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({ message: content }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to send message');
        }
        
      // Update UI from server response
      const { userMessage, aiMessage } = await response.json();
      
      // Remove the temporary message and add the real messages from the server
      setMessages(prev => 
        prev.filter(m => m.id !== tempMessage.id).concat([
          { id: userMessage.id, content: userMessage.content, isUser: true, accentColor: "var(--primary)" },
          { id: aiMessage.id, content: aiMessage.content, isUser: false, accentColor: "var(--secondary)" }
        ])
      );
      
      // Clear the cached response for this session to ensure fresh data on next fetch
      const cacheKey = `/api/course-chats/sessions/${sessionId}`;
      apiCache.delete(cacheKey);
      
      // Update the session title ONLY if this is the first message (when messages array was empty before)
      if (messages.length === 0 && selectedChapter) {
        // Refresh the chat history but only update the title for the current session
        const safeChapterId = getUrlSafeChapterId(selectedChapter.id);
        const freshSessions = await fetchWithCache(`/api/course-chats/sessions?virtualChapterId=${safeChapterId}`, 
          { headers: { 'Cache-Control': 'no-cache' } });
        
        if (freshSessions.length > 0) {
          setSessionHistory(prev => {
            return prev.map(session => {
              if (session.id === sessionId) {
                // Only update first message for this session
                const truncatedContent = content.length > 40 ? content.substring(0, 40) + '...' : content;
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
      
      scrollToBottom();
      } catch (error) {
        console.error('Error sending message:', error);
      showToast('error', 'Failed to send message. Please try again.');
      
      // Remove the temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setIsMessageSending(false);
    }
  }, [scrollToBottom, showToast, messages.length, selectedChapter, getUrlSafeChapterId, fetchWithCache]);

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
      if (course.chapters && course.chapters.length > 0) {
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
      <Suspense key={message.id} fallback={<div className="animate-pulse h-16 bg-gray-100 rounded-lg"></div>}>
        <Message 
          key={message.id} 
          content={message.content} 
          isUser={message.isUser}
          accentColor={message.accentColor} 
        />
      </Suspense>
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

  // Add a component for the rename modal
  const RenameModal = () => {
    if (!isRenameModalOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
          <h3 className="text-lg font-semibold mb-4">Rename Chat</h3>
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="Enter new name"
            className="w-full p-2 border border-gray-300 rounded mb-4"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsRenameModalOpen(false);
                setRenamingSessionId(null);
                setNewSessionName('');
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => renamingSessionId && handleRenameSession(renamingSessionId)}
              className="px-4 py-2 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] rounded-md"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

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
                <div className="relative inline-block mt-1" ref={chapterDropdownRef}>
                <button 
                    onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-[var(--primary)] transition-colors"
                    disabled={!selectedCourse?.chapters || selectedCourse.chapters.length === 0}
                >
                    Chapter: {selectedChapter ? selectedChapter.name : 'Select a chapter'}
                    <ChevronDown size={14} className={`transition-transform ${isChapterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                  {isChapterDropdownOpen && selectedCourse && (
                  <div className="absolute left-0 mt-1 w-56 rounded-md shadow-lg bg-white z-30 border border-gray-200">
                    <div className="py-1">
                        {selectedCourse.chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            className={`block w-full text-left px-4 py-2 text-sm ${selectedChapter && chapter.id === selectedChapter.id ? 'bg-gray-100 text-[var(--primary)]' : 'text-gray-700'} hover:bg-gray-50`}
                            onClick={() => handleChapterChange(chapter)}
                          >
                            {chapter.name}
                            {chapter.completed && (
                              <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                            )}
                        </button>
                      ))}
                        {selectedCourse.chapters.length === 0 && (
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
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[var(--primary)] transition-colors rounded-md hover:bg-gray-100"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            >
              Chat History 
              {isHistoryOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </header>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto" ref={messageContainerRef}>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
                </div>
              ) : isInitialState && suggestedPrompts.length > 0 ? (
                <motion.div
                  className="h-full flex flex-col items-center justify-center px-6"
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: -30,
                    transition: { duration: 1, ease: "easeInOut" },
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <motion.h2
                    className="text-3xl font-bold mb-4 text-[var(--primary)]"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 1.2 }}
                  >
                    {selectedChapter 
                      ? `Ask me about "${selectedChapter.name}"`
                      : "Select a chapter to start"
                    }
                  </motion.h2>

                  {selectedChapter && selectedChapter.description && (
                    <motion.p
                      className="text-center text-gray-600 mb-6 max-w-lg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 1 }}
                    >
                      {selectedChapter.description}
                    </motion.p>
                  )}

                  <div className="flex flex-col space-y-4 px-4 pb-4">
                    {selectedChapter && currentSession && (
                      <Suspense fallback={<div className="animate-pulse h-12 bg-gray-100 rounded-md"></div>}>
                  <SuggestedQuestions 
                        questions={suggestedPrompts} 
                          onQuestionClick={(question) => {
                            if (selectedChapter && currentSession) {
                              sendMessage(question, currentSession.id);
                            }
                          }}
                        />
                      </Suspense>
                    )}
                  </div>
                </motion.div>
              ) : messages.length > 0 ? (
                <motion.div
                  className="py-6 px-4 flex flex-col gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  {messageList}
                  <div ref={endOfMessagesRef} />
                </motion.div>
              ) : (
                // Fallback if there are no messages and no suggested prompts
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p className="mb-2">No messages yet</p>
                    <p>Type something below to start chatting</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 bg-white rounded-xl p-2 border border-gray-200">
              <button
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Add attachment"
              >
                <Paperclip size={20} />
              </button>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedChapter ? "Type your message..." : "Select a chapter to start chatting"}
                className="flex-1 resize-none outline-none text-sm min-h-[24px] max-h-[120px] py-2"
                rows={1}
                disabled={!selectedChapter}
              />
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Add emoji"
              >
                <Smile size={20} />
              </button>
              <button
                className={`p-2 rounded-lg flex items-center justify-center ${
                  inputMessage.trim() && selectedChapter
                  ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                onClick={() => {
                  if (selectedChapter && currentSession) {
                    sendMessage(inputMessage, currentSession.id);
                  }
                }}
                disabled={!inputMessage.trim() || !selectedChapter}
              >
                <Send size={20} />
              </button>
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
            <div className="p-6 h-full flex flex-col">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">Chat History</h2>
                <button 
                  onClick={startNewChatSession}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium transition-colors"
                >
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-2">
                {sessionHistory.length > 0 ? (
                  sessionHistory.map((session) => (
                    <div 
                      key={session.id} 
                      className={`relative group py-4 px-4 rounded-lg transition-all duration-200 border-b border-white/5 hover:bg-white/5 ${currentSession?.id === session.id ? 'bg-white/10' : ''}`}
                    >
                      <button 
                        className="text-left w-full"
                        onClick={() => handleSwitchSession(session.id)}
                      >
                        <div className="flex flex-col gap-2">
                          <h3 className="text-base font-medium text-white">
                            {session.customTitle || session.firstMessage || session.chapterName}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-white/60">
                            <Clock size={14} />
                            <span>{new Date(session.createdAt).toLocaleDateString()} {new Date(session.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                        </div>
                      </button>
                      
                      {/* Action buttons - hidden until hovered */}
                      <div className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSessionId(session.id);
                            setNewSessionName(session.customTitle || session.firstMessage || '');
                            setIsRenameModalOpen(true);
                          }}
                          className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white"
                          aria-label="Rename chat"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="p-1.5 bg-white/10 hover:bg-red-500 rounded text-white"
                          aria-label="Delete chat"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/60">
                    <p>No chat history for this chapter</p>
                  </div>
                )}
              </div>
            </div>
          </Suspense>
        </div>
      </div>

      {/* Rename Modal */}
      <RenameModal />
    </div>
  );
}

export default CourseChatWindow; 