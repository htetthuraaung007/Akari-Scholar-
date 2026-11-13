import React, { useState } from 'react';
import { Sparkles, BookOpen, Check, Copy, HelpCircle, Lightbulb, GraduationCap, RefreshCw } from 'lucide-react';

interface DualSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: {
    executiveSynthesis?: string;
    studyNotesMarkdown?: string;
    coreTakeaways?: Array<{ concept: string; explanation: string }>;
    methodologyAndMetrics?: string;
    selfAssessmentQuestions?: string[];
    parsedData?: any;
  } | null;
  loading: boolean;
  chapterTitle: string;
  onRegenerate: () => void;
}

function renderFormattedStudyNotes(markdown: string): React.ReactNode {
  if (!markdown) return null;
  const lines = markdown
    .split('\n')
    .filter((line) => !/^(Title|URL Source|Markdown Content):\s*/i.test(line.trim()));

  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-1.5" />;
    if (trimmed.startsWith('### ')) {
      return (
        <h4
          key={idx}
          className="text-xs sm:text-sm font-bold text-indigo-300 pt-2 pb-1 border-b border-slate-800/80"
        >
          {trimmed.replace(/^###\s+/, '')}
        </h4>
      );
    }
    const parts = trimmed.replace(/^[-*]\s+/, '').split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed pl-1">
        <span className="text-emerald-400 font-bold mt-0.5">•</span>
        <span>
          {parts.map((part, pIdx) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={pIdx} className="font-bold text-amber-300">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={pIdx}>{part}</span>
            )
          )}
        </span>
      </div>
    );
  });
}

export const DualSummaryModal: React.FC<DualSummaryModalProps> = ({
  isOpen,
  onClose,
  summaryData,
  loading,
  chapterTitle,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const parsed = summaryData?.parsedData || summaryData;
  const executiveSynthesis = parsed?.executiveSynthesis || summaryData?.executiveSynthesis || '';
  const studyNotesMarkdown = parsed?.studyNotesMarkdown || summaryData?.studyNotesMarkdown || '';
  const coreTakeaways = parsed?.coreTakeaways || [];
  const methodologyAndMetrics = parsed?.methodologyAndMetrics || '';
  const selfAssessmentQuestions = parsed?.selfAssessmentQuestions || [];

  const handleCopy = () => {
    const textToCopy = [
      `AI Academic Chapter Synthesis (${chapterTitle})`,
      executiveSynthesis ? `\nExecutive Synthesis:\n${executiveSynthesis}` : '',
      studyNotesMarkdown ? `\nDistraction-Free Study Notes:\n${studyNotesMarkdown}` : '',
      methodologyAndMetrics ? `\nMethodology & Metrics:\n${methodologyAndMetrics}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEmpty =
    !loading &&
    (!summaryData || (!executiveSynthesis && !studyNotesMarkdown && coreTakeaways.length === 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>AI Academic Chapter Synthesis & Study Notes</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Distraction-Free Notes
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">
                Chapter: <span className="text-slate-200 font-semibold">{chapterTitle}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-indigo-300 px-3 py-1 rounded-xl bg-indigo-950/50 border border-indigo-500/30">
            🇬🇧 Structured Study Notes & Core Definitions
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || isEmpty}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-300" />}
              <span>{copied ? 'Copied!' : 'Copy Notes'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">
                Synthesizing distraction-free study notes with Dynamic Auto-Cascade...
              </p>
            </div>
          ) : isEmpty ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-xs text-red-300">Could not retrieve dynamic synthesis or request timed out.</p>
              <button
                type="button"
                onClick={onRegenerate}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer hover:bg-indigo-500"
              >
                🔄 Click Here to Regenerate Synthesis
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Executive Synthesis */}
              {executiveSynthesis && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2 shadow">
                  <div className="font-bold text-indigo-300 text-sm flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Executive Synthesis (Thesis & Scope)</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-sans">{executiveSynthesis}</p>
                </div>
              )}

              {/* Distraction-Free Study Notes (### Headings & **Bold** Concepts) */}
              {studyNotesMarkdown && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-emerald-400" />
                    <span>Distraction-Free Study Notes (Headings & Core Definitions)</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {renderFormattedStudyNotes(studyNotesMarkdown)}
                  </div>
                </div>
              )}

              {/* Core Takeaways */}
              {Array.isArray(coreTakeaways) && coreTakeaways.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Core Conceptual Takeaways & Principles
                  </div>
                  <div className="space-y-2">
                    {coreTakeaways.map((ct: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <div className="font-bold text-blue-300 text-xs">{ct.concept}</div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">{ct.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Methodology & Metrics */}
              {methodologyAndMetrics && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider">
                    Methodology, Formulae & Key Metrics
                  </div>
                  <p className="text-slate-300 leading-relaxed">{methodologyAndMetrics}</p>
                </div>
              )}

              {/* Self Assessment Questions */}
              {Array.isArray(selfAssessmentQuestions) && selfAssessmentQuestions.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-300 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <HelpCircle className="w-4 h-4" />
                    <span>Self-Assessment & Discussion Questions</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-xs">
                    {selfAssessmentQuestions.map((q: string, idx: number) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Close Synthesis
          </button>
        </div>
      </div>
    </div>
  );
};
