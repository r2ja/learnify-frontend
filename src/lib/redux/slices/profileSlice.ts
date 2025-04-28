import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface LearningStyle {
  processingStyle: string;
  perceptionStyle: string;
  inputStyle: string;
  understandingStyle: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  language?: string;
  image?: string;
  learningStyle?: LearningStyle;
  lastFetched?: number;
}

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  learningProfileLoading: boolean;
  learningProfileError: string | null;
  learningProfileLastFetched: number | null;
}

// Async thunks
export const fetchLearningProfile = createAsyncThunk(
  'profile/fetchLearningProfile',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}/learning-profile`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Learning profile API response:', data);
      
      return {
        userId,
        language: data.language || 'english',
        learningStyle: data.profile ? {
          processingStyle: data.profile.processingStyle || 'Active',
          perceptionStyle: data.profile.perceptionStyle || 'Intuitive',
          inputStyle: data.profile.inputStyle || 'Visual',
          understandingStyle: data.profile.understandingStyle || 'Sequential'
        } : null
      };
    } catch (error) {
      console.error('Error fetching learning profile:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch learning profile');
    }
  },
  {
    // Only fetch if no data or data is older than 5 minutes
    condition: (userId, { getState }) => {
      const state = getState() as { profile: ProfileState };
      const { profile, learningProfileLastFetched } = state.profile;
      
      if (!userId || !profile) return true;
      
      // If no last fetched time or data is older than 5 minutes (300000ms)
      if (!learningProfileLastFetched || Date.now() - learningProfileLastFetched > 300000) {
        return true;
      }
      
      return false;
    }
  }
);

// Initial state
const initialState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
  learningProfileLoading: false,
  learningProfileError: null,
  learningProfileLastFetched: null
};

// Create slice
const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<UserProfile>) => {
      state.profile = action.payload;
    },
    clearProfileError: (state) => {
      state.error = null;
      state.learningProfileError = null;
    },
  },
  extraReducers: (builder) => {
    // fetchLearningProfile reducers
    builder.addCase(fetchLearningProfile.pending, (state) => {
      state.learningProfileLoading = true;
      state.learningProfileError = null;
    });
    
    builder.addCase(fetchLearningProfile.fulfilled, (state, action) => {
      const { userId, language, learningStyle } = action.payload;
      
      if (!state.profile) {
        state.profile = { id: userId };
      }
      
      state.profile.language = language;
      state.profile.learningStyle = learningStyle;
      state.learningProfileLoading = false;
      state.learningProfileLastFetched = Date.now();
    });
    
    builder.addCase(fetchLearningProfile.rejected, (state, action) => {
      state.learningProfileLoading = false;
      state.learningProfileError = action.payload as string;
    });
  },
});

export const { setProfile, clearProfileError } = profileSlice.actions;
export default profileSlice.reducer; 