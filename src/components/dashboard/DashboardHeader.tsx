'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';

interface LearningProfile {
  learningStyle: string;
  preferences: any;
  assessmentDate: string;
}

export function DashboardHeader() {
  const { user, loading: authLoading, refreshUserData } = useAuth();
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
          setLearningProfile(data);
        } else if (response.status !== 404) {
          // 404 is expected if user hasn't taken assessment yet
          const errorData = await response.json();
          setError(errorData.error || 'Failed to load learning profile');
        }
      } catch (err) {
        console.error('Error fetching learning profile:', err);
        setError('Unable to load your learning profile');
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
      <div className="flex items-center mb-3">
        <div className="bg-[#33454b] rounded-full h-14 w-14 flex items-center justify-center mr-4">
          {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{getGreeting()}, {user?.name || 'Student'}</h2>
        </div>
      </div>
      <p className="text-white/80 leading-relaxed">
        Your personalized dashboard shows your progress, upcoming tasks, and courses tailored to your unique learning style.
      </p>
    </div>
  );
} 