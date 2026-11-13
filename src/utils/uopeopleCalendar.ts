export interface UoPeopleTermCycle {
  termId: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  termNumber: number;            // 1, 2, 3, 4, 5
  termLabel: string;             // "Term 1", "Term 2", etc.
  academicYear: string;          // "2026-2027", "2027-2028", etc.
  termStartDate: string;         // 'YYYY-MM-DD'
  termEndDate: string;           // 'YYYY-MM-DD'
  finalExamStart: string;
  finalExamEnd: string;
  gradesPublishedDate: string;
}

// Multi-Year Baseline Definition (Seamlessly expandable via web scraping cache)
export const MULTI_YEAR_TERMS: UoPeopleTermCycle[] = [
  // --- ACADEMIC YEAR 2026-2027 ---
  {
    termId: 'T1',
    termNumber: 1,
    termLabel: 'Term 1',
    academicYear: '2026-2027',
    termStartDate: '2026-09-03',
    termEndDate: '2026-11-04',
    finalExamStart: '2026-10-29',
    finalExamEnd: '2026-11-01',
    gradesPublishedDate: '2026-11-11'
  },
  {
    termId: 'T2',
    termNumber: 2,
    termLabel: 'Term 2',
    academicYear: '2026-2027',
    termStartDate: '2026-11-12',
    termEndDate: '2027-01-13',
    finalExamStart: '2027-01-07',
    finalExamEnd: '2027-01-10',
    gradesPublishedDate: '2027-01-20'
  },
  {
    termId: 'T3',
    termNumber: 3,
    termLabel: 'Term 3',
    academicYear: '2026-2027',
    termStartDate: '2027-01-28',
    termEndDate: '2027-03-31',
    finalExamStart: '2027-03-25',
    finalExamEnd: '2027-03-28',
    gradesPublishedDate: '2027-04-07'
  },
  {
    termId: 'T4',
    termNumber: 4,
    termLabel: 'Term 4',
    academicYear: '2026-2027',
    termStartDate: '2027-04-08',
    termEndDate: '2027-06-09',
    finalExamStart: '2027-06-03',
    finalExamEnd: '2027-06-06',
    gradesPublishedDate: '2027-06-16'
  },
  {
    termId: 'T5',
    termNumber: 5,
    termLabel: 'Term 5',
    academicYear: '2026-2027',
    termStartDate: '2027-06-17',
    termEndDate: '2027-08-18',
    finalExamStart: '2027-08-12',
    finalExamEnd: '2027-08-15',
    gradesPublishedDate: '2027-08-25'
  },

  // --- ACADEMIC YEAR 2027-2028 (Automated Rollover) ---
  {
    termId: 'T1',
    termNumber: 1,
    termLabel: 'Term 1',
    academicYear: '2027-2028',
    termStartDate: '2027-09-02',
    termEndDate: '2027-11-03',
    finalExamStart: '2027-10-28',
    finalExamEnd: '2027-10-31',
    gradesPublishedDate: '2027-11-10'
  }
];

export interface TermSchedule {
  term: string;
  startDate: string;
  endDate: string;
  breakStartDate?: string;
  breakEndDate?: string;
}

export const DEFAULT_2026_SCHEDULE: TermSchedule[] = MULTI_YEAR_TERMS.map((t, idx, arr) => ({
  term: t.termId,
  startDate: t.termStartDate,
  endDate: t.termEndDate,
  breakStartDate: t.termEndDate,
  breakEndDate: arr[idx + 1] ? arr[idx + 1].termStartDate : '2027-09-02'
}));

export interface LiveAcademicContext {
  isTermBreak: boolean;
  activeBadgeLabel: string;
  currentTerm?: UoPeopleTermCycle;
  upcomingTerm?: UoPeopleTermCycle;
  previousTerm?: UoPeopleTermCycle;
  daysUntilNextTerm?: number;
}

export function resolveLiveAcademicContext(targetIsoDate?: string): LiveAcademicContext {
  const currentIso = targetIsoDate || new Date().toISOString().split('T')[0];

  let allTerms = [...MULTI_YEAR_TERMS];
  allTerms.sort((a, b) => a.termStartDate.localeCompare(b.termStartDate));

  const currentActive = allTerms.find(
    (t) => currentIso >= t.termStartDate && currentIso <= t.termEndDate
  );

  if (currentActive) {
    return {
      isTermBreak: false,
      activeBadgeLabel: `${currentActive.termLabel.toUpperCase()} (${currentActive.academicYear})`,
      currentTerm: currentActive
    };
  }

  let prevTerm: UoPeopleTermCycle | undefined;
  let nextTerm: UoPeopleTermCycle | undefined;

  for (let i = 0; i < allTerms.length; i++) {
    if (currentIso < allTerms[i].termStartDate) {
      nextTerm = allTerms[i];
      prevTerm = allTerms[i - 1];
      break;
    }
  }

  if (!nextTerm && allTerms.length > 0) {
    prevTerm = allTerms[allTerms.length - 1];
  }

  let daysUntilNext = 0;
  if (nextTerm) {
    const diffMs = new Date(nextTerm.termStartDate).getTime() - new Date(currentIso).getTime();
    daysUntilNext = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Check if current date falls within the break window (between prevTerm.termEndDate and nextTerm.termStartDate)
  let isBreak = false;
  if (prevTerm && nextTerm) {
    isBreak = currentIso > prevTerm.termEndDate && currentIso < nextTerm.termStartDate;
  } else {
    isBreak = true;
  }

  const breakBadgeLabel = prevTerm 
    ? `${prevTerm.termLabel.toUpperCase()} BREAK (${prevTerm.academicYear})`
    : 'TERM BREAK';

  return {
    isTermBreak: isBreak,
    activeBadgeLabel: breakBadgeLabel,
    previousTerm: prevTerm,
    upcomingTerm: nextTerm,
    daysUntilNextTerm: daysUntilNext
  };
}

export interface AcademicTerm {
  termNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  examStartDate: string;
  examEndDate: string;
  gradesPublishedDate: string;
  breakStartDate?: string;
  breakEndDate?: string;
  nextTermStartDate?: string;
}

export const UOPEOPLE_TERMS_2026_2027: AcademicTerm[] = MULTI_YEAR_TERMS.filter(t => t.academicYear === '2026-2027').map((t, idx, arr) => ({
  termNumber: t.termNumber,
  name: `${t.termLabel} (${t.academicYear})`,
  startDate: t.termStartDate,
  endDate: t.termEndDate,
  examStartDate: t.finalExamStart,
  examEndDate: t.finalExamEnd,
  gradesPublishedDate: t.gradesPublishedDate,
  breakStartDate: t.termEndDate,
  breakEndDate: arr[idx + 1] ? arr[idx + 1].termStartDate : '2027-09-02',
  nextTermStartDate: arr[idx + 1] ? arr[idx + 1].termStartDate : '2027-09-02'
}));

export interface AcademicStateResult {
  currentState: 'ACTIVE_TERM' | 'TERM_BREAK';
  activeTerm: AcademicTerm;
  nextTerm?: AcademicTerm;
  countdownTarget?: Date;
  daysUntilNextTerm?: number;
}

export function getCurrentAcademicState(serverTime: Date): AcademicStateResult {
  const iso = serverTime.toISOString().split('T')[0];
  const live = resolveLiveAcademicContext(iso);
  const activeTermCycle = live.currentTerm || live.previousTerm || MULTI_YEAR_TERMS[0];

  const matchedTerm: AcademicTerm = {
    termNumber: activeTermCycle.termNumber,
    name: `${activeTermCycle.termLabel} (${activeTermCycle.academicYear})`,
    startDate: activeTermCycle.termStartDate,
    endDate: activeTermCycle.termEndDate,
    examStartDate: activeTermCycle.finalExamStart,
    examEndDate: activeTermCycle.finalExamEnd,
    gradesPublishedDate: activeTermCycle.gradesPublishedDate,
  };

  let nextTermObj: AcademicTerm | undefined;
  if (live.upcomingTerm) {
    nextTermObj = {
      termNumber: live.upcomingTerm.termNumber,
      name: `${live.upcomingTerm.termLabel} (${live.upcomingTerm.academicYear})`,
      startDate: live.upcomingTerm.termStartDate,
      endDate: live.upcomingTerm.termEndDate,
      examStartDate: live.upcomingTerm.finalExamStart,
      examEndDate: live.upcomingTerm.finalExamEnd,
      gradesPublishedDate: live.upcomingTerm.gradesPublishedDate,
    };
  }

  return {
    currentState: live.isTermBreak ? 'TERM_BREAK' : 'ACTIVE_TERM',
    activeTerm: matchedTerm,
    nextTerm: nextTermObj,
    countdownTarget: live.upcomingTerm ? new Date(live.upcomingTerm.termStartDate + 'T00:00:00-05:00') : undefined,
    daysUntilNextTerm: live.daysUntilNextTerm
  };
}

export async function syncUoPeopleCalendar(force: boolean = false): Promise<any[]> {
  return MULTI_YEAR_TERMS;
}

export function getActiveCalendarStatus(): {
  isTermBreak: boolean;
  activeTerm?: string;
  statusLabel: string;
  subText: string;
} {
  const live = resolveLiveAcademicContext();
  return {
    isTermBreak: live.isTermBreak,
    activeTerm: live.currentTerm?.termId,
    statusLabel: live.activeBadgeLabel,
    subText: live.isTermBreak ? 'လက်ရှိတွင် Term Break အားလပ်ရက် ဖြစ်ပါသည်' : 'Active Term စာသင်ချိန်'
  };
}

export function isCurrentlyTermBreak(testDate?: Date): boolean {
  const iso = testDate ? testDate.toISOString().split('T')[0] : undefined;
  return resolveLiveAcademicContext(iso).isTermBreak;
}

export function getCurrentTermContext(testDate?: Date): { isBreak: boolean; label: string } {
  const live = resolveLiveAcademicContext(testDate ? testDate.toISOString().split('T')[0] : undefined);
  return {
    isBreak: live.isTermBreak,
    label: live.isTermBreak ? '🌴 Term Break (ကျောင်းပိတ်ရက်ကာလ)' : '📚 Active Term (စာသင်ချိန်)'
  };
}
