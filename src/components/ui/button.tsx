'use client';

import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    isLoading = false, 
    disabled,
    ...props 
  }, ref) => {
    // Get variant styling
    const getVariantClasses = () => {
      switch (variant) {
        case 'primary':
          return 'bg-[var(--primary)] text-white hover:opacity-90';
        case 'secondary':
          return 'bg-gray-200 text-gray-800 hover:bg-gray-300';
        case 'outline':
          return 'bg-white border border-[var(--primary)] text-[var(--primary)] hover:bg-gray-50';
        case 'text':
          return 'bg-transparent text-[var(--primary)] hover:underline';
        default:
          return 'bg-[var(--primary)] text-white hover:opacity-90';
      }
    };

    // Get size styling
    const getSizeClasses = () => {
      switch (size) {
        case 'sm':
          return 'px-3 py-1.5 text-sm';
        case 'md':
          return 'px-4 py-2';
        case 'lg':
          return 'px-6 py-3 text-lg';
        default:
          return 'px-4 py-2';
      }
    };

    return (
      <button
        ref={ref}
        className={`
          ${getVariantClasses()}
          ${getSizeClasses()}
          ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
          rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{children}</span>
          </div>
        ) : children}
      </button>
    );
  }
);

Button.displayName = 'Button'; 