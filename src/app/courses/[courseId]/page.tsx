'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/components/auth/AuthContext';

interface SyllabusItem {
  title: string;
  content?: string;
  readings?: string[];
  exercises?: number;
  duration?: string;
}

interface SyllabusData {
  chapters?: SyllabusItem[];
}

interface CourseDetails {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  category: string;
  chapters: number;
  duration?: string;
  level: string;
  syllabus?: SyllabusData | SyllabusItem[] | any;
  isEnrolled?: boolean;
}

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formattedSyllabus, setFormattedSyllabus] = useState<SyllabusItem[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        let url = `/api/courses/${courseId}`;
        
        // If user is authenticated, add userId to check enrollment status
        if (user?.id) {
          url = `/api/courses/${courseId}?userId=${user.id}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch course details');
        }
        
        const data = await response.json();
        
        // Parse syllabus if it's a string
        if (typeof data.syllabus === 'string') {
          try {
            data.syllabus = JSON.parse(data.syllabus);
          } catch (e) {
            console.error('Error parsing syllabus JSON:', e);
          }
        }
        
        setCourse(data);
        
        // Process syllabus data
        let syllabusChapters: SyllabusItem[] = [];
        
        if (data.syllabus) {
          // If syllabus has a chapters array (as in our seed data)
          if (data.syllabus.chapters && Array.isArray(data.syllabus.chapters)) {
            syllabusChapters = data.syllabus.chapters;
          }
          // If syllabus is directly an array of chapters
          else if (Array.isArray(data.syllabus)) {
            syllabusChapters = data.syllabus;
          }
        }
        
        // If we still don't have syllabus data, generate it based on chapter count
        if (syllabusChapters.length === 0 && data.chapters > 0) {
          syllabusChapters = Array.from({ length: data.chapters }, (_, idx) => ({
            title: `Chapter ${idx + 1}`,
            duration: `${Math.floor(Math.random() * 2) + 1} hours`
          }));
        }
        
        setFormattedSyllabus(syllabusChapters);
      } catch (err) {
        setError('Error loading course details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchCourse();
    }
  }, [courseId, user?.id]);

  const handleEnroll = async () => {
    if (!course) return;
    
    if (!isAuthenticated) {
      showToast('error', 'Please log in to enroll in this course');
      router.push('/auth/login');
      return;
    }
    
    try {
      setEnrolling(true);
      
      if (!user?.id) {
        throw new Error('User is not authenticated');
      }
      
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        // If user is already enrolled, just redirect to the first chapter
        if (errorData.error && errorData.error.includes('already enrolled')) {
          setCourse(prevCourse => ({
            ...prevCourse!,
            isEnrolled: true
          }));
          showToast('info', 'You are already enrolled in this course');
          setTimeout(() => {
            router.push(`/courses/${courseId}/chapters/1`);
          }, 1000);
          return;
        }
        throw new Error(errorData.error || `Failed to enroll: ${response.statusText}`);
      }
      
      // Update the course state to reflect enrollment
      setCourse(prevCourse => {
        if (!prevCourse) return null;
        return {
          ...prevCourse,
          isEnrolled: true
        };
      });
      
      // Show success message
      showToast('success', 'Successfully enrolled in course!');
      
      // Redirect to first chapter after a short delay
      setTimeout(() => {
        router.push(`/courses/${courseId}/chapters/1`);
      }, 1500);
    } catch (err) {
      console.error('Error enrolling in course:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to enroll in course. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartLearning = () => {
    router.push(`/courses/${courseId}/chapters/1`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !course) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-gray-600">{error || 'Course not found'}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Course Header */}
        <div className="bg-[var(--primary)] text-white p-8 rounded-xl mb-8">
          <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="bg-white/20 px-3 py-1 rounded-full">{course.category}</div>
            <div className="bg-white/20 px-3 py-1 rounded-full">{course.level}</div>
            <div className="bg-white/20 px-3 py-1 rounded-full">{course.duration || '10 hours'}</div>
          </div>
        </div>

        {/* Course Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">About this Course</h2>
              <p className="text-gray-700">{course.description}</p>
            </div>

            {/* Syllabus */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Course Syllabus</h2>
              {formattedSyllabus.length > 0 ? (
                <div className="space-y-4">
                  {formattedSyllabus.map((chapter, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="bg-[var(--primary)] rounded-full w-8 h-8 flex items-center justify-center mr-3 text-white">
                            {idx + 1}
                          </div>
                          <span className="font-medium">{chapter.title}</span>
                        </div>
                        <span className="text-gray-500 text-sm">
                          {chapter.duration || (chapter.exercises ? `${chapter.exercises} exercises` : '1-2 hours')}
                        </span>
                      </div>
                      
                      {/* Show chapter content if available */}
                      {chapter.content && (
                        <div className="mt-3 ml-11 text-sm text-gray-600">
                          {chapter.content}
                        </div>
                      )}
                      
                      {/* Show readings if available */}
                      {chapter.readings && chapter.readings.length > 0 && (
                        <div className="mt-3 ml-11">
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">Recommended Readings:</h4>
                          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                            {chapter.readings.map((reading, readingIdx) => (
                              <li key={readingIdx}>{reading}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Show exercises count if available */}
                      {chapter.exercises && (
                        <div className="mt-2 ml-11">
                          <span className="text-xs font-semibold bg-[var(--primary)] text-white px-2 py-1 rounded-full">
                            {chapter.exercises} exercises
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Syllabus information is not available for this course.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              {course.imageUrl && (
                <img 
                  src={course.imageUrl} 
                  alt={course.title} 
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}
              
              <h3 className="text-lg font-bold mb-2">{course.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
                <span>{course.level}</span>
                <span>•</span>
                <span>{course.chapters} chapter{course.chapters !== 1 ? 's' : ''}</span>
              </div>
              
              {course.isEnrolled ? (
                <button
                  onClick={handleStartLearning}
                  className="w-full py-3 font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors"
                >
                  Continue Learning
                </button>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full py-3 font-semibold text-white bg-[var(--primary)] hover:bg-opacity-90 rounded-lg shadow-sm transition-colors disabled:opacity-70"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll in Course'}
                </button>
              )}
              
              <div className="mt-6 space-y-3">
                <div className="flex items-start">
                  <div className="mt-1 text-[var(--primary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold">Self-paced Learning</h4>
                    <p className="text-xs text-gray-600">Learn at your own pace with 24/7 access</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mt-1 text-[var(--primary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold">AI-Powered Support</h4>
                    <p className="text-xs text-gray-600">Get personalized help with our AI assistant</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mt-1 text-[var(--primary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold">Interactive Content</h4>
                    <p className="text-xs text-gray-600">Engage with quizzes and exercises</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 