import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../db';
import { 
  User, 
  UserCreateInput, 
  UserSelect,
  LearningProfile
} from './types';

export const userRepository = {
  /**
   * Find all users with optional filtering
   */
  async findMany({ 
    select, 
    take, 
    skip,
    where 
  }: { 
    select?: UserSelect, 
    take?: number, 
    skip?: number,
    where?: { email?: string }
  } = {}): Promise<User[]> {
    // If select is provided, make sure each column name is properly quoted
    let fields;
    if (select) {
      fields = Object.keys(select)
        .filter(key => select[key as keyof UserSelect])
        .map(key => `"${key}"`)
        .join(', ');
    } else {
      fields = '*';
    }
    
    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';
    
    let whereClause = '';
    const params: any[] = [];
    
    if (where?.email) {
      whereClause = 'WHERE "email" = $1';
      params.push(where.email);
    }
    
    const sql = `
      SELECT ${fields}
      FROM "User"
      ${whereClause}
      ${limitClause}
      ${offsetClause}
    `;
    
    return await query<User>(sql, params);
  },

  /**
   * Find a user by their unique ID
   */
  async findUnique({ 
    where, 
    select 
  }: { 
    where: { id: string } | { email: string }, 
    select?: UserSelect 
  }): Promise<User | null> {
    // If select is provided, make sure each column name is properly quoted
    let fields;
    if (select) {
      fields = Object.keys(select)
        .filter(key => select[key as keyof UserSelect])
        .map(key => `"${key}"`)
        .join(', ');
    } else {
      fields = '*';
    }
    
    const whereField = 'id' in where ? 'id' : 'email';
    const sql = `
      SELECT ${fields}
      FROM "User"
      WHERE "${whereField}" = $1
    `;
    
    const users = await query<User>(sql, [where[whereField]]);
    return users.length > 0 ? users[0] : null;
  },

  /**
   * Create a new user
   */
  async create({ 
    data 
  }: { 
    data: UserCreateInput 
  }): Promise<User> {
    const id = uuidv4();
    const now = new Date();
    
    const sql = `
      INSERT INTO "User" (
        "id", 
        "name", 
        "email", 
        "password", 
        "image", 
        "language",
        "createdAt", 
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const users = await query<User>(sql, [
      id,
      data.name,
      data.email,
      data.password,
      data.image,
      data.language || 'english',
      now,
      now
    ]);
    
    return users[0];
  },

  /**
   * Update an existing user
   */
  async update({ 
    where, 
    data 
  }: { 
    where: { id: string }, 
    data: Partial<UserCreateInput> 
  }): Promise<User> {
    const { id } = where;
    const updateData = { ...data, updatedAt: new Date() };
    
    const fields = Object.keys(updateData) as Array<keyof typeof updateData>;
    const setClauses = fields.map((field, i) => `"${field}" = $${i + 2}`);
    const values = fields.map(field => updateData[field]);
    
    const sql = `
      UPDATE "User"
      SET ${setClauses.join(', ')}
      WHERE "id" = $1
      RETURNING *
    `;
    
    const users = await query<User>(sql, [id, ...values]);
    
    if (users.length === 0) {
      throw new Error(`User with id ${id} not found`);
    }
    
    return users[0];
  },

  /**
   * Delete a user
   */
  async delete({ 
    where 
  }: { 
    where: { id: string } 
  }): Promise<User> {
    return await transaction(async (client) => {
      const { id } = where;
      
      // First, delete related records
      await client.query('DELETE FROM "CourseEnrollment" WHERE "userId" = $1', [id]);
      await client.query('DELETE FROM "LearningProfile" WHERE "userId" = $1', [id]);
      await client.query('DELETE FROM "QuizInstance" WHERE "userId" = $1', [id]);
      await client.query('DELETE FROM "QuizResponse" WHERE "userId" = $1', [id]);
      await client.query('DELETE FROM "GeneralQueryChatSession" WHERE "userId" = $1', [id]);
      
      // Then delete the user
      const result = await client.query('DELETE FROM "User" WHERE "id" = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        throw new Error(`User with id ${id} not found`);
      }
      
      return result.rows[0];
    });
  }
}; 