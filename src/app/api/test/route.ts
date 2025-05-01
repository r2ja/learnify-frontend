import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('Test API endpoint called');
  return NextResponse.json({ 
    success: true, 
    message: 'API is working',
    timestamp: new Date().toISOString() 
  });
}

export async function POST(request: NextRequest) {
  console.log('Test API POST endpoint called');
  try {
    const body = await request.json();
    return NextResponse.json({ 
      success: true, 
      message: 'POST API is working',
      receivedData: body,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to parse request body',
      timestamp: new Date().toISOString() 
    }, { status: 400 });
  }
} 