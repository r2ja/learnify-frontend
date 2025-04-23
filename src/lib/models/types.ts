// Base interfaces for entities
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User entity
export interface User extends BaseEntity {
  name: string | null;
  email: string;
  password: string | null;
  image: string | null;
  language: 'urdu' | 'english' | 'french';
}

// Learning profile entity
export interface LearningProfile extends BaseEntity {
  userId: string;
  processingStyle: string;
  perceptionStyle: string;
  inputStyle: string;
  understandingStyle: string;
  assessmentDate: Date;
}

// Course entity
export interface Course extends BaseEntity {
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  chapters: number;
  level: string;
  syllabus: any | null; // JSON in PostgreSQL
}

// Chapter entity
export interface Chapter extends BaseEntity {
  courseId: string;
  name: string;
  description: string | null;
  content: any; // JSON in PostgreSQL
}

// ChapterPrompt entity
export interface ChapterPrompt extends BaseEntity {
  chapterId: string;
  prompt: string;
}

// QuizInstance entity
export interface QuizInstance extends BaseEntity {
  userId: string;
  courseId: string;
  chapterId: string;
  context: any; // JSON in PostgreSQL
  quiz_payload: any; // JSON in PostgreSQL
  status: string;
}

// QuizResponse entity
export interface QuizResponse extends BaseEntity {
  quizInstanceId: string;
  userId: string;
  answers: any; // JSON in PostgreSQL
  score: number | null;
  submittedAt: Date;
}

// ChatSession entities
export interface BaseChatSession extends BaseEntity {
  userId: string;
  prompt: string | null;
  input_type: string;
  input_payload: any | null; // JSON in PostgreSQL
  output_payload: any | null; // JSON in PostgreSQL
}

export interface ChapterChatSession extends BaseChatSession {
  chapterId: string;
}

export interface GeneralQueryChatSession extends BaseChatSession {
  courseId: string;
}

// Input types for creation and update
export type UserCreateInput = {
  name?: string | null;
  email: string;
  password?: string | null;
  image?: string | null;
  language?: 'urdu' | 'english' | 'french';
};

export type CourseCreateInput = Omit<Course, 'id' | 'createdAt' | 'updatedAt'>;

export type ChapterCreateInput = Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>;

export type LearningProfileCreateInput = Omit<LearningProfile, 'id' | 'createdAt' | 'updatedAt'>;

// Select fields types
export type UserSelect = {
  id?: boolean;
  name?: boolean;
  email?: boolean;
  password?: boolean;
  image?: boolean;
  language?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  enrolledIn?: boolean;
  learningProfile?: boolean;
};

export type CourseSelect = {
  id?: boolean;
  title?: boolean;
  description?: boolean;
  imageUrl?: boolean;
  category?: boolean;
  chapters?: boolean;
  level?: boolean;
  syllabus?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  students?: boolean;
}; 