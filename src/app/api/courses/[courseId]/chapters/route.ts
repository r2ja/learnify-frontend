import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
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

    const { courseId } = params;

    // First check if the user is enrolled in this course
    const enrollmentSql = `
      SELECT * FROM "CourseEnrollment"
      WHERE "courseId" = $1 AND "userId" = $2
    `;
    
    const enrollments = await query(enrollmentSql, [courseId, userId]);
    
    if (enrollments.length === 0) {
      return NextResponse.json(
        { error: 'You are not enrolled in this course' },
        { status: 403 }
      );
    }

    // Get chapters for the course
    const chaptersSql = `
      SELECT 
        c.id,
        c."courseId",
        c.name,
        c.description,
        c.content,
        c."createdAt",
        c."updatedAt",
        CASE WHEN ucp.completed IS TRUE THEN TRUE ELSE FALSE END as "completed",
        ucp."lastViewed"
      FROM "Chapter" c
      LEFT JOIN "UserChapterProgress" ucp ON c.id = ucp."chapterId" AND ucp."userId" = $2
      WHERE c."courseId" = $1
      ORDER BY c."createdAt" ASC
    `;

    const chapters = await query(chaptersSql, [courseId, userId]);

    return NextResponse.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters', details: error instanceof Error ? error.message : 'Unknown error' },
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