import { FlashcardItem, QuizQuestion as AcademicQuizQuestion, FlashcardHistoryEntry, SM2CardState } from './academic';

export type { FlashcardItem, FlashcardHistoryEntry, SM2CardState };

export type Grade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F';

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  grade: Grade;
  customPoint?: number;
}

export interface Term {
  id: string;
  name: string; // e.g. "Year 1 Term 1" or "Fall 2024"
  courses: Course[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  concept: string;
  source?: 'direct_generation' | 'quiz_error';
  sourceWeek?: string;
  // SM-2 Spaced Repetition fields
  repetition: number;
  interval: number; // in days
  easeFactor: number; // default 2.5
  nextReviewDate: string; // ISO date string
  lastReviewedDate?: string;
  consecutiveCorrect: number;
  history?: FlashcardHistoryEntry[];
}

export type QuizQuestion = AcademicQuizQuestion;

export interface QuizSessionRecord {
  id: string;
  weekTag: string; // e.g. "Week 1", "Week 2", ... "Week 8 / Final Review"
  sourceTitle: string;
  sources: string[];
  totalQuestions: number;
  score?: number;
  attemptsCount: number;
  createdAt: number;
  examStyle: 'uopeople' | 'standard';
  questions: QuizQuestion[];
}

export interface CitationItem {
  id: string;
  type: 'journal' | 'website' | 'book' | 'report';
  title: string;
  authors: string;
  year: string;
  sourceName: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doiOrUrl?: string;
  apaFormatted: string;
  inTextParenthetical: string;
  inTextNarrative: string;
  annotation?: string; // Annotated bibliography extension
}

export interface BurnoutLog {
  energyLevel: number; // 1-10 (Auto-calculated, read-only)
  stressLevel: number; // 1-10 (Auto-calculated, read-only)
  studyHoursToday: number;
  sleepHours: number;
  lastUpdated: string;
  deadlinePressure?: 'low' | 'medium' | 'high';
  symptoms?: string[];
  calculatedStage?: 'optimal' | 'moderate' | 'fatigue' | 'critical';
  recoveryTip?: string;
  notes?: string;
}

export interface ResearchPaperEntry {
  id: string;
  title: string;
  authors: string;
  year: string;
  methodology: string;
  sampleSize: string;
  findings: string;
  limitations: string;
  gaps: string;
}

export interface SocraticMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: string;
}

export interface StarStory {
  situation: string;
  task: string;
  action: string;
  result: string;
  generatedEssay?: string;
}

export interface GeminiKeyEntry {
  id: string;
  key: string;
  label?: string; // e.g. "Account A (Main)", "Account B (Backup)"
  status: 'active' | 'quota_exhausted' | 'invalid' | 'testing';
  lastUsed?: string;
  errorCount?: number;
}

export interface UserSettings {
  language: 'my' | 'en'; // Burmese or English
  useCustomKey: boolean;
  customGeminiKey: string;
  geminiKeyPool?: GeminiKeyEntry[];
  customOpenAiKey: string;
  customClaudeKey: string;
  activeProvider: 'server' | 'gemini' | 'openai' | 'claude';
  targetCgpa: number;
  remainingCredits: number;
  isEncrypted: boolean;
  encryptionPassphrase?: string;
  honorCodeAccepted: boolean;
  dataSaverMode: boolean;
  engineMode: 'cloud' | 'local';
  preferredModel?: string;
  eyecareMode?: boolean;
}

export type ActiveTab =
  | 'dashboard'
  | 'uopeople_scholar'
  | 'rubric_guide'
  | 'rhythm'
  | 'cgpa'
  | 'assignment'
  | 'socratic'
  | 'research'
  | 'apa'
  | 'lesson'
  | 'flashcards'
  | 'scholarship'
  | 'career'
  | 'academic_career'
  | 'scholarship_sop_studio'
  | 'pomodoro'
  | 'originality';
