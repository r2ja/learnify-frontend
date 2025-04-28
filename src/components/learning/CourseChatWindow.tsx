'use client';

import React, { useState, useEffect, useRef, FC } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Paperclip, Send, Smile, Edit2, Check } from 'lucide-react';
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

interface LearningProfile {
  processingStyle: string;
  perceptionStyle: string;
  inputStyle: string;
  understandingStyle: string;
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  
  // Add state for learning profile and user language
  const [userLanguage, setUserLanguage] = useState<string>("english");
  const [learningProfile, setLearningProfile] = useState<LearningProfile>({
    processingStyle: "Active",
    perceptionStyle: "Intuitive",
    inputStyle: "Visual",
    understandingStyle: "Sequential"
  });
  
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

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

    // Refresh the chat history to show the updated list
    triggerHistoryRefresh();
  };

  // Helper to trigger a refresh of chat history
  const triggerHistoryRefresh = () => {
    setHistoryRefreshTrigger(prev => prev + 1);
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
        // Refresh chat history when a new conversation is created
        triggerHistoryRefresh();
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
          // No need to trigger refresh here as saveMessages will do it when creating the new conversation
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
      // Prepare data to send
      const messageData = {
        message: message,
        user_id: user.id,
        // Send course name instead of ID
        course_name: selectedCourse.title,
        // Send chapter/module name instead of ID
        chapter_name: selectedModule.title,
        session_id: sessionId,
        language: userLanguage,
        // Send the entire conversation history for context
        messages: messages.map(msg => ({
          content: msg.content,
          isUser: msg.isUser
        })),
        // Send the user's learning profile fields explicitly
        // These should match the fields in your learning_profile database table
        processingStyle: learningProfile.processingStyle,
        perceptionStyle: learningProfile.perceptionStyle,
        inputStyle: learningProfile.inputStyle,
        understandingStyle: learningProfile.understandingStyle
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

  // Update conversation title
  const updateConversationTitle = async (newTitle: string) => {
    if (!user || !selectedCourse || !selectedModule || !currentConversationId) return;
    
    try {
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
          title: newTitle
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update conversation title');
      }
      
      const data = await response.json();
      setCurrentConversationTitle(data.title);
      
      // Refresh the chat history to show the updated title
      triggerHistoryRefresh();
      
      console.log('Conversation title updated successfully');
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  };

  // Start title editing
  const startTitleEdit = () => {
    setTitleInput(currentConversationTitle);
    setIsEditingTitle(true);
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, 50);
  };

  // Save title edit
  const saveTitleEdit = () => {
    const newTitle = titleInput.trim();
    if (newTitle) {
      setCurrentConversationTitle(newTitle);
      updateConversationTitle(newTitle);
    }
    setIsEditingTitle(false);
  };

  // Handle title input key press
  const handleTitleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTitleEdit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // Fetch the user's learning profile when the component loads
  useEffect(() => {
    if (loadingUser || !user) return;
    
    const fetchUserLearningProfile = async () => {
      try {
        // Fetch the user's learning profile
        const response = await fetch(`/api/users/${user.id}/learning-profile`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Update learning profile if it exists
          if (data && data.profile) {
            setLearningProfile({
              processingStyle: data.profile.processingStyle || "Active",
              perceptionStyle: data.profile.perceptionStyle || "Intuitive",
              inputStyle: data.profile.inputStyle || "Visual",
              understandingStyle: data.profile.understandingStyle || "Sequential"
            });
          }
          
          // Set user language if available
          if (data.language) {
            setUserLanguage(data.language);
          }
          
          console.log("Loaded user learning profile:", data);
        }
      } catch (error) {
        console.error("Error fetching user learning profile:", error);
      }
    };
    
    fetchUserLearningProfile();
  }, [user, loadingUser]);

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

          {/* Conversation Title - only show when a conversation is active and not in initial state */}
          {!isInitialState && currentConversationId && (
            <div className="px-4 py-2 border-b border-gray-100 flex items-center">
              {isEditingTitle ? (
                <div className="flex items-center flex-1">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={handleTitleKeyPress}
                    onBlur={saveTitleEdit}
                    className="px-2 py-1 border border-gray-300 rounded-md flex-1 mr-2 text-sm font-medium"
                    maxLength={50}
                  />
                  <button 
                    onClick={saveTitleEdit}
                    className="p-1 rounded-md bg-[var(--primary)] text-white"
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center flex-1">
                  <h3 className="text-sm font-medium text-gray-700 flex-1 truncate pr-2">
                    {currentConversationTitle}
                  </h3>
                  <button
                    onClick={startTitleEdit}
                    className="p-1 text-gray-500 hover:text-[var(--primary)] rounded-md hover:bg-gray-100"
                    title="Rename conversation"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

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
                    <div className="flex justify-center mb-4 px-4 sm:px-8 md:px-12 lg:px-20">
                      <div className="flex-shrink-0 w-9 h-9 rounded-md bg-[var(--primary)] text-white flex items-center justify-center mr-3 mt-0.5">
                        <span className="text-base font-semibold">L</span>
                      </div>
                      <div className="relative max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[65%] py-4 px-5 rounded-lg bg-gray-100 text-gray-800">
                        <div className="flex items-center justify-start h-6">
                          <div className="flex space-x-2">
                            <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                          </div>
                        </div>
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
              refreshTrigger={historyRefreshTrigger}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseChatWindow; 