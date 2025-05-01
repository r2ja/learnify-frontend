import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to ensure the directory exists
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
      return true;
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      return false;
    }
  }
  return true;
};

export async function POST(request: NextRequest) {
  console.log('API: saveImage received a POST request');
  
  // Log request headers for debugging
  const headers = Object.fromEntries(request.headers);
  console.log('Request headers:', JSON.stringify(headers, null, 2));
  
  try {
    // First test if we can simply respond
    if (request.headers.get('x-test') === 'true') {
      console.log('Test request received, responding with success');
      return NextResponse.json({ success: true, message: 'API is working' }, { status: 200 });
    }
    
    const body = await request.json();
    console.log('Request body received, has imageData:', !!body.imageData);
    
    const { imageData, prompt } = body;

    if (!imageData) {
      console.log('Error: No image data provided');
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Create the images directory if it doesn't exist
    const imagesDir = path.resolve('C:/Users/inaya/OneDrive/Desktop/FYP/images');
    console.log(`Ensuring images directory exists: ${imagesDir}`);
    
    if (!ensureDirectoryExists(imagesDir)) {
      return NextResponse.json({ error: 'Failed to create images directory' }, { status: 500 });
    }

    // Extract base64 data - remove the header if present
    console.log('Processing image data');
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Generate unique filename with timestamp to prevent collisions
    const timestamp = new Date().getTime();
    const filename = `${timestamp}-${uuidv4()}.png`;
    const filepath = path.join(imagesDir, filename);
    
    console.log(`Saving image to: ${filepath}`);
    
    try {
      // Write file to disk
      fs.writeFileSync(filepath, base64Data, 'base64');
      console.log(`Image saved successfully to: ${filepath}`);
      
      // Return the file path and other details
      return NextResponse.json({ 
        filePath: filepath,
        filename: filename,
        prompt: prompt
      }, { status: 200 });
    } catch (writeError) {
      console.error('Error writing image file:', writeError);
      return NextResponse.json({ 
        error: 'Failed to write image file',
        details: (writeError as Error).message
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error saving image:', error);
    return NextResponse.json({ 
      error: 'Failed to save image',
      details: (error as Error).message
    }, { status: 500 });
  }
} 