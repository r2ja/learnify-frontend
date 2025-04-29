'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from './FormField';

export default function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear field-specific error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    // Email validation - more robust regex that handles common email format issues
    if (!formData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else {
      // Enhanced email regex that checks for valid format with proper domain
      // This regex ensures:
      // - Local part contains valid characters
      // - @ symbol is present
      // - Domain has at least one dot
      // - Domain parts contain valid characters
      // - Top-level domain is at least 2 characters
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address (e.g., name@example.com)';
        isValid = false;
      }
    }

    // Password validation with additional strength requirements
    if (!formData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
      isValid = false;
    } else if (!/\d/.test(formData.password)) {
      errors.password = 'Password must contain at least one number';
      isValid = false;
    } else if (!/[a-zA-Z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one letter';
      isValid = false;
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setError('');
    setFieldErrors({});

    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      // Call the signup API
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies to be sent/received
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      let data;
      try {
        // Safely parse the JSON response
        const responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Server returned an invalid response. This might indicate a database connection issue.');
      }

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 409) {
          throw new Error('An account with this email already exists. Please use a different email or try logging in.');
        }
        // Handle specific database connection errors
        if (data.error && data.error.includes('database')) {
          throw new Error('Database connection failed. Please try again in a few moments or contact support if this persists.');
        }
        throw new Error(data.error || 'Registration failed');
      }
      
      // After successful signup, fetch the user data before redirecting
      try {
        const userResponse = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!userResponse.ok) {
          console.warn('Could not fetch user data after signup, but signup was successful');
          // Still redirect to assessment after a delay
          setTimeout(() => {
            router.push('/assessment?fromSignup=true');
          }, 500); // Longer delay to allow for auth setup
        } else {
          // Successfully got user data
          const userData = await userResponse.json();
          console.log('User data fetched after signup:', userData);
          
          // Ensure we have the user ID before redirecting
          if (userData && userData.id) {
            // Short delay to ensure data is processed before redirecting
            setTimeout(() => {
              // Navigate to the assessment page with both user ID and fromSignup params
              router.push(`/assessment?fromSignup=true&userId=${userData.id}`);
            }, 500); // Longer delay to ensure auth state is fully established
          } else {
            // Fallback if user ID is somehow missing
            setTimeout(() => {
              router.push('/assessment?fromSignup=true');
            }, 500);
          }
        }
      } catch (fetchError) {
        // Log the error but don't block the redirect
        console.error('Error fetching user data after signup:', fetchError);
        setTimeout(() => {
          router.push('/assessment?fromSignup=true');
        }, 500);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center" noValidate>
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md mb-4 w-full text-center">
          {error}
        </div>
      )}

      <FormField
        label="Full Name"
        name="name"
        value={formData.name}
        onChange={handleInputChange}
        placeholder="Enter your full name"
        type="text"
        required={true}
        error={fieldErrors.name}
      />

      <FormField
        label="Email"
        name="email"
        value={formData.email}
        onChange={handleInputChange}
        placeholder="Enter your email"
        type="email"
        required={true}
        error={fieldErrors.email}
      />

      <FormField
        label="Password"
        name="password"
        type="password"
        value={formData.password}
        onChange={handleInputChange}
        placeholder="Create a password"
        required={true}
        error={fieldErrors.password}
      />

      <FormField
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        value={formData.confirmPassword}
        onChange={handleInputChange}
        placeholder="Confirm your password"
        required={true}
        error={fieldErrors.confirmPassword}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-darkTeal text-white py-3 rounded-md hover:bg-[#1a272a] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-darkTeal disabled:opacity-70 mt-6"
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
} 