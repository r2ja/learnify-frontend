import { NextResponse } from 'next/server';
import { courseRepository } from '@/lib/models/courseRepository';
import { query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    const course = await courseRepository.findUnique({
      where: {
        id: courseId,
      },
      include: {
        students: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // If userId is provided, check if the user is enrolled
    if (userId) {
      const enrollmentCheck = await query(
        'SELECT * FROM "CourseEnrollment" WHERE "courseId" = $1 AND "userId" = $2',
        [courseId, userId]
      );
      
      return NextResponse.json({
        ...course,
        isEnrolled: enrollmentCheck.length > 0
      });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const body = await request.json();
    const { courseId } = params;

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    const updatedCourse = await courseRepository.update({
      where: {
        id: courseId,
      },
      data: body,
    });

    return NextResponse.json(updatedCourse, { status: 200 });
  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    await courseRepository.delete({
      where: {
        id: courseId,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 