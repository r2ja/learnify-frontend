import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    // Properly destructure the params object
    const { courseId } = params;
    const { userId } = await request.json();

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if course exists
    const courseCheck = await query(
      'SELECT id FROM "Course" WHERE id = $1',
      [courseId]
    );

    if (courseCheck.length === 0) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Check if user exists
    const userCheck = await query(
      'SELECT id FROM "User" WHERE id = $1',
      [userId]
    );

    if (userCheck.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already enrolled
    const enrollmentCheck = await query(
      'SELECT * FROM "_CourseToUser" WHERE "A" = $1 AND "B" = $2',
      [courseId, userId]
    );

    if (enrollmentCheck.length > 0) {
      return NextResponse.json(
        { error: 'User is already enrolled in this course' },
        { status: 400 }
      );
    }

    // Enroll the user in the course
    await query(
      'INSERT INTO "_CourseToUser" ("A", "B") VALUES ($1, $2)',
      [courseId, userId]
    );

    return NextResponse.json(
      { message: 'Successfully enrolled in course' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error enrolling in course:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 