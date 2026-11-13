import React from 'react';
import { QuizQuestion } from '../types';
import { MathRenderer } from './MathRenderer';
import {
  Award,
  Layers,
  Download,
  RotateCw,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';

export interface QuizReviewProps {
  language: 'en' | 'my';
  selectedWeek: string;
  currentAttemptNumber: number;
  quizElapsedSeconds: number;
  quizScore: number;
  quizzes: QuizQuestion[];
  userAnswers: Record<number, number>;
  incorrectCount: number;
  errorCardsAddedBadge: number | null;
  errorCardCount: number;
  generatingQuiz: boolean;
  formatTimer: (sec: number) => string;
  onSendMistakesToErrorDeck: () => void;
  onAddSingleQuestionToDeck?: (question: QuizQuestion) => void;
  onRetestMissed: () => void;
  onGenerateFreshAttempt: () => void;
  onOpenErrorDeck: () => void;
  onRetakeFullQuiz: () => void;
}

export const QuizReview: React.FC<QuizReviewProps> = ({
  language,
  selectedWeek,
  currentAttemptNumber,
  quizElapsedSeconds,
  quizScore,
  quizzes,
  userAnswers,
  incorrectCount,
  errorCardsAddedBadge,
  errorCardCount,
  generatingQuiz,
  formatTimer,
  onSendMistakesToErrorDeck,
  onAddSingleQuestionToDeck,
  onRetestMissed,
  onGenerateFreshAttempt,
  onOpenErrorDeck,
  onRetakeFullQuiz,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Score Summary Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold text-white">
            {language === 'my'
              ? 'စာမေးပွဲ အပြီးသတ် စစ်ဆေးချက်နှင့် ရမှတ်အနှစ်ချုပ်'
              : 'Exam Practice Result & Conceptual Review'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {selectedWeek} • Attempt #{currentAttemptNumber} • Time: {formatTimer(quizElapsedSeconds)}
          </p>
        </div>

        <div className="inline-block p-4 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 min-w-[280px]">
          <div className="text-4xl sm:text-5xl font-black text-white mb-1 font-mono">
            <span
              className={
                quizScore / (quizzes.length || 1) >= 0.7 ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {quizScore}
            </span>
            <span className="text-slate-600 text-2xl font-normal"> / {quizzes.length}</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-center space-x-2">
            <span>Score Percentage:</span>
            <span className="font-bold text-white">
              {Math.round((quizScore / (quizzes.length || 1)) * 100)}%
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                quizScore / (quizzes.length || 1) >= 0.8
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : quizScore / (quizzes.length || 1) >= 0.7
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {quizScore / (quizzes.length || 1) >= 0.8
                ? 'Mastery Passed'
                : quizScore / (quizzes.length || 1) >= 0.7
                ? 'Passing Standard'
                : 'Review Recommended'}
            </span>
          </div>
        </div>

        {/* Persistent Method (B) Quiz Error Collector Action */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-violet-950/40 to-slate-950 border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="text-left space-y-0.5">
            <div className="text-xs font-bold text-rose-200 flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-rose-400" />
              <span>Method (B): Zero-Cost Quiz Error Collector</span>
            </div>
            <p className="text-[11px] text-slate-300">
              မှားသွားသော မေးခွန်း ({incorrectCount}) ပုဒ်ကို Gemini API လုံးဝမသုံးဘဲ SM-2 Error Deck သို့ တိုက်ရိုက်ပို့မည်
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSendMistakesToErrorDeck}
              disabled={incorrectCount === 0}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                📥 မှားသောမေးခွန်း ({incorrectCount}) ပုဒ်ကို Flashcard ထဲသို့ ထည့်မည်
              </span>
            </button>
            {errorCardsAddedBadge !== null && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                +{errorCardsAddedBadge} Added
              </span>
            )}
          </div>
        </div>

        {/* Secondary Review Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-800">
          {incorrectCount > 0 && (
            <button
              onClick={onRetestMissed}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>🔄 Retest Missed ({incorrectCount})</span>
            </button>
          )}

          <button
            disabled={generatingQuiz}
            onClick={onGenerateFreshAttempt}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {generatingQuiz ? 'Generating...' : '✨ Generate Fresh Questions (New Attempt)'}
            </span>
          </button>

          <button
            onClick={onOpenErrorDeck}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>🗂️ Open SM-2 Error Deck ({errorCardCount})</span>
          </button>

          <button
            onClick={onRetakeFullQuiz}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            Retake Full Quiz
          </button>
        </div>
      </div>

      {/* Question-by-Question Review */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
          <span>Detailed Question Breakdown ({quizzes.length} Questions)</span>
          <span className="text-slate-500">
            {quizScore} Correct • {incorrectCount} Incorrect
          </span>
        </div>

        {quizzes.map((q, idx) => {
          const userChoice = userAnswers[idx];
          const isUserCorrect = userChoice === q.correctIndex;
          const isTrueFalse =
            q.questionType === 'true_false' ||
            (q.options.length === 2 &&
              (q.options[0]?.toLowerCase() === 'true' ||
                q.options[0]?.toLowerCase() === 'false'));
          const isExcept =
            q.questionType === 'except' || /\b(EXCEPT|NOT|FALSE|LEAST)\b/.test(q.question);

          return (
            <div
              key={q.id || idx}
              className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-4 ${
                isUserCorrect
                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  : 'bg-rose-950/15 border-rose-900/40 hover:border-rose-500/40'
              }`}
            >
              {/* Status Header & Individual Add to Flashcard Deck Button for Wrong Answers */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold font-mono text-slate-400">
                    #{idx + 1}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center space-x-1 ${
                      isUserCorrect
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {isUserCorrect ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Correct (+1)</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3" />
                        <span>Incorrect (0/1)</span>
                      </>
                    )}
                  </span>
                  {isTrueFalse ? (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase">
                      True / False
                    </span>
                  ) : isExcept ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase">
                      EXCEPT
                    </span>
                  ) : null}
                </div>

                {!isUserCorrect && onAddSingleQuestionToDeck && (
                  <button
                    type="button"
                    onClick={() => onAddSingleQuestionToDeck(q)}
                    className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>[ 📥 Add to Flashcard Deck ]</span>
                  </button>
                )}
              </div>

              {/* Question Title with LaTeX Rendering */}
              <div className="text-sm sm:text-base font-bold text-white leading-relaxed">
                <MathRenderer content={q.question} />
              </div>

              {/* Selected Choice vs. Correct Choice Breakdown */}
              <div
                className={
                  isTrueFalse
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1'
                    : 'space-y-2 pt-1'
                }
              >
                {q.options.map((opt, optIdx) => {
                  const isCorrectOption = optIdx === q.correctIndex;
                  const isSelectedByUser = optIdx === userChoice;

                  let optStyle = 'bg-slate-950/60 border-slate-900 text-slate-400';
                  if (isCorrectOption) {
                    optStyle =
                      'bg-emerald-950/40 border-emerald-500/70 text-emerald-200 font-semibold ring-1 ring-emerald-500/40';
                  } else if (isSelectedByUser && !isCorrectOption) {
                    optStyle =
                      'bg-rose-950/40 border-rose-500/70 text-rose-200 ring-1 ring-rose-500/40';
                  }

                  const letter = isTrueFalse
                    ? opt.toLowerCase().startsWith('t')
                      ? 'T'
                      : 'F'
                    : String.fromCharCode(65 + optIdx);

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-3 ${optStyle}`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <span
                          className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            isCorrectOption
                              ? 'bg-emerald-500 text-white'
                              : isSelectedByUser && !isCorrectOption
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {letter}
                        </span>
                        <div className="leading-relaxed">
                          <MathRenderer content={opt} />
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center space-x-1 text-[11px]">
                        {isCorrectOption && (
                          <span className="text-emerald-400 font-semibold">
                            ✓ Correct Answer
                          </span>
                        )}
                        {isSelectedByUser && !isCorrectOption && (
                          <span className="text-rose-400 font-semibold">
                            ✗ Your Choice
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* In-Depth Conceptual Explanation & Real-World Application (With MathRenderer) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
                <div>
                  <span className="font-bold text-violet-400 text-[11px] uppercase tracking-wider block mb-1">
                    IN-DEPTH CONCEPTUAL EXPLANATION:
                  </span>
                  <div className="whitespace-pre-wrap">
                    <MathRenderer content={q.explanation} />
                  </div>
                </div>

                {q.realWorldApplication && (
                  <div className="pt-2.5 border-t border-slate-800/80">
                    <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/25 text-indigo-200">
                      <strong className="text-indigo-300 uppercase tracking-wider text-[11px] block mb-0.5">
                        🌍 REAL-WORLD APPLICATION:
                      </strong>
                      <MathRenderer content={q.realWorldApplication} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizReview;
