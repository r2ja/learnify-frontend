'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Award, ChevronRight, PlayCircle, Users, BarChart } from 'lucide-react';

// Types
interface Chapter {
  id: string;
  title: string;
  description: string;
  duration: string;
  isCompleted?: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  aiTutor: string;
  adaptiveLearning: string[];
  chapters: Chapter[];
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  image: string;
  category: string;
  students: number;
  rating: number;
}

// Mock course data
const coursesData: { [key: string]: Course } = {
  "cs101": {
    id: "cs101",
    title: "Introduction to Computer Science",
    description: "Learn the fundamentals of computer science and programming.",
    fullDescription: "This comprehensive course covers the core concepts of computer science, from basic programming principles to fundamental algorithms and data structures. You'll gain a solid foundation that will prepare you for advanced topics in the field.",
    aiTutor: "CompSci-GPT",
    adaptiveLearning: ["Interactive code examples", "Visual explanations", "AI-generated practice problems"],
    chapters: [
      {
        id: "cs101-ch1",
        title: "Introduction to Programming Concepts",
        description: "Learn the basics of programming logic and structure.",
        duration: "45 mins",
        isCompleted: false,
      },
      {
        id: "cs101-ch2",
        title: "Variables and Data Types",
        description: "Understanding different types of data and how to store them.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "cs101-ch3",
        title: "Control Flow: Conditions and Loops",
        description: "How to control program execution with if statements and loops.",
        duration: "75 mins",
        isCompleted: false,
      },
      {
        id: "cs101-ch4",
        title: "Functions and Modularity",
        description: "Creating reusable code blocks and structuring your program.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "cs101-ch5",
        title: "Introduction to Data Structures",
        description: "Learn about arrays, lists, and basic collection types.",
        duration: "90 mins",
        isCompleted: false,
      }
    ],
    duration: "6 hours",
    level: "Beginner",
    image: "/path-to-image.jpg",
    category: "Computer Science",
    students: 3452,
    rating: 4.8
  },
  "web101": {
    id: "web101",
    title: "Web Development Fundamentals",
    description: "Master the basics of HTML, CSS, and JavaScript.",
    fullDescription: "This course is designed to introduce you to modern web development. You'll learn how to create responsive websites using HTML for structure, CSS for styling, and JavaScript for interactivity. By the end, you'll have built several web projects to showcase your new skills.",
    aiTutor: "WebDev-GPT",
    adaptiveLearning: ["Live code rendering", "Visual design feedback", "Interactive website builder"],
    chapters: [
      {
        id: "web101-ch1",
        title: "HTML Basics",
        description: "Structure your web content with HTML tags and elements.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "web101-ch2",
        title: "CSS Styling",
        description: "Make your websites beautiful with CSS styling.",
        duration: "75 mins",
        isCompleted: false,
      },
      {
        id: "web101-ch3",
        title: "Responsive Design",
        description: "Ensure your websites work on all devices and screen sizes.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "web101-ch4",
        title: "JavaScript Fundamentals",
        description: "Add interactivity to your websites with JavaScript.",
        duration: "90 mins",
        isCompleted: false,
      },
      {
        id: "web101-ch5",
        title: "Building a Complete Website",
        description: "Put it all together to create a functional website.",
        duration: "120 mins",
        isCompleted: false,
      }
    ],
    duration: "8 hours",
    level: "Beginner",
    image: "/path-to-image.jpg",
    category: "Web Development",
    students: 5687,
    rating: 4.6
  },
  "intro-to-programming": {
    id: "intro-to-programming",
    title: "Introduction to Programming",
    description: "Learn the fundamentals of programming with this comprehensive course.",
    fullDescription: "This course provides a solid foundation in programming concepts for beginners. You'll learn key programming principles, logic structures, and problem-solving techniques that apply across all programming languages.",
    aiTutor: "CodeMaster-AI",
    adaptiveLearning: ["Personalized code feedback", "Visual algorithm explanations", "Adaptive difficulty"],
    chapters: [
      {
        id: "intro-ch1",
        title: "What is Programming?",
        description: "Understanding the basics of what programming is and how it works.",
        duration: "30 mins",
        isCompleted: false,
      },
      {
        id: "intro-ch2",
        title: "Variables and Data Types",
        description: "Learn how to store and manipulate different types of data.",
        duration: "45 mins",
        isCompleted: false,
      },
      {
        id: "intro-ch3",
        title: "Control Structures",
        description: "Understand how to control program flow with conditionals and loops.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "intro-ch4",
        title: "Functions and Modularity",
        description: "Breaking down programs into reusable components.",
        duration: "45 mins",
        isCompleted: false,
      }
    ],
    duration: "10 hours",
    level: "Beginner",
    image: "/assets/images/courses/programming.jpg",
    category: "Computer Science",
    students: 8924,
    rating: 4.7
  },
  "data-structures": {
    id: "data-structures",
    title: "Data Structures and Algorithms",
    description: "Master the essential data structures and algorithms for software development.",
    fullDescription: "This course explores fundamental data structures like arrays, linked lists, trees, and hash tables, along with essential algorithms for sorting, searching, and graph traversal. You'll learn how to analyze algorithm efficiency and choose the right data structure for different problems.",
    aiTutor: "AlgoSmart-AI",
    adaptiveLearning: ["Algorithm visualizations", "Runtime complexity analysis", "Custom problem generation"],
    chapters: [
      {
        id: "dsa-ch1",
        title: "Introduction to Algorithm Analysis",
        description: "Learn how to analyze and compare algorithm efficiency.",
        duration: "45 mins",
        isCompleted: false,
      },
      {
        id: "dsa-ch2",
        title: "Arrays and Linked Lists",
        description: "Understanding fundamental linear data structures.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "dsa-ch3",
        title: "Stacks and Queues",
        description: "Implementing and using these important abstract data types.",
        duration: "45 mins",
        isCompleted: false,
      },
      {
        id: "dsa-ch4",
        title: "Trees and Binary Search Trees",
        description: "Working with hierarchical data structures.",
        duration: "90 mins",
        isCompleted: false,
      }
    ],
    duration: "15 hours",
    level: "Intermediate",
    image: "/assets/images/courses/data-structures.jpg",
    category: "Computer Science",
    students: 5432,
    rating: 4.8
  },
  "machine-learning": {
    id: "machine-learning",
    title: "Introduction to Machine Learning",
    description: "Explore the basics of machine learning and build your first models.",
    fullDescription: "This course introduces the fundamentals of machine learning, including supervised and unsupervised learning approaches. You'll learn about key algorithms, model evaluation, and how to implement basic ML solutions to real-world problems.",
    aiTutor: "ML-Tutor",
    adaptiveLearning: ["Interactive data visualizations", "Model performance analysis", "Custom dataset generation"],
    chapters: [
      {
        id: "ml-ch1",
        title: "What is Machine Learning?",
        description: "An overview of machine learning concepts and applications.",
        duration: "40 mins",
        isCompleted: false,
      },
      {
        id: "ml-ch2",
        title: "Supervised Learning Basics",
        description: "Understanding classification and regression problems.",
        duration: "60 mins",
        isCompleted: false,
      },
      {
        id: "ml-ch3",
        title: "Model Evaluation",
        description: "How to measure and improve model performance.",
        duration: "50 mins",
        isCompleted: false,
      },
      {
        id: "ml-ch4",
        title: "Introduction to Neural Networks",
        description: "Building your first neural network model.",
        duration: "75 mins",
        isCompleted: false,
      }
    ],
    duration: "12 hours",
    level: "Intermediate",
    image: "/assets/images/courses/machine-learning.jpg",
    category: "Data Science",
    students: 6789,
    rating: 4.6
  }
};

export function CourseDetail({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [enrollButtonText, setEnrollButtonText] = useState("Enroll in Course");
  const [isEnrolled, setIsEnrolled] = useState(false);

  // Get the course data based on courseId
  const course = coursesData[courseId];

  if (!course) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md bg-white rounded-lg shadow-md p-8">
          <div className="mb-4">
            <BookOpen size={48} className="mx-auto text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Course Not Found</h2>
          <p className="mb-6 text-gray-600">The course you're looking for doesn't exist or has been removed.</p>
          <button 
            onClick={() => router.push('/courses')}
            className="w-full py-3 bg-[var(--primary)] text-white rounded-md hover:brightness-110"
          >
            Browse All Courses
          </button>
        </div>
      </div>
    );
  }

  const handleEnroll = () => {
    setEnrollButtonText("Enrolled ✓");
    setIsEnrolled(true);
    
    // In a real app, you would make an API call to enroll the user
    setTimeout(() => {
      router.push(`/courses/${courseId}/chapter/${course.chapters[0].id}`);
    }, 1000);
  };

  return (
    <div className="w-full p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center text-sm">
          <Link href="/courses" className="text-gray-500 hover:text-[var(--primary)]">
            Courses
          </Link>
          <ChevronRight size={16} className="mx-2 text-gray-400" />
          <span className="text-gray-700">{course.title}</span>
        </div>

        {/* Course Header Section - Khan Academy style */}
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            {/* Course Info */}
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">
                {course.title}
              </h1>
              
              <div className="flex flex-wrap items-center text-sm mb-4 gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  course.level === 'Beginner' ? 'bg-green-100 text-green-700' :
                  course.level === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {course.level}
                </span>
                <span className="text-gray-500 flex items-center">
                  <Clock size={14} className="mr-1" />
                  {course.duration}
                </span>
              </div>
              
              <p className="text-gray-700 mb-4">
                {course.fullDescription}
              </p>
              
              <div className="mb-4">
                <h3 className="text-md font-semibold mb-2">AI-Powered Learning</h3>
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full mr-2 flex items-center justify-center text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M12 2c5.522 0 10 4.478 10 10s-4.478 10-10 10S2 17.522 2 12 6.478 2 12 2zm-1.5 14h3v-2h-3v2zm3.5-5c0-.827-.673-1.5-1.5-1.5h-1c-.827 0-1.5.673-1.5 1.5v.5h2v-.5h1v.5c0 .827-.673 1.5-1.5 1.5h-1c-.827 0-1.5-.673-1.5-1.5V11h-2v.5c0 1.93 1.57 3.5 3.5 3.5h1c1.93 0 3.5-1.57 3.5-3.5V11z"/>
                    </svg>
                  </div>
                  <p className="font-medium">Powered by {course.aiTutor}</p>
                </div>
                <ul className="list-disc pl-10 text-sm text-gray-600 space-y-1">
                  {course.adaptiveLearning.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
              
              {/* Enroll button at the top for mobile */}
              <div className="md:hidden mb-4">
                <button
                  onClick={handleEnroll}
                  disabled={isEnrolled}
                  className={`w-full py-3 rounded-md ${
                    isEnrolled
                      ? 'bg-green-500 text-white cursor-default'
                      : 'bg-[var(--primary)] text-white hover:brightness-110'
                  }`}
                >
                  {enrollButtonText}
                </button>
              </div>
            </div>
            
            {/* Course Progress Card - Khan Academy style */}
            <div className="md:w-80">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h3 className="text-lg font-bold mb-4">Your Learning</h3>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Overall Completion</span>
                    <span>0%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-full w-0 bg-[var(--primary)] rounded-full"></div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 mb-4">
                  <p>This AI-powered course adapts to your learning style and pace as you progress.</p>
                </div>
                
                <div className="hidden md:block">
                  <button
                    onClick={handleEnroll}
                    disabled={isEnrolled}
                    className={`w-full py-3 rounded-md ${
                      isEnrolled
                        ? 'bg-green-500 text-white cursor-default'
                        : 'bg-[var(--primary)] text-white hover:brightness-110'
                    }`}
                  >
                    {enrollButtonText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Content Section */}
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <h2 className="text-xl font-bold mb-6">Course Content</h2>
          
          <div className="space-y-4">
            {course.chapters.map((chapter, index) => (
              <div 
                key={chapter.id} 
                className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 mr-3 mt-1">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{chapter.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{chapter.description}</p>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock size={14} className="mr-1" />
                        <span>{chapter.duration}</span>
                      </div>
                    </div>
                    
                    {isEnrolled ? (
                      <Link 
                        href={`/courses/${courseId}/chapter/${chapter.id}`}
                        className="shrink-0 ml-4 px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:brightness-110 flex items-center"
                      >
                        <PlayCircle size={16} className="mr-1" />
                        <span>Start</span>
                      </Link>
                    ) : (
                      <div className="shrink-0 ml-4 px-4 py-2 bg-gray-100 text-gray-400 rounded-md cursor-not-allowed flex items-center">
                        <PlayCircle size={16} className="mr-1" />
                        <span>Locked</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}