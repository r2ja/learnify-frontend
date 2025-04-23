'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { courseApi } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'react-hot-toast';

// Define interfaces for type safety
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

interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category: string;
  chapters: number;
  duration: string;
  level: string;
  syllabus?: SyllabusData | SyllabusItem[] | any;
  isEnrolled?: boolean;
}

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onStartCourse: (courseId: string) => void;
  onEnroll: (courseId: string) => Promise<void>;
  isEnrolling: boolean;
}

// Modal component for course details
function CourseModal({ isOpen, onClose, course, onStartCourse, onEnroll, isEnrolling }: CourseModalProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    
    // Prevent scrolling of the body when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  if (!isOpen || !mounted) return null;
  
  // Extract syllabus chapters from course data
  let syllabusChapters: SyllabusItem[] = [];
  
  if (course.syllabus) {
    // If syllabus has a chapters array (as in our seed data)
    if (course.syllabus.chapters && Array.isArray(course.syllabus.chapters)) {
      syllabusChapters = course.syllabus.chapters;
    }
    // If syllabus is directly an array of chapters
    else if (Array.isArray(course.syllabus)) {
      syllabusChapters = course.syllabus;
    }
  }
  
  // If we still don't have syllabus data, generate it based on chapter count
  if (syllabusChapters.length === 0 && course.chapters > 0) {
    syllabusChapters = Array.from({ length: course.chapters }, (_, idx) => ({
      title: `Chapter ${idx + 1}`,
      duration: `${Math.floor(Math.random() * 2) + 1} hours`
    }));
  }
  
  // Portal content
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-[5px] z-[9999] flex items-center justify-center p-4 animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
        style={{ animationDuration: '250ms' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--primary)] text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 text-white hover:text-gray-200 transition-colors bg-black/20 hover:bg-black/30 p-1.5 rounded-full"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold">{course.title}</h2>
          <div className="text-white/80 mt-1">
            {course.chapters} Lectures • {course.level}
          </div>
        </div>
        
        {/* Content - Syllabus */}
        <div className="overflow-y-auto p-6 flex-grow">
          <h3 className="text-lg font-bold mb-4">Course Syllabus</h3>
          <div className="space-y-4">
            {syllabusChapters.map((chapter, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="bg-[var(--primary)] bg-opacity-10 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-[var(--primary)]">
                      {idx + 1}
                    </div>
                    <span className="font-medium">{chapter.title}</span>
                  </div>
                  <span className="text-gray-500 text-sm">
                    {chapter.duration || (chapter.exercises ? `${chapter.exercises} exercises` : `1-2 hours`)}
                  </span>
                </div>
                
                {/* Show chapter content if available */}
                {chapter.content && (
                  <div className="mt-2 ml-11 text-sm text-gray-600">
                    {chapter.content.length > 200 
                      ? `${chapter.content.substring(0, 200)}...` 
                      : chapter.content}
                  </div>
                )}
                
                {/* Show readings if available */}
                {chapter.readings && chapter.readings.length > 0 && (
                  <div className="mt-2 ml-11">
                    <span className="text-xs font-semibold text-gray-500">Recommended reading:</span>
                    <span className="text-xs text-gray-500 ml-1">{chapter.readings[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer with action buttons */}
        <div className="p-6 border-t border-gray-200 flex justify-center space-x-4">
          {course.isEnrolled ? (
            <button 
              onClick={() => onStartCourse(course.id)}
              className="py-2 px-8 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors duration-300 font-medium flex items-center"
            >
              <span>Continue Learning</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          ) : (
            <>
              <button 
                onClick={() => onEnroll(course.id)}
                disabled={isEnrolling}
                className="py-2 px-8 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-300 font-medium flex items-center"
              >
                <span>{isEnrolling ? 'Enrolling...' : 'Enroll Now'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button 
                onClick={() => onStartCourse(course.id)}
                className="py-2 px-8 rounded-md text-[var(--primary)] bg-white border border-[var(--primary)] hover:bg-gray-50 transition-colors duration-300 font-medium flex items-center"
              >
                <span>Preview Course</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
  
  // Use createPortal only on client side
  return createPortal(modalContent, document.body);
}

export default function CoursesSection() {
  const { user, loading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState('All Courses');
  const tabs = ['All Courses', 'Enrolled Courses'];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolledLoading, setEnrolledLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolledError, setEnrolledError] = useState<string | null>(null);
  const [fetchingCourseDetails, setFetchingCourseDetails] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const { showToast } = useToast();
  
  // Fetch all courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/courses?userId=${user?.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }
        const data = await response.json();
        setCourses(data);
      } catch (error) {
        console.error('Error fetching courses:', error);
        setError('Failed to load courses');
        toast.error('Failed to load courses');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && user?.id) {
      fetchCourses();
    }
  }, [user?.id, userLoading]);
  
  // Fetch enrolled courses
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      try {
        setEnrolledLoading(true);
        setEnrolledError(null);
        const response = await fetch(`/api/courses/enrolled?userId=${user?.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch enrolled courses');
        }
        const data = await response.json();
        setEnrolledCourses(data);
      } catch (error) {
        console.error('Error fetching enrolled courses:', error);
        setEnrolledError('Failed to load enrolled courses');
        toast.error('Failed to load enrolled courses');
      } finally {
        setEnrolledLoading(false);
      }
    };

    if (!userLoading && user?.id) {
      fetchEnrolledCourses();
    }
  }, [user?.id, userLoading]);
  
  // Get the appropriate courses and loading state based on active tab
  const { currentCourses, isLoading, currentError } = useMemo(() => ({
    currentCourses: activeTab === 'Enrolled Courses' ? enrolledCourses : courses,
    isLoading: activeTab === 'Enrolled Courses' ? enrolledLoading : loading,
    currentError: activeTab === 'Enrolled Courses' ? enrolledError : error
  }), [activeTab, courses, enrolledCourses, loading, enrolledLoading, error, enrolledError]);
  
  const handleViewCourse = async (course: Course) => {
    try {
      setFetchingCourseDetails(true);
      
      // Fetch detailed course info including syllabus
      const detailedCourse = await courseApi.getById(course.id);
      
      // Ensure syllabus data is properly parsed if it's a string
      if (typeof detailedCourse.syllabus === 'string') {
        try {
          detailedCourse.syllabus = JSON.parse(detailedCourse.syllabus);
        } catch (e) {
          console.error('Error parsing syllabus JSON:', e);
        }
      }
      
      setSelectedCourse(detailedCourse);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error fetching course details:', err);
      // Fall back to showing the basic course data
      setSelectedCourse(course);
      setIsModalOpen(true);
    } finally {
      setFetchingCourseDetails(false);
    }
  };
  
  const handleStartCourse = (courseId: string) => {
    // Redirect to the course detail page
    router.push(`/courses/${courseId}`);
    setIsModalOpen(false);
  };

  const handleEnroll = async (courseId: string) => {
    try {
      setEnrolling(true);
      
      if (!user?.id) {
        showToast('error', 'Please log in to enroll in courses');
        return;
      }
      
      // Make direct fetch call instead of using the API client
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to enroll: ${response.statusText}`);
      }
      
      // Update the course list to reflect enrollment
      setCourses(prevCourses => 
        prevCourses.map(course => 
          course.id === courseId 
            ? { ...course, isEnrolled: true }
            : course
        )
      );
      
      // Update the selected course if it's the one being enrolled
      if (selectedCourse && selectedCourse.id === courseId) {
        setSelectedCourse({
          ...selectedCourse,
          isEnrolled: true
        });
      }
      
      // Refresh enrolled courses list
      const enrolledResponse = await fetch(`/api/courses/enrolled?userId=${user.id}`);
      if (enrolledResponse.ok) {
        const enrolledData = await enrolledResponse.json();
        setEnrolledCourses(enrolledData);
      }
      
      // Show success message
      showToast('success', 'Successfully enrolled in course!');
      
      // Close the modal after successful enrollment
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error enrolling in course:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to enroll in course. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle withdrawal from a course
  const handleWithdraw = async (courseId: string) => {
    try {
      if (!user?.id) {
        showToast('error', 'You must be logged in to withdraw from a course');
        return;
      }
      
      setWithdrawing(true);
      
      try {
        const response = await fetch(`/api/courses/${courseId}/withdraw`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });
        
        // Try to parse the response as JSON
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Failed to withdraw: ${response.statusText}`);
        }
        
        // Success path
        // Update local state to reflect withdrawal
        setCourses(prevCourses => 
          prevCourses.map(course => 
            course.id === courseId 
              ? { ...course, isEnrolled: false }
              : course
          )
        );
        
        // Remove from enrolled courses
        setEnrolledCourses(prev => prev.filter(course => course.id !== courseId));
        
        // Close menu
        setMenuOpen(null);
        
        // Show success message
        showToast('success', 'Successfully withdrew from course');
      } catch (responseError) {
        console.error('Error with withdraw request:', responseError);
        showToast('error', responseError instanceof Error ? responseError.message : 'Failed to withdraw from course');
        throw responseError; // rethrow to be caught by the outer try-catch
      }
    } catch (err) {
      console.error('Error withdrawing from course:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to withdraw from course');
    } finally {
      setWithdrawing(false);
    }
  };
  
  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-sm relative z-10 animate-fadeIn animation-delay-300">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">My Courses</h2>
        <Link 
          href="/courses" 
          className="text-sm text-[var(--primary)] hover:underline"
        >
          View All
        </Link>
      </div>
      
      {/* Tabs */}
      <div className="flex flex-wrap space-x-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`pb-1 transition-all duration-300 ${
              activeTab === tab 
              ? 'text-black font-semibold border-b-2 border-[var(--primary)]' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      
      {/* Course List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : currentError ? (
        <div className="py-10 text-center">
          <p className="text-red-500">{currentError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 text-[var(--primary)] underline"
          >
            Try again
          </button>
        </div>
      ) : currentCourses.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-500">
            {activeTab === 'Enrolled Courses' 
              ? 'You haven\'t enrolled in any courses yet.' 
              : 'No courses available at the moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentCourses.map((course, index) => (
            <div 
              key={course.id} 
              className={`flex justify-between items-center py-4 border-b last:border-b-0 animate-fadeIn`}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="flex-1">
                <h3 className="font-medium text-lg">{course.title}</h3>
                <div className="text-gray-500 text-sm">{course.chapters} Lectures</div>
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 mr-4">{course.level}</span>
                {!course.isEnrolled ? (
                  <button 
                    className="py-2 px-4 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-300 text-sm"
                    onClick={() => handleViewCourse(course)}
                  >
                    View Course
                  </button>
                ) : (
                  <div className="flex items-center relative">
                    <button 
                      className="py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors duration-300 text-sm mr-2"
                      onClick={() => router.push(`/courses/${course.id}`)}
                    >
                      Continue Learning
                    </button>
                    <button
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
                      onClick={() => setMenuOpen(menuOpen === course.id ? null : course.id)}
                      aria-label="Course options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {menuOpen === course.id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg py-1 z-20 w-48"
                      >
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                          onClick={() => handleWithdraw(course.id)}
                          disabled={withdrawing}
                        >
                          {withdrawing ? (
                            <>
                              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Withdraw from Course
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Course Modal */}
      {selectedCourse && (
        <CourseModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          course={selectedCourse}
          onStartCourse={handleStartCourse}
          onEnroll={handleEnroll}
          isEnrolling={enrolling}
        />
      )}
    </div>
  );
} 