import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  GraduationCap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Target,
  FileText,
} from 'lucide-react';

export const InstructorRubricProfiler: React.FC = () => {
  const { language, callAcademicApi } = useApp();

  const [profileType, setProfileType] = useState<
    'strict_citations' | 'strict_depth' | 'strict_critical' | 'strict_rubric_checklist' | 'custom'
  >('strict_citations');

  const [instructorNotes, setInstructorNotes] = useState('');
  const [draftText, setDraftText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const PROFILES = [
    {
      id: 'strict_citations' as const,
      titleEn: 'Strict on APA Citations & Recent Sources',
      titleMy: 'APA Citation နှင့် ကိုးကားလွတ်မှု မခံသော ဆရာ',
      descEn: 'Deducts heavily for missing in-text citations, undated sources, or APA formatting glitches.',
      descMy: 'In-text citation မပါခြင်း၊ ၁၀ နှစ်ကျော် သက်တမ်းလွန် စာအုပ်များ သုံးခြင်းကို အမှတ်ပြတ်သားစွာ ဖြတ်သော ဆရာ',
      defaultNotes: 'Instructor insists on strict APA 7th standards. Peer-reviewed scholarly sources within the last 5 years are required. Every major assertion must have an in-text citation.',
    },
    {
      id: 'strict_depth' as const,
      titleEn: 'Strict on Word Count & Comprehensive Depth',
      titleMy: 'စာမျက်နှာအရှည်နှင့် အသေးစိတ် အနုစိတ် ဦးစားပေး ဆရာ',
      descEn: 'Penalizes brief answers. Demands thorough real-world examples and comprehensive explanations.',
      descMy: 'စာလုံးရေ အနည်းဆုံး သတ်မှတ်ချက်ကို တိကျစွာ စစ်ဆေးပြီး အကျဉ်းချုပ် ရေးသားမှုများကို အမှတ်လျှော့သော ဆရာ',
      defaultNotes: 'Instructor expects submissions to meet or exceed the upper word count limit with rich case studies, real-world examples, and detailed multi-paragraph exploration.',
    },
    {
      id: 'strict_critical' as const,
      titleEn: 'Strict on Critical Thinking & Counter-Arguments',
      titleMy: 'ဝေဖန်ပိုင်းခြားတွေးခေါ်မှုနှင့် ဆန့်ကျင်ဘက် အမြင်တောင်းသော ဆရာ',
      descEn: 'Requires robust consideration of counter-arguments and substantive intellectual rebuttals.',
      descMy: 'သဘောတရား ပြန်လည်ကူးရေးရုံ သက်သက်ကို အမှတ်မပေးဘဲ ဆန့်ကျင်ဘက် အမြင်နှင့် စိစစ်ချက် မဖြစ်မနေ တောင်းဆိုသော ဆရာ',
      defaultNotes: 'Instructor penalizes superficial descriptive summaries. Essays must include an explicit counter-argument and explain limitations of the proposed solution.',
    },
    {
      id: 'strict_rubric_checklist' as const,
      titleEn: 'Strict Prompt Rubric Checklist Purist',
      titleMy: 'မေးခွန်းအချက်အလက် အကုန်ဖြေမဖြေ တိကျစွာ စစ်သော ဆရာ',
      descEn: 'Checks off each sub-question bullet systematically against the university grading rubric.',
      descMy: 'Assignment မေးခွန်းပါ အပိုဒ်ခွဲတိုင်း၊ မေးခွန်းခွဲတိုင်းကို ဇယားချ၍ တစ်ခုချင်းစီ အမှတ်ပေးသော ဆရာ',
      defaultNotes: 'Instructor grades mechanically using the rubric matrix. Every sub-prompt and question bullet must have a dedicated, clearly identifiable section.',
    },
    {
      id: 'custom' as const,
      titleEn: 'Custom (Paste Syllabus Note or Feedback)',
      titleMy: 'ဆရာ၏ Feedback / Syllabus စာသား ထည့်သွင်းခြင်း',
      descEn: 'Paste your actual professor’s welcome announcement, syllabus note, or past feedback.',
      descMy: 'မိမိဆရာ ပေးထားသော ပထမပတ် Feedback သို့မဟုတ် Syllabus အမှာစကားကို ထည့်၍ စစ်ဆေးခြင်း',
      defaultNotes: '',
    },
  ];

  const handleSelectProfile = (id: typeof profileType) => {
    setProfileType(id);
    const found = PROFILES.find((p) => p.id === id);
    if (found && id !== 'custom') {
      setInstructorNotes(found.defaultNotes);
    }
  };

  const loadSampleDraft = () => {
    setDraftText(
      `Technological automation within municipal infrastructure has significantly increased throughout modern developing cities. While robotic sensors and machine learning models increase transit efficiency, serious privacy concerns emerge regarding digital mass surveillance. According to recent empirical analyses, municipal surveillance networks frequently expand without legislative oversight (Zuboff, 2019). In summary, municipal governments must establish transparent legal oversight frameworks before procuring automated sensor technologies. Without ethical safeguards, civic trust inevitably deteriorates.`
    );
  };

  const handleProfileAudit = async () => {
    if (!draftText.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const selected = PROFILES.find((p) => p.id === profileType);
      const res = await callAcademicApi('instructor_rubric_profiler', {
        instructorNotes: instructorNotes || (selected ? selected.defaultNotes : 'Standard strict academic rubric'),
        draftText,
        profileType: selected ? selected.titleEn : 'Strict Academic Rubric',
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to profile instructor expectations.');
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
      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start space-x-3">
        <GraduationCap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white flex items-center space-x-2">
            <span>
              {language === 'my'
                ? 'Multiple Instructor Rubric Profiler (ဆရာအကြိုက် ချိန်ညှိစနစ်)'
                : 'Multiple Instructor Rubric Profiler'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px]">
              Instructor-Tailored Grading Scorecard
            </span>
          </div>
          <p className="leading-relaxed text-slate-400">
            {language === 'my'
              ? 'ဆရာတစ်ဦးနှင့်တစ်ဦး အမှတ်ပေးပုံ ကွာခြားချက် (APA Citation တင်းကျပ်သူ၊ စာလုံးရေ အရှည်တောင်းသူ၊ Critical Thinking ဦးစားပေးသူ) အလိုက် မိမိ၏ စာမူကြမ်းကို ကြိုတင်စစ်ဆေးပြီး အမှတ်ပြည့်ရအောင် ပြင်ဆင်နိုင်ပါသည်'
              : 'Different professors grade differently. Align your paper directly with your specific instructor’s known grading bias (Strict Citations, Word Count Depth, Critical Thinking, or custom syllabus feedback).'}
          </p>
        </div>
      </div>

      {/* Preset Instructor Bias Archetypes */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          {language === 'my' ? 'ဆရာ၏ အမှတ်ပေး ဦးစားပေးပုံစံကို ရွေးချယ်ပါ:' : 'Select Instructor Grading Archetype:'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PROFILES.map((p) => {
            const isSelected = profileType === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProfile(p.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-xs font-bold text-slate-200">
                    {language === 'my' ? p.titleMy : p.titleEn}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {language === 'my' ? p.descMy : p.descEn}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUTS */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my'
                ? 'ဆရာ၏ Syllabus အမှာစကား သို့မဟုတ် ညွှန်ကြားချက်များ (Instructor Notes / Feedback):'
                : 'Instructor Directives, Syllabus Note, or Past Feedback:'}
            </label>
            <textarea
              rows={3}
              value={instructorNotes}
              onChange={(e) => setInstructorNotes(e.target.value)}
              placeholder="e.g. In Week 1 feedback, professor emphasized: 'Make sure every claim has an APA in-text citation and avoid pure summaries'..."
              className="w-full p-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-400">
                {language === 'my' ? 'သင်၏ စာမူကြမ်း (Essay / Assignment Draft):' : 'Your Assignment Draft:'}
              </label>
              <button
                type="button"
                onClick={loadSampleDraft}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                {language === 'my' ? 'နမူနာ ထည့်မည်' : 'Load Sample Draft'}
              </button>
            </div>
            <textarea
              rows={8}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Paste your essay draft to audit against this professor's specific expectations..."
              className="w-full p-3 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={loading || !draftText.trim()}
              onClick={handleProfileAudit}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
              <span>
                {loading
                  ? (language === 'my' ? 'ဆရာအကြိုက် စစ်ဆေးနေပါသည်...' : 'Profiling Rubric Expectations...')
                  : (language === 'my' ? 'ဆရာအကြိုက် ချိန်ညှိစစ်ဆေးမည်' : 'Audit Against Instructor Bias')}
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
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Target className="w-4 h-4" />
              <span>{language === 'my' ? 'ဆရာအကြိုက် စစ်ဆေးချက် ရလဒ်' : 'Instructor Alignment Scorecard'}</span>
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
                    <span>Copy Scorecard</span>
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">
                {language === 'my'
                  ? 'ရွေးချယ်ထားသော ဆရာ၏ ဦးစားပေးအချက်များနှင့် စာမူကြမ်းကို အသေးစိတ် တိုက်ဆိုင်စစ်ဆေးနေပါသည်...'
                  : 'Evaluating draft vulnerabilities under professor-specific grading rubrics...'}
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
              <GraduationCap className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-xs max-w-sm">
                {language === 'my'
                  ? 'ဆရာ၏ အမှတ်ပေးပုံစံနှင့် စာမူကြမ်းကို ထည့်သွင်းပြီး အမှတ်အပြည့်ရရှိရန် လိုအပ်ချက်များကို စစ်ဆေးပါ'
                  : 'Select an instructor archetype and paste your draft to receive tailored rubric calibrations.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
