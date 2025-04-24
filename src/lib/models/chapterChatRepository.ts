import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

export interface ChatSession {
  id: string;
  userId: string;
  chapterId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
}

export interface CreateSessionParams {
  userId: string;
  chapterId: string;
  title: string;
}

export interface CreateMessageParams {
  sessionId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
}

export class ChapterChatRepository {
  async getSessionsByChapterAndUser(
    chapterId: string,
    userId: string
  ): Promise<ChatSession[]> {
    const { rows } = await sql`
      SELECT * FROM chat_sessions
      WHERE chapter_id = ${chapterId} AND user_id = ${userId}
      ORDER BY updated_at DESC
    `;

    return rows.map(this.mapDbSessionToModel);
  }

  async getSessionById(sessionId: string): Promise<ChatSession | null> {
    const { rows } = await sql`
      SELECT * FROM chat_sessions
      WHERE id = ${sessionId}
    `;

    if (rows.length === 0) return null;
    return this.mapDbSessionToModel(rows[0]);
  }

  async createSession(params: CreateSessionParams): Promise<ChatSession> {
    const { rows } = await sql`
      INSERT INTO chat_sessions (
        user_id, chapter_id, title
      ) VALUES (
        ${params.userId}, ${params.chapterId}, ${params.title}
      )
      RETURNING *
    `;

    return this.mapDbSessionToModel(rows[0]);
  }

  async updateSessionTitle(
    sessionId: string,
    title: string
  ): Promise<ChatSession | null> {
    const { rows } = await sql`
      UPDATE chat_sessions
      SET title = ${title}, updated_at = NOW()
      WHERE id = ${sessionId}
      RETURNING *
    `;

    if (rows.length === 0) return null;
    return this.mapDbSessionToModel(rows[0]);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    // First delete messages
    await sql`
      DELETE FROM chat_messages
      WHERE session_id = ${sessionId}
    `;

    // Then delete the session
    const { rowCount } = await sql`
      DELETE FROM chat_sessions
      WHERE id = ${sessionId}
    `;

    return rowCount > 0;
  }

  async getMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    const { rows } = await sql`
      SELECT * FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;

    return rows.map(this.mapDbMessageToModel);
  }

  async createMessage(params: CreateMessageParams): Promise<ChatMessage> {
    // Update the session's updated_at timestamp
    await sql`
      UPDATE chat_sessions
      SET updated_at = NOW()
      WHERE id = ${params.sessionId}
    `;

    const { rows } = await sql`
      INSERT INTO chat_messages (
        session_id, content, role
      ) VALUES (
        ${params.sessionId}, ${params.content}, ${params.role}
      )
      RETURNING *
    `;

    return this.mapDbMessageToModel(rows[0]);
  }

  private mapDbSessionToModel(dbSession: any): ChatSession {
    return {
      id: dbSession.id,
      userId: dbSession.user_id,
      chapterId: dbSession.chapter_id,
      title: dbSession.title,
      createdAt: dbSession.created_at,
      updatedAt: dbSession.updated_at
    };
  }

  private mapDbMessageToModel(dbMessage: any): ChatMessage {
    return {
      id: dbMessage.id,
      sessionId: dbMessage.session_id,
      content: dbMessage.content,
      role: dbMessage.role,
      createdAt: dbMessage.created_at
    };
  }
} 