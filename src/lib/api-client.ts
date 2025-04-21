/**
 * Mock API client for demo purposes
 * In a real application, this would make actual API calls
 */

interface UserProgress {
  progress: number;
  completedItems: number;
  totalItems: number;
}

/**
 * Get the user's current progress
 */
export async function getUserProgress(): Promise<UserProgress> {
  // Mock data - in a real app, this would be an API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        progress: Math.floor(Math.random() * 100),
        completedItems: 3,
        totalItems: 5
      });
    }, 500);
  });
} 