/**
 * Learning Style Transformer
 * 
 * This module transforms raw assessment answers into a structured learning profile
 * with different learning style dimensions.
 */

export type LearningStyleDimension = 'processingStyle' | 'perceptionStyle' | 'inputStyle' | 'understandingStyle';

export interface RawAssessmentAnswers {
  [questionId: number]: string | string[] | number;
}

export interface LearningStylePreferences {
  subjects?: string[];
  structuredLearning?: string;
  focusAbility?: number;
  schedulePreference?: string;
  [key: string]: any;
}

export interface LearningStyleResult {
  primaryStyle: string;
  processingStyle: string;
  perceptionStyle: string;
  inputStyle: string;
  understandingStyle: string;
  preferences: LearningStylePreferences;
}

/**
 * Main transformer function that analyzes assessment answers and returns a complete learning profile
 */
export function transformLearningStyle(answers: RawAssessmentAnswers): LearningStyleResult {
  // Default values if questions are skipped or not answered
  const result: LearningStyleResult = {
    primaryStyle: 'Visual Learner',
    processingStyle: 'Active',
    perceptionStyle: 'Intuitive',
    inputStyle: 'Visual',
    understandingStyle: 'Sequential',
    preferences: {}
  };

  // Extract preferences from answers
  const preferences: LearningStylePreferences = {
    subjects: getSubjectsOfInterest(answers),
    structuredLearning: getStructuredLearningPreference(answers),
    focusAbility: getFocusAbility(answers),
    schedulePreference: getSchedulePreference(answers)
  };

  // Determine primary learning style based on content consumption preference (VARK model)
  const primaryStyle = determinePrimaryStyle(answers);
  
  // Determine Felder-Silverman learning style dimensions
  const processingStyle = determineProcessingStyle(answers);
  const perceptionStyle = determinePerceptionStyle(answers);
  const inputStyle = determineInputStyle(answers);
  const understandingStyle = determineUnderstandingStyle(answers);

  return {
    primaryStyle,
    processingStyle,
    perceptionStyle,
    inputStyle,
    understandingStyle,
    preferences
  };
}

/**
 * Determine the primary learning style (VARK model)
 * Visual, Auditory, Reading/Writing, Kinesthetic
 */
function determinePrimaryStyle(answers: RawAssessmentAnswers): string {
  // Based on Question 1: Content consumption preference
  const contentPreference = answers[1] as string;
  
  if (!contentPreference) return 'Visual Learner'; // Default
  
  switch (contentPreference) {
    case 'Reading text':
      return 'Reading/Writing Learner';
    case 'Watching videos':
      return 'Visual Learner';
    case 'Interactive exercises':
      return 'Kinesthetic Learner';
    case 'Listening to audio':
      return 'Auditory Learner';
    default:
      return 'Visual Learner';
  }
}

/**
 * Determine processing style: Active vs Reflective
 * How information is processed
 */
function determineProcessingStyle(answers: RawAssessmentAnswers): string {
  // In a real implementation, this would be based on specific questions
  // For now, we'll use a simple heuristic based on existing questions
  
  const contentPreference = answers[1] as string;
  const structuredLearning = answers[3] as string;
  
  // If the user prefers interactive exercises and isn't strict about structure,
  // they likely have an active processing style
  if (contentPreference === 'Interactive exercises' && 
      (structuredLearning === 'Not important' || structuredLearning === 'Somewhat important')) {
    return 'Active';
  }
  
  // If they prefer reading or listening and value structure,
  // they likely have a reflective processing style
  if ((contentPreference === 'Reading text' || contentPreference === 'Listening to audio') &&
      (structuredLearning === 'Very important' || structuredLearning === 'Essential')) {
    return 'Reflective';
  }
  
  // Default based on focus ability
  const focusAbility = answers[4] as number || 3;
  return focusAbility >= 4 ? 'Reflective' : 'Active';
}

/**
 * Determine perception style: Sensing vs Intuitive
 * How information is perceived
 */
function determinePerceptionStyle(answers: RawAssessmentAnswers): string {
  // In a real implementation, this would be based on specific questions
  // For this example, we'll use subjects of interest as a proxy
  
  const subjects = answers[2] as string[] || [];
  
  // If they're interested in concrete subjects like programming or business,
  // they might be more sensing (practical, detail-oriented)
  if (subjects.includes('Programming') || subjects.includes('Business')) {
    return 'Sensing';
  }
  
  // If they're interested in more abstract subjects like design or math,
  // they might be more intuitive (conceptual, innovation-oriented)
  if (subjects.includes('Design') || subjects.includes('Mathematics')) {
    return 'Intuitive';
  }
  
  // Default
  return 'Intuitive';
}

/**
 * Determine input style: Visual vs Verbal
 * How information is best received
 */
function determineInputStyle(answers: RawAssessmentAnswers): string {
  // Based primarily on content consumption preference
  const contentPreference = answers[1] as string;
  
  if (contentPreference === 'Watching videos') {
    return 'Visual';
  }
  
  if (contentPreference === 'Reading text' || contentPreference === 'Listening to audio') {
    return 'Verbal';
  }
  
  // Default
  return 'Visual';
}

/**
 * Determine understanding style: Sequential vs Global
 * How understanding is built
 */
function determineUnderstandingStyle(answers: RawAssessmentAnswers): string {
  // In a real implementation, this would be based on specific questions
  // For this example, we'll use structured learning preference as a proxy
  
  const structuredLearning = answers[3] as string;
  
  // If they prefer highly structured learning, they likely prefer sequential understanding
  if (structuredLearning === 'Very important' || structuredLearning === 'Essential') {
    return 'Sequential';
  }
  
  // If they're less concerned with structure, they might prefer global understanding
  if (structuredLearning === 'Not important' || structuredLearning === 'Somewhat important') {
    return 'Global';
  }
  
  // Default
  return 'Sequential';
}

// Helper functions for extracting preferences

function getSubjectsOfInterest(answers: RawAssessmentAnswers): string[] {
  return (answers[2] as string[]) || [];
}

function getStructuredLearningPreference(answers: RawAssessmentAnswers): string {
  return (answers[3] as string) || 'Somewhat important';
}

function getFocusAbility(answers: RawAssessmentAnswers): number {
  return (answers[4] as number) || 3;
}

function getSchedulePreference(answers: RawAssessmentAnswers): string {
  return (answers[5] as string) || 'Flexible schedule';
} 