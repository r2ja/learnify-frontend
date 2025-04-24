-- Migration: Update chat schema to support new OpenAI integration
-- This migration creates new tables for chat sessions and messages

-- Drop old tables if they exist
DROP TABLE IF EXISTS public."ChapterChatSession" CASCADE;
DROP TABLE IF EXISTS public."GeneralQueryChatSession" CASCADE;

-- Create new chat_sessions table
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create new chat_messages table
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions (user_id);
CREATE INDEX idx_chat_sessions_chapter ON public.chat_sessions (chapter_id);
CREATE INDEX idx_chat_sessions_course ON public.chat_sessions (course_id);
CREATE INDEX idx_chat_messages_session ON public.chat_messages (session_id);

-- Add foreign key constraints
ALTER TABLE ONLY public.chat_sessions 
    ADD CONSTRAINT fk_chat_sessions_chapter 
    FOREIGN KEY (chapter_id) REFERENCES public."Chapter" (id) 
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_sessions 
    ADD CONSTRAINT fk_chat_sessions_course 
    FOREIGN KEY (course_id) REFERENCES public."Course" (id) 
    ON UPDATE CASCADE ON DELETE CASCADE;

-- Add foreign key constraint for chat_messages to chat_sessions
ALTER TABLE ONLY public.chat_messages 
    ADD CONSTRAINT fk_chat_messages_session 
    FOREIGN KEY (session_id) REFERENCES public.chat_sessions (id) 
    ON UPDATE CASCADE ON DELETE CASCADE;

-- Create table for user progress tracking
CREATE TABLE public.user_progress (
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    completion_percentage INTEGER DEFAULT 0,
    last_viewed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, chapter_id)
);

-- Add foreign key constraints to user_progress
ALTER TABLE ONLY public.user_progress 
    ADD CONSTRAINT fk_user_progress_chapter 
    FOREIGN KEY (chapter_id) REFERENCES public."Chapter" (id) 
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_progress 
    ADD CONSTRAINT fk_user_progress_course 
    FOREIGN KEY (course_id) REFERENCES public."Course" (id) 
    ON UPDATE CASCADE ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE public.chat_sessions IS 'Stores chat sessions between users and AI for specific chapters';
COMMENT ON TABLE public.chat_messages IS 'Stores individual messages within chat sessions';
COMMENT ON TABLE public.user_progress IS 'Tracks user progress through courses and chapters';

COMMENT ON COLUMN public.chat_sessions.title IS 'Title of the chat session, can be generated based on first message';
COMMENT ON COLUMN public.chat_messages.role IS 'Message role: system (context), user, or assistant (AI)';
COMMENT ON COLUMN public.user_progress.completion_percentage IS 'Percentage of chapter completed by user';
COMMENT ON COLUMN public.user_progress.last_viewed IS 'Timestamp when user last viewed this chapter';
COMMENT ON COLUMN public.user_progress.completed_at IS 'Timestamp when user completed this chapter, null if not completed'; 