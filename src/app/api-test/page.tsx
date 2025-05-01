'use client';

import React, { useState, useEffect } from 'react';

export default function ApiTestPage() {
  const [testResult, setTestResult] = useState<string>('No test run yet');
  const [saveResult, setSaveResult] = useState<string>('No save test run yet');
  const [getResult, setGetResult] = useState<string>('No get test run yet');
  const [filePath, setFilePath] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const runApiTest = async () => {
    setTestResult('Testing API...');
    try {
      const response = await fetch('/api/test');
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${(error as Error).message}`);
    }
  };

  const runSaveImageTest = async () => {
    setSaveResult('Testing saveImage API...');
    try {
      // Create a small test image (1x1 pixel transparent PNG in base64)
      const tinyImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdQImgOl12AAAAABJRU5ErkJggg==';
      
      const response = await fetch('/api/saveImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: tinyImageBase64,
          prompt: 'Test image from API test page'
        })
      });
      
      const data = await response.json();
      setSaveResult(JSON.stringify(data, null, 2));
      
      if (data.filePath) {
        setFilePath(data.filePath);
      }
    } catch (error) {
      setSaveResult(`Error: ${(error as Error).message}`);
    }
  };

  const runGetImageTest = async () => {
    if (!filePath) {
      setGetResult('No file path to test yet. Run the save test first.');
      return;
    }

    setGetResult('Testing getImage API...');
    try {
      const response = await fetch(`/api/getImage?filePath=${encodeURIComponent(filePath)}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setImagePreview(url);
        setGetResult(`Image retrieved successfully. Content-Type: ${response.headers.get('content-type')}`);
      } else {
        const errorData = await response.json();
        setGetResult(`Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      setGetResult(`Error: ${(error as Error).message}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">API Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test API</h2>
          <button
            onClick={runApiTest}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md mb-4"
          >
            Test /api/test Endpoint
          </button>
          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60 text-sm">
            {testResult}
          </pre>
        </div>
        
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Save Image</h2>
          <button
            onClick={runSaveImageTest}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md mb-4"
          >
            Test /api/saveImage Endpoint
          </button>
          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60 text-sm">
            {saveResult}
          </pre>
        </div>
        
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Get Image</h2>
          <button
            onClick={runGetImageTest}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md mb-4"
            disabled={!filePath}
          >
            Test /api/getImage Endpoint
          </button>
          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60 text-sm">
            {getResult}
          </pre>
          {imagePreview && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Image Preview:</h3>
              <img 
                src={imagePreview} 
                alt="Retrieved test image" 
                className="border rounded-md"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 