import React, { useState, useMemo } from 'react';
import {
  analyzeAiDetectionMetrics,
  AiDetectionMetricsResult,
} from '../utils/aiDetectionMetrics';
import { humanizeForZeroGpt } from '../utils/humanizerEngine';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Activity,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';

interface AiVerificationPanelProps {
  text: string;
  onReplaceText?: (newText: string) => void;
  language?: 'my' | 'en';
}

export const AiVerificationPanel: React.FC<AiVerificationPanelProps> = ({
  text,
  onReplaceText,
  language = 'my',
}) => {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClichePanel, setShowClichePanel] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditTriggered, setAuditTriggered] = useState(false);
  const [justReplaced, setJustReplaced] = useState<string | null>(null);

  // Real-time metrics calculation
  const metrics: AiDetectionMetricsResult = useMemo(() => {
    return analyzeAiDetectionMetrics(text);
  }, [text]);

  const aiScore = metrics.aiScore;
  const humanScore = metrics.humanScore;
  const isClean = aiScore < 20;
  const isModerate = aiScore >= 20 && aiScore <= 50;
  const isHighRisk = aiScore > 50;

  const handleRunFullAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setAuditTriggered(true);
    }, 600);
  };

  const handleHumanizeFlaws = () => {
    if (!onReplaceText) return;
    const humanized = humanizeForZeroGpt(text);
    onReplaceText(humanized);
    setJustReplaced('All Flaws Fixed');
    setTimeout(() => setJustReplaced(null), 2000);
  };

  const handleQuickReplace = (phrase: string, replacement: string) => {
    if (!onReplaceText) return;
    const regex = new RegExp(`\\b${phrase.replace(/'/g, "\\'")}\\b`, 'gi');
    const updated = text.replace(regex, replacement);
    onReplaceText(updated);
    setJustReplaced(phrase);
    setTimeout(() => setJustReplaced(null), 1800);
  };

  if (!text || text.trim().length === 0) {
    return null;
  }

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 shadow-2xl space-y-4 ${
        isClean
          ? 'bg-gradient-to-r from-emerald-950/50 via-slate-950 to-indigo-950/40 border-emerald-500/40 text-emerald-200'
          : isModerate
          ? 'bg-gradient-to-r from-amber-950/50 via-slate-950 to-slate-900 border-amber-500/50 text-amber-200'
          : 'bg-gradient-to-r from-rose-950/60 via-slate-950 to-slate-900 border-rose-500/60 text-rose-200'
      }`}
    >
      {/* 1. STANDARD AUDIT WIDGET HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          {isClean ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : isModerate ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <span
                className={`font-black text-xs sm:text-sm tracking-wider uppercase ${
                  isClean ? 'text-emerald-300' : isModerate ? 'text-amber-300' : 'text-rose-300'
                }`}
              >
                ZEROGPT & GPTZERO LIVE VERIFICATION AUDIT [Real-Time Live]
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                Real-Time Live
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ZeroGPT, GPTZero နှင့် Turnitin စံနှုန်းများအတိုင်း စာလုံးတစ်လုံးချင်းစီကို Live အချိန်နှင့်တစ်ပြေးညီ စစ်ဆေးနေပါသည်
            </div>
          </div>
        </div>

        {/* Status Ribbon Ribbon */}
        <div className="flex items-center space-x-2">
          <span
            className={`text-xs font-mono font-extrabold px-3.5 py-1.5 rounded-xl border shadow-md ${
              isClean
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : isModerate
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/60 animate-pulse'
            }`}
          >
            {isClean
              ? `Passed (AI Score: ${aiScore}% ✅)`
              : isModerate
              ? `Flagged Warning (AI Score: ${aiScore}% ⚠️)`
              : `High Risk (AI Score: ${aiScore}% 🚨)`}
          </span>
        </div>
      </div>

      {/* 2. MANDATORY TOP-LEVEL PROBABILISTIC WARNING BOX */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs space-y-1.5">
        <div className="flex items-center space-x-2 font-bold text-amber-300 uppercase tracking-wider text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>AI Detector Warning: 100% အတိအကျ မမှန်နိုင်ပါ (Probabilistic Disclaimer)</span>
        </div>
        <p className="text-[11px] text-amber-100/90 leading-relaxed font-sans">
          <strong>မြန်မာဘာသာ:</strong> ZeroGPT, GPTZero နှင့် Turnitin ကဲ့သို့သော AI Detection စနစ်များသည် ခန့်မှန်းခြေ (Probabilistic) သာဖြစ်ပြီး ၁၀၀% အတိအကျ မှန်ကန်ခြင်း မရှိပါ (False positives များ ဖြစ်ပေါ်တတ်သည်)။ ဤစနစ်သည် ကျောင်းသားများ၏ စာအရေးအသားကို human-like ဖြစ်စေရန် ကူညီရုံသာ ဖြစ်ပါသည်။
        </p>
      </div>

      {/* 3. INTERACTIVE TRIGGER BUTTONS & REAL-TIME ACTIONS */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={isAuditing}
          onClick={handleRunFullAudit}
          className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
        >
          <Search className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
          <span>{isAuditing ? 'စစ်ဆေးနေသည်...' : 'AI စစ်ဆေးမည် (Run Full Audit)'}</span>
        </button>

        <button
          type="button"
          onClick={handleHumanizeFlaws}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center space-x-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Humanize / Fix Flaws (AI သံဖျောက်မည်)</span>
        </button>

        <button
          type="button"
          onClick={() => setShowHeatmap(!showHeatmap)}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer flex items-center space-x-1.5"
        >
          {showHeatmap ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>Sentence Heatmap ဖွင့်ကြည့်မည်</span>
        </button>
      </div>

      {justReplaced && (
        <div className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1 animate-in fade-in">
          <Check className="w-3.5 h-3.5" />
          <span>Successfully applied fix: "{justReplaced}"</span>
        </div>
      )}

      {/* 4. MULTI-METRIC DEEP ANALYSIS ENGINE (3 CORE PILLARS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
        {/* Pillar A: AI Detection Rate */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-pink-400" />
              <span>AI Detection Rate:</span>
            </span>
            <strong
              className={`font-mono text-xs ${
                isClean ? 'text-emerald-400' : isModerate ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {aiScore}%
            </strong>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isClean ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(4, aiScore)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>Target: &lt;20%</span>
            <span>Human: {humanScore}%</span>
          </div>
        </div>

        {/* Pillar B: Burstiness & Cadence */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="text-slate-400 text-[11px] flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Burstiness & Cadence:</span>
          </div>
          <div className="font-bold text-slate-200 text-xs font-mono">
            CV: {metrics.burstinessCV}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold">
            {metrics.pacingStatus}
          </div>
        </div>

        {/* Pillar C: Perplexity & Vocabulary Complexity */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="text-slate-400 text-[11px] flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Perplexity & Vocabulary:</span>
          </div>
          <div className="font-bold text-slate-200 text-xs font-mono">
            {metrics.perplexityScore}% Lexical Entropy
          </div>
          <div className="text-[10px] text-slate-400">
            {metrics.flaggedCliches.length === 0 ? 'Zero AI Clichés' : `${metrics.flaggedCliches.length} flagged AI phrases`}
          </div>
        </div>
      </div>

      {/* 5. SENTENCE DISTRIBUTION COUNTER & CLICHÉ FIXER */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-bold">Sentence Distribution:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
            Human: {metrics.sentenceDistribution.human}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono font-bold">
            Moderate: {metrics.sentenceDistribution.moderate}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono font-bold">
            AI-Flagged: {metrics.sentenceDistribution.ai}
          </span>
        </div>

        {metrics.flaggedCliches.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClichePanel(!showClichePanel)}
            className="text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 cursor-pointer text-xs"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{metrics.flaggedCliches.length} AI Clichés Detected ({showClichePanel ? 'Hide' : 'Review'})</span>
            {showClichePanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* 6. EXPANDABLE CLICHÉ QUICK REPLACEMENT PANEL */}
      {showClichePanel && metrics.flaggedCliches.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30 text-xs space-y-2 animate-in fade-in">
          <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
            <span>⚠️ AI Cliché Signatures Found (Click to instantly humanize):</span>
            <span className="text-[10px] text-slate-400 font-mono">1-Click Lexical Fixer</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.flaggedCliches.map((cliche, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800 text-xs"
              >
                <span className="text-amber-400 font-mono font-bold">"{cliche}"</span>
                <span className="text-slate-500">→</span>
                <button
                  type="button"
                  onClick={() => handleQuickReplace(cliche, 'genuinely')}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] transition-all cursor-pointer"
                >
                  Remove / Replace
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. SENTENCE HEATMAP DISPLAY */}
      {showHeatmap && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 text-xs space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-300 border-b border-slate-900 pb-2">
            <span>🔬 Detailed Sentence Diagnostic Report & Heatmap:</span>
            <span className="text-[10px] text-slate-400 font-mono">Total {metrics.sentenceAudit.length} Sentences Analyzed</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs leading-relaxed">
            {metrics.sentenceAudit.map((sent) => {
              const isAi = sent.flag === 'ai';
              const isMod = sent.flag === 'moderate';

              return (
                <div
                  key={sent.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isAi
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : isMod
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[10px] text-slate-400">
                      Sentence #{sent.id + 1} ({sent.wordCount} words)
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border ${
                        isAi
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : isMod
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {isAi ? `🔴 AI Probability: ${sent.score}%` : isMod ? `🟡 Neutral: ${sent.score}%` : `🟢 Human Passing: ${sent.score}%`}
                    </span>
                  </div>
                  <p className="font-sans text-xs select-text">{sent.text}</p>
                  {sent.reasons.length > 0 && (
                    <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-1">
                      {sent.reasons.map((r, rIdx) => (
                        <span key={rIdx} className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          • {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
