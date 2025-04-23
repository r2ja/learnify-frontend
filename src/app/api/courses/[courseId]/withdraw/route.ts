import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface RouteParams {
  params: {
    courseId: string;
  };
}

// DELETE /api/courses/[courseId]/withdraw
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { courseId } = params;
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
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!courseId) {
      return new NextResponse(
        JSON.stringify({ error: 'Course ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Withdrawing user ${userId} from course ${courseId}`);

    // Check if enrollment exists
    const checkSql = `
      SELECT * FROM "CourseEnrollment"
      WHERE "courseId" = $1 AND "userId" = $2
    `;
    const existingEnrollment = await query(checkSql, [courseId, userId]);
    if (existingEnrollment.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'User is not enrolled in this course' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
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

    return new NextResponse(
      JSON.stringify({ message: 'Successfully withdrew from course', success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error withdrawing from course:', error);
    return new NextResponse(
      JSON.stringify({
        error: 'Failed to withdraw from course',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 