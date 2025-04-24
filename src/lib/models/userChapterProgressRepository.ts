import { sql } from "@vercel/postgres";
import { Chapter } from "./chapterRepository";

export interface UserChapterProgress {
  id: string;
  userId: string;
  courseId: string;
  chapterId: string;
  completed: boolean;
  lastViewed: Date;
}

export interface ChapterProgress {
  totalChapters: number;
  completedChapters: number;
  chapters: (Chapter & { completed: boolean })[];
}

export const userChapterProgressRepository = {
  async getProgress(userId: string, courseId: string): Promise<ChapterProgress> {
    const result = await sql`
      WITH ChapterStats AS (
        SELECT 
          c."id",
          c."title",
          c."description",
          c."courseId",
          c."position",
          COALESCE(ucp."completed", false) as "completed"
        FROM "Chapter" c
        LEFT JOIN "UserChapterProgress" ucp 
          ON c."id" = ucp."chapterId" 
          AND ucp."userId" = ${userId}
        WHERE c."courseId" = ${courseId}
        ORDER BY c."position"
      )
      SELECT 
        COUNT(*) as "totalChapters",
        COUNT(*) FILTER (WHERE "completed" = true) as "completedChapters",
        json_agg(ChapterStats.*) as "chapters"
      FROM ChapterStats;
    `;

    const stats = result.rows[0];
    return {
      totalChapters: parseInt(stats.totalChapters),
      completedChapters: parseInt(stats.completedChapters),
      chapters: stats.chapters || []
    };
  },

  async markChapterComplete(userId: string, chapterId: string): Promise<void> {
    await sql`
      INSERT INTO "UserChapterProgress" ("userId", "courseId", "chapterId", "completed", "lastViewed")
      SELECT ${userId}, c."courseId", ${chapterId}, true, CURRENT_TIMESTAMP
      FROM "Chapter" c
      WHERE c."id" = ${chapterId}
      ON CONFLICT ("userId", "chapterId") 
      DO UPDATE SET 
        "completed" = true,
        "lastViewed" = CURRENT_TIMESTAMP;
    `;
  },

  async updateLastViewed(userId: string, chapterId: string): Promise<void> {
    await sql`
      INSERT INTO "UserChapterProgress" ("userId", "courseId", "chapterId", "lastViewed")
      SELECT ${userId}, c."courseId", ${chapterId}, CURRENT_TIMESTAMP
      FROM "Chapter" c
      WHERE c."id" = ${chapterId}
      ON CONFLICT ("userId", "chapterId") 
      DO UPDATE SET "lastViewed" = CURRENT_TIMESTAMP;
    `;
  }
}; 