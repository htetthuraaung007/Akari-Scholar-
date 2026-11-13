import {
  MULTI_YEAR_TERMS,
  resolveLiveAcademicContext,
  UoPeopleTermCycle,
} from './uopeopleCalendar';

export const CGPA_HISTORY_STORAGE_KEY = 'uopeople_cgpa_history';
export const LEGACY_CGPA_STORAGE_KEY = 'akari_cgpa_terms';

export type UoPeopleGrade =
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D+'
  | 'D'
  | 'F'
  | 'TC';

export const GRADE_POINTS: Record<UoPeopleGrade, number | null> = {
  A: 4.0,
  'A-': 3.67,
  'B+': 3.33,
  B: 3.0,
  'B-': 2.67,
  'C+': 2.33,
  C: 2.0,
  'C-': 1.67,
  'D+': 1.33,
  D: 1.0,
  F: 0.0,
  TC: null, // Transfer Credit: Excluded from GPA calculation, included in total earned credits
};

export interface CourseRecord {
  id: string;
  code: string;
  courseName?: string;
  credits: number;
  grade: UoPeopleGrade;
}

export interface TermRecord {
  id: string;
  termName: string;
  calendarSpan?: string;
  academicYear?: string;
  termNumber?: number;
  isCustom?: boolean;
  courses: CourseRecord[];
}

export interface CgpaSummary {
  cumulativeGpa: number;
  totalGpaCredits: number;
  totalEarnedCredits: number; // Includes TC
  totalQualityPoints: number;
  honorsBadge: { label: string; color: string };
  scholarshipStatus: { safe: boolean; label: string; color: string };
}

export function normalizeUoPeopleGrade(raw: string): UoPeopleGrade | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned === 'A+' || cleaned === 'A') return 'A';
  if (
    cleaned === 'A-' ||
    cleaned === 'B+' ||
    cleaned === 'B' ||
    cleaned === 'B-' ||
    cleaned === 'C+' ||
    cleaned === 'C' ||
    cleaned === 'C-' ||
    cleaned === 'D+' ||
    cleaned === 'D' ||
    cleaned === 'F' ||
    cleaned === 'TC'
  ) {
    return cleaned;
  }
  if (cleaned === 'TR' || cleaned === 'CR' || cleaned === 'TRANSFER' || cleaned === 'TRANSFERCREDIT') {
    return 'TC';
  }
  return null;
}

export function calculateCgpa(terms: TermRecord[]): CgpaSummary {
  let totalQualityPoints = 0;
  let totalGpaCredits = 0;
  let totalEarnedCredits = 0;

  terms.forEach((term) => {
    term.courses.forEach((course) => {
      const pts = GRADE_POINTS[course.grade];
      if (pts !== null && pts !== undefined) {
        totalQualityPoints += pts * course.credits;
        totalGpaCredits += course.credits;
        if (course.grade !== 'F') {
          totalEarnedCredits += course.credits;
        }
      } else if (course.grade === 'TC') {
        totalEarnedCredits += course.credits;
      }
    });
  });

  const cumulativeGpa =
    totalGpaCredits > 0
      ? Math.min(4.0, Math.round((totalQualityPoints / totalGpaCredits) * 100) / 100)
      : 0.0;

  // Academic Honors & Standing
  let honorsBadge = {
    label: 'Good Standing',
    color: 'text-slate-300 bg-slate-800 border-slate-700',
  };
  if (cumulativeGpa >= 3.85 && totalEarnedCredits >= 30) {
    honorsBadge = {
      label: '🏆 Summa Cum Laude',
      color: 'text-amber-300 bg-amber-950/60 border-amber-500/40',
    };
  } else if (cumulativeGpa >= 3.7 && totalEarnedCredits >= 30) {
    honorsBadge = {
      label: '🎖️ Magna Cum Laude',
      color: 'text-purple-300 bg-purple-950/60 border-purple-500/40',
    };
  } else if (cumulativeGpa >= 3.5 && totalEarnedCredits >= 30) {
    honorsBadge = {
      label: '⭐ Cum Laude',
      color: 'text-blue-300 bg-blue-950/60 border-blue-500/40',
    };
  } else if (cumulativeGpa < 2.0 && totalGpaCredits >= 12) {
    honorsBadge = {
      label: '🚨 Academic Probation Warning',
      color: 'text-rose-300 bg-rose-950/60 border-rose-500/40',
    };
  }

  // Scholarship Standing (< 3.00 vs >= 3.00)
  const scholarshipStatus =
    cumulativeGpa >= 3.0
      ? {
          safe: true,
          label: '🟢 Scholarship Safe (>= 3.00)',
          color: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40',
        }
      : {
          safe: false,
          label: '⚠️ Scholarship At Risk (< 3.00)',
          color: 'text-amber-400 bg-amber-950/60 border-amber-500/40',
        };

  return {
    cumulativeGpa,
    totalGpaCredits,
    totalEarnedCredits,
    totalQualityPoints,
    honorsBadge,
    scholarshipStatus,
  };
}

export interface TargetAnalysis {
  isAchieved: boolean;
  isMathematicallyImpossible: boolean;
  requiredGpa: number;
  maxAchievableGpa: number;
  recommendationText: string;
}

export function calculateTargetScenario(
  currentQualityPoints: number,
  currentGpaCredits: number,
  targetGpa: number,
  remainingCredits: number
): TargetAnalysis {
  if (remainingCredits <= 0) {
    const currGpa = currentGpaCredits > 0 ? currentQualityPoints / currentGpaCredits : 0;
    return {
      isAchieved: currGpa >= targetGpa,
      isMathematicallyImpossible: currGpa < targetGpa,
      requiredGpa: 0,
      maxAchievableGpa: currGpa,
      recommendationText: 'ကျန်ရှိသော Credit မရှိတော့ပါ။',
    };
  }

  const totalFutureCredits = currentGpaCredits + remainingCredits;
  const maxQualityPoints = currentQualityPoints + remainingCredits * 4.0;
  const maxAchievableGpa = Math.round((maxQualityPoints / totalFutureCredits) * 100) / 100;

  const targetQualityPoints = targetGpa * totalFutureCredits;
  const neededQualityPoints = targetQualityPoints - currentQualityPoints;
  const requiredGpa = Math.round((neededQualityPoints / remainingCredits) * 100) / 100;

  if (requiredGpa > 4.0) {
    return {
      isAchieved: false,
      isMathematicallyImpossible: true,
      requiredGpa,
      maxAchievableGpa,
      recommendationText: `ကျန်ရှိသော ${remainingCredits} credits အားလုံး A (4.00) ချည်း ရခဲ့လျှင်ပင် အမြင့်ဆုံး ${maxAchievableGpa.toFixed(2)} သာ ရရှိနိုင်သဖြင့် Target GPA ${targetGpa.toFixed(2)} သည် သင်္ချာနည်းအရ မဖြစ်နိုင်တော့ပါ။ Target ကို ပြန်လည်ညှိပေးပါ။`,
    };
  }

  if (
    currentGpaCredits > 0 &&
    requiredGpa <= currentQualityPoints / currentGpaCredits &&
    currentQualityPoints / currentGpaCredits >= targetGpa
  ) {
    return {
      isAchieved: true,
      isMathematicallyImpossible: false,
      requiredGpa: Math.max(0, requiredGpa),
      maxAchievableGpa,
      recommendationText: `ဂုဏ်ယူပါသည်! သင်၏ လက်ရှိ CGPA သည် လိုချင်သော Target သို့ ရောက်ရှိနေပြီး ဖြစ်သည်။ ကျန်ရှိသော Course များတွင် GPA ${Math.max(2.0, requiredGpa).toFixed(2)} ခန့် ထိန်းထားရုံဖြင့် Target ကို ဆက်လက် ထိန်းသိမ်းနိုင်ပါမည်။`,
    };
  }

  return {
    isAchieved: false,
    isMathematicallyImpossible: false,
    requiredGpa,
    maxAchievableGpa,
    recommendationText: `Target CGPA ${targetGpa.toFixed(2)} ရရှိရန် ကျန်ရှိသော ${remainingCredits} credit နာရီများတွင် အနည်းဆုံး ပျမ်းမျှ GPA ${requiredGpa.toFixed(2)} (${
      requiredGpa >= 3.67 ? 'A / A-' : requiredGpa >= 3.33 ? 'A- / B+' : 'B+ / B'
    } အများစု) ရရှိရန် လိုအပ်ပါသည်။`,
  };
}

// =========================================================================
// UoPeople Official 5-Term Academic Calendar Cycle Linkage
// Term 1 [Sep-Nov], Term 2 [Nov-Jan], Term 3 [Jan-Apr], Term 4 [Apr-Jun], Term 5 [Jun-Aug]
// =========================================================================
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthSpanFromIso(startIso: string, endIso: string): string {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${startIso} - ${endIso}`;
  return `${MONTH_NAMES[s.getUTCMonth()]} ${s.getUTCFullYear()} - ${MONTH_NAMES[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

export interface ParsedTermDescriptor {
  academicStartYear: number;
  termNumber: 1 | 2 | 3 | 4 | 5;
  style: 'academic_year' | 'short_year';
  academicYear: string;
  calendarSpan: string;
}

export function resolveOfficialTermSpan(
  academicStartYear: number,
  termNumber: 1 | 2 | 3 | 4 | 5
): { academicYear: string; calendarSpan: string; cycleEntry?: UoPeopleTermCycle } {
  const academicYear = `${academicStartYear}-${academicStartYear + 1}`;
  const matched = MULTI_YEAR_TERMS.find(
    (t) => t.academicYear === academicYear && t.termNumber === termNumber
  );

  if (matched) {
    return {
      academicYear,
      calendarSpan: formatMonthSpanFromIso(matched.termStartDate, matched.termEndDate),
      cycleEntry: matched,
    };
  }

  // Fallback to official 5-term UoPeople cycle pattern for historical/future years
  const endYear = academicStartYear + 1;
  const fallbackSpans: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: `Sep ${academicStartYear} - Nov ${academicStartYear}`,
    2: `Nov ${academicStartYear} - Jan ${endYear}`,
    3: `Jan ${endYear} - Apr ${endYear}`,
    4: `Apr ${endYear} - Jun ${endYear}`,
    5: `Jun ${endYear} - Aug ${endYear}`,
  };

  return {
    academicYear,
    calendarSpan: fallbackSpans[termNumber],
  };
}

export function parseStandardTermDescriptor(termName: string): ParsedTermDescriptor | null {
  if (!termName) return null;
  const cleaned = termName.trim();

  // Pattern A1: "2025-2026 Term 1" or "AY 2026-2027 Term 2"
  const ayMatchForward = cleaned.match(/(\d{4})\s*[-–]\s*(\d{4}).*?(?:Term|T)\s*([1-5])/i);
  if (ayMatchForward) {
    const startYear = parseInt(ayMatchForward[1], 10);
    const termNumber = parseInt(ayMatchForward[3], 10) as 1 | 2 | 3 | 4 | 5;
    const { academicYear, calendarSpan } = resolveOfficialTermSpan(startYear, termNumber);
    return {
      academicStartYear: startYear,
      termNumber,
      style: 'academic_year',
      academicYear,
      calendarSpan,
    };
  }

  // Pattern A2: "Term 3 (2026-2027)" or "Term 3 · 2026-2027"
  const ayMatchReverse = cleaned.match(/(?:Term|T)\s*([1-5]).*?(\d{4})\s*[-–]\s*(\d{4})/i);
  if (ayMatchReverse) {
    const startYear = parseInt(ayMatchReverse[2], 10);
    const termNumber = parseInt(ayMatchReverse[1], 10) as 1 | 2 | 3 | 4 | 5;
    const { academicYear, calendarSpan } = resolveOfficialTermSpan(startYear, termNumber);
    return {
      academicStartYear: startYear,
      termNumber,
      style: 'academic_year',
      academicYear,
      calendarSpan,
    };
  }

  // Pattern B: "2026 Term 2" or "Term 2 2026"
  const shortMatch =
    cleaned.match(/(\d{4})\s*(?:Term|T)\s*([1-5])/i) ||
    cleaned.match(/(?:Term|T)\s*([1-5])\s*(?:\(|,|-|\s)*(\d{4})/i);

  if (shortMatch) {
    const isYearFirst = /^\d{4}/.test(shortMatch[1]);
    const startYear = parseInt(isYearFirst ? shortMatch[1] : shortMatch[2], 10);
    const termNumber = parseInt(isYearFirst ? shortMatch[2] : shortMatch[1], 10) as 1 | 2 | 3 | 4 | 5;
    const { academicYear, calendarSpan } = resolveOfficialTermSpan(startYear, termNumber);
    return {
      academicStartYear: startYear,
      termNumber,
      style: 'short_year',
      academicYear,
      calendarSpan,
    };
  }

  return null;
}

export function enrichTermWithCalendarMetadata(term: TermRecord): TermRecord {
  if (term.isCustom) {
    return term;
  }
  const parsed = parseStandardTermDescriptor(term.termName);
  if (!parsed) {
    return term;
  }
  return {
    ...term,
    termNumber: parsed.termNumber,
    academicYear: term.academicYear || parsed.academicYear,
    calendarSpan: term.calendarSpan || parsed.calendarSpan,
  };
}

export interface NextTermDescriptor {
  termName: string;
  calendarSpan: string;
  academicYear: string;
  termNumber: 1 | 2 | 3 | 4 | 5;
}

/**
 * Inspects the latest standard (non-custom) term in the student's history
 * and calculates the next official UoPeople Academic Calendar term.
 * Falls back to the live UoPeople Academic Calendar context when history has no standard terms.
 */
export function getNextTermDescriptor(existingTerms: TermRecord[]): NextTermDescriptor {
  // Scan backwards so custom terms (Transfer Credits, Leave Term, etc.) never break sequencing
  for (let i = existingTerms.length - 1; i >= 0; i--) {
    const candidate = existingTerms[i];
    if (candidate.isCustom) continue;

    const parsed = parseStandardTermDescriptor(candidate.termName);
    const metaStartYear = candidate.academicYear
      ? parseInt(candidate.academicYear.split('-')[0], 10)
      : NaN;
    const metaTermNum =
      candidate.termNumber && candidate.termNumber >= 1 && candidate.termNumber <= 5
        ? (candidate.termNumber as 1 | 2 | 3 | 4 | 5)
        : null;

    if (parsed || (!isNaN(metaStartYear) && metaTermNum)) {
      let nextYear = parsed ? parsed.academicStartYear : metaStartYear;
      let nextTermNum = (parsed ? parsed.termNumber : (metaTermNum as 1 | 2 | 3 | 4 | 5)) + 1;
      if (nextTermNum > 5) {
        nextYear += 1;
        nextTermNum = 1;
      }
      const typedTermNum = nextTermNum as 1 | 2 | 3 | 4 | 5;
      const { academicYear, calendarSpan } = resolveOfficialTermSpan(nextYear, typedTermNum);
      const useAcademicYearStyle = parsed ? parsed.style === 'academic_year' : true;
      const termName = useAcademicYearStyle
        ? `${academicYear} Term ${typedTermNum}`
        : `${nextYear} Term ${typedTermNum}`;

      return {
        termName,
        calendarSpan,
        academicYear,
        termNumber: typedTermNum,
      };
    }
  }

  // No standard terms found: derive directly from live UoPeople Academic Calendar engine
  const live = resolveLiveAcademicContext();
  const baseCycle =
    live.currentTerm || live.upcomingTerm || live.previousTerm || MULTI_YEAR_TERMS[0];
  const startYear = parseInt(baseCycle.academicYear.split('-')[0], 10) || 2026;
  const termNumber = (baseCycle.termNumber >= 1 && baseCycle.termNumber <= 5
    ? baseCycle.termNumber
    : 1) as 1 | 2 | 3 | 4 | 5;
  const { academicYear, calendarSpan } = resolveOfficialTermSpan(startYear, termNumber);

  return {
    termName: `${startYear} Term ${termNumber}`,
    calendarSpan,
    academicYear,
    termNumber,
  };
}

// Auto-generates sequential term names from existing terms
export function getNextTermName(existingTerms: TermRecord[]): string {
  return getNextTermDescriptor(existingTerms).termName;
}

export interface OfficialTermPresetOption {
  id: string;
  termName: string;
  academicYear: string;
  termNumber: 1 | 2 | 3 | 4 | 5;
  calendarSpan: string;
}

export function buildOfficialTermPresets(): OfficialTermPresetOption[] {
  const options: OfficialTermPresetOption[] = [];
  const years = [2024, 2025, 2026, 2027];
  years.forEach((startYear) => {
    ([1, 2, 3, 4, 5] as const).forEach((termNumber) => {
      const { academicYear, calendarSpan } = resolveOfficialTermSpan(startYear, termNumber);
      options.push({
        id: `${academicYear}-T${termNumber}`,
        termName: `${academicYear} Term ${termNumber}`,
        academicYear,
        termNumber,
        calendarSpan,
      });
    });
  });
  return options;
}

export function sortTermsChronologically(terms: TermRecord[]): TermRecord[] {
  return [...terms]
    .map((t, originalIndex) => ({
      term: enrichTermWithCalendarMetadata(t),
      originalIndex,
    }))
    .sort((a, b) => {
      const isTransferA =
        Boolean(a.term.isCustom) && /transfer|tc\b/i.test(a.term.termName);
      const isTransferB =
        Boolean(b.term.isCustom) && /transfer|tc\b/i.test(b.term.termName);
      if (isTransferA !== isTransferB) return isTransferA ? -1 : 1;

      const pa = a.term.isCustom ? null : parseStandardTermDescriptor(a.term.termName);
      const pb = b.term.isCustom ? null : parseStandardTermDescriptor(b.term.termName);

      if (pa && pb) {
        if (pa.academicStartYear !== pb.academicStartYear) {
          return pa.academicStartYear - pb.academicStartYear;
        }
        if (pa.termNumber !== pb.termNumber) {
          return pa.termNumber - pb.termNumber;
        }
      }
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return a.originalIndex - b.originalIndex;
    })
    .map((item) => item.term);
}
