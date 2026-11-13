import React from 'react';
import { QuizQuestion } from '../types';
import { MathRenderer } from './MathRenderer';
import {
  Clock,
  RotateCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface QuizQuestionCardProps {
  question: QuizQuestion;
  currentQuizIndex: number;
  totalQuestions: number;
  selectedWeek: string;
  currentAttemptNumber: number;
  quizElapsedSeconds: number;
  quizScore: number;
  selectedOption: number | null;
  isAnswerSubmitted: boolean;
  formatTimer: (sec: number) => string;
  onSelectOption: (index: number) => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  onRetakeFullQuiz: () => void;
}

export const QuizQuestionCard: React.FC<QuizQuestionCardProps> = ({
  question,
  currentQuizIndex,
  totalQuestions,
  selectedWeek,
  currentAttemptNumber,
  quizElapsedSeconds,
  quizScore,
  selectedOption,
  isAnswerSubmitted,
  formatTimer,
  onSelectOption,
  onPrevQuestion,
  onNextQuestion,
  onRetakeFullQuiz,
}) => {
  const isTrueFalse =
    question.questionType === 'true_false' ||
    (question.options.length === 2 &&
      (question.options[0]?.toLowerCase() === 'true' ||
        question.options[0]?.toLowerCase() === 'false'));

  const isExcept =
    question.questionType === 'except' || /\b(EXCEPT|NOT|FALSE|LEAST)\b/.test(question.question);

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
      {/* Progress & Timer Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-violet-400">
              Question {currentQuizIndex + 1} of {totalQuestions}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
              {selectedWeek} • Attempt #{currentAttemptNumber}
            </span>
            {isTrueFalse ? (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                ⚖️ True / False
              </span>
            ) : isExcept ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                ⚠️ Negative Constraint (EXCEPT)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                🎓 Conceptual MCQ
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <span>{formatTimer(quizElapsedSeconds)}</span>
            </span>
            <span className="font-mono font-bold text-emerald-400">
              Score: {quizScore} / {totalQuestions}
            </span>
            <button
              onClick={onRetakeFullQuiz}
              className="text-slate-500 hover:text-slate-300 p-1 rounded cursor-pointer"
              title="Restart Quiz"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full transition-all duration-300"
            style={{
              width: `${((currentQuizIndex + 1) / Math.max(totalQuestions, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Stem with LaTeX Typesetting */}
      <div className="text-base sm:text-lg font-extrabold text-white leading-relaxed">
        <MathRenderer content={question.question} />
      </div>

      {/* Answer Choices: 2 Wide Buttons for True/False vs. 4-Choice MCQ */}
      <div className={isTrueFalse ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2' : 'space-y-3 pt-1'}>
        {question.options.map((option, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = idx === question.correctIndex;

          let style =
            'bg-slate-950 border-slate-800 text-slate-200 hover:border-violet-500/50 hover:bg-slate-900/60';
          if (isAnswerSubmitted) {
            if (isCorrect) {
              style =
                'bg-emerald-950/50 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500 font-semibold';
            } else if (isSelected && !isCorrect) {
              style =
                'bg-rose-950/50 border-rose-500 text-rose-200 ring-1 ring-rose-500';
            } else {
              style = 'bg-slate-950/60 border-slate-900 text-slate-500 opacity-60';
            }
          }

          const letter = isTrueFalse
            ? option.toLowerCase().startsWith('t')
              ? 'T'
              : 'F'
            : String.fromCharCode(65 + idx);

          return (
            <button
              key={idx}
              disabled={isAnswerSubmitted}
              onClick={() => onSelectOption(idx)}
              className={`w-full text-left p-3.5 sm:p-4 min-h-[48px] rounded-2xl border text-xs sm:text-sm transition-all flex items-start justify-between gap-3 cursor-pointer ${
                isTrueFalse ? 'sm:p-5 items-center' : ''
              } ${style}`}
            >
              <div className="flex items-start space-x-3 min-w-0 flex-1">
                <span
                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                    isAnswerSubmitted && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : isAnswerSubmitted && isSelected && !isCorrect
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {letter}
                </span>
                <div className="leading-relaxed pt-0.5 font-medium overflow-x-auto no-scrollbar flex-1">
                  <MathRenderer content={option} />
                </div>
              </div>
              {isAnswerSubmitted && isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          disabled={currentQuizIndex === 0}
          onClick={onPrevQuestion}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <div className="flex items-center space-x-2">
          {isAnswerSubmitted ? (
            <button
              onClick={onNextQuestion}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-violet-600/30 transition-all cursor-pointer"
            >
              <span>
                {currentQuizIndex < totalQuestions - 1
                  ? 'Next Question'
                  : 'Complete & View Result Screen'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              {isTrueFalse
                ? 'Select True or False above'
                : 'Select one of the 4 academic options above'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizQuestionCard;
