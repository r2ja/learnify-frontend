"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CourseChatWindow } from '@/components/learning/CourseChatWindow';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'react-hot-toast';

export default function ChapterChatPage({
  params
}: {
  params: { courseId: string; chapterId: string }
}) {
  const { courseId, chapterId } = params;
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no sessionId is provided, redirect to the course page
    if (!sessionId) {
      // Call continue endpoint to get a session ID
      const getContinueSession = async () => {
        try {
          const response = await fetch(`/api/progress/${courseId}/continue`, {
            method: 'POST'
          });
          
          if (!response.ok) {
            throw new Error('Failed to get session');
          }
          
          const { chapterId, sessionId } = await response.json();
          window.location.href = `/courses/${courseId}/chapter/${chapterId}/chat?sessionId=${sessionId}`;
        } catch (error) {
          console.error('Error getting session:', error);
          setError('Failed to load chat session. Please try again.');
          setLoading(false);
        }
      };
      
      if (user && !userLoading) {
        getContinueSession();
      }
    } else {
      setLoading(false);
    }
  }, [courseId, chapterId, sessionId, user, userLoading]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[var(--primary)] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-600">Loading chat session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.href = `/courses/${courseId}`}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back to Course
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-yellow-50 text-yellow-800 p-6 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p>Please log in to access the chat feature.</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <CourseChatWindow 
        courseId={courseId} 
        chapterId={chapterId} 
        sessionId={sessionId || undefined}
      />
    </div>
  );
} 