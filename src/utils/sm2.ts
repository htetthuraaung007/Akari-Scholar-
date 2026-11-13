import { Flashcard, FlashcardItem } from '../types';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export type NumericReviewGrade = 1 | 3 | 4 | 5;

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDaysToToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * SuperMemo SM-2 Algorithm for FlashcardItem & Flashcard:
 * - Again (Grade 1): 1 day interval, reset repetition
 * - Hard (Grade 3): 3 days (or 1.2x interval)
 * - Good (Grade 4): 6 days (or interval * easeFactor)
 * - Easy (Grade 5): 10+ days (or interval * easeFactor * 1.3)
 */
export function calculateSM2ForItem(
  card: FlashcardItem,
  numericGrade: NumericReviewGrade
): FlashcardItem {
  const q = numericGrade;
  let { repetition, interval, easeFactor } = card;
  if (!easeFactor || easeFactor < 1.3) easeFactor = 2.5;
  if (!interval || interval < 1) interval = 1;
  if (repetition === undefined || repetition < 0) repetition = 0;

  if (q === 1) {
    // Again -> 1 day
    repetition = 0;
    interval = 1;
  } else if (q === 3) {
    // Hard -> 3 days
    interval = repetition === 0 ? 3 : Math.max(3, Math.round(interval * 1.2));
    repetition += 1;
  } else if (q === 4) {
    // Good -> 6 days
    interval = repetition <= 1 ? 6 : Math.max(6, Math.round(interval * easeFactor));
    repetition += 1;
  } else {
    // Easy (5) -> 10+ days
    interval = repetition <= 1 ? 10 : Math.max(10, Math.round(interval * easeFactor * 1.3));
    repetition += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  easeFactor = Number(easeFactor.toFixed(2));

  const today = getTodayDateString();
  const nextReviewDate = addDaysToToday(interval);
  const history = Array.isArray(card.history) ? [...card.history, { date: today, grade: q }] : [{ date: today, grade: q }];

  return {
    ...card,
    repetition,
    interval,
    easeFactor,
    nextReviewDate,
    lastReviewedDate: today,
    history,
  };
}

/**
 * Backward-compatible SM-2 helper for AppContext Flashcard
 */
export function calculateSM2(
  card: Flashcard,
  grade: ReviewGrade
): {
  repetition: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
  consecutiveCorrect: number;
} {
  let q: NumericReviewGrade;
  switch (grade) {
    case 'again':
      q = 1;
      break;
    case 'hard':
      q = 3;
      break;
    case 'good':
      q = 4;
      break;
    case 'easy':
      q = 5;
      break;
  }

  const updated = calculateSM2ForItem(
    {
      id: card.id,
      front: card.front,
      back: card.back,
      source: card.source || 'direct_generation',
      sourceWeek: card.sourceWeek || card.concept || 'Week 1',
      interval: card.interval || 1,
      repetition: card.repetition || 0,
      easeFactor: card.easeFactor || 2.5,
      nextReviewDate: card.nextReviewDate || getTodayDateString(),
      history: card.history || [],
    },
    q
  );

  return {
    repetition: updated.repetition,
    interval: updated.interval,
    easeFactor: updated.easeFactor,
    nextReviewDate: updated.nextReviewDate,
    consecutiveCorrect: q >= 3 ? (card.consecutiveCorrect || 0) + 1 : 0,
  };
}

/**
 * Daily Review Index: Calculated entirely client-side using nextReviewDate <= today
 */
export function isCardDue(card: { nextReviewDate?: string }): boolean {
  if (!card.nextReviewDate) return true;
  const today = getTodayDateString();
  const cardDateOnly = card.nextReviewDate.split('T')[0];
  return cardDateOnly <= today;
}
