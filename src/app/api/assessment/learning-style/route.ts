import { NextResponse } from 'next/server';
import { learningProfileRepository } from '@/lib/models/learningProfileRepository';
import { verifyToken } from '@/lib/jwt';

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

// GET /api/assessment/learning-style - Start the assessment or get existing profile
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
    let userId;
    try {
      const payload = verifyToken(authToken);
      userId = payload.userId;
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Fetch the user's existing learning profile if it exists
    const learningProfile = await learningProfileRepository.findUnique({
      where: { userId },
    });

    console.log('Learning profile found for assessment:', !!learningProfile);

    // If a profile exists, return it
    if (learningProfile) {
      return NextResponse.json({
        hasExistingProfile: true,
        profile: learningProfile,
        assessmentDate: learningProfile.assessmentDate || new Date(),
      });
    }

    // If no profile exists, indicate that the assessment should start
    return NextResponse.json({
      hasExistingProfile: false,
      message: 'No learning profile found. Start assessment.',
    });
  } catch (error) {
    console.error('Error in learning style assessment GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/assessment/learning-style - Save the assessment results
export async function POST(request: Request) {
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
    let userId;
    try {
      const payload = verifyToken(authToken);
      userId = payload.userId;
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get data from request body
    const data = await request.json();
    
    if (!data || !data.learningStyle) {
      return NextResponse.json(
        { error: 'Learning style data is required' },
        { status: 400 }
      );
    }

    // Extract learning style data
    const { 
      processingStyle,
      perceptionStyle,
      inputStyle,
      understandingStyle
    } = data.learningStyle;

    console.log('Saving learning style profile:', {
      userId,
      processingStyle,
      perceptionStyle,
      inputStyle,
      understandingStyle
    });

    // Check if profile exists
    const existingProfile = await learningProfileRepository.findUnique({
      where: { userId },
    });

    let learningProfile;

    // Create or update the learning profile
    if (existingProfile) {
      learningProfile = await learningProfileRepository.update({
        where: { userId },
        data: {
          processingStyle,
          perceptionStyle,
          inputStyle,
          understandingStyle,
          assessmentDate: new Date(),
        },
      });
    } else {
      learningProfile = await learningProfileRepository.create({
        data: {
          userId,
          processingStyle,
          perceptionStyle,
          inputStyle,
          understandingStyle,
          assessmentDate: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      profile: learningProfile,
      message: 'Learning style assessment saved successfully',
    });
  } catch (error) {
    console.error('Error in learning style assessment POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 