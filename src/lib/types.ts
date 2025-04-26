// Chat System Types

// Message types supported by the LLM
export type MessageType = 'text' | 'code' | 'mermaid' | 'image' | 'table' | 'error' | 'markdown';

// Chat message with enhanced type support
export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  messageType: MessageType;
  isUser: boolean;
  reasoning?: string;
  metadata?: MessageMetadata;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Metadata specific to different message types
export interface MessageMetadata {
  // For code blocks
  code?: {
    language: string;
    filename?: string;
  };
  // For mermaid diagrams
  mermaid?: {
    diagram: string;
    title?: string;
  };
  // For generated images
  image?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  // For tables
  table?: {
    headers: string[];
    rows: string[][];
  };
  // For citations
  citations?: {
    source: string;
    url?: string;
    title?: string;
  }[];
  // For markdown content
  hasCode?: boolean;
  hasMermaid?: boolean;
}

// Course chat session
export interface CourseChat {
  id: string;
  userId: string;
  courseId: string;
  virtualChapterId?: string;
  title?: string;
  customTitle?: string;
  language: string;
  learningProfileId: string;
  lastContext?: string;
  metadata?: CourseChatMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Course chat metadata
export interface CourseChatMetadata {
  sessionStats?: {
    messageCount: number;
    userMessageCount: number;
    aiMessageCount: number;
    lastInteraction: string; // ISO date string
  };
  contextHistory?: {
    timestamp: string; // ISO date string
    context: string;
  }[];
}

// Learning profile from the existing schema
export interface LearningProfile {
  id: string;
  userId: string;
  processingStyle: string;
  perceptionStyle: string;
  inputStyle: string;
  understandingStyle: string;
  assessmentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Message streaming interface
export interface StreamingMessage {
  id: string;
  content: string;
  messageType: MessageType;
  isUser: boolean;
  isComplete: boolean;
  metadata?: MessageMetadata;
}

// Request interface for sending messages
export interface SendMessageRequest {
  content: string;
  chatId: string;
  courseId: string;
  chapterId?: string;
  learningProfileId: string;
  language: string;
}

// Response interface for receiving messages
export interface MessageResponse {
  id: string;
  content: string;
  messageType: MessageType;
  isUser: boolean;
  reasoning?: string;
  metadata?: MessageMetadata;
  createdAt: string;
} 
  metadata?: MessageMetadata;
  createdAt: string;
} 