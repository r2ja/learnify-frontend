import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { createToken } from '@/lib/jwt';
import { userRepository } from '@/lib/models/userRepository';
import { UserCreateInput } from '@/lib/models/types';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await userRepository.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user
    const user = await userRepository.create({
      data: {
        name,
        email,
        password: hashedPassword,
        language: 'english', // Default language
      },
    });

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
        { status: 201 }
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

      console.log('Registration successful, setting auth_token cookie');
      return response;
    } catch (tokenError) {
      console.error('Error creating JWT token:', tokenError);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Error creating user' },
      { status: 500 }
    );
  }
} 