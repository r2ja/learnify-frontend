import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: Request) {
  try {
    // Get the auth token from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const authToken = getCookieValue(cookieHeader, 'auth_token');

    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token to get the user ID
    const payload = verifyToken(authToken);
    const userId = payload.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Query to fetch enrolled courses with all necessary details including syllabus
    const sql = `
      SELECT 
        c.*
      FROM "CourseEnrollment" ce
      INNER JOIN "Course" c ON ce."courseId" = c.id
      WHERE ce."userId" = $1
      ORDER BY c."createdAt" DESC
    `;

    const enrolledCourses = await query(sql, [userId]);

    // Transform the response to format syllabus properly
    const formattedCourses = enrolledCourses.map(course => {
      // Parse the syllabus JSON if it exists
      let syllabus = null;
      if (course.syllabus) {
        try {
          // Parse the syllabus string to JSON if it's a string
          const parsedSyllabus = typeof course.syllabus === 'string' 
            ? JSON.parse(course.syllabus) 
            : course.syllabus;
          
          // Extract chapters from syllabus
          syllabus = parsedSyllabus.chapters || [];
        } catch (e) {
          console.error('Error parsing syllabus JSON:', e);
          syllabus = [];
        }
      }

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        imageUrl: course.imageUrl,
        category: course.category,
        chapters: course.chapters,
        level: course.level,
        syllabus: syllabus,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      };
    });

    return NextResponse.json(formattedCourses);
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrolled courses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to extract cookie value
function getCookieValue(cookieString: string, cookieName: string): string | null {
  const cookies = cookieString.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName) {
      return value;
    }
  }
  return null;
} 