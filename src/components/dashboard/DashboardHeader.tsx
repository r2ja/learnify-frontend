'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LearningProfile {
  learningStyle: string;
  preferences: any;
  assessmentDate: string;
}

export function DashboardHeader() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUserData } = useAuth();
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  
  // Refresh user data when component mounts to ensure latest data
  useEffect(() => {
    const ensureUserData = async () => {
      // Only refresh if user is null but we're not in loading state
      // This indicates we need fresh data
      if (!user && !authLoading) {
        console.log('DashboardHeader: User data missing, refreshing...');
        await refreshUserData();
      }
    };
    
    ensureUserData();
  }, [user, authLoading, refreshUserData]);
  
  useEffect(() => {
    const fetchLearningProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${user.id}/learning-profile`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Learning profile data:', data);
          // Check if a valid profile exists
          if (data.profile) {
          setLearningProfile(data);
            setHasProfile(true);
          } else {
            console.log('No learning profile found for user');
            setHasProfile(false);
          }
        } else if (response.status !== 404) {
          // 404 is expected if user hasn't taken assessment yet
          const errorData = await response.json();
          setError(errorData.error || 'Failed to load learning profile');
          setHasProfile(false);
        } else {
          // 404 means no profile
          setHasProfile(false);
        }
      } catch (err) {
        console.error('Error fetching learning profile:', err);
        setError('Unable to load your learning profile');
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLearningProfile();
  }, [user?.id]); // Only depend on user.id, not the entire user object
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  
  // Show loading state if either auth is loading or profile is loading
  if (authLoading) {
    return (
      <div className="bg-darkTeal rounded-2xl p-6 text-white shadow-md animate-pulse">
        <div className="flex items-center mb-3">
          <div className="bg-[#33454b] rounded-full h-14 w-14 flex items-center justify-center mr-4">
            <div className="w-8 h-8 bg-gray-300/30 rounded-full"></div>
          </div>
          <div className="h-8 w-48 bg-gray-300/30 rounded"></div>
        </div>
        <div className="h-4 w-full bg-gray-300/30 rounded my-2"></div>
        <div className="h-4 w-3/4 bg-gray-300/30 rounded"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-darkTeal rounded-2xl p-6 text-white shadow-md">
      <div className="flex flex-col md:flex-row md:items-center mb-3">
        <div className="flex items-center">
        <div className="bg-[#33454b] rounded-full h-14 w-14 flex items-center justify-center mr-4">
          {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{getGreeting()}, {user?.name || 'Student'}</h2>
        </div>
      </div>
        
        {hasProfile === false && !loading && (
          <div className="mt-3 md:mt-0 md:ml-auto">
            <Link 
              href={`/assessment?userId=${user?.id}`}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Complete learning style assessment for best responses
            </Link>
          </div>
        )}
      </div>
      
      <p className="text-white/80 leading-relaxed">
        Your personalized dashboard shows your progress, upcoming tasks, and courses tailored to your unique learning style.
      </p>
    </div>
  );
} 