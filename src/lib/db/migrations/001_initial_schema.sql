-- Create Course table
CREATE TABLE IF NOT EXISTS "Course" (
  "id" UUID PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "imageUrl" VARCHAR(255),
  "category" VARCHAR(100) NOT NULL,
  "chapters" INTEGER NOT NULL,
  "duration" VARCHAR(50) NOT NULL,
  "level" VARCHAR(50) NOT NULL,
  "syllabus" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY,
  "name" VARCHAR(255),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "password" VARCHAR(255),
  "image" VARCHAR(255),
  "role" VARCHAR(50) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create Course-User junction table for enrollments
CREATE TABLE IF NOT EXISTS "_CourseToUser" (
  "A" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "B" UUID NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  PRIMARY KEY ("A", "B")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_course_category" ON "Course"("category");
CREATE INDEX IF NOT EXISTS "idx_user_email" ON "User"("email");
CREATE INDEX IF NOT EXISTS "idx_course_user_a" ON "_CourseToUser"("A");
CREATE INDEX IF NOT EXISTS "idx_course_user_b" ON "_CourseToUser"("B"); 