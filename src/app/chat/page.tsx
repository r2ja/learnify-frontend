'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { CourseChatWindow } from '@/components/learning/CourseChatWindow';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import Link from 'next/link';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const chapterId = searchParams.get('chapterId');
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [hasEnrolledCourses, setHasEnrolledCourses] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has any enrolled courses
    const checkEnrolledCourses = async () => {
      if (!isAuthenticated || !user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`/api/courses/enrolled?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch enrolled courses');
        }
        
        const enrolledCourses = await response.json();
        setHasEnrolledCourses(enrolledCourses.length > 0);
      } catch (error) {
        console.error('Error checking enrolled courses:', error);
        setHasEnrolledCourses(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkEnrolledCourses();
  }, [user, isAuthenticated]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="h-screen w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
        </div>
      </MainLayout>
    );
  }

  // If the user doesn't have any enrolled courses, show a message
  if (hasEnrolledCourses === false) {
    return (
      <MainLayout>
        <div className="h-screen w-full flex items-center justify-center">
          <div className="max-w-md p-8 bg-white rounded-xl shadow-lg text-center">
            <div className="text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">You need to enroll in a course first</h2>
            <p className="text-gray-600 mb-6">
              To use the chat assistant, you need to be enrolled in at least one course. 
              Please browse our course catalog and enroll in a course that interests you.
            </p>
            <Link href="/courses" className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-opacity-90 inline-block transition-colors">
              Browse Courses
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-screen w-full flex-1">
        <CourseChatWindow courseId={courseId || undefined} chapterId={chapterId || undefined} />
      </div>
    </MainLayout>
  );
} 