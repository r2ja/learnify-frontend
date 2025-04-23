-- PostgreSQL database dump
-- Dumped from database version 16.8 (Ubuntu 16.8-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.8 (Ubuntu 16.8-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Schema comment
COMMENT ON SCHEMA public IS '';

-- ---------- ENUM TYPES ----------
-- Drop the type if it exists to avoid errors on re-run
DROP TYPE IF EXISTS public."UserLanguage" CASCADE;
CREATE TYPE public."UserLanguage" AS ENUM (
  'urdu',
  'english',
  'french'
);

SET default_tablespace = '';
SET default_table_access_method = heap;

-- ---------- TABLES ----------

-- Drop existing tables in reverse order of creation/dependency to avoid errors
DROP TABLE IF EXISTS public."ChapterChatSession" CASCADE;
DROP TABLE IF EXISTS public."GeneralQueryChatSession" CASCADE;
DROP TABLE IF EXISTS public."QuizResponse" CASCADE;
DROP TABLE IF EXISTS public."QuizInstance" CASCADE;
DROP TABLE IF EXISTS public."CourseEnrollment" CASCADE;
DROP TABLE IF EXISTS public."LearningProfile" CASCADE;
DROP TABLE IF EXISTS public."ChapterPrompt" CASCADE;
DROP TABLE IF EXISTS public."Chapter" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public."Course" CASCADE;


CREATE TABLE public."Course" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "imageUrl" text,
    category text DEFAULT 'Computer Science'::text NOT NULL,
    chapters integer DEFAULT 1 NOT NULL,
    level text DEFAULT 'Beginner'::text NOT NULL,
    syllabus jsonb, -- Keep syllabus for potential legacy use or overview
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."Course" IS 'Stores course metadata.';


-- Chapter: each course can have multiple chapters
CREATE TABLE public."Chapter" (
    id text NOT NULL DEFAULT gen_random_uuid()::text,
    "courseId" text NOT NULL,
    name text NOT NULL,
    description text,
    content jsonb NOT NULL, -- Detailed content, could be markdown, structured data, etc.
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."Chapter" IS 'Stores individual chapters belonging to a course.';


-- High-quality sample prompts for each chapter
CREATE TABLE public."ChapterPrompt" (
    id text NOT NULL DEFAULT gen_random_uuid()::text,
    "chapterId" text NOT NULL,
    prompt text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."ChapterPrompt" IS 'Stores high-quality sample prompts related to a chapter for UI display.';


CREATE TABLE public."User" (
    id text NOT NULL,
    name text,
    email text NOT NULL,
    password text, -- Should be hashed
    image text,
    language public."UserLanguage" NOT NULL DEFAULT 'english'::public."UserLanguage",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."User" IS 'Stores user account information.';


CREATE TABLE public."LearningProfile" (
    id text NOT NULL, -- Could be same as userId if one-to-one
    "userId" text NOT NULL,
    "processingStyle" text DEFAULT 'Reflective'::text NOT NULL,
    "perceptionStyle" text DEFAULT 'Sensing'::text NOT NULL,
    "inputStyle" text DEFAULT 'Visual'::text NOT NULL,
    "understandingStyle" text DEFAULT 'Global'::text NOT NULL,
    "assessmentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."LearningProfile" IS 'Stores user learning preferences based on an assessment.';


-- Enrollment mapping: tracks which users are enrolled in which courses
CREATE TABLE public."CourseEnrollment" (
    "courseId" text NOT NULL,
    "userId" text NOT NULL,
    PRIMARY KEY ("courseId", "userId")
);
COMMENT ON TABLE public."CourseEnrollment" IS 'Junction table for the many-to-many relationship between Users and Courses.';


-- QuizInstance: singular quiz per chapter (one-to-one enforced by UNIQUE constraint)
CREATE TABLE public."QuizInstance" (
    id text NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" text NOT NULL, -- User who initiated or is taking the quiz
    "courseId" text NOT NULL, -- Context: course the quiz belongs to
    "chapterId" text NOT NULL UNIQUE, -- Enforces one quiz per chapter
    context jsonb NOT NULL, -- e.g., instructions, related material pointers
    quiz_payload jsonb NOT NULL, -- The actual quiz questions and structure
    status text NOT NULL DEFAULT 'pending', -- e.g., pending, in-progress, completed
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."QuizInstance" IS 'Represents a specific quiz instance associated with a chapter. Unique constraint on chapterId enforces one quiz per chapter.';


-- QuizResponse: stores each user's submitted answers and score for a quiz instance
CREATE TABLE public."QuizResponse" (
    id text NOT NULL DEFAULT gen_random_uuid()::text,
    "quizInstanceId" text NOT NULL,
    "userId" text NOT NULL, -- User who submitted the response
    answers jsonb NOT NULL, -- User's answers
    score integer, -- Score assigned after grading (optional)
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."QuizResponse" IS 'Stores a user''s response to a specific quiz instance.';


-- GeneralQueryChatSession: stores full chat log per course (used by general query agent)
CREATE TABLE public."GeneralQueryChatSession" (
    id text NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" text NOT NULL,
    "courseId" text NOT NULL,
    prompt text, -- The user's prompt
    input_type text DEFAULT 'text', -- Type of input: text, pdf, image
    input_payload jsonb, -- Details of the input (e.g., file info, text content)
    output_payload jsonb, -- LLM response + generated assets (e.g., image URLs, mermaid source)
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."GeneralQueryChatSession" IS 'Stores chat history for general queries related to a course, supporting multi-modal inputs/outputs.';


-- ChapterChatSession: stores full chat log per chapter
CREATE TABLE public."ChapterChatSession" (
    id text NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" text NOT NULL,
    "chapterId" text NOT NULL,
    prompt text,
    input_type text DEFAULT 'text',
    input_payload jsonb,
    output_payload jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
COMMENT ON TABLE public."ChapterChatSession" IS 'Stores chat history specific to a chapter, supporting multi-modal inputs/outputs.';


-- ---------- INDEXES ----------
CREATE UNIQUE INDEX "User_email_key" ON public."User" (email);
CREATE UNIQUE INDEX "LearningProfile_userId_key" ON public."LearningProfile" ("userId");

CREATE INDEX idx_chapter_course ON public."Chapter" ("courseId");
CREATE INDEX idx_quizinstance_user_course_chapter ON public."QuizInstance" ("userId", "courseId", "chapterId", "status");
CREATE INDEX idx_quizresponse_instance_user ON public."QuizResponse" ("quizInstanceId", "userId");
CREATE INDEX idx_course_enrollment_user ON public."CourseEnrollment" ("userId");
CREATE INDEX idx_course_enrollment_course ON public."CourseEnrollment" ("courseId"); -- Added index for course lookup
CREATE INDEX idx_chapterprompt_chapter ON public."ChapterPrompt" ("chapterId");
CREATE INDEX idx_generalquerychat_user_course ON public."GeneralQueryChatSession" ("userId", "courseId");
CREATE INDEX idx_chapterchat_user_chapter ON public."ChapterChatSession" ("userId", "chapterId");


-- ---------- FOREIGN KEYS ----------
ALTER TABLE ONLY public."Chapter" ADD CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ChapterPrompt" ADD CONSTRAINT "ChapterPrompt_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter" (id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Learning profile is strongly linked to a user, restrict deletion of user if profile exists
ALTER TABLE ONLY public."LearningProfile" ADD CONSTRAINT "LearningProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."QuizInstance" ADD CONSTRAINT "QuizInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."QuizInstance" ADD CONSTRAINT "QuizInstance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."QuizInstance" ADD CONSTRAINT "QuizInstance_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."QuizResponse" ADD CONSTRAINT "QuizResponse_quizInstanceId_fkey" FOREIGN KEY ("quizInstanceId") REFERENCES public."QuizInstance" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."QuizResponse" ADD CONSTRAINT "QuizResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."GeneralQueryChatSession" ADD CONSTRAINT "GeneralQueryChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."GeneralQueryChatSession" ADD CONSTRAINT "GeneralQueryChatSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."ChapterChatSession" ADD CONSTRAINT "ChapterChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."ChapterChatSession" ADD CONSTRAINT "ChapterChatSession_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter" (id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Add comments to columns for better understanding
COMMENT ON COLUMN public."Course".syllabus IS 'Legacy or overview syllabus data, potentially less detailed than Chapter content.';
COMMENT ON COLUMN public."Chapter".content IS 'Detailed content for the chapter, format flexible (e.g., markdown, JSON).';
COMMENT ON COLUMN public."User".password IS 'Hashed user password.';
COMMENT ON COLUMN public."LearningProfile".id IS 'Primary key, potentially same as userId for one-to-one mapping.';
COMMENT ON COLUMN public."LearningProfile"."userId" IS 'Foreign key linking to the User table.';
COMMENT ON COLUMN public."QuizInstance"."chapterId" IS 'Foreign key to Chapter, constrained to be unique to enforce one quiz per chapter.';
COMMENT ON COLUMN public."QuizInstance".context IS 'Contextual information for the quiz, like instructions.';
COMMENT ON COLUMN public."QuizInstance".quiz_payload IS 'The actual questions and structure of the quiz.';
COMMENT ON COLUMN public."QuizInstance".status IS 'Current status of the quiz (e.g., pending, completed).';
COMMENT ON COLUMN public."QuizResponse".answers IS 'User''s submitted answers in JSON format.';
COMMENT ON COLUMN public."QuizResponse".score IS 'Calculated score for the submitted response.';
COMMENT ON COLUMN public."GeneralQueryChatSession".input_type IS 'Type of input provided by the user (text, pdf, image).';
COMMENT ON COLUMN public."GeneralQueryChatSession".input_payload IS 'Data associated with the input (e.g., file details, text).';
COMMENT ON COLUMN public."GeneralQueryChatSession".output_payload IS 'Response from the AI, including any generated assets.';
COMMENT ON COLUMN public."ChapterChatSession".input_type IS 'Type of input provided by the user (text, pdf, image).';
COMMENT ON COLUMN public."ChapterChatSession".input_payload IS 'Data associated with the input (e.g., file details, text).';
COMMENT ON COLUMN public."ChapterChatSession".output_payload IS 'Response from the AI, including any generated assets.';

