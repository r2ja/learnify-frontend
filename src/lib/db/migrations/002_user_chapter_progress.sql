CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "UserChapterProgress" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
    "chapterId" TEXT NOT NULL REFERENCES "Chapter"("id") ON DELETE CASCADE,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastViewed" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "chapterId")
);

-- Create indexes for better query performance
CREATE INDEX "UserChapterProgress_userId_idx" ON "UserChapterProgress"("userId");
CREATE INDEX "UserChapterProgress_courseId_idx" ON "UserChapterProgress"("courseId");
CREATE INDEX "UserChapterProgress_chapterId_idx" ON "UserChapterProgress"("chapterId"); 