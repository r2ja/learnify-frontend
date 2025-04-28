'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';

export function LearningAssessment() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [responses, setResponses] = useState<Array<string>>([]); // Only validated responses
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testComplete, setTestComplete] = useState(false);
  const [learningStyle, setLearningStyle] = useState<{
    processingStyle: string;
    perceptionStyle: string;
    inputStyle: string;
    understandingStyle: string;
  } | null>(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Check if user already has a learning profile
  useEffect(() => {
    const checkExistingProfile = async () => {
      if (!user?.id) return;

      try {
        console.log('Checking for existing learning profile for user:', user.id);
        const response = await fetch(`/api/users/${user.id}/learning-profile`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch profile: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Learning profile API response:', data);
        
        // The profile data is in the 'profile' property
        const profile = data.profile;
        
        // Check if profile exists and has learning style data
        if (profile) {
          console.log('Existing profile found:', profile);
          setHasExistingProfile(true);
          
          // Format the learning style information with the actual values from API
          const styleInfo = {
            processingStyle: profile.processingStyle,
            perceptionStyle: profile.perceptionStyle,
            inputStyle: profile.inputStyle,
            understandingStyle: profile.understandingStyle
          };
          
          setLearningStyle(styleInfo);
        } else {
          console.log('No learning profile found');
          setHasExistingProfile(false);
        }
      } catch (error: unknown) {
        const errorToLog = error instanceof Error ? error.message : String(error);
        console.error('Error checking learning profile:', errorToLog);
        setHasExistingProfile(false);
      }
    };

    checkExistingProfile();
  }, [user]);

  // Start the conversation when the component mounts and user is ready
  useEffect(() => {
    if (hasExistingProfile || !user) return;
    
    const startConversation = async () => {
      try {
        setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };
    
    startConversation();
  }, [hasExistingProfile, user]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus the text input
  useEffect(() => {
    if (!testComplete && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [testComplete, isLoading, messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

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
        
        // Save the learning profile to the database
        if (user?.id) {
          try {
            await fetch(`/api/users/${user.id}/learning-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
                ...learningStyles,
                assessmentDate: new Date(),
        }),
      });
      
            showToast('success', 'Learning profile saved successfully!');
          } catch (error) {
            console.error('Error saving learning profile:', error);
            showToast('error', 'Failed to save learning profile.');
          }
        }
      }
    } catch (error) {
      console.error('Error in assessment:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleRetakeTest = async () => {
    if (!user?.id) return;
    
    try {
      // Reset the state
      setMessages([]);
      setResponses([]);
      setTestComplete(false);
      setLearningStyle(null);
      
      // Start a new conversation
      setIsLoading(true);
      const res = await fetch('http://localhost:8000/start/');
      
      if (!res.ok) {
        throw new Error(`Failed to start assessment: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.question) {
        setMessages([{ role: 'bot', content: data.question }]);
      }
    } catch (error) {
      console.error('Error restarting conversation:', error);
      setError('Error starting assessment. Please ensure the assessment server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render Learning Profile Results if test is complete or user has an existing profile
  if ((testComplete || hasExistingProfile) && learningStyle) {
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
    
  // Render chatbot UI for assessment
  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px]">
      <div className="p-4 bg-[var(--primary)] text-white">
        <h2 className="text-xl font-semibold">Learning Style Assessment</h2>
        <p className="text-sm opacity-90">
          Answer the questions thoughtfully to discover your learning style preferences.
        </p>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {!user ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <p className="text-lg mb-3">Please log in to take the learning style assessment.</p>
              <button
                onClick={() => router.push('/auth/login')}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-opacity-90"
              >
                Log In
              </button>
            </div>
          </div>
        ) : (
          <>
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
              <div className="space-y-4">
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
              </div>
            )}
          </>
        )}
      </div>
      
      {user && !testComplete && (
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