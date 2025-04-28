import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { 
  fetchAllCourses, 
  fetchEnrolledCourses, 
  fetchCourseDetails,
  enrollInCourse,
  withdrawFromCourse,
  setSelectedCourse 
} from '@/lib/redux/slices/coursesSlice';

export interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category: string;
  chapters: number;
  duration: string;
  level: string;
  syllabus?: any;
  isEnrolled?: boolean;
}

export function useCourses() {
  const dispatch = useAppDispatch();
  const { 
    allCourses,
    enrolledCourses,
    selectedCourse,
    loading,
    error,
    lastFetched
  } = useAppSelector(state => state.courses);

  // Fetch all courses
  const fetchCourses = useCallback((userId?: string) => {
    dispatch(fetchAllCourses(userId));
  }, [dispatch]);

  // Fetch enrolled courses
  const fetchUserEnrolledCourses = useCallback((userId: string) => {
    dispatch(fetchEnrolledCourses(userId));
  }, [dispatch]);

  // Fetch course details
  const getCourseDetails = useCallback((courseId: string) => {
    dispatch(fetchCourseDetails(courseId));
  }, [dispatch]);

  // Set selected course
  const selectCourse = useCallback((course: Course | null) => {
    dispatch(setSelectedCourse(course));
  }, [dispatch]);

  // Enroll in a course
  const enrollCourse = useCallback(async (courseId: string, userId: string) => {
    try {
      await dispatch(enrollInCourse({ courseId, userId })).unwrap();
      return true;
    } catch (error) {
      console.error('Error enrolling in course:', error);
      return false;
    }
  }, [dispatch]);

  // Withdraw from a course
  const withdrawCourse = useCallback(async (courseId: string, userId: string) => {
    try {
      await dispatch(withdrawFromCourse({ courseId, userId })).unwrap();
      return true;
    } catch (error) {
      console.error('Error withdrawing from course:', error);
      return false;
    }
  }, [dispatch]);

  // Check if data needs to be refreshed (older than 5 minutes)
  const shouldRefreshData = useCallback((tab: 'all' | 'enrolled') => {
    const key = tab === 'all' ? 'allCourses' : 'enrolledCourses';
    const lastFetchTime = lastFetched[key];
    
    if (!lastFetchTime) return true;
    
    // Refresh if data is older than 5 minutes
    return Date.now() - lastFetchTime > 300000;
  }, [lastFetched]);

  return {
    allCourses,
    enrolledCourses,
    selectedCourse,
    loading,
    error,
    fetchCourses,
    fetchUserEnrolledCourses,
    getCourseDetails,
    selectCourse,
    enrollCourse,
    withdrawCourse,
    shouldRefreshData
  };
} 