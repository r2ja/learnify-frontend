import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../db';
import { 
  Course, 
  CourseCreateInput,
  User
} from './types';

export const courseRepository = {
  /**
   * Find all courses with optional filtering
   */
  async findMany({ 
    select, 
    take, 
    skip,
    userId 
  }: { 
    select?: Record<string, boolean>, 
    take?: number, 
    skip?: number,
    userId?: string
  } = {}): Promise<Course[]> {
    // If select is provided, make sure each column name is properly quoted
    let fields;
    if (select) {
      fields = Object.keys(select)
        .filter(key => select[key])
        .map(key => `"${key}"`)
        .join(', ');
    } else {
      fields = 'c.*';
    }
    
    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';
    
    let sql;
    if (userId) {
      sql = `
        SELECT ${fields}, 
               CASE WHEN ce."userId" IS NOT NULL THEN true ELSE false END as "isEnrolled"
        FROM "Course" c
        LEFT JOIN "CourseEnrollment" ce ON c.id = ce."courseId" AND ce."userId" = $1
        ${limitClause}
        ${offsetClause}
      `;
      return await query<Course>(sql, [userId]);
    } else {
      sql = `
        SELECT ${fields}
        FROM "Course" c
        ${limitClause}
        ${offsetClause}
      `;
      return await query<Course>(sql);
    }
  },

  /**
   * Find a course by its unique ID
   */
  async findUnique({ 
    where, 
    select, 
    include 
  }: { 
    where: { id: string }, 
    select?: Record<string, boolean>,
    include?: { students?: boolean }
  }): Promise<Course & { students?: User[] } | null> {
    // If select is provided, make sure each column name is properly quoted
    let fields;
    if (select) {
      fields = Object.keys(select)
        .filter(key => select[key])
        .map(key => `"${key}"`)
        .join(', ');
    } else {
      fields = '*';
    }
    
    const sql = `
      SELECT ${fields}
      FROM "Course"
      WHERE "id" = $1
    `;
    
    const courses = await query<Course>(sql, [where.id]);
    
    if (courses.length === 0) {
      return null;
    }
    
    const course = courses[0] as Course & { students?: User[] };
    
    // Fetch related data if requested
    if (include) {
      // Fetch enrolled students
      if (include.students) {
        const studentsSql = `
          SELECT u.*
          FROM "User" u
          JOIN "CourseEnrollment" ce ON u.id = ce."userId"
          WHERE ce."courseId" = $1
        `;
        
        const students = await query<User>(studentsSql, [course.id]);
        course.students = students;
      }
    }
    
    return course;
  },

  /**
   * Create a new course
   */
  async create({ 
    data 
  }: { 
    data: CourseCreateInput 
  }): Promise<Course> {
    const id = uuidv4();
    const now = new Date();
    
    // Handle syllabus JSON conversion
    let dataToInsert = { ...data };
    if (dataToInsert.syllabus && typeof dataToInsert.syllabus === 'object') {
      dataToInsert.syllabus = JSON.stringify(dataToInsert.syllabus);
    }
    
    const fields = Object.keys(dataToInsert) as Array<keyof CourseCreateInput>;
    const placeholders = fields.map((_, i) => `$${i + 4}`);
    const values = fields.map(field => dataToInsert[field]);
    
    const sql = `
      INSERT INTO "Course" (
        "id", 
        "createdAt", 
        "updatedAt",
        ${fields.map(f => `"${String(f)}"`).join(', ')}
      )
      VALUES (
        $1, $2, $3, ${placeholders.join(', ')}
      )
      RETURNING *
    `;
    
    const courses = await query<Course>(sql, [id, now, now, ...values]);
    return courses[0];
  },

  /**
   * Update an existing course
   */
  async update({ 
    where, 
    data 
  }: { 
    where: { id: string }, 
    data: Partial<CourseCreateInput> 
  }): Promise<Course> {
    const { id } = where;
    let updateData = { ...data, updatedAt: new Date() };
    
    // Handle syllabus JSON conversion
    if (updateData.syllabus && typeof updateData.syllabus === 'object') {
      updateData.syllabus = JSON.stringify(updateData.syllabus);
    }
    
    const fields = Object.keys(updateData) as Array<keyof typeof updateData>;
    const setClauses = fields.map((field, i) => `"${String(field)}" = $${i + 2}`);
    const values = fields.map(field => updateData[field]);
    
    const sql = `
      UPDATE "Course"
      SET ${setClauses.join(', ')}
      WHERE "id" = $1
      RETURNING *
    `;
    
    const courses = await query<Course>(sql, [id, ...values]);
    
    if (courses.length === 0) {
      throw new Error(`Course with id ${id} not found`);
    }
    
    return courses[0];
  },

  /**
   * Delete a course
   */
  async delete({ 
    where 
  }: { 
    where: { id: string } 
  }): Promise<Course> {
    return await transaction(async (client) => {
      const { id } = where;
      
      // Delete enrollments
      await client.query('DELETE FROM "CourseEnrollment" WHERE "courseId" = $1', [id]);
      
      // Delete chapters
      await client.query('DELETE FROM "Chapter" WHERE "courseId" = $1', [id]);
      
      // Delete chat sessions
      await client.query('DELETE FROM "GeneralQueryChatSession" WHERE "courseId" = $1', [id]);
      
      // Delete quiz instances
      await client.query('DELETE FROM "QuizInstance" WHERE "courseId" = $1', [id]);
      
      // Finally delete the course
      const result = await client.query('DELETE FROM "Course" WHERE "id" = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        throw new Error(`Course with id ${id} not found`);
      }
      
      return result.rows[0];
    });
  },
  
  /**
   * Enroll a user in a course
   */
  async enroll({ 
    courseId, 
    userId 
  }: { 
    courseId: string, 
    userId: string 
  }): Promise<void> {
    const sql = `
      INSERT INTO "CourseEnrollment" ("courseId", "userId")
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `;
    
    await query(sql, [courseId, userId]);
  },
  
  /**
   * Unenroll a user from a course
   */
  async unenroll({ 
    courseId, 
    userId 
  }: { 
    courseId: string, 
    userId: string 
  }): Promise<void> {
    const sql = `
      DELETE FROM "CourseEnrollment"
      WHERE "courseId" = $1 AND "userId" = $2
    `;
    
    await query(sql, [courseId, userId]);
  }
}; 