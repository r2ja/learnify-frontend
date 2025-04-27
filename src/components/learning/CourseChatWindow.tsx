'use client';

import React, { useState, useEffect, useRef, FC } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Paperclip, Send, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from './Message';
import { ChatHistory } from './ChatHistory';
import { SuggestedQuestions } from './SuggestedQuestions';
import { BackgroundPaths } from './BackgroundPaths';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from '@/lib/hooks/useUser';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  accentColor: string;
  isMarkdown?: boolean;
}

interface Course {
  id: string;
  title: string;
  modules: Module[];
}

interface Module {
  id: string;
  title: string;
}

interface DBCourse {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  level: string;
  chapters: any[];
  isEnrolled: boolean;
  syllabus?: any;
}

interface CourseChatWindowProps {
  courseId?: string;
  chapterId?: string;
}

const chatHistory = [
  { id: "1", title: "Introduction to React", date: "2024-02-07" },
  { id: "2", title: "JavaScript Basics", date: "2024-02-06" },
  { id: "3", title: "CSS Fundamentals", date: "2024-02-05" },
];

const suggestedQuestions = [
  "How do React components work?",
  "What are React hooks?",
  "Explain the virtual DOM",
  "What is JSX?",
  "How does state management work?",
  "What are props in React?",
  "Explain useEffect",
  "What is Context API?",
];

const botResponses = [
  "I'd be happy to help you understand React components.",
  "Let me explain how state management works in React.",
  "Here's what you need to know about React hooks.",
  "The virtual DOM is a key concept in React. Let me explain.",
  "Props and state are fundamental to React. Here's how they work.",
];

// Sample initial courses data for loading state
const initialCourses: Course[] = [
  {
    id: "loading",
    title: "Loading courses...",
    modules: [
      { id: "loading-1", title: "Please wait" }
    ]
  }
];

// ConnectionStatus component
const ConnectionStatus: FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
    <span className="text-xs text-gray-500">
      {isConnected ? 'Connected' : 'Disconnected'}
    </span>
  </div>
);

export function CourseChatWindow({ courseId, chapterId }: CourseChatWindowProps) {
  const { user, loading: loadingUser } = useUser();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitialState, setIsInitialState] = useState(true);
  const [availableCourses, setAvailableCourses] = useState<Course[]>(initialCourses);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [responseComplete, setResponseComplete] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string>("New Chat");
  
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const moduleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(event.target as Node)) {
        setIsModuleDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch enrolled courses when user is loaded
  useEffect(() => {
    if (loadingUser || !user) return;
    
    async function fetchEnrolledCourses() {
      setIsLoadingCourses(true);
      try {
        console.log(`Fetching enrolled courses for user: ${user!.id}`);
        const response = await fetch(`/api/courses/enrolled?userId=${user!.id}`);
    
    if (!response.ok) {
          throw new Error('Failed to fetch enrolled courses');
        }
        
        const enrolledCourses: DBCourse[] = await response.json();
        console.log('Fetched enrolled courses:', enrolledCourses);
        
        // Transform the data to match our Course interface
        const transformedCourses: Course[] = enrolledCourses.map(course => {
          console.log('Course syllabus:', course.syllabus);
          
          // Create default module for the course
          const defaultModules = [{ id: `${course.id}-default`, title: "General Chat" }];
          
          // Try to extract chapter information if available
          let modules = defaultModules;
          
          try {
            // Check if syllabus exists and has chapters
            if (course.syllabus && typeof course.syllabus === 'object') {
              // Try to access chapters from syllabus
              const chapters = course.syllabus.chapters || [];
              
              if (Array.isArray(chapters) && chapters.length > 0) {
                modules = chapters.map((chapter: any, index: number) => ({
            id: `${course.id}-chapter-${index}`,
                  title: chapter.title || `Chapter ${index + 1}`
                }));
              }
            }
          } catch (err) {
            console.error('Error parsing course chapters:', err);
        }
        
        return {
          id: course.id,
          title: course.title,
            modules: modules
        };
      });
      
        console.log('Transformed courses:', transformedCourses);
        setAvailableCourses(transformedCourses);
        
        // If we have courses, select the first one by default
        if (transformedCourses.length > 0) {
          setSelectedCourse(transformedCourses[0]);
          setSelectedModule(transformedCourses[0].modules[0]);
        }
        
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
        // Set some sample courses for fallback
        setAvailableCourses([
          {
            id: "error",
            title: "Error loading courses",
            modules: [{ id: "error-1", title: "Try again later" }]
          }
        ]);
      } finally {
        setIsLoadingCourses(false);
      }
    }
    
    fetchEnrolledCourses();
  }, [user, loadingUser]);

  // Initialize websocket connection
  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket('ws://127.0.0.1:8765');
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    setSocket(ws);
    
    // Clean up the websocket connection when component unmounts
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Initialize with welcome message when course/chapter changes
  useEffect(() => {
    let welcomeMessage = "Hi there! I'm your AI learning assistant. How can I help you today?";
    
    if (selectedCourse && selectedModule) {
      welcomeMessage = `Welcome to ${selectedCourse.title}! I'm your AI tutor and I'll guide you through the learning material. Feel free to ask me any questions about the topic.`;
      
      // Course-specific content message
      const contentMessage: ChatMessage = {
        id: '2',
        content: `Let's start by understanding the key concepts in ${selectedModule.title}. What specific aspect would you like to explore first?`,
        isUser: false,
        accentColor: "var(--primary)",
      };

      setMessages([
        {
          id: '1',
          content: welcomeMessage,
          isUser: false,
          accentColor: "var(--primary)",
        },
        contentMessage
      ]);
    } else {
      setMessages([
        {
          id: '1',
          content: welcomeMessage,
          isUser: false,
          accentColor: "var(--primary)",
        }
      ]);
    }

    // Generate a session ID if not already set
    if (!sessionId) {
      setSessionId(uuidv4());
    }
  }, [selectedCourse, selectedModule]);

  // Scroll to bottom when messages change
  useEffect(() => {
      scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Create a new chat
  const createNewChat = () => {
    // Clear messages and use default welcome messages
    setMessages([]);
    setCurrentConversationId(null);
    setCurrentConversationTitle("New Chat");
    setIsInitialState(true);
    
    const welcomeMessage = selectedCourse && selectedModule 
      ? `Welcome to ${selectedCourse.title}! I'm your AI tutor and I'll guide you through the learning material for ${selectedModule.title}. Feel free to ask me any questions about the topic.` 
      : "Hi there! I'm your AI learning assistant. How can I help you today?";
    
    if (selectedCourse && selectedModule) {
      // Course-specific content message
      const contentMessage: ChatMessage = {
        id: '2',
        content: `Let's start by understanding the key concepts in ${selectedModule.title}. What specific aspect would you like to explore first?`,
        isUser: false,
        accentColor: "var(--primary)",
      };

      setMessages([
        {
          id: '1',
          content: welcomeMessage,
          isUser: false,
          accentColor: "var(--primary)",
        },
        contentMessage
      ]);
    } else {
      setMessages([
        {
          id: '1',
          content: welcomeMessage,
          isUser: false,
          accentColor: "var(--primary)",
        }
      ]);
    }
  };

  // Load a specific chat
  const loadChat = async (conversationId: string) => {
    if (!user || !selectedCourse || !selectedModule) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/conversations?courseId=${selectedCourse.id}&moduleId=${selectedModule.id}&conversationId=${conversationId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.messages) {
          setMessages(data.messages);
          setCurrentConversationId(data.id);
          setCurrentConversationTitle(data.title);
          setIsInitialState(false);
        }
      } else {
        console.error('Failed to load conversation');
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save messages to database
  const saveMessages = async () => {
    if (!user || !selectedCourse || !selectedModule || messages.length === 0 || isSavingConversation) return;
    
    try {
      setIsSavingConversation(true);
      
      console.log('Saving conversation...');
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          moduleId: selectedModule.id,
          conversationId: currentConversationId,
          messages: messages,
          title: currentConversationTitle || "Chat - " + new Date().toLocaleString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save conversation');
      }
      
      const data = await response.json();
      if (!currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }
      
      console.log('Conversation saved successfully');
    } catch (error) {
      console.error('Error saving conversation:', error);
    } finally {
      setIsSavingConversation(false);
    }
  };

  // Load previous messages when course or module changes
  useEffect(() => {
    const loadConversation = async () => {
      if (!user || !selectedCourse || !selectedModule) return;
      
      try {
        const response = await fetch(`/api/conversations?courseId=${selectedCourse.id}&moduleId=${selectedModule.id}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            setCurrentConversationId(data.id);
            setCurrentConversationTitle(data.title || "Chat");
            setIsInitialState(false);
          } else {
            // No existing conversation for this module, show default welcome messages
            createNewChat();
          }
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        createNewChat();
      }
    };
    
    loadConversation();
  }, [user, selectedCourse, selectedModule]);

  // Save messages when complete
  useEffect(() => {
    if (responseComplete && !isLoading && messages.length > 0) {
      saveMessages();
      setResponseComplete(false);
    }
  }, [responseComplete, isLoading, messages]);

  const handleWebSocketMessage = (data: any) => {
    if (data.type === 'text') {
      // For text messages, update the last bot message or create a new one
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        // If the last message is from the bot, append to it
        if (!lastMessage.isUser) {
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + data.content,
            isMarkdown: true
          };
          return updatedMessages;
        } else {
          // Otherwise create a new bot message
          return [...prev, {
            id: Date.now().toString(),
            content: data.content,
            isUser: false,
            accentColor: "var(--primary)",
            isMarkdown: true
          }];
        }
      });
      setIsLoading(false);
    } else if (data.type === 'mermaid_gen') {
      // Handle mermaid diagrams
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          content: '```mermaid\n' + data.content + '\n```',
          isUser: false,
          accentColor: "var(--primary)",
          isMarkdown: true
        }
      ]);
      setIsLoading(false);
    } else if (data.type === 'complete') {
      // Response is complete
      setIsLoading(false);
      setResponseComplete(true); // Mark response as complete to trigger saving
      
      // If this is the first user message, update the title with the first few words
      if (currentConversationId === null) {
        const userMessages = messages.filter(m => m.isUser);
        if (userMessages.length === 1) {
          const firstUserMessage = userMessages[0].content;
          // Use the first 5 words or 30 characters as the title
          const words = firstUserMessage.split(' ').slice(0, 5).join(' ');
          const title = words.length > 30 ? words.substring(0, 30) + '...' : words;
          setCurrentConversationTitle(title);
        }
      }
    } else if (data.type === 'error') {
      // Handle error
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          content: `Error: ${data.content}`,
          isUser: false,
          accentColor: "red",
        }
      ]);
      setIsLoading(false);
      setResponseComplete(true); // Save even on error
    }
  };

  const sendMessageToWebSocket = (message: string) => {
    if (!selectedCourse || !selectedModule) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          content: "Please select a course before sending a message.",
          isUser: false,
          accentColor: "red",
        }
      ]);
      return;
    }

    if (!user) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          content: "You need to be logged in to use the chat.",
          isUser: false,
          accentColor: "red",
        }
      ]);
        return;
      }

    if (socket && socket.readyState === WebSocket.OPEN) {
      // Prepare data to send - use non-null assertion since we've already checked user exists
      const messageData = {
        message: message,
        user_id: user!.id,
        course_id: selectedCourse.id,
        chapter_id: selectedModule.id,
        session_id: sessionId,
        language: 'english',
        learning_profile: {
          style: 'conceptual',
          depth: 'beginner',
          interaction: 'examples'
        }
      };
      
      // Log the outgoing message
      console.log('Sending message to WebSocket:', messageData);
      
      // Send the message
      socket.send(JSON.stringify(messageData));
      setIsLoading(true);
    } else {
      console.error('WebSocket is not connected');
      
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          content: "Error: Could not connect to the assistant. Please try again later.",
          isUser: false,
          accentColor: "red",
        }
      ]);
    }
  };

  const handleSendMessage = (text = inputMessage) => {
    if (text.trim()) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        content: text,
        isUser: true,
        accentColor: "var(--primary)",
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputMessage("");
      setIsInitialState(false);

      // Create a placeholder loading message
      const loadingMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "",
        isUser: false,
        accentColor: "var(--primary)",
      };
      
      setMessages(prev => [...prev, loadingMessage]);
      
      // Send the message to the WebSocket server
      sendMessageToWebSocket(text);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCourseChange = (course: Course) => {
    console.log('Selected course:', course);
    setSelectedCourse(course);
    setSelectedModule(course.modules[0]);
    setIsCourseDropdownOpen(false);
    setSessionId(uuidv4()); // Create a new session ID for the new course
    setCurrentConversationId(null); // Reset current conversation
    // Messages will be loaded or initialized in the useEffect
  };

  const handleModuleChange = (module: Module) => {
    setSelectedModule(module);
    setIsModuleDropdownOpen(false);
    setCurrentConversationId(null); // Reset current conversation
    // Messages will be loaded or initialized in the useEffect
  };

  const getRandomResponse = () => {
    return botResponses[Math.floor(Math.random() * botResponses.length)];
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <BackgroundPaths />
      <ConnectionStatus isConnected={isConnected} />
      
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
                  disabled={isLoadingCourses}
                >
                  {isLoadingCourses 
                    ? "Loading courses..." 
                    : selectedCourse 
                      ? selectedCourse.title 
                      : "Select a course"}
                  <ChevronDown size={20} className={`transition-transform ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isCourseDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-64 rounded-md shadow-lg bg-white z-30 border border-gray-200">
                    <div className="py-1 max-h-80 overflow-y-auto">
                      {availableCourses.map(course => (
                        <button
                          key={course.id}
                          className={`block w-full text-left px-4 py-2 text-sm ${selectedCourse && course.id === selectedCourse.id ? 'bg-gray-100 text-[var(--primary)]' : 'text-gray-700'} hover:bg-gray-50`}
                          onClick={() => handleCourseChange(course)}
                        >
                          {course.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Module Selector - only show if a course is selected */}
              {selectedCourse && selectedModule && (
                <div className="relative inline-block mt-1" ref={moduleDropdownRef}>
                <button 
                    onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-[var(--primary)] transition-colors"
                >
                    Module: {selectedModule.title}
                    <ChevronDown size={14} className={`transition-transform ${isModuleDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                  {isModuleDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-56 rounded-md shadow-lg bg-white z-30 border border-gray-200">
                      <div className="py-1 max-h-60 overflow-y-auto">
                        {selectedCourse.modules.map(module => (
                        <button
                            key={module.id}
                            className={`block w-full text-left px-4 py-2 text-sm ${module.id === selectedModule.id ? 'bg-gray-100 text-[var(--primary)]' : 'text-gray-700'} hover:bg-gray-50`}
                            onClick={() => handleModuleChange(module)}
                          >
                            {module.title}
                        </button>
                      ))}
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
              {isInitialState ? (
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
                    {selectedCourse 
                      ? `What would you like to learn about ${selectedCourse.title}?` 
                      : "Select a course to start learning"}
                  </motion.h2>

                  {selectedCourse && (
                  <SuggestedQuestions 
                      questions={suggestedQuestions} 
                      onQuestionClick={handleSendMessage} 
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  className="py-6 px-4 flex flex-col gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  {messages.map((message) => (
                    <Message 
                      key={message.id} 
                      content={message.content} 
                      isUser={message.isUser}
                      accentColor={message.accentColor}
                      isMarkdown={message.isMarkdown}
                    />
                  ))}
                  
                  {isLoading && (
                    <div className="flex items-center">
                      <div className="flex space-x-1 ml-12">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                  </div>
                </div>
                  )}
                  
                  <div ref={endOfMessagesRef} />
                </motion.div>
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
                placeholder={selectedCourse ? "Type your message..." : "Select a course to start chatting"}
                className="flex-1 resize-none outline-none text-sm min-h-[24px] max-h-[120px] py-2"
                rows={1}
                disabled={!selectedCourse}
              />
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Add emoji"
              >
                <Smile size={20} />
              </button>
              <button
                className={`p-2 rounded-lg flex items-center justify-center ${
                  inputMessage.trim() && selectedCourse
                  ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading || !selectedCourse}
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
          {selectedCourse && selectedModule && (
            <ChatHistory 
              courseId={selectedCourse.id}
              moduleId={selectedModule.id}
              onSelectChat={(id) => loadChat(id)}
              onNewChat={createNewChat}
              currentChatId={currentConversationId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseChatWindow; 