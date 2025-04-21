import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { name, email, password } = body;

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    try {
      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error checking existing user:', error);
      return NextResponse.json(
        { error: 'Database error while checking user. Please try again.' },
        { status: 500 }
      );
    }

    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the user
      const user = await db.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'STUDENT', // Default role
        },
      });

      // Generate JWT token
      const token = createToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Set the token in cookies and return response
      const response = NextResponse.json(
        { 
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          } 
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

      return response;
    } catch (error) {
      // Handle specific Prisma errors
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P1001') {
          console.error('Database connection error:', error);
          return NextResponse.json(
            { error: 'Unable to connect to the database. Please try again later.' },
            { status: 500 }
          );
        }
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: 'Email already exists' },
            { status: 400 }
          );
        }
      }
      
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
} 