'use client';

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { ProfileAvatar } from './ProfileAvatar';
import { useAuth } from '@/components/auth/AuthContext';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  learningStyle: string;
  bio: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  profileImage?: string;
  notifications: {
    email: boolean;
    sms: boolean;
    browser: boolean;
  };
}

// Form validation schema
const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  learningStyle: z.string(),
  bio: z.string().max(500, "Bio must be less than 500 characters"),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    browser: z.boolean(),
  })
});

// Password schema that is only validated when currentPassword is provided
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string()
}).refine((data: { newPassword: string; confirmPassword: string }) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export function ProfileContent() {
  const { user } = useAuth();
  
  // Initial profile data
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    learningStyle: 'Visual Learner',
    bio: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    profileImage: '',
    notifications: {
      email: true,
      sms: false,
      browser: true,
    }
  });

  // Form states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Learning style options
  const learningStyles = [
    'Visual Learner',
    'Auditory Learner',
    'Reading/Writing Learner',
    'Kinesthetic Learner'
  ];

  // Fetch user profile data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      try {
        // Fetch user details
        const userResponse = await fetch(`/api/users/${user.id}`);
        if (!userResponse.ok) throw new Error('Failed to fetch user data');
        
        const userData = await userResponse.json();
        
        // Split name into first and last name
        let firstName = '';
        let lastName = '';
        
        if (userData.name) {
          const nameParts = userData.name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        // Fetch learning profile if available
        let learningStyle = 'Visual Learner';
        
        try {
          const profileResponse = await fetch(`/api/users/${user.id}/learning-profile`);
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            learningStyle = profileData.learningStyle;
          }
        } catch (err) {
          console.error('Error fetching learning profile:', err);
        }
        
        setProfile({
          ...profile,
          firstName,
          lastName,
          email: userData.email || '',
          learningStyle,
          bio: userData.bio || '',
          profileImage: userData.image || '',
        });
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  // Handle profile image change
  const handleProfileImageChange = (file: File) => {
    setProfileImageFile(file);
  };

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.includes('.')) {
      // Handle nested objects (e.g., notifications.email)
      const [parent, child] = name.split('.');
      
      if (parent === 'notifications') {
        setProfile(prev => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            [child]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
          }
        }));
      }
    } else {
      // Handle top-level fields
      setProfile(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
    
    // Clear error for this field when modified
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = () => {
    // Clear previous errors
    setErrors({});
    let isValid = true;
    let newErrors: Record<string, string> = {};

    try {
      // Validate profile data
      profileSchema.parse(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err: z.ZodIssue) => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
        });
        isValid = false;
      }
    }

    // Only validate password if user is trying to change it
    if (profile.currentPassword || profile.newPassword || profile.confirmPassword) {
      try {
        passwordSchema.parse({
          currentPassword: profile.currentPassword,
          newPassword: profile.newPassword,
          confirmPassword: profile.confirmPassword
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((err: z.ZodIssue) => {
            const path = err.path.join('.');
            newErrors[path] = err.message;
          });
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Validate the form
    if (!validateForm()) return;
    
    setIsSaving(true);
    
    try {
      // Update user profile
      const userUpdateResponse = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          email: profile.email,
          // Add other fields as needed
        }),
      });
      
      if (!userUpdateResponse.ok) {
        throw new Error('Failed to update user profile');
      }
      
      // Update learning profile
      const learningProfileResponse = await fetch(`/api/users/${user.id}/learning-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learningStyle: profile.learningStyle,
          preferences: {
            // Additional preferences can be stored here
          },
        }),
      });
      
      if (!learningProfileResponse.ok) {
        throw new Error('Failed to update learning profile');
      }
      
      // Handle password change if requested
      if (profile.currentPassword && profile.newPassword) {
        const passwordResponse = await fetch(`/api/users/${user.id}/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword: profile.currentPassword,
            newPassword: profile.newPassword,
          }),
        });
        
        if (!passwordResponse.ok) {
          const passwordError = await passwordResponse.json();
          throw new Error(passwordError.error || 'Failed to update password');
        }
      }
      
      // Show success message
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Clear password fields and image file after successful update
      setProfile(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setProfileImageFile(null);
      
      // Exit edit mode
      setIsEditing(false);
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-h-screen overflow-y-auto pb-16">
      <div className="w-full py-8 px-2">
        <div className="dashboard-card p-8 animate-fadeIn shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="py-2 px-4 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-300"
              >
                Edit Profile
              </button>
            ) : null}
          </div>

          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 animate-fadeIn">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Profile Image */}
            <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start">
              <ProfileAvatar 
                initialImage={profile.profileImage} 
                editable={isEditing}
                onImageChange={handleProfileImageChange}
              />
              
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">
                  Account Info
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={profile.firstName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 border rounded-md ${errors.firstName ? 'border-red-500' : 'border-gray-300'} ${!isEditing ? 'bg-gray-100' : 'bg-white'}`}
                    />
                    {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
                  </div>
                  
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={profile.lastName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 border rounded-md ${errors.lastName ? 'border-red-500' : 'border-gray-300'} ${!isEditing ? 'bg-gray-100' : 'bg-white'}`}
                    />
                    {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
                  </div>
                </div>
                
                <div className="mt-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profile.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded-md ${errors.email ? 'border-red-500' : 'border-gray-300'} ${!isEditing ? 'bg-gray-100' : 'bg-white'}`}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>
              </div>
            </div>
            
            {/* Learning Preferences */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">
                Learning Preferences
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="learningStyle" className="block text-sm font-medium text-gray-700 mb-1">
                    Learning Style
                  </label>
                  <select
                    id="learningStyle"
                    name="learningStyle"
                    value={profile.learningStyle}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border rounded-md ${errors.learningStyle ? 'border-red-500' : 'border-gray-300'} ${!isEditing ? 'bg-gray-100' : 'bg-white'}`}
                  >
                    {learningStyles.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                  {errors.learningStyle && <p className="mt-1 text-sm text-red-500">{errors.learningStyle}</p>}
                </div>
              </div>
              
              <div className="mt-6">
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={profile.bio}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border rounded-md ${errors.bio ? 'border-red-500' : 'border-gray-300'} ${!isEditing ? 'bg-gray-100' : 'bg-white'}`}
                />
                {errors.bio && <p className="mt-1 text-sm text-red-500">{errors.bio}</p>}
                <p className="text-sm text-gray-500 mt-1">
                  {profile.bio.length}/500 characters
                </p>
              </div>
            </div>
            
            {/* Security Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">
                Security
              </h2>
              
              {isEditing && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      name="currentPassword"
                      value={profile.currentPassword}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md ${errors.currentPassword ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.currentPassword && <p className="mt-1 text-sm text-red-500">{errors.currentPassword}</p>}
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={profile.newPassword}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md ${errors.newPassword ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.newPassword && <p className="mt-1 text-sm text-red-500">{errors.newPassword}</p>}
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={profile.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md">
                    <h3 className="text-sm font-medium text-blue-800 mb-1">Password Requirements</h3>
                    <ul className="text-xs text-blue-700 list-disc pl-5 space-y-1">
                      <li>At least 8 characters long</li>
                      <li>Contains at least one uppercase letter</li>
                      <li>Contains at least one lowercase letter</li>
                      <li>Contains at least one number</li>
                      <li>Contains at least one special character</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {!isEditing && (
                <div className="flex items-center px-4 py-6 bg-gray-50 rounded-md">
                  <div className="text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-gray-700 font-medium">Password</p>
                    <p className="text-gray-500 text-sm">••••••••</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Notification Preferences */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">
                Notification Preferences
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="notificationEmail"
                    name="notifications.email"
                    checked={profile.notifications.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <label htmlFor="notificationEmail" className="ml-3 block text-sm font-medium text-gray-700">
                    Email Notifications
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="notificationSms"
                    name="notifications.sms"
                    checked={profile.notifications.sms}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <label htmlFor="notificationSms" className="ml-3 block text-sm font-medium text-gray-700">
                    SMS Notifications
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="notificationBrowser"
                    name="notifications.browser"
                    checked={profile.notifications.browser}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <label htmlFor="notificationBrowser" className="ml-3 block text-sm font-medium text-gray-700">
                    Browser Notifications
                  </label>
                </div>
              </div>
            </div>
            
            {/* Form Buttons */}
            {isEditing && (
              <div className="flex justify-end space-x-4 border-t pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // Optionally reset form to original values
                  }}
                  className="py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-300"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2 px-4 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-300 flex items-center"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            )}
            
            {errors.form && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {errors.form}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
} 