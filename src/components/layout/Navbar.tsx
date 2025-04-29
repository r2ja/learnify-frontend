'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NavItem } from './NavItem';
import { useAuth } from '@/components/auth/AuthContext';
import { LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [hasEnrolledCourses, setHasEnrolledCourses] = useState<boolean | null>(null);
  const [showAlert, setShowAlert] = useState(false);

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
      setShowAlert(true);
      // Hide alert after 3 seconds
      setTimeout(() => setShowAlert(false), 3000);
    } else {
      router.push('/chat');
    }
  };
  
  return (
    <>
      {/* Top Alert for Chat Access */}
      {showAlert && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-3 px-4 text-center font-medium z-[9999] shadow-md">
          Please enroll in at least one course to use the chat assistant.
          <button 
            onClick={() => setShowAlert(false)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white"
          >
            ✕
          </button>
        </div>
      )}
    
      <nav className="w-20 h-screen fixed left-0 top-0 bg-[var(--sidebar)] rounded-r-3xl p-4 flex flex-col items-center shadow-lg">
        <Link href="/" className="text-white text-3xl font-bold mb-12 hover:scale-110 transition-transform duration-300">L.</Link>
        
        <div className="flex flex-col gap-6">
          <NavItem 
            href="/dashboard" 
            isActive={pathname === '/dashboard'}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            }
          />
          <NavItem 
            href="/assessment" 
            isActive={pathname === '/assessment'}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <NavItem 
            href="/courses" 
            isActive={pathname === '/courses' || pathname.startsWith('/courses/')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
          {/* Chat Nav Item with hover tooltip */}
          <div className="relative group">
            <button 
              onClick={handleChatClick}
              className={`w-10 h-10 rounded-lg ${pathname === '/chat' ? 'bg-white text-[var(--sidebar)]' : 'text-gray-400 hover:text-white'} flex items-center justify-center transition-colors`}
              aria-label="Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
            
    
          </div>
        </div>
        
        {/* Spacer to push the following items to the bottom */}
        <div className="flex-grow"></div>
        
        {/* Bottom icons */}
        <div className="flex flex-col gap-6 mb-4">
          <NavItem 
            href="/profile" 
            isActive={pathname === '/profile'}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          
          {/* Logout Button */}
          <button 
            onClick={logout}
            className="w-10 h-10 rounded-lg text-gray-400 hover:text-white hover:bg-red-600/20 flex items-center justify-center transition-colors"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </nav>
    </>
  );
} 