'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Define interfaces for type safety
interface SyllabusItem {
  title: string;
  duration: string;
}

interface Course {
  id: string;
  title: string;
  lectures: number;
  university: string;
  syllabus: SyllabusItem[];
}

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onStartCourse: (courseId: string) => void;
}

// Enhanced course data with syllabus information
const coursesData: Course[] = [
  {
    id: '1',
    title: 'Fundamentals of Computer Science',
    lectures: 24,
    university: 'University',
    syllabus: [
      { title: 'Introduction to Computing', duration: '2 hours' },
      { title: 'Computer Organization and Architecture', duration: '3 hours' },
      { title: 'Data Representation', duration: '2 hours' },
      { title: 'Operating Systems', duration: '3 hours' },
      { title: 'Algorithms and Problem Solving', duration: '4 hours' },
      { title: 'Introduction to Programming', duration: '5 hours' },
      { title: 'Data Structures', duration: '5 hours' }
    ]
  },
  {
    id: '2',
    title: 'Object Oriented Programming',
    lectures: 24,
    university: 'University',
    syllabus: [
      { title: 'OOP Concepts and Principles', duration: '3 hours' },
      { title: 'Classes and Objects', duration: '3 hours' },
      { title: 'Inheritance and Polymorphism', duration: '4 hours' },
      { title: 'Abstraction and Encapsulation', duration: '3 hours' },
      { title: 'Design Patterns', duration: '5 hours' },
      { title: 'Exception Handling', duration: '3 hours' },
      { title: 'Object-Oriented Analysis and Design', duration: '3 hours' }
    ]
  },
  {
    id: '3',
    title: 'Technical Report Writing',
    lectures: 24,
    university: 'University',
    syllabus: [
      { title: 'Introduction to Technical Writing', duration: '2 hours' },
      { title: 'Document Planning and Research', duration: '3 hours' },
      { title: 'Organization and Structure', duration: '3 hours' },
      { title: 'Technical Style and Language', duration: '3 hours' },
      { title: 'Visual Elements and Data Presentation', duration: '4 hours' },
      { title: 'Editing and Revision', duration: '3 hours' },
      { title: 'Collaborative Writing', duration: '2 hours' },
      { title: 'Documentation Tools', duration: '4 hours' }
    ]
  },
  {
    id: '4',
    title: 'Introduction to Calculus I',
    lectures: 24,
    university: 'University',
    syllabus: [
      { title: 'Functions and Limits', duration: '4 hours' },
      { title: 'Derivatives and Rules of Differentiation', duration: '5 hours' },
      { title: 'Applications of Derivatives', duration: '4 hours' },
      { title: 'Integration', duration: '5 hours' },
      { title: 'Applications of Integration', duration: '4 hours' },
      { title: 'Transcendental Functions', duration: '2 hours' }
    ]
  },
  {
    id: '5',
    title: 'Introduction to Calculus II',
    lectures: 24,
    university: 'University',
    syllabus: [
      { title: 'Review of Integration', duration: '3 hours' },
      { title: 'Techniques of Integration', duration: '5 hours' },
      { title: 'Improper Integrals', duration: '3 hours' },
      { title: 'Infinite Series', duration: '4 hours' },
      { title: 'Power Series', duration: '3 hours' },
      { title: 'Parametric Equations and Polar Coordinates', duration: '4 hours' },
      { title: 'Vector Calculus', duration: '2 hours' }
    ]
  }
];

// Modal component for course details
function CourseModal({ isOpen, onClose, course, onStartCourse }: CourseModalProps) {
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
            {course.lectures} Lectures • {course.university}
          </div>
        </div>
        
        {/* Content - Syllabus */}
        <div className="overflow-y-auto p-6 flex-grow">
          <h3 className="text-lg font-bold mb-4">Course Syllabus</h3>
          <div className="space-y-4">
            {course.syllabus.map((item: SyllabusItem, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center">
                  <div className="bg-[var(--primary)] bg-opacity-10 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-[var(--primary)]">
                    {idx + 1}
                  </div>
                  <span className="font-medium">{item.title}</span>
                </div>
                <span className="text-gray-500 text-sm">{item.duration}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer with action button */}
        <div className="p-6 border-t border-gray-200 flex justify-center">
          <button 
            onClick={() => onStartCourse(course.id)}
            className="py-2 px-8 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-300 font-medium flex items-center"
          >
            <span>Learn Course</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
  
  // Use createPortal only on client side
  return createPortal(modalContent, document.body);
}

export function CoursesSection() {
  const [activeTab, setActiveTab] = useState('All Courses');
  const tabs = ['All Courses', 'Newest Courses', 'Top Rated'];
  
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  const router = useRouter();
  
  const handleViewCourse = (course: Course) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
  };
  
  const handleStartCourse = (courseId: string) => {
    // Redirect to the course detail page
    router.push(`/courses/${courseId}`);
    setIsModalOpen(false);
  };
  
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
      <div className="space-y-4">
        {coursesData.map((course, index) => (
          <div 
            key={course.id} 
            className={`flex justify-between items-center py-4 border-b last:border-b-0 animate-fadeIn`}
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <div className="flex-1">
              <h3 className="font-medium text-lg">{course.title}</h3>
              <div className="text-gray-500 text-sm">{course.lectures} Lectures</div>
            </div>
            <div className="flex items-center">
              <span className="text-gray-500 mr-4">{course.university}</span>
              <button 
                className="py-2 px-4 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors duration-300 text-sm"
                onClick={() => handleViewCourse(course)}
              >
                View Course
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Course Modal */}
      {selectedCourse && (
        <CourseModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          course={selectedCourse}
          onStartCourse={handleStartCourse}
        />
      )}
    </div>
  );
} 