CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for chat sessions per chapter
CREATE TABLE IF NOT EXISTS "ChapterChatSession" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
    "chapterId" TEXT NOT NULL REFERENCES "Chapter"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for individual chat messages
CREATE TABLE IF NOT EXISTS "ChapterChatMessage" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId" UUID NOT NULL REFERENCES "ChapterChatSession"("id") ON DELETE CASCADE,
    "sender" TEXT NOT NULL CHECK ("sender" IN ('user', 'assistant')),
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX "ChapterChatSession_userId_idx" ON "ChapterChatSession"("userId");
CREATE INDEX "ChapterChatSession_courseId_idx" ON "ChapterChatSession"("courseId");
CREATE INDEX "ChapterChatSession_chapterId_idx" ON "ChapterChatSession"("chapterId");
CREATE INDEX "ChapterChatMessage_sessionId_idx" ON "ChapterChatMessage"("sessionId");

-- Add a trigger to update the updatedAt field whenever a message is added to a session
CREATE OR REPLACE FUNCTION update_chapter_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "ChapterChatSession" 
    SET "updatedAt" = CURRENT_TIMESTAMP 
    WHERE "id" = NEW."sessionId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chapter_chat_session_timestamp
AFTER INSERT ON "ChapterChatMessage"
FOR EACH ROW
EXECUTE FUNCTION update_chapter_chat_session_timestamp(); 