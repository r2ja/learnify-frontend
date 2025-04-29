import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
interface Course {
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

interface CoursesState {
  allCourses: Course[];
  enrolledCourses: Course[];
  selectedCourse: Course | null;
  loading: {
    allCourses: boolean;
    enrolledCourses: boolean;
    courseDetails: boolean;
    enrollment: boolean;
    withdrawal: boolean;
  };
  error: {
    allCourses: string | null;
    enrolledCourses: string | null;
    courseDetails: string | null;
    enrollment: string | null;
    withdrawal: string | null;
  };
  lastFetched: {
    allCourses: number | null;
    enrolledCourses: number | null;
  };
}

// Async thunks
export const fetchAllCourses = createAsyncThunk(
  'courses/fetchAll',
  async (userId: string | undefined, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/courses?userId=${userId || ''}`);
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching courses:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch courses');
    }
  }
);

export const fetchEnrolledCourses = createAsyncThunk(
  'courses/fetchEnrolled',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/courses/enrolled?userId=${userId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch enrolled courses');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch enrolled courses');
    }
  }
);

export const fetchCourseDetails = createAsyncThunk(
  'courses/fetchDetails',
  async (courseId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/courses/${courseId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch course details');
      }
      const course = await response.json();
      
      // Parse syllabus if it's a string
      if (typeof course.syllabus === 'string') {
        try {
          course.syllabus = JSON.parse(course.syllabus);
        } catch (e) {
          console.error('Error parsing syllabus JSON:', e);
        }
      }
      
      return course;
    } catch (error) {
      console.error('Error fetching course details:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch course details');
    }
  }
);

export const enrollInCourse = createAsyncThunk(
  'courses/enroll',
  async ({ courseId, userId }: { courseId: string; userId: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to enroll: ${response.statusText}`);
      }
      
      return { courseId, userId };
    } catch (error) {
      console.error('Error enrolling in course:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to enroll in course');
    }
  }
);

export const withdrawFromCourse = createAsyncThunk(
  'courses/withdraw',
  async ({ courseId, userId }: { courseId: string; userId: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/withdraw`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to withdraw: ${response.statusText}`);
      }
      
      return { courseId };
    } catch (error) {
      console.error('Error withdrawing from course:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to withdraw from course');
    }
  }
);

// Initial state
const initialState: CoursesState = {
  allCourses: [],
  enrolledCourses: [],
  selectedCourse: null,
  loading: {
    allCourses: false,
    enrolledCourses: false,
    courseDetails: false,
    enrollment: false,
    withdrawal: false,
  },
  error: {
    allCourses: null,
    enrolledCourses: null,
    courseDetails: null,
    enrollment: null,
    withdrawal: null,
  },
  lastFetched: {
    allCourses: null,
    enrolledCourses: null,
  },
};

// Create slice
const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    setSelectedCourse: (state, action: PayloadAction<Course | null>) => {
      state.selectedCourse = action.payload;
    },
    clearErrors: (state) => {
      state.error = {
        allCourses: null,
        enrolledCourses: null,
        courseDetails: null,
        enrollment: null,
        withdrawal: null,
      };
    },
    resetCoursesState: () => {
      // Return initial state to completely reset
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // fetchAllCourses reducers
    builder.addCase(fetchAllCourses.pending, (state) => {
      state.loading.allCourses = true;
      state.error.allCourses = null;
    });
    builder.addCase(fetchAllCourses.fulfilled, (state, action) => {
      state.allCourses = action.payload;
      state.loading.allCourses = false;
      state.lastFetched.allCourses = Date.now();
    });
    builder.addCase(fetchAllCourses.rejected, (state, action) => {
      state.loading.allCourses = false;
      state.error.allCourses = action.payload as string;
    });

    // fetchEnrolledCourses reducers
    builder.addCase(fetchEnrolledCourses.pending, (state) => {
      state.loading.enrolledCourses = true;
      state.error.enrolledCourses = null;
    });
    builder.addCase(fetchEnrolledCourses.fulfilled, (state, action) => {
      state.enrolledCourses = action.payload;
      state.loading.enrolledCourses = false;
      state.lastFetched.enrolledCourses = Date.now();
    });
    builder.addCase(fetchEnrolledCourses.rejected, (state, action) => {
      state.loading.enrolledCourses = false;
      state.error.enrolledCourses = action.payload as string;
    });

    // fetchCourseDetails reducers
    builder.addCase(fetchCourseDetails.pending, (state) => {
      state.loading.courseDetails = true;
      state.error.courseDetails = null;
    });
    builder.addCase(fetchCourseDetails.fulfilled, (state, action) => {
      state.selectedCourse = action.payload;
      state.loading.courseDetails = false;
    });
    builder.addCase(fetchCourseDetails.rejected, (state, action) => {
      state.loading.courseDetails = false;
      state.error.courseDetails = action.payload as string;
    });

    // enrollInCourse reducers
    builder.addCase(enrollInCourse.pending, (state) => {
      state.loading.enrollment = true;
      state.error.enrollment = null;
    });
    builder.addCase(enrollInCourse.fulfilled, (state, action) => {
      const { courseId } = action.payload;
      
      // Update allCourses
      state.allCourses = state.allCourses.map(course => 
        course.id === courseId 
          ? { ...course, isEnrolled: true }
          : course
      );
      
      // Update selectedCourse
      if (state.selectedCourse && state.selectedCourse.id === courseId) {
        state.selectedCourse = { ...state.selectedCourse, isEnrolled: true };
      }
      
      // Update enrolledCourses if course exists in allCourses
      const enrolledCourse = state.allCourses.find(course => course.id === courseId);
      if (enrolledCourse) {
        state.enrolledCourses.push({ ...enrolledCourse, isEnrolled: true });
      }
      
      state.loading.enrollment = false;
    });
    builder.addCase(enrollInCourse.rejected, (state, action) => {
      state.loading.enrollment = false;
      state.error.enrollment = action.payload as string;
    });

    // withdrawFromCourse reducers
    builder.addCase(withdrawFromCourse.pending, (state) => {
      state.loading.withdrawal = true;
      state.error.withdrawal = null;
    });
    builder.addCase(withdrawFromCourse.fulfilled, (state, action) => {
      const { courseId } = action.payload;
      
      // Update allCourses
      state.allCourses = state.allCourses.map(course => 
        course.id === courseId 
          ? { ...course, isEnrolled: false }
          : course
      );
      
      // Update enrolledCourses
      state.enrolledCourses = state.enrolledCourses.filter(course => course.id !== courseId);
      
      // Update selectedCourse
      if (state.selectedCourse && state.selectedCourse.id === courseId) {
        state.selectedCourse = { ...state.selectedCourse, isEnrolled: false };
      }
      
      state.loading.withdrawal = false;
    });
    builder.addCase(withdrawFromCourse.rejected, (state, action) => {
      state.loading.withdrawal = false;
      state.error.withdrawal = action.payload as string;
    });
  },
});

export const { setSelectedCourse, clearErrors, resetCoursesState } = coursesSlice.actions;
export default coursesSlice.reducer; 