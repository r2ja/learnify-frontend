import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// GET /api/learning-profiles?userId=userId
export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

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
    const requestUserId = payload?.userId;

    if (!requestUserId || requestUserId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only access your own learning profiles' },
        { status: 403 }
      );
    }

    // Return mock data for testing
    return NextResponse.json([
      {
        id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        userId: userId,
        processingStyle: 'visual',
        understandingStyle: 'logical',
        perceptionStyle: 'global',
        inputStyle: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
        userId: userId,
        processingStyle: 'verbal',
        understandingStyle: 'intuitive',
        perceptionStyle: 'sequential',
        inputStyle: 'reflective',
        createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ]);

    /* Commented out until database is properly set up
    // Fetch learning profiles for the user
    const sql = `
      SELECT * FROM "UserLearningProfile"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
    `;

    const profiles = await query(sql, [userId]);

    // If no profiles exist, create a default one
    if (profiles.length === 0) {
      const defaultProfile = {
        id: crypto.randomUUID(),
        userId,
        processingStyle: 'visual',
        understandingStyle: 'logical',
        perceptionStyle: 'global',
        inputStyle: 'active',
        createdAt: new Date()
      };

      const insertSql = `
        INSERT INTO "UserLearningProfile" (
          "id", "userId", "processingStyle", "understandingStyle", 
          "perceptionStyle", "inputStyle", "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const params = [
        defaultProfile.id,
        defaultProfile.userId,
        defaultProfile.processingStyle,
        defaultProfile.understandingStyle,
        defaultProfile.perceptionStyle,
        defaultProfile.inputStyle,
        defaultProfile.createdAt
      ];

      try {
        const newProfile = await query(insertSql, params);
        return NextResponse.json(newProfile);
      } catch (insertError) {
        console.error('Error creating default learning profile:', insertError);
        // If insertion fails, just return an empty array
        return NextResponse.json([]);
      }
    }

    return NextResponse.json(profiles);
    */
  } catch (error) {
    console.error('Error fetching learning profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning profiles', details: error instanceof Error ? error.message : 'Unknown error' },
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

// GET /api/learning-profiles?userId=userId
export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

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
    const requestUserId = payload?.userId;

    if (!requestUserId || requestUserId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only access your own learning profiles' },
        { status: 403 }
      );
    }

    // Return mock data for testing
    return NextResponse.json([
      {
        id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        userId: userId,
        processingStyle: 'visual',
        understandingStyle: 'logical',
        perceptionStyle: 'global',
        inputStyle: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
        userId: userId,
        processingStyle: 'verbal',
        understandingStyle: 'intuitive',
        perceptionStyle: 'sequential',
        inputStyle: 'reflective',
        createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ]);

    /* Commented out until database is properly set up
    // Fetch learning profiles for the user
    const sql = `
      SELECT * FROM "UserLearningProfile"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
    `;

    const profiles = await query(sql, [userId]);

    // If no profiles exist, create a default one
    if (profiles.length === 0) {
      const defaultProfile = {
        id: crypto.randomUUID(),
        userId,
        processingStyle: 'visual',
        understandingStyle: 'logical',
        perceptionStyle: 'global',
        inputStyle: 'active',
        createdAt: new Date()
      };

      const insertSql = `
        INSERT INTO "UserLearningProfile" (
          "id", "userId", "processingStyle", "understandingStyle", 
          "perceptionStyle", "inputStyle", "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const params = [
        defaultProfile.id,
        defaultProfile.userId,
        defaultProfile.processingStyle,
        defaultProfile.understandingStyle,
        defaultProfile.perceptionStyle,
        defaultProfile.inputStyle,
        defaultProfile.createdAt
      ];

      try {
        const newProfile = await query(insertSql, params);
        return NextResponse.json(newProfile);
      } catch (insertError) {
        console.error('Error creating default learning profile:', insertError);
        // If insertion fails, just return an empty array
        return NextResponse.json([]);
      }
    }

    return NextResponse.json(profiles);
    */
  } catch (error) {
    console.error('Error fetching learning profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning profiles', details: error instanceof Error ? error.message : 'Unknown error' },
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