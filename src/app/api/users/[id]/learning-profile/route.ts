import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteParams = {
  params: {
    id: string;
  };
};

// Get user's learning profile
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const learningProfile = await db.learningProfile.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!learningProfile) {
      return NextResponse.json(
        { error: 'Learning profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(learningProfile, { status: 200 });
  } catch (error) {
    console.error('Error fetching learning profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create or update user's learning profile
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const userId = params.id;
    const body = await request.json();
    const { learningStyle, preferences } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Upsert the learning profile
    const updatedProfile = await db.learningProfile.upsert({
      where: {
        userId: userId,
      },
      update: {
        learningStyle: learningStyle,
        preferences: preferences,
        assessmentDate: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId: userId,
        learningStyle: learningStyle || 'Visual Learner',
        preferences: preferences || {},
        assessmentDate: new Date(),
      },
    });

    return NextResponse.json(updatedProfile, { status: 200 });
  } catch (error) {
    console.error('Error updating learning profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete user's learning profile
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if profile exists
    const existingProfile = await db.learningProfile.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Learning profile not found' },
        { status: 404 }
      );
    }

    // Delete the profile
    await db.learningProfile.delete({
      where: {
        userId: userId,
      },
    });

    return NextResponse.json(
      { message: 'Learning profile deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting learning profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 