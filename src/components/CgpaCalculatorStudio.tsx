import React, { useState, useEffect, useRef } from 'react';
import {
  calculateCgpa,
  calculateTargetScenario,
  getNextTermDescriptor,
  enrichTermWithCalendarMetadata,
  buildOfficialTermPresets,
  sortTermsChronologically,
  normalizeUoPeopleGrade,
  GRADE_POINTS,
  UoPeopleGrade,
  TermRecord,
  CourseRecord,
  CGPA_HISTORY_STORAGE_KEY,
  LEGACY_CGPA_STORAGE_KEY,
} from '../utils/cgpaAnalytics';
import { resolveLiveAcademicContext } from '../utils/uopeopleCalendar';
import {
  AcademicProgressParseError,
  mergeIngestedTerms,
  parseAcademicProgressFile,
} from '../utils/academicProgressParser';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Calendar,
  ArrowUp,
  ArrowDown,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  Plus,
} from 'lucide-react';

function loadInitialCgpaTerms(): TermRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = localStorage.getItem(CGPA_HISTORY_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((t: TermRecord) => enrichTermWithCalendarMetadata(t));
      }
    } catch {
      // Ignore malformed storage
    }
  }
  return [];
}

const OFFICIAL_TERM_PRESETS = buildOfficialTermPresets();

export const CgpaCalculatorStudio: React.FC = () => {
  const [terms, setTerms] = useState<TermRecord[]>(loadInitialCgpaTerms);
  const [degreeTotalTarget, setDegreeTotalTarget] = useState<120 | 60>(120);
  const [targetGpaInput, setTargetGpaInput] = useState('');
  const [remainingCreditsInput, setRemainingCreditsInput] = useState('');
  const [isRemainingManual, setIsRemainingManual] = useState(false);

  // Modals & Interactive States
  const [quickPasteText, setQuickPasteText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);

  const [showProgressModal, setShowProgressModal] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isParsingProgress, setIsParsingProgress] = useState(false);
  const [ingestMode, setIngestMode] = useState<'merge' | 'replace'>('merge');
  const progressFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingCalendarTermId, setEditingCalendarTermId] = useState<string | null>(null);
  const [showCustomTermMenu, setShowCustomTermMenu] = useState(false);
  const customMenuRef = useRef<HTMLDivElement | null>(null);

  const [toast, setToast] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'warning' | 'error', message: string) => {
    setToast({ type, message });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Persist entire CGPA tree under `uopeople_cgpa_history`
  useEffect(() => {
    try {
      localStorage.setItem(CGPA_HISTORY_STORAGE_KEY, JSON.stringify(terms));
    } catch {
      // Ignore storage quota errors
    }
  }, [terms]);

  // Close custom term dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customMenuRef.current && !customMenuRef.current.contains(e.target as Node)) {
        setShowCustomTermMenu(false);
      }
    };
    if (showCustomTermMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomTermMenu]);

  const summary = calculateCgpa(terms);

  // Keep WHAT-IF Planner remaining credits synced with Earned Credits when terms exist unless manually edited
  useEffect(() => {
    if (!isRemainingManual && summary.totalEarnedCredits > 0) {
      setRemainingCreditsInput(String(Math.max(0, degreeTotalTarget - summary.totalEarnedCredits)));
    }
  }, [summary.totalEarnedCredits, degreeTotalTarget, isRemainingManual]);

  const hasWhatIfInputs =
    targetGpaInput.trim() !== '' &&
    remainingCreditsInput.trim() !== '' &&
    (parseFloat(targetGpaInput) || 0) > 0 &&
    (parseInt(remainingCreditsInput, 10) || 0) > 0;

  const targetAnalysis = calculateTargetScenario(
    summary.totalQualityPoints,
    summary.totalGpaCredits,
    parseFloat(targetGpaInput) || 0,
    parseInt(remainingCreditsInput, 10) || 0
  );

  const nextTermInfo = getNextTermDescriptor(terms);
  const liveCalendarContext = resolveLiveAcademicContext();

  // Term Operations
  const handleAddNextTerm = () => {
    const descriptor = getNextTermDescriptor(terms);
    setTerms((prev) => [
      ...prev,
      {
        id: `term-${Date.now()}`,
        termName: descriptor.termName,
        calendarSpan: descriptor.calendarSpan,
        academicYear: descriptor.academicYear,
        termNumber: descriptor.termNumber,
        isCustom: false,
        courses: [{ id: `c-${Date.now()}`, code: '', courseName: '', credits: 3, grade: 'A' }],
      },
    ]);
  };

  const handleAddCustomTerm = (
    label: string,
    options?: { isCustom?: boolean; calendarSpan?: string; academicYear?: string; termNumber?: number; defaultGrade?: UoPeopleGrade }
  ) => {
    setTerms((prev) => [
      ...prev,
      {
        id: `term-custom-${Date.now()}`,
        termName: label,
        calendarSpan: options?.calendarSpan,
        academicYear: options?.academicYear,
        termNumber: options?.termNumber,
        isCustom: options?.isCustom ?? true,
        courses: [
          {
            id: `c-${Date.now()}`,
            code: '',
            courseName: '',
            credits: 3,
            grade: options?.defaultGrade || 'A',
          },
        ],
      },
    ]);
    setShowCustomTermMenu(false);
  };

  const handleRemoveTerm = (termId: string) => {
    setTerms((prev) => prev.filter((t) => t.id !== termId));
  };

  const handleMoveTerm = (index: number, direction: 'up' | 'down') => {
    setTerms((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const handleRenameTerm = (termId: string, nextName: string) => {
    setTerms((prev) =>
      prev.map((t) => {
        if (t.id !== termId) return t;
        const updated = { ...t, termName: nextName };
        if (!updated.isCustom) {
          return enrichTermWithCalendarMetadata({
            ...updated,
            calendarSpan: undefined,
            academicYear: undefined,
          });
        }
        return updated;
      })
    );
  };

  const handleApplyOfficialTermPreset = (termId: string, presetId: string) => {
    if (presetId === '__custom__') {
      setTerms((prev) =>
        prev.map((t) =>
          t.id === termId
            ? {
                ...t,
                isCustom: true,
                termNumber: undefined,
                academicYear: undefined,
                calendarSpan: undefined,
              }
            : t
        )
      );
      setEditingCalendarTermId(null);
      return;
    }

    const preset = OFFICIAL_TERM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTerms((prev) =>
      prev.map((t) =>
        t.id === termId
          ? {
              ...t,
              termName: preset.termName,
              academicYear: preset.academicYear,
              termNumber: preset.termNumber,
              calendarSpan: preset.calendarSpan,
              isCustom: false,
            }
          : t
      )
    );
    setEditingCalendarTermId(null);
  };

  const handleAddCourse = (termId: string) => {
    setTerms((prev) =>
      prev.map((t) => {
        if (t.id !== termId) return t;
        const defaultGrade: UoPeopleGrade =
          t.isCustom && /transfer|tc\b/i.test(t.termName) ? 'TC' : 'A';
        return {
          ...t,
          courses: [
            ...t.courses,
            { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, code: '', courseName: '', credits: 3, grade: defaultGrade },
          ],
        };
      })
    );
  };

  const handleRemoveCourse = (termId: string, courseId: string) => {
    setTerms((prev) =>
      prev.map((t) => {
        if (t.id !== termId) return t;
        return { ...t, courses: t.courses.filter((c) => c.id !== courseId) };
      })
    );
  };

  const handleUpdateCourse = (
    termId: string,
    courseId: string,
    field: keyof CourseRecord,
    val: string | number
  ) => {
    setTerms((prev) =>
      prev.map((t) => {
        if (t.id !== termId) return t;
        return {
          ...t,
          courses: t.courses.map((c) => (c.id === courseId ? { ...c, [field]: val } : c)),
        };
      })
    );
  };

  // Smart Ingestion Handler for "My Academic Progress" (PDF / Screenshot)
  const handleProcessProgressFile = async (file: File) => {
    setIsParsingProgress(true);
    try {
      const result = await parseAcademicProgressFile(file);

      const nextTerms =
        ingestMode === 'replace'
          ? sortTermsChronologically(result.terms)
          : mergeIngestedTerms(terms, result.terms);

      const nextSummary = calculateCgpa(nextTerms);
      setTerms(nextTerms);
      setIsRemainingManual(false);
      setRemainingCreditsInput(
        String(Math.max(0, degreeTotalTarget - nextSummary.totalEarnedCredits))
      );

      setShowProgressModal(false);
      showToast(
        'success',
        `Academic Progress မှ Term (${result.extractedTermCount}) ခုနှင့် ဘာသာရပ် (${result.extractedCourseCount}) ခုကို စနစ်တကျ ထည့်သွင်းတွက်ချက်ပြီးပါပြီ။ (CGPA: ${nextSummary.cumulativeGpa.toFixed(2)})`
      );
    } catch (err: unknown) {
      if (err instanceof AcademicProgressParseError && err.code === 'UNREADABLE') {
        showToast(
          'warning',
          'စာရွက်စာတမ်းကို ရှင်းလင်းစွာ မဖတ်ရှုနိုင်ပါ။ ကျေးဇူးပြု၍ Portal စာမျက်နှာကို Screenshot ပြတ်သားစွာ ရိုက်၍ဖြစ်စေ၊ Manual ဖြစ်စေ ထည့်သွင်းပေးပါ။'
        );
      } else if (err instanceof AcademicProgressParseError && err.code === 'FILE_TOO_LARGE') {
        showToast(
          'warning',
          'ဖိုင်အရွယ်အစား ကြီးမားလွန်းပါသည် (7MB အောက် PDF သို့မဟုတ် Screenshot ကို အသုံးပြုပေးပါ)။'
        );
      } else if (err instanceof AcademicProgressParseError && err.code === 'INVALID_FILE') {
        showToast(
          'warning',
          'PDF (.pdf) သို့မဟုတ် ပုံ (.png, .jpg, .webp) ဖိုင်များကိုသာ တင်ပေးပါ။'
        );
      } else {
        showToast(
          'warning',
          'စာရွက်စာတမ်းကို ရှင်းလင်းစွာ မဖတ်ရှုနိုင်ပါ။ ကျေးဇူးပြု၍ Portal စာမျက်နှာကို Screenshot ပြတ်သားစွာ ရိုက်၍ဖြစ်စေ၊ Manual ဖြစ်စေ ထည့်သွင်းပေးပါ။'
        );
      }
    } finally {
      setIsParsingProgress(false);
      if (progressFileInputRef.current) {
        progressFileInputRef.current.value = '';
      }
    }
  };

  // Quick Portal Grade Text Parser
  const handleParsePortalGrades = () => {
    if (!quickPasteText.trim()) return;
    const lines = quickPasteText.split('\n');
    const newCourses: CourseRecord[] = [];

    lines.forEach((line) => {
      const upper = line.trim();
      const matchGrade = upper.match(/\b(A-|A\+|A|B\+|B|B-|C\+|C|C-|D\+|D|F|TC)\b/i);
      const matchCode = upper.match(/([A-Z]{2,4}\s*\d{4})/i);
      const matchCreds = upper.match(/\b(1|2|3|4|5|6)\b/);

      if (matchCode && matchGrade) {
        const code = matchCode[1].toUpperCase();
        const grade = normalizeUoPeopleGrade(matchGrade[1]) || 'A';
        const credits = matchCreds ? parseInt(matchCreds[1], 10) : 3;
        newCourses.push({
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code,
          credits,
          grade,
        });
      }
    });

    if (newCourses.length > 0) {
      const descriptor = getNextTermDescriptor(terms);
      setTerms((prev) => [
        ...prev,
        {
          id: `term-${Date.now()}`,
          termName: descriptor.termName,
          calendarSpan: descriptor.calendarSpan,
          academicYear: descriptor.academicYear,
          termNumber: descriptor.termNumber,
          isCustom: false,
          courses: newCourses,
        },
      ]);
      setQuickPasteText('');
      setShowPasteModal(false);
      showToast('success', `ဘာသာရပ် (${newCourses.length}) ခုကို Term အသစ်အဖြစ် ထည့်သွင်းပြီးပါပြီ။`);
    } else {
      showToast(
        'warning',
        'Course Code (ဥပမာ CS 1103) နှင့် Grade (ဥပမာ A) များကို မတွေ့ရှိပါ။ စာသားပုံစံကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။'
      );
    }
  };

  // Backup & Restore (Preserves full calendar metadata & course titles)
  const handleExportData = () => {
    const blob = new Blob([JSON.stringify(terms, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UoPeople_CGPA_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'CGPA မှတ်တမ်း Backup ဖိုင်ကို ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const normalized = imported.map((t: TermRecord) => enrichTermWithCalendarMetadata(t));
          const restoredSummary = calculateCgpa(normalized);
          setTerms(normalized);
          setIsRemainingManual(false);
          setRemainingCreditsInput(
            String(Math.max(0, degreeTotalTarget - restoredSummary.totalEarnedCredits))
          );
          showToast('success', `Backup မှ Term (${normalized.length}) ခုကို ပြန်လည်ထည့်သွင်းပြီးပါပြီ။`);
        } else {
          showToast('error', 'Backup JSON ဖိုင်ပုံစံ မမှန်ကန်ပါ။');
        }
      } catch {
        showToast('error', 'Backup JSON ဖိုင်ကို ဖတ်ရှု၍ မရပါ။');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Action Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2 tracking-tight">
            <span>🎓</span> Term အလိုက် CGPA တွက်ချက်ခြင်းနှင့် Target ခန့်မှန်းစနစ်
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            UoPeople စံနှုန်း Grade များ၊ Transfer Credits (TC)၊ Scholarship Safety နှင့် Official Calendar Term Progression
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowProgressModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/25 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>📤</span> My Academic Progress တင်မည် (PDF / ပုံ)
          </button>
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>📋</span> Portal Grade ကူးထည့်မည်
          </button>
          <button
            type="button"
            onClick={handleExportData}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>💾</span> Backup
          </button>
          <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all">
            <span>📥</span> Restore
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>
        </div>
      </div>

      {/* Gentle Inline Toast Notification */}
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs sm:text-sm shadow-lg animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : toast.type === 'warning'
              ? 'bg-amber-950/70 border-amber-500/40 text-amber-200'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed font-medium">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Cumulative CGPA Card */}
        <div className="lg:col-span-4 p-5 sm:p-6 rounded-3xl bg-[#0c1222]/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              စုစုပေါင်း CGPA
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              {terms.length} Terms Recorded
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              {summary.cumulativeGpa.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 4.00 Max</span>
          </div>

          {/* Smart Badges: Scholarship & Honors */}
          <div className="space-y-2 pt-1">
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-between shadow-sm ${summary.scholarshipStatus.color}`}
            >
              <span>{summary.scholarshipStatus.label}</span>
            </div>
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-between shadow-sm ${summary.honorsBadge.color}`}
            >
              <span>{summary.honorsBadge.label}</span>
            </div>
          </div>

          {/* Credits & Degree Progress Bar */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>
                Earned Credits: <strong className="text-white">{summary.totalEarnedCredits} hrs</strong>
              </span>
              <span className="text-slate-400">Target: {degreeTotalTarget} hrs</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (summary.totalEarnedCredits / degreeTotalTarget) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>
                {((summary.totalEarnedCredits / degreeTotalTarget) * 100).toFixed(1)}% Completed
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextTarget = degreeTotalTarget === 120 ? 60 : 120;
                  setDegreeTotalTarget(nextTarget);
                  setIsRemainingManual(false);
                }}
                className="hover:text-indigo-400 transition-colors font-semibold underline cursor-pointer"
              >
                Switch to {degreeTotalTarget === 120 ? 'Associate (60)' : 'Bachelor (120)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Target CGPA What-If Simulator Card */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-3xl bg-[#0c1222]/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 text-lg">🎯</span>
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wide">
                Target CGPA ရရှိရန် ကြိုတင်ခန့်မှန်းချက် (What-If Planner)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Max Possible:{' '}
              <strong className="text-cyan-300 font-bold">
                {hasWhatIfInputs ? targetAnalysis.maxAchievableGpa.toFixed(2) : '—'}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                လိုချင်သော Target CGPA (e.g. 3.80)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="4"
                placeholder="e.g. 3.80"
                value={targetGpaInput}
                onChange={(e) => setTargetGpaInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  ကျန်ရှိသော Credit နာရီ စုစုပေါင်း
                </label>
                {isRemainingManual && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRemainingManual(false);
                      setRemainingCreditsInput(
                        String(Math.max(0, degreeTotalTarget - summary.totalEarnedCredits))
                      );
                    }}
                    className="text-[10px] text-cyan-400 hover:underline font-semibold cursor-pointer"
                  >
                    Auto-sync ({Math.max(0, degreeTotalTarget - summary.totalEarnedCredits)} hrs)
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0"
                placeholder="e.g. 120"
                value={remainingCreditsInput}
                onChange={(e) => {
                  setIsRemainingManual(true);
                  setRemainingCreditsInput(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Scenario Recommendation Box */}
          {hasWhatIfInputs ? (
            <div
              className={`p-4 rounded-2xl border leading-relaxed text-xs sm:text-sm shadow-inner ${
                targetAnalysis.isMathematicallyImpossible
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : targetAnalysis.isAchieved
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
              }`}
            >
              <p className="font-medium">{targetAnalysis.recommendationText}</p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 leading-relaxed text-xs sm:text-sm text-slate-400 shadow-inner">
              <p className="font-medium">
                လိုချင်သော Target CGPA နှင့် ကျန်ရှိသော Credit နာရီများကို ရိုက်ထည့်၍ လိုအပ်သည့် အနည်းဆုံး ပျမ်းမျှ GPA ကို တွက်ချက်ကြည့်ရှုပါ။
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Calendar-Linked Hybrid Term Sequence Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs text-slate-200 font-semibold">
              UoPeople Official 5-Term Calendar Sequence Engine
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Live Sync: {liveCalendarContext.activeBadgeLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Term 1 (Sep–Nov) → Term 2 (Nov–Jan) → Term 3 (Jan–Apr) → Term 4 (Apr–Jun) → Term 5 (Jun–Aug)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Custom / Transfer / Official Picker Dropdown */}
          <div className="relative" ref={customMenuRef}>
            <button
              type="button"
              onClick={() => setShowCustomTermMenu((prev) => !prev)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Custom / TC Term</span>
            </button>

            {showCustomTermMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-40 space-y-1 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Special / Non-Sequence Terms
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleAddCustomTerm('Transfer Credits (TC)', {
                      isCustom: true,
                      defaultGrade: 'TC',
                    })
                  }
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-emerald-300 font-semibold cursor-pointer"
                >
                  🎓 Transfer Credits (TC)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddCustomTerm('Leave of Absence Term', {
                      isCustom: true,
                    })
                  }
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-amber-300 font-semibold cursor-pointer"
                >
                  🌴 Leave / Break Term
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddCustomTerm(`Legacy / Custom Term ${terms.length + 1}`, {
                      isCustom: true,
                    })
                  }
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-200 font-semibold cursor-pointer"
                >
                  ✏️ Custom / Legacy Term
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddNextTerm}
            className="px-4 sm:px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <span>+</span>
            <span>
              နောက် Term အသစ်ထည့်မည် ({nextTermInfo.termName} · {nextTermInfo.calendarSpan})
            </span>
          </button>
        </div>
      </div>

      {/* Terms & Course Tables */}
      <div className="space-y-4">
        {terms.map((term, termIdx) => {
          let termPts = 0;
          let termGpaCreds = 0;
          let termTotalCreds = 0;
          term.courses.forEach((c) => {
            const p = GRADE_POINTS[c.grade];
            if (p !== null && p !== undefined) {
              termPts += p * c.credits;
              termGpaCreds += c.credits;
              if (c.grade !== 'F') {
                termTotalCreds += c.credits;
              }
            } else if (c.grade === 'TC') {
              termTotalCreds += c.credits;
            }
          });
          const termGpa = termGpaCreds > 0 ? (termPts / termGpaCreds).toFixed(2) : '0.00';

          return (
            <div
              key={term.id}
              className="p-4 sm:p-5 rounded-3xl bg-[#0c1222]/90 border border-slate-800 space-y-4 shadow-xl"
            >
              <div className="flex items-start sm:items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={term.termName}
                      onChange={(e) => handleRenameTerm(term.id, e.target.value)}
                      className="bg-transparent font-extrabold text-sm sm:text-base text-white focus:outline-none focus:border-b-2 border-indigo-500 min-w-[160px]"
                    />
                    {term.academicYear && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        AY {term.academicYear}
                      </span>
                    )}
                    {term.calendarSpan && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>{term.calendarSpan}</span>
                      </span>
                    )}
                    {term.isCustom && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Custom / Non-Sequence
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCalendarTermId((curr) => (curr === term.id ? null : term.id))
                      }
                      className="p-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Official UoPeople Calendar Term ရွေးချယ်ရန် / Manual Override လုပ်ရန်"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Manual Official Calendar Term Dropdown & Field Overrides */}
                  {editingCalendarTermId === term.id && (
                    <div className="p-3 rounded-2xl bg-slate-950/90 border border-indigo-500/40 space-y-2.5 mt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleApplyOfficialTermPreset(term.id, e.target.value);
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-indigo-500/50 text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="" disabled>
                            Select Official Calendar Term or Custom Mode...
                          </option>
                          <option value="__custom__">
                            ✏️ Custom / Transfer / Leave Term (Exclude from sequence)
                          </option>
                          {OFFICIAL_TERM_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.termName} ({preset.calendarSpan})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditingCalendarTermId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                        >
                          Done
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <input
                          type="text"
                          value={term.calendarSpan || ''}
                          onChange={(e) =>
                            setTerms((prev) =>
                              prev.map((t) =>
                                t.id === term.id ? { ...t, calendarSpan: e.target.value } : t
                              )
                            )
                          }
                          placeholder="Date Range Override (e.g. Jan 2027 - Mar 2027)"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                        <input
                          type="text"
                          value={term.academicYear || ''}
                          onChange={(e) =>
                            setTerms((prev) =>
                              prev.map((t) =>
                                t.id === term.id ? { ...t, academicYear: e.target.value } : t
                              )
                            )
                          }
                          placeholder="Academic Year Badge Override (e.g. 2026-2027)"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">
                    စုစုပေါင်း Credit:{' '}
                    <strong className="text-white font-mono">{termTotalCreds} hrs</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono shadow-sm">
                    Term GPA: {termGpa}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={termIdx === 0}
                      onClick={() => handleMoveTerm(termIdx, 'up')}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs transition-colors cursor-pointer"
                      title="အပေါ်သို့ ရွှေ့မည်"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={termIdx === terms.length - 1}
                      onClick={() => handleMoveTerm(termIdx, 'down')}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs transition-colors cursor-pointer"
                      title="အောက်သို့ ရွှေ့မည်"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(term.id)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 text-xs transition-colors cursor-pointer"
                      title="Remove Term"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Course Rows */}
              <div className="space-y-2.5">
                {term.courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-2.5 flex-wrap md:flex-nowrap bg-slate-950/60 p-2 rounded-2xl border border-slate-800/80"
                  >
                    <input
                      type="text"
                      placeholder="Code (e.g. UNIV 1001)"
                      value={course.code}
                      onChange={(e) =>
                        handleUpdateCourse(term.id, course.id, 'code', e.target.value)
                      }
                      className="w-full sm:w-36 md:w-36 px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Course Name (optional)"
                      value={course.courseName || ''}
                      onChange={(e) =>
                        handleUpdateCourse(term.id, course.id, 'courseName', e.target.value)
                      }
                      className="flex-1 min-w-[160px] px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={course.credits}
                      onChange={(e) =>
                        handleUpdateCourse(
                          term.id,
                          course.id,
                          'credits',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-24 px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none cursor-pointer"
                    >
                      <option value={3}>3 hrs</option>
                      <option value={4}>4 hrs</option>
                      <option value={1}>1 hr</option>
                      <option value={2}>2 hrs</option>
                      <option value={5}>5 hrs</option>
                      <option value={6}>6 hrs</option>
                    </select>
                    <select
                      value={course.grade}
                      onChange={(e) =>
                        handleUpdateCourse(
                          term.id,
                          course.id,
                          'grade',
                          e.target.value as UoPeopleGrade
                        )
                      }
                      className="w-32 px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-white font-bold font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="A">A (4.00)</option>
                      <option value="A-">A- (3.67)</option>
                      <option value="B+">B+ (3.33)</option>
                      <option value="B">B (3.00)</option>
                      <option value="B-">B- (2.67)</option>
                      <option value="C+">C+ (2.33)</option>
                      <option value="C">C (2.00)</option>
                      <option value="C-">C- (1.67)</option>
                      <option value="D+">D+ (1.33)</option>
                      <option value="D">D (1.00)</option>
                      <option value="F">F (0.00)</option>
                      <option value="TC">TC (Transfer)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveCourse(term.id, course.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-900 text-xs transition-colors cursor-pointer"
                      title="Remove Course"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Course in Term Button */}
              <button
                type="button"
                onClick={() => handleAddCourse(term.id)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1.5 pt-1 cursor-pointer"
              >
                <span>+</span> ဘာသာရပ် ထပ်ထည့်မည်
              </button>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          MODAL: MY ACADEMIC PROGRESS SMART INGESTION (PDF / SCREENSHOT UPLOADER)
         ========================================================================= */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📤</span> My Academic Progress တင်မည် (PDF / ပုံ)
              </h3>
              <button
                type="button"
                disabled={isParsingProgress}
                onClick={() => setShowProgressModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold disabled:opacity-40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              UoPeople Student Portal ရှိ <strong>My Academic Progress</strong> စာမျက်နှာမှ Export လုပ်ထားသော{' '}
              <span className="text-emerald-300 font-semibold">PDF ဖိုင်</span> သို့မဟုတ် Table{' '}
              <span className="text-cyan-300 font-semibold">Screenshot ပုံ (.png, .jpg, .webp)</span>{' '}
              ကို ထည့်သွင်းပါ။ စနစ်မှ ပြီးစီးခဲ့သော ဘာသာရပ်များ၊ Credit နာရီများနှင့် Grade များကို Term အစီအစဉ်အလိုက် အလိုအလျောက် ခွဲထုတ်ပေးပါမည်။
            </p>

            {/* Merge vs Replace Toggle */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                disabled={isParsingProgress}
                onClick={() => setIngestMode('merge')}
                className={`p-2.5 rounded-xl border font-semibold transition-all cursor-pointer text-left ${
                  ingestMode === 'merge'
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold">🔗 Smart Merge</div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  လက်ရှိ Term များနှင့် ပေါင်းစပ်ဖြည့်သွင်းမည်
                </div>
              </button>
              <button
                type="button"
                disabled={isParsingProgress}
                onClick={() => setIngestMode('replace')}
                className={`p-2.5 rounded-xl border font-semibold transition-all cursor-pointer text-left ${
                  ingestMode === 'replace'
                    ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold">🔄 Replace History</div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  တင်လိုက်သော မှတ်တမ်းဖြင့် အသစ်အစားထိုးမည်
                </div>
              </button>
            </div>

            {/* Drop-Zone Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!isParsingProgress) setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                if (isParsingProgress) return;
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  void handleProcessProgressFile(file);
                }
              }}
              onClick={() => {
                if (!isParsingProgress) {
                  progressFileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer space-y-3 ${
                isDraggingFile
                  ? 'border-emerald-400 bg-emerald-950/30'
                  : 'border-slate-700 hover:border-emerald-500/60 bg-slate-950/70'
              } ${isParsingProgress ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  ဖိုင်ကို ဤနေရာသို့ ဆွဲထည့်ပါ (သို့မဟုတ် နှိပ်၍ ရွေးချယ်ပါ)
                </p>
                <p className="text-[11px] text-slate-400">
                  Supports UoPeople Academic Progress PDF (.pdf) & Screenshots (.png, .jpg, .webp) · Max 7MB
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 text-[11px] text-slate-300 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF Export
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> Portal Screenshot
                </span>
              </div>
              <input
                ref={progressFileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleProcessProgressFile(file);
                  }
                }}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Zero-Cloud Privacy · Dynamic Free-Tier Cascade Parser
              </span>
              <button
                type="button"
                disabled={isParsingProgress}
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Localized Loading Overlay During PDF / Image Extraction */}
      {isParsingProgress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-7 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-2">
              <h4 className="text-sm sm:text-base font-bold text-white leading-relaxed">
                Academic Progress စာမျက်နှာမှ ပြီးစီးခဲ့သော ဘာသာရပ်များကို စနစ်တကျ စိစစ်ထုတ်ယူနေပါသည်...
              </h4>
              <p className="text-xs text-slate-400">
                Term များ၊ Credit နာရီများနှင့် UoPeople Grade များကို အစီအစဉ်အလိုက် ပြန်လည်တွက်ချက်ပေးနေပါသည်။
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Portal Grade Quick Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📋</span> Portal Grade Text ကူးထည့်ခြင်း
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Moodle Gradebook သို့မဟုတ် UoPeople Student Portal မှ Grade စာသားများကို အောက်ပါ Box ထဲသို့ ကူးထည့်ပါ။ စနစ်မှ Course Codes (ဥပမာ CS 1103) နှင့် Grades (ဥပမာ A) များကို အလိုအလျောက် ခွဲထုတ်ပေးပါမည်။
            </p>

            <textarea
              rows={8}
              value={quickPasteText}
              onChange={(e) => setQuickPasteText(e.target.value)}
              placeholder="Paste Moodle grades here... e.g. CS 1103 Programming 1 ... 3 ... A"
              className="w-full p-3.5 text-xs sm:text-sm rounded-2xl bg-slate-950 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                ပိတ်မည် (Cancel)
              </button>
              <button
                type="button"
                onClick={handleParsePortalGrades}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Grade များ ခွဲထုတ်ထည့်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
