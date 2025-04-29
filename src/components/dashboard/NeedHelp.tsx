'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';

export function NeedHelp() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [hasEnrolledCourses, setHasEnrolledCourses] = useState<boolean | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Check if user has any enrolled courses
    const checkEnrolledCourses = async () => {
      if (!isAuthenticated || !user) {
        return;
      }

      try {
        const response = await fetch(`/api/courses/enrolled?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch enrolled courses');
        }
        
        const enrolledCourses = await response.json();
        setHasEnrolledCourses(enrolledCourses.length > 0);
      } catch (error) {
        console.error('Error checking enrolled courses:', error);
        setHasEnrolledCourses(false);
      }
    };

    checkEnrolledCourses();
  }, [user, isAuthenticated]);

  const handleChatClick = (e: React.MouseEvent) => {
    if (!hasEnrolledCourses) {
      e.preventDefault();
      setShowTooltip(true);
      
      // Hide tooltip after 3 seconds
      setTimeout(() => {
        setShowTooltip(false);
      }, 3000);
    } else {
      router.push('/chat');
    }
  };

  return (
    <div className="bg-[var(--primary)] text-white p-6 rounded-2xl relative overflow-hidden animate-fadeIn animation-delay-700">
      {/* Background decorative stars (similar to header) */}
      <div className="absolute top-0 right-0 w-full h-full">
        <div className="absolute bottom-10 right-10 w-16 h-16 opacity-20">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <div className="absolute top-5 right-20 w-12 h-12 opacity-10">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="text-xl font-bold mb-6">
          Need help solving a <br /> tricky question?
        </div>
        
        <div className="relative">
          <button 
            onClick={handleChatClick}
            className="bg-white text-[var(--primary)] px-4 py-2 rounded-full font-medium hover:bg-gray-100 transition-all duration-300 hover:shadow-lg hover:transform hover:scale-105"
          >
            Let's Go
          </button>
          
          {showTooltip && (
            <div className="absolute bottom-full left-0 mb-2 p-3 bg-red-600 text-white rounded-lg shadow-lg text-sm w-64 animate-fadeIn">
              <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-red-600"></div>
              You need to enroll in at least one course before using the chat assistant.
              <Link href="/courses" className="block mt-2 underline hover:text-white/80">
                Browse available courses
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 