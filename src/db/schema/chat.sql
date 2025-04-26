-- Chat System Schema

-- Create UserLearningProfile table
CREATE TABLE "UserLearningProfile" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "style" VARCHAR(50) NOT NULL DEFAULT 'conceptual',
    "depth" VARCHAR(50) NOT NULL DEFAULT 'beginner',
    "interaction" VARCHAR(50) NOT NULL DEFAULT 'examples',
    "preferredLanguage" VARCHAR(10) NOT NULL DEFAULT 'english',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId")
);

-- Create CourseChat table
CREATE TABLE "CourseChat" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "courseId" UUID NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
    "virtualChapterId" UUID REFERENCES "VirtualChapter"(id) ON DELETE SET NULL,
    "title" VARCHAR(255),
    "customTitle" VARCHAR(255),
    "language" VARCHAR(10) NOT NULL DEFAULT 'english',
    "learningProfile" JSONB NOT NULL DEFAULT '{
        "style": "conceptual",
        "depth": "beginner",
        "interaction": "examples"
    }',
    "lastContext" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ChatMessage table
CREATE TABLE "ChatMessage" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "chatId" UUID NOT NULL REFERENCES "CourseChat"(id) ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "messageType" VARCHAR(20) NOT NULL DEFAULT 'text',
    "isUser" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "metadata" JSONB,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indices
CREATE INDEX "idx_coursechat_userid" ON "CourseChat"("userId");
CREATE INDEX "idx_coursechat_courseid" ON "CourseChat"("courseId");
CREATE INDEX "idx_coursechat_chapterid" ON "CourseChat"("virtualChapterId");
CREATE INDEX "idx_coursechat_created" ON "CourseChat"("createdAt");
CREATE INDEX "idx_chatmessage_chatid" ON "ChatMessage"("chatId");
CREATE INDEX "idx_chatmessage_order" ON "ChatMessage"("order");
CREATE INDEX "idx_chatmessage_type" ON "ChatMessage"("messageType"); 