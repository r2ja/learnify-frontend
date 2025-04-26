-- Migration: Add Chat System (UP)
BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing tables if they exist (careful with this in production)
DROP TABLE IF EXISTS "ChatMessage" CASCADE;
DROP TABLE IF EXISTS "CourseChat" CASCADE;

-- Create CourseChat table
CREATE TABLE "CourseChat" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "virtualChapterId" TEXT,
    "title" VARCHAR(255),
    "customTitle" VARCHAR(255),
    "language" VARCHAR(10) NOT NULL DEFAULT 'english',
    "learningProfileId" TEXT NOT NULL,
    "lastContext" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_course_chat_user"
        FOREIGN KEY ("userId")
        REFERENCES "User"(id)
        ON DELETE CASCADE,
    CONSTRAINT "fk_course_chat_course"
        FOREIGN KEY ("courseId")
        REFERENCES "Course"(id)
        ON DELETE CASCADE,
    CONSTRAINT "fk_course_chat_learning_profile"
        FOREIGN KEY ("learningProfileId")
        REFERENCES "LearningProfile"(id)
        ON DELETE CASCADE
);

-- Create ChatMessage table
CREATE TABLE "ChatMessage" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "chatId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" VARCHAR(20) NOT NULL DEFAULT 'text',
    "isUser" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "metadata" JSONB,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_chat_message"
        FOREIGN KEY ("chatId")
        REFERENCES "CourseChat"(id)
        ON DELETE CASCADE
);

-- Create indices
CREATE INDEX "idx_coursechat_userid" ON "CourseChat"("userId");
CREATE INDEX "idx_coursechat_courseid" ON "CourseChat"("courseId");
CREATE INDEX "idx_coursechat_learningprofileid" ON "CourseChat"("learningProfileId");
CREATE INDEX "idx_coursechat_created" ON "CourseChat"("createdAt");
CREATE INDEX "idx_chatmessage_chatid" ON "ChatMessage"("chatId");
CREATE INDEX "idx_chatmessage_order" ON "ChatMessage"("order");
CREATE INDEX "idx_chatmessage_type" ON "ChatMessage"("messageType");

-- Create triggers for updating timestamps
CREATE TRIGGER update_course_chat_modtime
    BEFORE UPDATE ON "CourseChat"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_message_modtime
    BEFORE UPDATE ON "ChatMessage"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE "CourseChat" IS 'Main chat session table linking users, courses, and learning profiles';
COMMENT ON TABLE "ChatMessage" IS 'Individual messages within a chat session';

COMMENT ON COLUMN "CourseChat"."metadata" IS 'Example metadata structure:
{
    "sessionStats": {
        "messageCount": 10,
        "userMessageCount": 5,
        "aiMessageCount": 5,
        "lastInteraction": "2024-02-20T12:00:00Z"
    },
    "contextHistory": [
        {
            "timestamp": "2024-02-20T12:00:00Z",
            "context": "Previous relevant context..."
        }
    ]
}';

COMMENT ON COLUMN "ChatMessage"."metadata" IS 'Example metadata structure:
{
    "mermaid": {
        "diagram": "graph TD; A-->B;",
        "title": "Class Hierarchy"
    },
    "code": {
        "language": "python",
        "filename": "example.py"
    },
    "image": {
        "url": "generated_image_url",
        "alt": "Description"
    }
}';

COMMIT;

-- Migration: Remove Chat System (DOWN)
-- To be run if we need to rollback the changes
/*
BEGIN;

DROP TABLE IF EXISTS "ChatMessage" CASCADE;
DROP TABLE IF EXISTS "CourseChat" CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

COMMIT;
*/ 