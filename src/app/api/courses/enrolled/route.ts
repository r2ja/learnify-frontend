import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // First, verify if the user exists
    const userQuery = `SELECT id FROM "User" WHERE id = $1`;
    const userResult = await query(userQuery, [userId]);

    if (!userResult || userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Query to fetch enrolled courses with all necessary details
    const sql = `
      SELECT 
        c.*,
        true as "isEnrolled"
      FROM "_CourseToUser" cu
      INNER JOIN "Course" c ON cu."A" = c.id
      WHERE cu."B" = $1
      ORDER BY c."createdAt" DESC
    `;

    console.log('Executing enrolled courses query for userId:', userId);
    const enrolledCourses = await query(sql, [userId]);
    console.log(`Found ${enrolledCourses.length} enrolled courses:`, enrolledCourses);

    // Transform the response to match the expected format
    const formattedCourses = enrolledCourses.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      imageUrl: course.imageUrl,
      category: course.category,
      chapters: course.chapters,
      duration: course.duration,
      level: course.level,
      syllabus: course.syllabus,
      isEnrolled: true,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt
    }));

    return NextResponse.json(formattedCourses);
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrolled courses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 