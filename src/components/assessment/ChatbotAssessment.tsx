'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface LearningStyleInfo {
  processingStyle: string;
  perceptionStyle: string;
  inputStyle: string;
  understandingStyle: string;
}

export function ChatbotAssessment() {
  const router = useRouter();
  const { user, isAuthenticated, refreshUserData } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [responses, setResponses] = useState<string[]>([]); // Only validated responses
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testComplete, setTestComplete] = useState(false);
  const [learningStyle, setLearningStyle] = useState<LearningStyleInfo | null>(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [urlUserId, setUrlUserId] = useState<string | null>(null);
  const [authRetryCount, setAuthRetryCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track previous user to detect changes
  const prevUserIdRef = useRef<string | undefined>(undefined);
  
  // Check for userId parameter in URL (from dashboard notification or signup)
  useEffect(() => {
    // Extract URL parameters
    const queryParams = new URLSearchParams(window.location.search);
    const userIdParam = queryParams.get('userId');
    const fromSignup = queryParams.get('fromSignup') === 'true';
    
    if (userIdParam) {
      console.log('Detected userId in URL:', userIdParam);
      setUrlUserId(userIdParam);
    }
    
    // If we're coming from signup but not authenticated yet, try to refresh user data
    if ((fromSignup || userIdParam) && !isAuthenticated && authRetryCount < 5) {
      console.log(`Auth not ready yet. Retry attempt: ${authRetryCount + 1}`);
      
      // Set a delay that increases with each retry
      const retryDelay = 1000 * (authRetryCount + 1);
      
      const retryTimer = setTimeout(async () => {
        console.log(`Retry ${authRetryCount + 1}: Refreshing user data...`);
        try {
          await refreshUserData();
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
        setAuthRetryCount(prev => prev + 1);
      }, retryDelay);
      
      return () => clearTimeout(retryTimer);
    }
  }, [isAuthenticated, authRetryCount, refreshUserData]);

  // Reset state when user changes or logs out
  useEffect(() => {
    // If not authenticated or user changes, reset state
    if (!isAuthenticated || !user) {
      console.log('User not authenticated or missing, resetting assessment state');
      resetAllState();
      prevUserIdRef.current = undefined;
      return;
    }
    
    // User changed detection
    const userId = user.id;
    const userChanged = userId !== prevUserIdRef.current;
    
    if (userId && userChanged) {
      console.log('User changed, resetting assessment state for new user:', userId);
      resetAllState();
      prevUserIdRef.current = userId;
      
      // Trigger profile check when user changes
      checkExistingProfile(userId);
    }
  }, [isAuthenticated, user]);

  // Reset all component state
  const resetAllState = () => {
    setMessages([]);
    setResponses([]);
    setInput('');
    setError(null);
    setTestComplete(false);
    setLearningStyle(null);
    setHasExistingProfile(false);
    setAssessmentStarted(false);
    setCheckingProfile(true);
  };

  // Separate checkExistingProfile function for reusability
  const checkExistingProfile = async (userId: string) => {
    if (!userId || userId.trim() === '') {
      console.error('User ID is empty or invalid');
        setCheckingProfile(false);
        return;
      }

      try {
        setCheckingProfile(true);
      console.log('Checking for existing learning profile for user:', userId);
      
      const response = await fetch(`/api/users/${userId}/learning-profile`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch profile: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Learning profile API response:', data);
        
        // The profile data is in the 'profile' property
        const profile = data.profile;
        
        // Check if profile exists and has learning style data
        if (profile && 
            profile.processingStyle && 
            profile.perceptionStyle && 
            profile.inputStyle && 
            profile.understandingStyle) {
          
          console.log('Existing profile found with styles:', profile);
          
          // Format the learning style information
          const styleInfo: LearningStyleInfo = {
            processingStyle: profile.processingStyle,
            perceptionStyle: profile.perceptionStyle,
            inputStyle: profile.inputStyle,
            understandingStyle: profile.understandingStyle
          };
          
        setHasExistingProfile(true);
          setLearningStyle(styleInfo);
        } else {
          console.log('No complete learning profile found');
          setHasExistingProfile(false);
        setLearningStyle(null);
        }
      } catch (error) {
        console.error('Error checking learning profile:', error);
        setHasExistingProfile(false);
      setLearningStyle(null);
      } finally {
        setCheckingProfile(false);
      }
    };

  // Check if user already has a learning profile
  useEffect(() => {
    const initializeProfile = async () => {
      // Handle the case where we have a URL userId but no authenticated user yet
      const isFromSignup = new URLSearchParams(window.location.search).get('fromSignup') === 'true';
      
      if ((!isAuthenticated || !user) && (urlUserId || isFromSignup) && authRetryCount < 5) {
        console.log(`Waiting for authentication to complete...`);
        setCheckingProfile(true);
        return; // Will be retried by the auth retry mechanism
      }
      
      // Only proceed if we have both authentication and user data
      if (!isAuthenticated || !user?.id) {
        setCheckingProfile(false);
        return;
      }

      // For users coming directly from signup, immediately show the start assessment screen
      if (isFromSignup) {
        console.log('User coming from signup, showing start assessment screen');
        setCheckingProfile(false);
        setHasExistingProfile(false);
        setLearningStyle(null);
        return;
      }

      await checkExistingProfile(user.id.toString());
    };

    initializeProfile();
  }, [isAuthenticated, user, urlUserId, authRetryCount]);

  // Start the conversation when the user explicitly chooses to start the assessment
  const startConversation = async () => {
    if (!isAuthenticated || !user) {
      router.push('/auth/login');
      return;
    }
    
    try {
      setIsLoading(true);
      setAssessmentStarted(true);
      const res = await fetch('http://localhost:8000/start/');
      
      if (!res.ok) {
        throw new Error(`Failed to start assessment: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.question) {
        setMessages([{ role: 'bot', content: data.question }]);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setError('Error starting assessment. Please ensure the assessment server is running.');
      setAssessmentStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-focus the text input
  useEffect(() => {
    if (!testComplete && !isLoading && inputRef.current && assessmentStarted) {
      inputRef.current.focus();
    }
  }, [testComplete, isLoading, messages, assessmentStarted]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user?.id) {
      router.push('/auth/login');
      return;
    }

    if (input.trim().length < 5) {
      setError('Please provide a more detailed response (at least 5 characters).');
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/answer/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: responses,
          new_answer: input,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'An error occurred during assessment.');
      }
      
      const data = await res.json();
      
      if (data.question) {
        // If there is a next question, update responses and messages
        setResponses(data.responses);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: input },
          { role: 'bot', content: data.question },
        ]);
      } else if (data.learning_style) {
        // Test complete: Save the learning style to database
        setResponses(data.responses);
        setTestComplete(true);
        
        // Format the results for display
        const styles = data.learning_style;
        const stylesArray = Object.keys(styles);
        
        // Transform the learning styles to match our database schema
        const learningStyles = {
          processingStyle: stylesArray.find(s => s === 'Active' || s === 'Reflective') || 'Active',
          perceptionStyle: stylesArray.find(s => s === 'Sensing' || s === 'Intuitive') || 'Intuitive',
          inputStyle: stylesArray.find(s => s === 'Visual' || s === 'Verbal') || 'Visual',
          understandingStyle: stylesArray.find(s => s === 'Sequential' || s === 'Global') || 'Sequential'
        };
        
        setLearningStyle(learningStyles);
        
        // Add a completion message to the chat
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: input },
          {
            role: 'bot',
            content: `Test complete! Your learning style profile:
            
• Processing: ${learningStyles.processingStyle}
• Perception: ${learningStyles.perceptionStyle}
• Input: ${learningStyles.inputStyle}
• Understanding: ${learningStyles.understandingStyle}

This information will help us personalize your learning experience.`,
          },
        ]);
        
        // Save the learning profile to the database only if the test is completely finished
        if (user?.id) {
          try {
            console.log('Saving learning profile with data:', JSON.stringify(learningStyles));
            
            // Try saving up to 3 times with increasing delay
            let saveSuccess = false;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (!saveSuccess && attempts < maxAttempts) {
              attempts++;
              try {
                const saveResponse = await fetch(`/api/users/${user.id}/learning-profile`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...learningStyles,
                assessmentDate: new Date(),
              }),
            });
            
                if (!saveResponse.ok) {
                  const errorData = await saveResponse.json();
                  console.error('Error response from API:', errorData);
                  throw new Error(errorData.error || errorData.details || 'Failed to save learning profile');
                }
                
                saveSuccess = true;
            showToast('success', 'Learning profile saved successfully!');
              } catch (saveError) {
                console.error(`Attempt ${attempts} failed:`, saveError);
                
                if (attempts >= maxAttempts) {
                  throw saveError;
                }
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          } catch (error) {
            console.error('Error saving learning profile:', error);
            showToast('error', 'Failed to save learning profile. Your results are displayed but not saved.');
            // Still set hasExistingProfile to true so user can see results
            setHasExistingProfile(true);
          }
        }
      }
    } catch (error) {
      console.error('Error in assessment:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleRetakeTest = async () => {
    if (!isAuthenticated || !user?.id) {
      router.push('/auth/login');
      return;
    }
    
    // Reset the state
    setMessages([]);
    setResponses([]);
    setTestComplete(false);
    setHasExistingProfile(false);
    
    // Start a new conversation
    await startConversation();
  };

  const handleCancelTest = () => {
    setMessages([]);
    setResponses([]);
    setTestComplete(false);
    setAssessmentStarted(false);
    setError(null);
  };

  const handleStartTest = async () => {
    if (!isAuthenticated || !user?.id) {
      router.push('/auth/login');
      return;
    }

    // Re-check profile before starting test
    await checkExistingProfile(user.id.toString());

    if (!hasExistingProfile) {
      startConversation();
    } else {
      // For users with existing profiles, we need to clear it first
      setHasExistingProfile(false);
      startConversation();
    }
  };

  // Show loading screen while checking for profile
  if (checkingProfile) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
            <p className="mt-4 text-gray-500">Loading your learning profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, show login prompt with better handling for users coming from signup
  if (!isAuthenticated) {
    // If we're still in retry mode and came from signup, show a better loading state
    if (authRetryCount < 5 && new URLSearchParams(window.location.search).get('fromSignup') === 'true') {
      return (
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8 text-center">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
              <p className="mt-4 text-gray-500">Setting up your account...</p>
              <p className="mt-2 text-sm text-gray-400">Please wait while we prepare your assessment.</p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-6 text-[var(--primary)]">Learning Style Assessment</h2>
          <div className="my-8">
            <p className="text-lg mb-4">Please log in to take the learning style assessment.</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-opacity-90"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Learning Profile Results if test is complete or user has an existing profile with valid learning style data
  if ((testComplete || (hasExistingProfile && learningStyle)) && learningStyle) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-[var(--primary)]">Your Learning Style Profile</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2 text-[var(--primary)]">Processing Style</h3>
              <p className="text-xl font-bold mb-2">{learningStyle.processingStyle}</p>
              <p className="text-gray-600">
                {learningStyle.processingStyle === 'Active' 
                  ? 'You learn best by doing, experimenting, and working with others.'
                  : 'You prefer to think things through and work alone.'}
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2 text-[var(--primary)]">Perception Style</h3>
              <p className="text-xl font-bold mb-2">{learningStyle.perceptionStyle}</p>
              <p className="text-gray-600">
                {learningStyle.perceptionStyle === 'Sensing' 
                  ? 'You focus on facts, details, and practical applications.'
                  : 'You prefer abstract concepts, theories, and discovering possibilities.'}
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2 text-[var(--primary)]">Input Style</h3>
              <p className="text-xl font-bold mb-2">{learningStyle.inputStyle}</p>
              <p className="text-gray-600">
                {learningStyle.inputStyle === 'Visual' 
                  ? 'You learn best from visual aids like charts, diagrams, and demonstrations.'
                  : 'You prefer written and spoken explanations.'}
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2 text-[var(--primary)]">Understanding Style</h3>
              <p className="text-xl font-bold mb-2">{learningStyle.understandingStyle}</p>
              <p className="text-gray-600">
                {learningStyle.understandingStyle === 'Sequential' 
                  ? 'You learn in small, incremental steps with logical progression.'
                  : 'You learn in large jumps, grasping the big picture first.'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-center mt-8">
            <p className="text-gray-700 mb-4 text-center">
              We'll use this information to personalize your learning experience on Learnify.
            </p>
            
            <button
              onClick={handleRetakeTest}
              className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Retake Assessment
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render either the start screen or the chatbot UI based on whether assessment is started
  if (!assessmentStarted) {
    // Render start screen
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-6 text-[var(--primary)]">Learning Style Assessment</h2>
          
              <p className="text-gray-700 mb-8 max-w-2xl mx-auto">
                Discover your learning preferences by taking our assessment. This will help us personalize your learning experience.
                The assessment consists of 4 questions and takes about 5 minutes to complete.
              </p>
              
              <div className="bg-gray-50 p-6 rounded-lg mb-8 max-w-2xl mx-auto">
                <h3 className="font-semibold text-lg mb-2">Important Note</h3>
                <p className="text-gray-600">
                  To ensure accurate results, please complete the entire assessment in one session. 
                  Your learning profile will only be updated after you've answered all questions.
                </p>
              </div>
              
              <button
                onClick={handleStartTest}
                className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Start Assessment
              </button>
              
              <button
                onClick={() => router.push('/dashboard')}
                className="ml-4 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Return to Dashboard
              </button>
        </div>
      </div>
    );
  }
  
  // Render chatbot UI for assessment when started
  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px]">
      <div className="p-4 bg-[var(--primary)] text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Learning Style Assessment</h2>
          <p className="text-sm opacity-90">
            Answer the questions thoughtfully to discover your learning style preferences.
          </p>
        </div>
        <button 
          onClick={handleCancelTest}
          className="px-3 py-1 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm"
        >
          Cancel
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {messages.length === 0 && !error ? (
            <div className="flex items-center justify-center h-full">
              {isLoading ? (
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary)]"></div>
                  <p className="mt-2 text-gray-500">Starting assessment...</p>
                </div>
              ) : (
                <p className="text-gray-500">Starting assessment session...</p>
              )}
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-[var(--primary)] text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 max-w-[80%] rounded-bl-none">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="text-center p-2 text-red-500 text-sm">
                  {error}
                </div>
              )}
              
              <div ref={chatEndRef} />
            </>
          )}
        </div>
      </div>
      
      {!testComplete && (
        <div className="border-t p-4">
          <form onSubmit={handleSend} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your response here..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={isLoading || messages.length === 0}
            />
            <button
              type="submit"
              disabled={isLoading || input.trim().length < 5 || messages.length === 0}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Please provide thoughtful responses (minimum 5 characters).
          </p>
        </div>
      )}
    </div>
  );
} 