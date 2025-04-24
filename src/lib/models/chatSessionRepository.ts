import { db } from '@/lib/db';
import { ChatSession } from '@/lib/types';

export const chatSessionRepository = {
  // Create a new chat session
  async createSession(userId: string, chapterId: string, title: string): Promise<ChatSession> {
    const result = await db.query(
      `INSERT INTO chat_sessions (user_id, chapter_id, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, chapterId, title]
    );
    
    return result.rows[0];
  },

  // Get all sessions for a user and chapter
  async getSessionsByChapter(userId: string, chapterId: string): Promise<ChatSession[]> {
    const result = await db.query(
      `SELECT * FROM chat_sessions
       WHERE user_id = $1 AND chapter_id = $2
       ORDER BY updated_at DESC`,
      [userId, chapterId]
    );
    
    return result.rows;
  },

  // Get a specific session by ID
  async getSessionById(sessionId: string): Promise<ChatSession | null> {
    const result = await db.query(
      `SELECT * FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );
    
    return result.rows[0] || null;
  },

  // Update a session's title or update the updated_at timestamp
  async updateSession(sessionId: string, title?: string): Promise<ChatSession | null> {
    let query = '';
    const params = [];
    
    if (title) {
      query = `UPDATE chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      params.push(title, sessionId);
    } else {
      query = `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 RETURNING *`;
      params.push(sessionId);
    }
    
    const result = await db.query(query, params);
    return result.rows[0] || null;
  },

  // Delete a session
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM chat_sessions WHERE id = $1 RETURNING id`,
      [sessionId]
    );
    
    return result.rowCount > 0;
  }
}; 