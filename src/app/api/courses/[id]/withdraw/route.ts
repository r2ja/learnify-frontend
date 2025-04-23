import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

// DELETE /api/courses/[id]/withdraw
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: courseId } = params;
    
    let userId;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!courseId) {
      return new NextResponse(
        JSON.stringify({ error: 'Course ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Withdrawing user ${userId} from course ${courseId}`);

    // Check if enrollment exists
    const enrollmentCheckSql = `
      SELECT * FROM "CourseEnrollment" 
      WHERE "courseId" = $1 AND "userId" = $2
    `;
    
    const existingEnrollment = await query(enrollmentCheckSql, [courseId, userId]);
    
    if (existingEnrollment.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'User is not enrolled in this course' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Delete the enrollment
    const deleteSql = `
      DELETE FROM "CourseEnrollment"
      WHERE "courseId" = $1 AND "userId" = $2
      RETURNING *
    `;
    
    const result = await query(deleteSql, [courseId, userId]);
    
    if (result.length === 0) {
      throw new Error('Failed to withdraw from course');
    }
    
    console.log(`Successfully withdrew user ${userId} from course ${courseId}`);
    
    return new NextResponse(
      JSON.stringify({ message: 'Successfully withdrew from course' }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error withdrawing from course:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to withdraw from course', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 