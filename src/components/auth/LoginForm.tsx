'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from './FormField';

export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else {
      // RFC 5322 compliant email regex
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
        isValid = false;
      }
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
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
      // Call the login API with credentials included
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies to be sent/received
        body: JSON.stringify(formData),
      });

      let data;
      try {
        // Safely parse the JSON response
        const responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Server returned an invalid response.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // After successful login, fetch the user data before redirecting
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data after login');
      }
      
      const userData = await userResponse.json();
      
      // Short delay to ensure data is processed 
      setTimeout(() => {
      // Navigate to the dashboard
      router.push('/dashboard');
      }, 100);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
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
          placeholder="Enter your password"
          required={true}
          error={fieldErrors.password}
          showForgot={true}
          onForgotClick={() => router.push('/auth/forgot-password')}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-darkTeal text-white py-3 rounded-md hover:bg-[#1a272a] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-darkTeal disabled:opacity-70 mt-6"
        >
          {loading ? 'Signing in...' : 'Login Now'}
        </button>
      </form>
    </div>
  );
} 