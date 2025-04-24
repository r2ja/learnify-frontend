import { db } from '@/lib/db';
import { ChatMessage } from '@/lib/types';

export const chatMessageRepository = {
  // Add a new message to a chat session
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
    const result = await db.query(
      `INSERT INTO chat_messages (session_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, role, content]
    );
    
    return result.rows[0];
  },

  // Get all messages for a session
  async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    const result = await db.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );
    
    return result.rows;
  },

  // Delete all messages for a session
  async deleteMessagesBySession(sessionId: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM chat_messages WHERE session_id = $1`,
      [sessionId]
    );
    
    return result.rowCount > 0;
  }
}; 