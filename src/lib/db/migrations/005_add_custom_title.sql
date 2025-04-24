-- Add customTitle column to CourseChat table
ALTER TABLE IF EXISTS "CourseChat" 
ADD COLUMN IF NOT EXISTS "customTitle" TEXT; 