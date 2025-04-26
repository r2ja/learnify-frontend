import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// GET /api/user/enrolled-courses
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
    const userId = payload?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // For now, return mock data for testing until the database is properly set up
    return NextResponse.json([
      {
        id: "a1c2e3f4-5678-4abc-9def-0123456789ab",
        title: "Introduction to Computer Science",
        description: "Learn the basics of computer science and programming",
        image_url: "/images/courses/cs-intro.jpg",
        chapters: [
          {
            id: "ch1-cs101", 
            title: "Getting Started with Programming",
            courseId: "a1c2e3f4-5678-4abc-9def-0123456789ab",
            description: "Learn about the fundamentals of programming",
            order: 1
          },
          {
            id: "ch2-cs101",
            title: "Variables and Data Types",
            courseId: "a1c2e3f4-5678-4abc-9def-0123456789ab",
            description: "Understanding variables and basic data types",
            order: 2
          }
        ]
      },
      {
        id: "b2d3e4f5-6789-5bcd-0def-1234567890bc",
        title: "Web Development Fundamentals",
        description: "Learn HTML, CSS, and JavaScript to build web applications",
        image_url: "/images/courses/web-dev.jpg",
        chapters: [
          {
            id: "ch1-webdev",
            title: "HTML Basics",
            courseId: "b2d3e4f5-6789-5bcd-0def-1234567890bc",
            description: "Introduction to HTML and document structure",
            order: 1
          },
          {
            id: "ch2-webdev",
            title: "CSS Styling",
            courseId: "b2d3e4f5-6789-5bcd-0def-1234567890bc",
            description: "Learn how to style your web pages with CSS",
            order: 2
          }
        ]
      }
    ]);

    /* Commented out until database is properly set up
    // Fetch enrolled courses for the user
    const sql = `
      SELECT c.id, c.title, c.description, c.image_url
      FROM "Course" c
      JOIN "Enrollment" e ON c.id = e."courseId"
      WHERE e."userId" = $1
      ORDER BY e."enrolledAt" DESC
    `;

    const courses = await query(sql, [userId]);
    
    // For each course, fetch its chapters
    for (const course of courses) {
      const chaptersSql = `
        SELECT id, title, "courseId", description, "order"
        FROM "Chapter"
        WHERE "courseId" = $1
        ORDER BY "order" ASC
      `;
      
      const chapters = await query(chaptersSql, [course.id]);
      course.chapters = chapters;
    }

    return NextResponse.json(courses);
    */
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrolled courses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to get cookie value
function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies[name] || null;
} 
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// GET /api/user/enrolled-courses
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
    const userId = payload?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // For now, return mock data for testing until the database is properly set up
    return NextResponse.json([
      {
        id: "a1c2e3f4-5678-4abc-9def-0123456789ab",
        title: "Introduction to Computer Science",
        description: "Learn the basics of computer science and programming",
        image_url: "/images/courses/cs-intro.jpg",
        chapters: [
          {
            id: "ch1-cs101", 
            title: "Getting Started with Programming",
            courseId: "a1c2e3f4-5678-4abc-9def-0123456789ab",
            description: "Learn about the fundamentals of programming",
            order: 1
          },
          {
            id: "ch2-cs101",
            title: "Variables and Data Types",
            courseId: "a1c2e3f4-5678-4abc-9def-0123456789ab",
            description: "Understanding variables and basic data types",
            order: 2
          }
        ]
      },
      {
        id: "b2d3e4f5-6789-5bcd-0def-1234567890bc",
        title: "Web Development Fundamentals",
        description: "Learn HTML, CSS, and JavaScript to build web applications",
        image_url: "/images/courses/web-dev.jpg",
        chapters: [
          {
            id: "ch1-webdev",
            title: "HTML Basics",
            courseId: "b2d3e4f5-6789-5bcd-0def-1234567890bc",
            description: "Introduction to HTML and document structure",
            order: 1
          },
          {
            id: "ch2-webdev",
            title: "CSS Styling",
            courseId: "b2d3e4f5-6789-5bcd-0def-1234567890bc",
            description: "Learn how to style your web pages with CSS",
            order: 2
          }
        ]
      }
    ]);

    /* Commented out until database is properly set up
    // Fetch enrolled courses for the user
    const sql = `
      SELECT c.id, c.title, c.description, c.image_url
      FROM "Course" c
      JOIN "Enrollment" e ON c.id = e."courseId"
      WHERE e."userId" = $1
      ORDER BY e."enrolledAt" DESC
    `;

    const courses = await query(sql, [userId]);
    
    // For each course, fetch its chapters
    for (const course of courses) {
      const chaptersSql = `
        SELECT id, title, "courseId", description, "order"
        FROM "Chapter"
        WHERE "courseId" = $1
        ORDER BY "order" ASC
      `;
      
      const chapters = await query(chaptersSql, [course.id]);
      course.chapters = chapters;
    }

    return NextResponse.json(courses);
    */
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrolled courses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to get cookie value
function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies[name] || null;
} 