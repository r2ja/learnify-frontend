import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '@/lib/db';
import { User, Course } from './types';

export interface EnrollmentProgressSummary {
  courseId: string;
  userId: string;
  progress: number;
  lastChapterId: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface EnrollmentWithCourse extends EnrollmentProgressSummary {
  course: Course;
}

export interface EnrollmentWithUser extends EnrollmentProgressSummary {
  user: User;
}

export const enrollmentRepository = {
  /**
   * Enroll a user in a course
   */
  async enrollUserInCourse(userId: string, courseId: string): Promise<void> {
    try {
      // First, check if the user is already enrolled
      const checkEnrollmentSql = `
        SELECT * FROM "_CourseToUser"
        WHERE "A" = $1 AND "B" = $2
      `;
      
      const enrollments = await query(checkEnrollmentSql, [userId, courseId]);
      
      if (enrollments.length === 0) {
        // Not enrolled, so create the enrollment
        await transaction(async (executeTransaction) => {
          // Create the enrollment relation
          const enrollSql = `
            INSERT INTO "_CourseToUser" ("A", "B")
            VALUES ($1, $2)
          `;
          
          await executeTransaction(enrollSql, [userId, courseId]);
          
          // Initialize the progress tracking
          const now = new Date();
          const createProgressSql = `
            INSERT INTO "UserCourseProgress" (
              "id", "userId", "courseId", "progress", 
              "isCompleted", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;
          
          await executeTransaction(createProgressSql, [
            uuidv4(),
            userId,
            courseId,
            0, // Initial progress 0%
            false, // Not completed
            now,
            now
          ]);
        });
      }
    } catch (error) {
      console.error('Error enrolling user in course:', error);
      throw error;
    }
  },
  
  /**
   * Unenroll a user from a course
   */
  async unenrollUserFromCourse(userId: string, courseId: string): Promise<void> {
    try {
      await transaction(async (executeTransaction) => {
        // Delete the progress tracking
        const deleteProgressSql = `
          DELETE FROM "UserCourseProgress"
          WHERE "userId" = $1 AND "courseId" = $2
        `;
        
        await executeTransaction(deleteProgressSql, [userId, courseId]);
        
        // Delete the enrollment relation
        const unenrollSql = `
          DELETE FROM "_CourseToUser"
          WHERE "A" = $1 AND "B" = $2
        `;
        
        await executeTransaction(unenrollSql, [userId, courseId]);
      });
    } catch (error) {
      console.error('Error unenrolling user from course:', error);
      throw error;
    }
  },
  
  /**
   * Update a user's progress in a course
   */
  async updateProgress(
    userId: string, 
    courseId: string, 
    progress: number, 
    lastChapterId?: string,
    isCompleted?: boolean
  ): Promise<void> {
    try {
      const updates = [];
      const params = [progress, userId, courseId];
      let paramIndex = 4;
      
      let updateSql = `
        UPDATE "UserCourseProgress"
        SET "progress" = $1, "updatedAt" = CURRENT_TIMESTAMP
      `;
      
      if (lastChapterId) {
        updateSql += `, "lastChapterId" = $${paramIndex}`;
        params.push(lastChapterId);
        paramIndex++;
      }
      
      if (isCompleted !== undefined) {
        updateSql += `, "isCompleted" = $${paramIndex}`;
        params.push(isCompleted);
        paramIndex++;
        
        if (isCompleted) {
          updateSql += `, "completedAt" = CURRENT_TIMESTAMP`;
        }
      }
      
      updateSql += ` WHERE "userId" = $2 AND "courseId" = $3`;
      
      await query(updateSql, params);
    } catch (error) {
      console.error('Error updating course progress:', error);
      throw error;
    }
  },
  
  /**
   * Get courses a user is enrolled in
   */
  async getEnrolledCourses(userId: string): Promise<EnrollmentWithCourse[]> {
    try {
      const sql = `
        SELECT 
          c.*,
          p."progress",
          p."lastChapterId",
          p."isCompleted",
          p."completedAt"
        FROM "Course" c
        JOIN "_CourseToUser" e ON c."id" = e."B"
        LEFT JOIN "UserCourseProgress" p ON p."courseId" = c."id" AND p."userId" = e."A"
        WHERE e."A" = $1
        ORDER BY p."updatedAt" DESC
      `;
      
      const results = await query(sql, [userId]);
      
      return results.map(row => {
        const course: Course = {
          id: row.id,
          title: row.title,
          description: row.description,
          image: row.image,
          instructorId: row.instructorId,
          syllabus: row.syllabus,
          level: row.level,
          duration: row.duration,
          isPublished: row.isPublished,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
        
        // Parse syllabus if it's a string
        if (typeof course.syllabus === 'string') {
          try {
            course.syllabus = JSON.parse(course.syllabus);
          } catch (err) {
            console.error('Error parsing syllabus JSON:', err);
          }
        }
        
        return {
          courseId: row.id,
          userId,
          progress: row.progress || 0,
          lastChapterId: row.lastChapterId,
          isCompleted: row.isCompleted || false,
          completedAt: row.completedAt,
          course
        };
      });
    } catch (error) {
      console.error('Error getting enrolled courses:', error);
      throw error;
    }
  },
  
  /**
   * Get users enrolled in a course
   */
  async getEnrolledUsers(courseId: string): Promise<EnrollmentWithUser[]> {
    try {
      const sql = `
        SELECT 
          u.*,
          p."progress",
          p."lastChapterId",
          p."isCompleted",
          p."completedAt"
        FROM "User" u
        JOIN "_CourseToUser" e ON u."id" = e."A"
        LEFT JOIN "UserCourseProgress" p ON p."userId" = u."id" AND p."courseId" = e."B"
        WHERE e."B" = $1
        ORDER BY u."name" ASC
      `;
      
      const results = await query(sql, [courseId]);
      
      return results.map(row => {
        const user: User = {
          id: row.id,
          name: row.name,
          email: row.email,
          password: null, // Don't expose password
          image: row.image,
          role: row.role,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
        
        return {
          courseId,
          userId: row.id,
          progress: row.progress || 0,
          lastChapterId: row.lastChapterId,
          isCompleted: row.isCompleted || false,
          completedAt: row.completedAt,
          user
        };
      });
    } catch (error) {
      console.error('Error getting enrolled users:', error);
      throw error;
    }
  },
  
  /**
   * Check if a user is enrolled in a course
   */
  async isUserEnrolled(userId: string, courseId: string): Promise<boolean> {
    try {
      const sql = `
        SELECT COUNT(*) as count
        FROM "_CourseToUser"
        WHERE "A" = $1 AND "B" = $2
      `;
      
      const result = await query(sql, [userId, courseId]);
      
      return result[0].count > 0;
    } catch (error) {
      console.error('Error checking enrollment:', error);
      throw error;
    }
  },
  
  /**
   * Get the progress for a specific user in a specific course
   */
  async getUserCourseProgress(userId: string, courseId: string): Promise<EnrollmentProgressSummary | null> {
    try {
      const sql = `
        SELECT * FROM "UserCourseProgress"
        WHERE "userId" = $1 AND "courseId" = $2
      `;
      
      const results = await query(sql, [userId, courseId]);
      
      if (results.length === 0) {
        return null;
      }
      
      const row = results[0];
      
      return {
        courseId,
        userId,
        progress: row.progress || 0,
        lastChapterId: row.lastChapterId,
        isCompleted: row.isCompleted || false,
        completedAt: row.completedAt
      };
    } catch (error) {
      console.error('Error getting course progress:', error);
      throw error;
    }
  }
}; 