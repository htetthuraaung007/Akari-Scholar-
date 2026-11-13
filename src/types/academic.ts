export interface FlashcardHistoryEntry {
  date: string;
  grade: number;
}

export interface SM2CardState {
  interval: number; // Days until next review
  repetition: number;
  easeFactor: number; // Default 2.5
  nextReviewDate: string; // ISO date string (YYYY-MM-DD)
  lastReviewedDate?: string;
  consecutiveCorrect?: number;
  history: FlashcardHistoryEntry[];
}

export interface FlashcardItem extends SM2CardState {
  id: string;
  front: string; // Key Term / Concept / Formula
  back: string; // Concise Definition / Core Rule / Principle
  source: 'direct_generation' | 'quiz_error';
  sourceWeek: string; // e.g., 'Week 1'
  sourceQuote?: string; // Verbatim 1-sentence quote for Ctrl+F search
  sectionHeader?: string; // Section or Chapter title
  realWorldApplication?: string; // 1-sentence practical example
  // Backward-compatible optional fields
  concept?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  questionType?: 'mcq' | 'except' | 'true_false';
  sectionHeader?: string; // Closest chapter heading or sub-topic title
  sourceQuote?: string; // Exact verbatim 1-sentence quote from text for Ctrl+F
  realWorldApplication?: string; // Practical 1-sentence real-world application
  selectedAnswer?: number;
  userAnswerIndex?: number;
  trapType?: string;
  isCorrect?: boolean;
}
