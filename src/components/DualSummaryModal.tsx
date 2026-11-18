import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Check,
  Copy,
  HelpCircle,
  Lightbulb,
  RefreshCw,
  AlertCircle,
  Key,
  X,
} from 'lucide-react';
import { PrivacySettingsModal } from './PrivacySettingsModal';

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
  errorMessage?: string | null;
  chapterTitle: string;
  onRegenerate: () => void;
}

function getStoredReaderApiKey(): string {
  if (typeof window === 'undefined') return '';
  const raw =
    localStorage.getItem('akari_gemini_api_key_v1') ||
    localStorage.getItem('gemini_api_key') ||
    '';
  return raw.replace(/["'\s]/g, '').trim();
}

function parseCleanErrorDisplay(rawError?: string | null): {
  displayMessage: string;
  isKeyIssue: boolean;
} | null {
  if (!rawError) return null;
  const trimmed = rawError.trim();
  if (!trimmed) return null;

  // Intercept raw Google RPC JSON error payloads (e.g. {"error":{"code":400,...}})
  if (trimmed.startsWith('{') || trimmed.includes('"error"') || trimmed.includes('INVALID_ARGUMENT')) {
    let status = 0;
    let rpcMsg = '';
    try {
      const jsonStart = trimmed.indexOf('{');
      const parsed = jsonStart >= 0 ? JSON.parse(trimmed.slice(jsonStart)) : null;
      status = Number(parsed?.error?.code || 0);
      rpcMsg = String(parsed?.error?.message || '').toLowerCase();
    } catch {
      rpcMsg = trimmed.toLowerCase();
    }

    if (
      status === 400 ||
      status === 401 ||
      status === 403 ||
      rpcMsg.includes('api key') ||
      rpcMsg.includes('api_key_invalid') ||
      rpcMsg.includes('permission_denied')
    ) {
      return {
        displayMessage:
          'Your Gemini API Key appears missing or invalid. Please open the API Key Vault to configure a valid key.',
        isKeyIssue: true,
      };
    }

    if (status === 429 || rpcMsg.includes('quota') || rpcMsg.includes('resource_exhausted')) {
      return {
        displayMessage:
          'API quota limit reached. Please wait briefly or switch keys inside the API Key Vault.',
        isKeyIssue: true,
      };
    }

    return {
      displayMessage:
        'Unable to generate AI synthesis right now. Please verify your key in the API Key Vault and retry.',
      isKeyIssue: false,
    };
  }

  if (trimmed.startsWith('MISSING_API_KEY:') || trimmed.startsWith('INVALID_API_KEY:')) {
    return {
      displayMessage: trimmed.replace(/^(MISSING_API_KEY|INVALID_API_KEY):\s*/, ''),
      isKeyIssue: true,
    };
  }

  const lower = trimmed.toLowerCase();
  const isKeyIssue =
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('403') ||
    lower.includes('401') ||
    lower.includes('quota');

  return {
    displayMessage: trimmed,
    isKeyIssue,
  };
}

function renderFormattedStudyNotes(markdown: string): React.ReactNode {
  if (!markdown || typeof markdown !== 'string') return null;
  const lines = markdown
    .split('\n')
    .filter((line) => !/^(Title|URL Source|Markdown Content):\s*/i.test(line.trim()));

  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-1.5" />;
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      return (
        <h4
          key={idx}
          className="text-xs sm:text-sm font-bold text-indigo-300 pt-2 pb-1 border-b border-slate-800/80"
        >
          {trimmed.replace(/^#{2,3}\s+/, '')}
        </h4>
      );
    }
    const parts = trimmed.replace(/^[-*•]\s+/, '').split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed pl-1">
        <span className="text-emerald-400 font-bold mt-0.5">•</span>
        <span>
          {parts.map((part, pIdx) =>
            part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
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
  errorMessage,
  chapterTitle,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => Boolean(getStoredReaderApiKey()));

  useEffect(() => {
    if (isOpen) {
      setDismissedError(false);
      setHasApiKey(Boolean(getStoredReaderApiKey()));
    }
  }, [isOpen, errorMessage]);

  if (!isOpen) return null;

  const parsed = summaryData?.parsedData || summaryData;
  const executiveSynthesis = parsed?.executiveSynthesis || summaryData?.executiveSynthesis || '';
  const studyNotesMarkdown = parsed?.studyNotesMarkdown || summaryData?.studyNotesMarkdown || '';
  const coreTakeaways = Array.isArray(parsed?.coreTakeaways) ? parsed.coreTakeaways : [];
  const methodologyAndMetrics = parsed?.methodologyAndMetrics || '';
  const selfAssessmentQuestions = Array.isArray(parsed?.selfAssessmentQuestions)
    ? parsed.selfAssessmentQuestions
    : [];

  const hasStreamedContent =
    Boolean(executiveSynthesis) ||
    Boolean(studyNotesMarkdown) ||
    coreTakeaways.length > 0 ||
    Boolean(methodologyAndMetrics) ||
    selfAssessmentQuestions.length > 0;

  const cleanError = !dismissedError ? parseCleanErrorDisplay(errorMessage) : null;
  const effectiveError =
    cleanError ||
    (!hasApiKey && !hasStreamedContent && !dismissedError
      ? {
          displayMessage:
            'No Gemini API Key detected. Open the API Key Vault to configure your personal key for instant AI synthesis.',
          isKeyIssue: true,
        }
      : null);

  const handleCopy = () => {
    const textToCopy = [
      `AI Academic Chapter Synthesis (${chapterTitle})`,
      executiveSynthesis ? `\nExecutive Synthesis:\n${executiveSynthesis}` : '',
      studyNotesMarkdown ? `\nDistraction-Free Study Notes:\n${studyNotesMarkdown}` : '',
      coreTakeaways.length > 0
        ? `\nCore Takeaways:\n${coreTakeaways.map((ct: any) => `- ${ct.concept}: ${ct.explanation}`).join('\n')}`
        : '',
      methodologyAndMetrics ? `\nMethodology & Metrics:\n${methodologyAndMetrics}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEmpty = !loading && !hasStreamedContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Sparkles className={`w-6 h-6 ${loading ? 'animate-spin' : 'animate-pulse'}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center flex-wrap gap-2">
                <span>AI Academic Chapter Synthesis & Study Notes</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {loading ? 'Streaming Live...' : 'Distraction-Free Notes'}
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

        {/* Clean Dismissible Notification Card for Missing/Invalid Key or Intercepted RPC Errors */}
        {effectiveError && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-2.5">
              {effectiveError.isKeyIssue ? (
                <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <span className="leading-relaxed">{effectiveError.displayMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {effectiveError.isKeyIssue && (
                <button
                  type="button"
                  onClick={() => setShowVaultModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Open API Key Vault</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissedError(true)}
                className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-bold text-indigo-300 px-3 py-1 rounded-xl bg-indigo-950/50 border border-indigo-500/30">
            🇬🇧 Structured Study Notes & Core Definitions
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-indigo-300 border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Streaming...' : 'Regenerate'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || isEmpty}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-200 border border-slate-700 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-300" />}
              <span>{copied ? 'Copied!' : 'Copy Notes'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
          {effectiveError && !hasStreamedContent ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                {effectiveError.displayMessage}
              </p>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {effectiveError.isKeyIssue && (
                  <button
                    type="button"
                    onClick={() => setShowVaultModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Configure in API Key Vault</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer hover:bg-indigo-500"
                >
                  🔄 Retry Streaming Synthesis
                </button>
              </div>
            </div>
          ) : loading && !hasStreamedContent ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">
                Connecting to verified Gemini stream...
              </p>
            </div>
          ) : isEmpty ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-xs text-red-300">Could not retrieve synthesis or request timed out.</p>
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
                  <p className="text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">{executiveSynthesis}</p>
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
              {coreTakeaways.length > 0 && (
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
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{methodologyAndMetrics}</p>
                </div>
              )}

              {/* Self Assessment Questions */}
              {selfAssessmentQuestions.length > 0 && (
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

              {loading && (
                <div className="flex items-center space-x-2 text-[11px] text-indigo-300 pt-1">
                  <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span>Streaming remaining synthesis sections...</span>
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

      <PrivacySettingsModal
        isOpen={showVaultModal}
        onClose={() => {
          setShowVaultModal(false);
          const keyPresent = Boolean(getStoredReaderApiKey());
          setHasApiKey(keyPresent);
          if (keyPresent) {
            setDismissedError(true);
            onRegenerate();
          }
        }}
      />
    </div>
  );
};
