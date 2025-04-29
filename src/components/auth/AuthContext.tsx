'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCookie, deleteCookie } from 'cookies-next';
import { persistor } from '@/lib/redux/store';

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  language?: 'english' | 'urdu' | 'french';
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch current user data from the API
  const fetchUserData = useCallback(async (): Promise<User | null> => {
    try {
      console.log('AuthContext: Fetching user data from /api/auth/me');
      setLoading(true);
      
      // Fetch the current user data with credentials included
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Include cookies in the request
        // Add cache busting to prevent browser caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log('AuthContext: /api/auth/me response status:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('AuthContext: User data received:', userData);
        
        // Set the user state with the complete data from the API
        setUser(userData);
        return userData;
      } else {
        // Token expired or invalid, clear it
        console.log('AuthContext: Authentication failed, clearing token');
        deleteCookie('auth_token');
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await fetchUserData();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [fetchUserData]);

  // Re-fetch user data at intervals to keep it fresh
  useEffect(() => {
    // Only set up polling if the user is authenticated
    if (!user) return;
    
    // Refresh user data every 5 minutes to keep it fresh
    const interval = setInterval(() => {
      console.log('Refreshing user data in background');
      fetchUserData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, fetchUserData]);

  const login = (userData: User) => {
    console.log('AuthContext: Login with user data:', userData);
    setUser(userData);
  };

  const logout = async () => {
    try {
      console.log('AuthContext: Logging out');
      setLoading(true);
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in the request
      });

      if (response.ok) {
        // Purge persisted Redux state
        await persistor.purge();
        
        // Clear user state
        setUser(null);
        
        // Navigate to home page instead of login
        router.push('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to manually refresh user data
  const refreshUserData = async (): Promise<User | null> => {
    console.log('AuthContext: Manually refreshing user data');
    return fetchUserData();
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        isAuthenticated: !!user,
        loading,
        refreshUserData 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 