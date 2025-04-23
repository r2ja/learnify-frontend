import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { createToken } from '@/lib/jwt';
import { userRepository } from '@/lib/models/userRepository';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await userRepository.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    try {
      // Generate JWT token
      const token = createToken({
        userId: user.id,
        email: user.email,
      });

      // Create response with user data
      const response = NextResponse.json(
        {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            language: user.language,
          },
        },
        { status: 200 }
      );

      // Set the cookie in the response
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'strict',
      });

      console.log('Login successful, setting auth_token cookie');
      return response;
    } catch (tokenError) {
      console.error('Error creating JWT token:', tokenError);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error during login' },
      { status: 500 }
    );
  }
} 