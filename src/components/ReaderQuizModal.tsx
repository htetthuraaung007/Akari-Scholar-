import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Brain,
  CheckCircle,
  XCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  X,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface QuizData {
  quizTitle: string;
  questions: QuizQuestion[];
}

interface ReaderQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterText: string;
  sectionTitle: string;
}

export const ReaderQuizModal: React.FC<ReaderQuizModalProps> = ({
  isOpen,
  onClose,
  chapterText,
  sectionTitle,
}) => {
  const { callAcademicApi } = useApp();
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !quizData && !loading) {
      generateQuiz();
    }
  }, [isOpen]);

  const generateQuiz = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await callAcademicApi('reader_quiz', {
        content: chapterText || sectionTitle,
      });
      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
        setQuizData(parsed);
      } else {
        throw new Error('Invalid quiz structure received from AI.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    if (selectedAnswers[questionIndex] !== undefined) return; // already answered
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleNext = () => {
    if (!quizData) return;
    if (currentIndex < quizData.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setShowResult(false);
  };

  if (!isOpen) return null;

  const currentQ = quizData?.questions[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isAnswered = currentQ ? selectedAnswers[currentIndex] !== undefined : false;

  // Calculate score
  let correctCount = 0;
  if (quizData) {
    quizData.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswerIndex) {
        correctCount++;
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {quizData?.quizTitle || 'Chapter Self-Assessment Quiz'}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md">{sectionTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Generating Concept-Check Quiz...</p>
                <p className="text-xs text-slate-400">Analyzing active section text with AI professorial rigor</p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center space-y-3">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={generateQuiz}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
              >
                Retry Generation
              </button>
            </div>
          ) : showResult && quizData ? (
            <div className="py-6 text-center space-y-6 animate-in fade-in">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Sparkles className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-white">Quiz Completed Successfully!</h3>
                <div className="text-3xl font-black text-emerald-400">
                  Score: {correctCount} / {quizData.questions.length} (
                  {Math.round((correctCount / quizData.questions.length) * 100)}%)
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {correctCount === quizData.questions.length
                    ? 'Outstanding mastery of this section!'
                    : 'Good effort! Review the theoretical explanations to solidify mastery.'}
                </p>
              </div>

              <div className="flex items-center justify-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retake Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-all shadow-lg shadow-emerald-600/20"
                >
                  <span>Back to Reading</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : currentQ && quizData ? (
            <div className="space-y-6 animate-in fade-in">
              {/* Progress & Badge */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                  Question {currentIndex + 1} of {quizData.questions.length}
                </span>
                <span className="text-slate-400">
                  Answered: {answeredCount} / {quizData.questions.length}
                </span>
              </div>

              {/* Question */}
              <h3 className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                {currentQ.question}
              </h3>

              {/* Options */}
              <div className="space-y-3">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[currentIndex] === optIdx;
                  const isCorrectAnswer = optIdx === currentQ.correctAnswerIndex;
                  const hasAnswered = isAnswered;

                  let btnStyle = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700';

                  if (hasAnswered) {
                    if (isCorrectAnswer) {
                      btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-sm shadow-emerald-500/10';
                    } else if (isSelected && !isCorrectAnswer) {
                      btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-200';
                    } else {
                      btnStyle = 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60';
                    }
                  } else if (isSelected) {
                    btnStyle = 'bg-blue-600/20 border-blue-500 text-blue-200';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={hasAnswered}
                      onClick={() => handleSelectOption(currentIndex, optIdx)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all text-xs sm:text-sm font-medium flex items-center justify-between cursor-pointer ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {hasAnswered && isCorrectAnswer && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                      {hasAnswered && isSelected && !isCorrectAnswer && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Rationale Box */}
              {isAnswered && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
                    <HelpCircle className="w-4 h-4" />
                    <span>Theoretical Explanation & Rationale:</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {currentQ.explanation}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Next Button */}
        {quizData && !showResult && !loading && !errorMessage && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isAnswered ? 'Review explanation & proceed' : 'Select an option to check answer'}
            </span>
            <button
              type="button"
              disabled={!isAnswered}
              onClick={handleNext}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <span>{currentIndex === quizData.questions.length - 1 ? 'View Results' : 'Next Question'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
