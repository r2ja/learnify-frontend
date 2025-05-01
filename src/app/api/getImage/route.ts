import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const filePath = request.nextUrl.searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    // Security check: Ensure the path is within the images directory
    const imagePath = decodeURIComponent(filePath);
    const imagesDir = path.resolve('C:/Users/inaya/OneDrive/Desktop/FYP/images');
    
    // Block path traversal attempts
    const normalizedPath = path.normalize(imagePath);
    if (!normalizedPath.startsWith(imagesDir) && !normalizedPath.includes('C:\\Users\\inaya\\OneDrive\\Desktop\\FYP\\images')) {
      console.error('Attempted path traversal attack:', imagePath);
      return NextResponse.json({ error: 'Invalid image path' }, { status: 403 });
    }
    
    // Check if the file exists
    if (!fs.existsSync(normalizedPath)) {
      console.error('Image not found:', normalizedPath);
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Get file extension to set correct content type
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'image/png'; // Default
    
    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    }

    try {
      // Read the file and send it as the response
      const imageBuffer = fs.readFileSync(normalizedPath);
      
      // Create a response with the image data
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
        }
      });
    } catch (readError) {
      console.error('Error reading image file:', readError);
      return NextResponse.json({ error: 'Failed to read image file' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error retrieving image:', error);
    return NextResponse.json({ error: 'Failed to retrieve image' }, { status: 500 });
  }
} 