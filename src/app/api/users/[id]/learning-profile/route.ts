import { NextResponse } from 'next/server';
import { learningProfileRepository } from '@/lib/models/learningProfileRepository';
import { userRepository } from '@/lib/models/userRepository';
import { verifyToken } from '@/lib/jwt';

interface RouteParams {
  params: {
    id: string;
  };
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

// GET /api/users/[id]/learning-profile
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const userId = params.id;
    
    console.log('GET /api/users/[id]/learning-profile - User ID:', userId);
    
    // Log URL parameters
    const url = new URL(request.url);
    const courseName = url.searchParams.get('courseName');
    const chapterName = url.searchParams.get('chapterName');
    
    console.log('Query parameters:', {
      courseName,
      chapterName,
      url: request.url
    });
    
    if (!userId) {
      console.error('User ID is missing in request params');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get auth token from cookies for authorization check
    const cookieHeader = request.headers.get('cookie') || '';
    const authToken = getCookieValue(cookieHeader, 'auth_token');
    console.log('Auth token present:', !!authToken);

    if (authToken) {
      // Verify the token to get the authenticated user ID
      try {
        const payload = verifyToken(authToken);
        const requestUserId = payload.userId;
        console.log('Authenticated user ID:', requestUserId);

        // For security, ensure the authenticated user can only access their own profile
        if (requestUserId !== userId) {
          return NextResponse.json(
            { error: 'You are not authorized to access this profile' },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error('Token verification error:', error);
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    } else {
      // For enhanced security, we could make this endpoint require authentication
      // Uncomment the following lines if you want to enforce authentication
      /*
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
      */
    }

    console.log('Attempting to find learning profile for userId:', userId);
    
    // Get the user information including language preference
    const user = await userRepository.findUnique({
      where: { id: userId },
      select: {
        id: true,
        language: true
      }
    });

    if (!user) {
      console.error('User not found for ID:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('User language:', user.language);

    const learningProfile = await learningProfileRepository.findUnique({
      where: { userId },
    });

    console.log('Learning profile found:', !!learningProfile);
    if (learningProfile) {
      console.log('Learning styles:', {
        processingStyle: learningProfile.processingStyle,
        perceptionStyle: learningProfile.perceptionStyle,
        inputStyle: learningProfile.inputStyle,
        understandingStyle: learningProfile.understandingStyle
      });
    }

    // Construct the response
    const response = {
      userId,
      language: user.language || 'english',
      courseName,
      chapterName,
      profile: learningProfile || {
        processingStyle: 'Active',
        perceptionStyle: 'Intuitive',
        inputStyle: 'Visual',
        understandingStyle: 'Sequential'
      }
    };

    console.log('Sending response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in learning profile GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id]/learning-profile
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const userId = params.id;
    
    console.log('PUT /api/users/[id]/learning-profile - User ID:', userId);
    
    // Log URL parameters
    const url = new URL(request.url);
    const courseName = url.searchParams.get('courseName');
    const chapterName = url.searchParams.get('chapterName');
    
    console.log('Query parameters:', {
      courseName,
      chapterName,
      url: request.url
    });
    
    if (!userId) {
      console.error('User ID is missing in request params');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get auth token from cookies for authorization check
    const cookieHeader = request.headers.get('cookie') || '';
    const authToken = getCookieValue(cookieHeader, 'auth_token');
    console.log('Auth token present:', !!authToken);

    // Verify user is authorized to update this profile
    if (authToken) {
      try {
        const payload = verifyToken(authToken);
        const requestUserId = payload.userId;
        console.log('Authenticated user ID:', requestUserId);

        // For security, ensure the authenticated user can only update their own profile
        if (requestUserId !== userId) {
          return NextResponse.json(
            { error: 'You are not authorized to update this profile' },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error('Token verification error:', error);
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const data = await request.json();
    console.log('Received data from frontend:', JSON.stringify(data, null, 2));

    // Validate data
    if (!data) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Extract language preference and other data if provided
    const { 
      language, 
      courseName: bodyCourseName, 
      chapterName: bodyChapterName, 
      ...profileData 
    } = data;

    console.log('Learning styles from request:', {
      processingStyle: profileData.processingStyle,
      perceptionStyle: profileData.perceptionStyle,
      inputStyle: profileData.inputStyle,
      understandingStyle: profileData.understandingStyle
    });
    
    console.log('Course information from request body:', {
      courseName: bodyCourseName || courseName,
      chapterName: bodyChapterName || chapterName
    });

    // Update user's language preference if provided
    if (language) {
      console.log('Updating language to:', language);
      await userRepository.update({
        where: { id: userId },
        data: { language }
      });
    }

    // Check for existing profile
    const existingProfile = await learningProfileRepository.findUnique({
      where: { userId },
    });

    let learningProfile;

    if (existingProfile) {
      console.log('Updating existing learning profile for userId:', userId);
      learningProfile = await learningProfileRepository.update({
        where: { userId },
        data: {
          ...profileData,
          assessmentDate: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      console.log('Creating new learning profile for userId:', userId);
      learningProfile = await learningProfileRepository.create({
        data: {
          userId,
          ...profileData,
          assessmentDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Get the updated user data with language
    const updatedUser = await userRepository.findUnique({
      where: { id: userId },
      select: {
        id: true,
        language: true
      }
    });

    // Construct response with all relevant data
    const response = {
      userId,
      language: updatedUser?.language || 'english',
      courseName: bodyCourseName || courseName,
      chapterName: bodyChapterName || chapterName,
      profile: learningProfile
    };

    console.log('Sending response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in learning profile PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]/learning-profile
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const userId = params.id;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if the profile exists
    const existingProfile = await learningProfileRepository.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Learning profile not found' },
        { status: 404 }
      );
    }

    // Delete the profile
    await learningProfileRepository.delete({
      where: { userId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting learning profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 