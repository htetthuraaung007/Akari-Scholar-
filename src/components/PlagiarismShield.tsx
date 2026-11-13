import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  FileText,
  Filter,
} from 'lucide-react';

export const PlagiarismShield: React.FC = () => {
  const { language, callAcademicApi } = useApp();

  const [courseCode, setCourseCode] = useState('POLS 1503-01');
  const [promptExcerpt, setPromptExcerpt] = useState('Compare and contrast the direct democracy of classical Athens with contemporary representative systems.');
  const [fullText, setFullText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSample = () => {
    setCourseCode('POLS 1503-01');
    setPromptExcerpt('Analyze whether economic globalization increases cultural homogenization or fosters hybrid local identities.');
    setFullText(
      `Unit 7 Assignment Activity
University of the People
POLS 1503-01 AY2027-T1
Instructor name: Dr. Vance
Student: John Doe
Date: November 6, 2026

Prompt Question: Analyze whether economic globalization increases cultural homogenization or fosters hybrid local identities.

Introduction
The phenomenon of economic globalization has transformed cross-border cultural dynamics. While early sociologists hypothesized that multinational corporate expansion would inevitably produce cultural homogenization, contemporary empirical research demonstrates that local communities actively recontextualize global artifacts to construct hybrid identities (Robertson, 1995).

Theoretical Framework
According to Robertson's model of glocalization, global cultural products rarely eradicate localized traditions; rather, they undergo organic synthesis. In contrast, critics argue that Western media dominance threatens indigenous linguistic heritage.

Conclusion
In conclusion, cultural globalization is neither purely homogenizing nor wholly fragmenting. It creates complex hybrid cultural ecosystems that require nuanced sociological analysis.

References
Robertson, R. (1995). Glocalization: Time-space and homogeneity-heterogeneity. Global Modernities, 25-44.`
    );
  };

  // Real-time client-side institutional boilerplate detection
  const detectedBoilerplate = useMemo(() => {
    if (!fullText.trim()) return [];

    const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
    const institutionalMatches: string[] = [];

    const patterns = [
      /university of the people/i,
      /pols\s*1503/i,
      /assignment\s*activity/i,
      /discussion\s*assignment/i,
      /instructor\s*name/i,
      /ay202\d-t\d/i,
      /student\s*:/i,
      /date\s*:/i,
      /prompt\s*question/i,
    ];

    for (const line of lines) {
      if (patterns.some((p) => p.test(line)) || (promptExcerpt && line.includes(promptExcerpt.trim()))) {
        institutionalMatches.push(line);
      }
    }

    return institutionalMatches;
  }, [fullText, promptExcerpt]);

  const rawWordCount = fullText.split(/\s+/).filter(Boolean).length;
  const boilerplateWordCount = detectedBoilerplate.join(' ').split(/\s+/).filter(Boolean).length;
  const coreWordCount = Math.max(0, rawWordCount - boilerplateWordCount);
  const boilerplateRatio = rawWordCount > 0 ? Math.round((boilerplateWordCount / rawWordCount) * 100) : 0;

  const handleAudit = async () => {
    if (!fullText.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await callAcademicApi('plagiarism_false_positive_shield', {
        fullText,
        courseCode,
        promptExcerpt,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to audit plagiarism false-positives.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/30 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white flex items-center space-x-2">
            <span>
              {language === 'my'
                ? 'Academic Plagiarism False-Positive Shield (Turnitin အမှတ်မှား ကာကွယ်ရေး စနစ်)'
                : 'Turnitin False-Positive Plagiarism Shield'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px]">
              Turnitin Similarity Filter
            </span>
          </div>
          <p className="leading-relaxed text-slate-400">
            {language === 'my'
              ? 'တက္ကသိုလ်အမည် (University of the People)၊ ဘာသာရပ်ကုဒ်၊ Assignment ခေါင်းစဉ်နှင့် Syllabus မေးခွန်းများသည် Turnitin တွင် Similarity % မလိုအပ်ဘဲ တက်စေသည့် အဓိက အကြောင်းရင်း ဖြစ်ပါသည်။ ၎င်း Generic စာသားများကို သီးသန့်ခွဲထုတ်ပြီး စစ်မှန်သော စာသားတူညီမှု (True Similarity) ကိုသာ စစ်ဆေးပေးပါသည်'
              : 'Generic institutional boilerplate (University of the People, course codes, quoted assignment questions) falsely spikes Turnitin similarity flags. This shield isolates authentic conceptual text and sanitizes false-positive traps.'}
          </p>
        </div>
      </div>

      {/* Metrics Bar */}
      {rawWordCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">Raw Words</span>
            <div className="text-lg font-black text-white font-mono mt-0.5">{rawWordCount}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-400">Boilerplate Words</span>
            <div className="text-lg font-black text-amber-300 font-mono mt-0.5">
              {boilerplateWordCount} ({boilerplateRatio}%)
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400">True Academic Core</span>
            <div className="text-lg font-black text-emerald-300 font-mono mt-0.5">{coreWordCount} words</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Turnitin Risk</span>
            <div className={`text-sm font-black uppercase mt-1 font-mono ${boilerplateRatio > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {boilerplateRatio > 15 ? '⚠️ Inflation Risk' : '✅ Shielded / Safe'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUTS */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {language === 'my' ? 'Assignment အချက်အလက်နှင့် စာမူကြမ်း' : 'Paper Draft & Course Context'}
            </label>
            <button
              type="button"
              onClick={loadSample}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              {language === 'my' ? 'နမူနာ ထည့်မည်' : 'Load Sample Draft'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Course Code:
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="POLS 1503-01"
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Prompt Excerpt (မေးခွန်း):
              </label>
              <input
                type="text"
                value={promptExcerpt}
                onChange={(e) => setPromptExcerpt(e.target.value)}
                placeholder="Question excerpt from syllabus..."
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white truncate"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my' ? 'တင်သွင်းမည့် စာမူကြမ်း အပြည့်အစုံ:' : 'Full Paper Draft Text:'}
            </label>
            <textarea
              rows={8}
              value={fullText}
              onChange={(e) => setFullText(e.target.value)}
              placeholder="Paste your full paper including title page, body, and references to scan for false-positive Turnitin traps..."
              className="w-full p-3 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>

          {/* Detected Boilerplate Badges */}
          {detectedBoilerplate.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Detected Institutional Match Traps ({detectedBoilerplate.length}):
              </span>
              <div className="flex flex-wrap gap-1">
                {detectedBoilerplate.slice(0, 6).map((b, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono truncate max-w-[200px]"
                    title={b}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={loading || !fullText.trim()}
              onClick={handleAudit}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-white" />
              )}
              <span>
                {loading
                  ? (language === 'my' ? 'စစ်ဆေးနေပါသည်...' : 'Analyzing Similarity Traps...')
                  : (language === 'my' ? 'False-Positive Shield စစ်ဆေးမည်' : 'Run Plagiarism False-Positive Shield')}
              </span>
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
              {error}
            </p>
          )}
        </div>

        {/* OUTPUT */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-full min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'my' ? 'Plagiarism Shield စစ်ဆေးတွေ့ရှိချက်' : 'Turnitin Shield & Core Report'}</span>
            </span>

            {result && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Report</span>
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">
                {language === 'my'
                  ? 'Turnitin မှားယွင်းစွာ ထောက်ပြတတ်သော စာကြောင်းများကို ခွဲထုတ်စစ်ဆေးနေပါသည်...'
                  : 'Isolating institutional boilerplates and calculating true conceptual similarity...'}
              </p>
            </div>
          ) : result ? (
            <div className="flex-1 overflow-y-auto max-h-[550px] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {result}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <ShieldCheck className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-xs max-w-sm">
                {language === 'my'
                  ? 'စာမူကြမ်းကို ဘယ်ဘက်တွင် ထည့်သွင်းပြီး မတင်မီ Turnitin မှားယွင်းအမှတ်တက်နိုင်သော အချက်များကို ဖယ်ရှားပါ'
                  : 'Paste draft to filter out institutional boilerplates and verify your paper’s true conceptual originality.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
