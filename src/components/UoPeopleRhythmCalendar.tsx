import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  resolveLiveAcademicContext,
  getCurrentAcademicState,
  getRegistrationPeriodContext,
  UOPEOPLE_TERMS_2026_2027,
  AcademicTerm,
} from '../utils/uopeopleCalendar';
import { downloadTermIcs, getGoogleCalendarWebUrl } from '../utils/icsGenerator';
import {
  confirmDeadlineSubmission,
  confirmRegistrationAcknowledgment,
  getAssignmentSubmittedKey,
  getNextActivityDeadline,
  getNextDiscussionDeadline,
  isRegistrationAcknowledged,
  isWeekAssignmentSubmitted,
  maybeDispatchAssignmentBrowserNotification,
  maybeDispatchRegistrationBrowserNotification,
  REGISTRATION_CLARIFICATION_NOTICE_MY,
  requestDeadlineNotificationPermission,
  THURSDAY_EXTENSION_NOTICE_MY,
  UOPEOPLE_REG_ACK_UPDATED_EVENT,
  UOPEOPLE_SUBMISSION_UPDATED_EVENT,
} from '../utils/uopeopleTime';
import { AcademicCalendarHeader } from './AcademicCalendarHeader';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  Calendar,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Flame,
  Download,
  BookOpen,
  Award,
  Palmtree,
  CheckSquare,
  Bell,
  X,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';

interface DaySchedule {
  dayName: string;
  burmeseDay: string;
  uopeopleDayIndex: number;
  phaseTitle: string;
  phaseBurmese: string;
  color: string;
  deadlineWarning?: string;
  deadlineGmt5Time?: string;
  tasks: {
    id: string;
    text: string;
    burmeseText: string;
    recommendedHours: number;
    category: 'reading' | 'discussion' | 'peer' | 'assignment' | 'quiz';
  }[];
}

const UOPEOPLE_SCHEDULE: DaySchedule[] = [
  {
    dayName: 'Thursday',
    burmeseDay: 'ကြာသပတေးနေ့ (Term / Unit စတင်ရက်)',
    uopeopleDayIndex: 0,
    phaseTitle: 'Unit Kickoff & Reading Assignment',
    phaseBurmese: 'ယူနစ်စတင်ခြင်းနှင့် သင်ခန်းစာဖတ်ရှုခြင်း',
    color: 'from-blue-600/20 border-blue-500/40 text-blue-300',
    tasks: [
      {
        id: 'thu-1',
        text: 'Download & read Unit Syllabus and Learning Guide',
        burmeseText: 'Unit သင်ရိုးညွှန်းတမ်းနှင့် လမ်းညွှန်းချက် (Learning Guide) ဖတ်ရှုခြင်း',
        recommendedHours: 1.0,
        category: 'reading',
      },
      {
        id: 'thu-2',
        text: 'Review Discussion Forum Prompt & Rubric criteria',
        burmeseText: 'Discussion Forum မေးခွန်းနှင့် အမှတ်ပေးစည်းမျဉ်း (Rubric) ကို သေချာစစ်ဆေးခြင်း',
        recommendedHours: 0.5,
        category: 'discussion',
      },
      {
        id: 'thu-3',
        text: 'Begin Reading Assignment chapters (Textbook / Articles)',
        burmeseText: 'ဖတ်ကြားရမည့် သင်ခန်းစာ အခန်းများကို စတင်ဖတ်ရှုခြင်း',
        recommendedHours: 2.5,
        category: 'reading',
      },
    ],
  },
  {
    dayName: 'Friday',
    burmeseDay: 'သောကြာနေ့ (Deep Reading & Note Taking)',
    uopeopleDayIndex: 1,
    phaseTitle: 'Concept Mastery & Initial Post Brainstorming',
    phaseBurmese: 'သဘောတရားများ ပိုင်နိုင်စွာ နားလည်စေခြင်းနှင့် မူကြမ်းရေးဆွဲခြင်း',
    color: 'from-indigo-600/20 border-indigo-500/40 text-indigo-300',
    tasks: [
      {
        id: 'fri-1',
        text: 'Finish assigned textbook chapters and external readings',
        burmeseText: 'ကျန်ရှိသော စာဖတ်ရန် အပိုင်းများနှင့် သုတေသနစာတမ်းများကို ဖတ်ရှုပြီးစီးအောင် လုပ်ဆောင်ခြင်း',
        recommendedHours: 2.5,
        category: 'reading',
      },
      {
        id: 'fri-2',
        text: 'Formulate a defensible thesis for the Discussion Forum',
        burmeseText: 'Discussion Forum အတွက် မိမိ၏ ခိုင်မာသော အယူအဆ (Thesis) ကို စတင် ရေးဖွဲ့ခြင်း',
        recommendedHours: 1.0,
        category: 'discussion',
      },
      {
        id: 'fri-3',
        text: 'Extract key vocabulary and technical concepts into Flashcards',
        burmeseText: 'အဓိက Technical ဝေါဟာရများကို Flashcards ထဲသို့ မှတ်သားထည့်သွင်းခြင်း',
        recommendedHours: 1.0,
        category: 'reading',
      },
    ],
  },
  {
    dayName: 'Saturday',
    burmeseDay: 'စနေနေ့ (Discussion Post Drafting & Polishing)',
    uopeopleDayIndex: 2,
    phaseTitle: 'Discussion Initial Post Drafting (APA 7th Citations)',
    phaseBurmese: 'Discussion မူရင်းအဖြေ ရေးသားခြင်းနှင့် APA 7th ကိုးကားချက်များ ထည့်သွင်းခြင်း',
    color: 'from-violet-600/20 border-violet-500/40 text-violet-300',
    tasks: [
      {
        id: 'sat-1',
        text: 'Draft Discussion Initial Post (300-500 words, 2-3 body paragraphs)',
        burmeseText: 'Discussion Forum အဖြေမူကြမ်း (စာလုံးရေ ၃၀၀-၅၀၀) ရေးသားခြင်း',
        recommendedHours: 2.0,
        category: 'discussion',
      },
      {
        id: 'sat-2',
        text: 'Verify APA 7th in-text citations & references with DOI lookup',
        burmeseText: 'APA 7th စံနှုန်းနှင့်အညီ In-Text Citations နှင့် References များ ပြည့်စုံမှု စစ်ဆေးခြင်း',
        recommendedHours: 0.5,
        category: 'discussion',
      },
      {
        id: 'sat-3',
        text: 'Review against Socratic dialogue & Rubric criteria',
        burmeseText: 'Rubric Criteria နှင့်အညီ အမှတ်ပြည့်ရနိုင်မည့် အချက်များ ပါမပါ ပြန်လည်စစ်ဆေးခြင်း',
        recommendedHours: 1.0,
        category: 'discussion',
      },
    ],
  },
  {
    dayName: 'Sunday',
    burmeseDay: 'တနင်္ဂနွေနေ့ (Discussion Forum Deadline ရက်)',
    uopeopleDayIndex: 3,
    phaseTitle: '🚨 Discussion Initial Post Deadline (11:55 PM / 23:55 GMT-5)',
    phaseBurmese: 'Discussion ပထမဆုံး အဖြေ တင်သွင်းရန် နောက်ဆုံးအချိန်',
    color: 'from-amber-600/25 border-amber-500/50 text-amber-300',
    deadlineWarning: 'Discussion Forum Initial Post Deadline at 11:55 PM (23:55 GMT-5)',
    deadlineGmt5Time: '11:55 PM (23:55 GMT-5)',
    tasks: [
      {
        id: 'sun-1',
        text: 'Submit Discussion Forum Initial Post before 11:55 PM (23:55 GMT-5)',
        burmeseText: 'Discussion Forum အဖြေအား နောက်ဆုံးသတ်မှတ်ချိန် 11:55 PM (23:55 GMT-5) မတိုင်မီ တင်သွင်းခြင်း',
        recommendedHours: 0.5,
        category: 'discussion',
      },
      {
        id: 'sun-2',
        text: 'Review Assignment Activity prompt & rubric requirements',
        burmeseText: 'Assignment Activity အတွက် မေးခွန်းနှင့် Rubric များကို ကြိုတင်လေ့လာခြင်း',
        recommendedHours: 1.5,
        category: 'assignment',
      },
      {
        id: 'sun-3',
        text: 'Take Untimed Self-Quiz (Attempt 1) to test comprehension',
        burmeseText: 'နားလည်သဘောပေါက်မှုကို စစ်ဆေးရန် Self-Quiz (ပထမအကြိမ်) ဖြေဆိုခြင်း',
        recommendedHours: 1.0,
        category: 'quiz',
      },
    ],
  },
  {
    dayName: 'Monday',
    burmeseDay: 'တနင်္လာနေ့ (Peer Assessment စတင်ချိန်)',
    uopeopleDayIndex: 4,
    phaseTitle: 'Peer Assessments & Assignment Activity Development',
    phaseBurmese: 'အတန်းဖော်များကို အမှတ်ပေးခြင်းနှင့် Assignment Activity ရေးသားခြင်း',
    color: 'from-cyan-600/20 border-cyan-500/40 text-cyan-300',
    tasks: [
      {
        id: 'mon-1',
        text: 'Assess & evaluate 3 peers in the Discussion Forum with constructive feedback',
        burmeseText: 'Discussion Forum တွင် အတန်းဖော် ၃ ဦး၏ စာများကို အပြုသဘော အကဲဖြတ် အမှတ်ပေးခြင်း',
        recommendedHours: 2.0,
        category: 'peer',
      },
      {
        id: 'mon-2',
        text: 'Draft Outline for Assignment Activity (Intro, Body Claims, Counter-arguments)',
        burmeseText: 'Assignment Activity အတွက် Outline နှင့် စာပိုဒ်အလိုက် မူကြမ်း စတင်ရေးသားခြင်း',
        recommendedHours: 2.0,
        category: 'assignment',
      },
    ],
  },
  {
    dayName: 'Tuesday',
    burmeseDay: 'အင်္ဂါနေ့ (Assignment Activity & Final Drafts)',
    uopeopleDayIndex: 5,
    phaseTitle: 'Assignment Activity Refinement & Peer Rating Verification',
    phaseBurmese: 'စာမူကြမ်းများ အချောသပ်ပြင်ဆင်ခြင်းနှင့် Peer Assessment စစ်ဆေးခြင်း',
    color: 'from-emerald-600/20 border-emerald-500/40 text-emerald-300',
    tasks: [
      {
        id: 'tue-1',
        text: 'Finalize Assignment Activity with 0% AI Humanizer & Turnitin Check',
        burmeseText: 'Assignment Activity ကို သဘာဝကျသော လူသားရေးဟန် 0% AI ဖြင့် အချောသပ် ပြင်ဆင်ခြင်း',
        recommendedHours: 2.0,
        category: 'assignment',
      },
      {
        id: 'tue-2',
        text: 'Review APA 7th formatting, citations, and rubric alignment',
        burmeseText: 'APA 7th စံနှုန်း၊ ကိုးကားချက်များနှင့် Rubric ကိုက်ညီမှု အပြီးသတ်စစ်ဆေးခြင်း',
        recommendedHours: 1.5,
        category: 'assignment',
      },
      {
        id: 'tue-3',
        text: 'Verify all 3 Discussion Peer Ratings are submitted and saved',
        burmeseText: 'Discussion Peer Assessment ၃ ခုစလုံး ပြီးစီးစွာ တင်သွင်းပြီးပြီလား စစ်ဆေးခြင်း',
        recommendedHours: 0.5,
        category: 'peer',
      },
    ],
  },
  {
    dayName: 'Wednesday',
    burmeseDay: 'ဗုဒ္ဓဟူးနေ့ (နောက်ဆုံး သတ်မှတ်ရက် Final Deadline)',
    uopeopleDayIndex: 6,
    phaseTitle: '🚨 FINAL SUBMISSION DEADLINE (11:55 PM / 23:55 GMT-5)',
    phaseBurmese: 'ရက်သတ္တပတ် ပြီးဆုံးခြင်းနှင့် နောက်ဆုံး တင်သွင်းရမည့် အချိန်',
    color: 'from-rose-600/30 border-rose-500/60 text-rose-300',
    deadlineWarning: 'CRITICAL DEADLINE: All Assignments & Quizzes due at 11:55 PM (23:55 GMT-5)',
    deadlineGmt5Time: '11:55 PM (23:55 GMT-5)',
    tasks: [
      {
        id: 'wed-1',
        text: 'Submit Assignment Activity in Word (.docx) / PDF format before 11:55 PM (23:55 GMT-5)',
        burmeseText: 'Assignment Activity ဖိုင်အား 11:55 PM (23:55 GMT-5) မတိုင်မီ တင်သွင်းခြင်း',
        recommendedHours: 0.5,
        category: 'assignment',
      },
      {
        id: 'wed-2',
        text: 'Verify all Discussion Peer Replies and Assessments before 11:55 PM (23:55 GMT-5)',
        burmeseText: 'Discussion Peer Replies နှင့် Assessments အားလုံး 11:55 PM (23:55 GMT-5) မတိုင်မီ စစ်ဆေးတင်သွင်းခြင်း',
        recommendedHours: 0.5,
        category: 'peer',
      },
      {
        id: 'wed-3',
        text: 'Complete Graded Quiz / Final Self-Quiz review',
        burmeseText: 'Graded Quiz သို့မဟုတ် အမှတ်ပေး စာမေးပွဲ ဖြေဆိုပြီးစီးခြင်း',
        recommendedHours: 1.0,
        category: 'quiz',
      },
      {
        id: 'wed-4',
        text: 'Double check Moodle Gradebook to confirm all unit tasks show submitted',
        burmeseText: 'Moodle Portal တွင် အရာအားလုံး အောင်မြင်စွာ တင်သွင်းပြီးကြောင်း အတည်ပြုခြင်း',
        recommendedHours: 0.5,
        category: 'reading',
      },
    ],
  },
];

export const UoPeopleRhythmCalendar: React.FC = () => {
  const { language } = useApp();

  // Live clocks state
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const academicContext = useMemo(() => {
    const iso = now.toISOString().split('T')[0];
    return resolveLiveAcademicContext(iso);
  }, [now]);

  const academicState = useMemo(() => {
    return getCurrentAcademicState(now);
  }, [now]);

  const registrationContext = useMemo(() => {
    return getRegistrationPeriodContext(now);
  }, [now]);

  // Selected Unit (1 to 9)
  const [currentUnit, setCurrentUnit] = usePersistentState<number>(
    'uopeople_current_unit',
    1
  );

  const [showBreakPreview, setShowBreakPreview] = useState(false);
  const [showIcsModal, setShowIcsModal] = useState(false);
  const [isConfirmingAssignment, setIsConfirmingAssignment] = useState(false);
  const [isConfirmingRegistration, setIsConfirmingRegistration] = useState(false);
  const [selectedExportTerm, setSelectedExportTerm] = useState<AcademicTerm>(
    academicState.activeTerm
  );

  const [notificationPermission, setNotificationPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // Track whether current unit's Assignment Activity is marked as submitted (`akari_submitted_unit_[X]`)
  const [isCurrentUnitSubmitted, setIsCurrentUnitSubmitted] = useState<boolean>(() =>
    isWeekAssignmentSubmitted(currentUnit)
  );

  // Track whether registration period is acknowledged for target term
  const [isRegAcked, setIsRegAcked] = useState<boolean>(() =>
    isRegistrationAcknowledged(registrationContext.targetTermKey)
  );

  useEffect(() => {
    setIsConfirmingAssignment(false);
    const syncSubmittedFlag = () => {
      setIsCurrentUnitSubmitted(isWeekAssignmentSubmitted(currentUnit));
    };
    syncSubmittedFlag();
    window.addEventListener(UOPEOPLE_SUBMISSION_UPDATED_EVENT, syncSubmittedFlag);
    window.addEventListener('storage', syncSubmittedFlag);
    window.addEventListener('akari_emergency_wipe', syncSubmittedFlag);
    return () => {
      window.removeEventListener(UOPEOPLE_SUBMISSION_UPDATED_EVENT, syncSubmittedFlag);
      window.removeEventListener('storage', syncSubmittedFlag);
      window.removeEventListener('akari_emergency_wipe', syncSubmittedFlag);
    };
  }, [currentUnit]);

  useEffect(() => {
    const syncRegFlag = () => {
      setIsRegAcked(isRegistrationAcknowledged(registrationContext.targetTermKey));
    };
    syncRegFlag();
    window.addEventListener(UOPEOPLE_REG_ACK_UPDATED_EVENT, syncRegFlag);
    window.addEventListener('storage', syncRegFlag);
    window.addEventListener('akari_emergency_wipe', syncRegFlag);
    return () => {
      window.removeEventListener(UOPEOPLE_REG_ACK_UPDATED_EVENT, syncRegFlag);
      window.removeEventListener('storage', syncRegFlag);
      window.removeEventListener('akari_emergency_wipe', syncRegFlag);
    };
  }, [registrationContext.targetTermKey]);

  // Sync selected export term when academicState changes
  useEffect(() => {
    if (academicState.activeTerm) {
      setSelectedExportTerm(academicState.activeTerm);
    }
  }, [academicState.activeTerm]);

  // Track checked tasks with universal persistence under akari_academic_tasks_v1
  const [completedTasks, setCompletedTasks] = usePersistentState<Record<string, boolean>>(
    'akari_academic_tasks_v1',
    {},
    'uopeople_completed_tasks_v1'
  );

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const localTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  // VPN-independent pure UTC-5 wall clock
  const uopeopleWallClock = useMemo(() => {
    const shifted = new Date(now.getTime() - 5 * 3600000);
    return {
      dayOfWeek: shifted.getUTCDay(), // 0=Sun..6=Sat
      timeLabel: now.toLocaleTimeString('en-US', {
        timeZone: 'Etc/GMT+5',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      dateLabel: now.toLocaleDateString('en-US', {
        timeZone: 'Etc/GMT+5',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  }, [now]);

  const timezoneOffsetHours = useMemo(() => {
    const localUtcOffsetHours = -now.getTimezoneOffset() / 60;
    const uopeopleUtcOffsetHours = -5;
    return localUtcOffsetHours - uopeopleUtcOffsetHours;
  }, [now]);

  const uopeopleAcademicDayIndex = useMemo(() => {
    const map = [3, 4, 5, 6, 0, 1, 2];
    return map[uopeopleWallClock.dayOfWeek];
  }, [uopeopleWallClock.dayOfWeek]);

  // Pure UTC-anchored deadline timestamps (11:55 PM / 23:55 GMT-5)
  const nextWedDeadline = useMemo(() => getNextActivityDeadline(now), [now]);
  const nextSunDeadline = useMemo(() => getNextDiscussionDeadline(now), [now]);

  // Countdown to Wednesday 11:55 PM (23:55 GMT-5)
  const countdownToWednesday = useMemo(() => {
    const diffMs = nextWedDeadline.getTime() - now.getTime();
    if (diffMs <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, totalHours: 0 };
    }
    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalHours = diffMs / (1000 * 60 * 60);
    return { days, hours, minutes, seconds, totalMs: diffMs, totalHours };
  }, [nextWedDeadline, now]);

  // Trigger native OS notifications at 24h / 12h for Assignment Activity & Registration Period
  useEffect(() => {
    if (!academicContext.isTermBreak && !isCurrentUnitSubmitted) {
      if (countdownToWednesday.totalMs > 0 && countdownToWednesday.totalMs <= 24 * 3600000) {
        maybeDispatchAssignmentBrowserNotification(currentUnit, countdownToWednesday.totalMs);
      }
    }
    if (!isRegAcked) {
      maybeDispatchRegistrationBrowserNotification(registrationContext);
    }
  }, [
    academicContext.isTermBreak,
    countdownToWednesday.totalMs,
    currentUnit,
    isCurrentUnitSubmitted,
    isRegAcked,
    registrationContext,
  ]);

  const termBreakCountdown = useMemo(() => {
    if (!academicState.countdownTarget) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diffMs = academicState.countdownTarget.getTime() - now.getTime();
    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return { days, hours, minutes, seconds };
  }, [academicState.countdownTarget, now]);

  // Convert 11:55 PM (23:55 GMT-5) strictly into user's device local timezone
  const convertedDeadlines = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });

    return {
      wednesdayLocal: formatter.format(nextWedDeadline),
      sundayLocal: formatter.format(nextSunDeadline),
    };
  }, [nextWedDeadline, nextSunDeadline]);

  const completionStats = useMemo(() => {
    const total = UOPEOPLE_SCHEDULE.reduce((sum, d) => sum + d.tasks.length, 0);
    const completed = UOPEOPLE_SCHEDULE.reduce((sum, d) => {
      return sum + d.tasks.filter((t) => completedTasks[`u${currentUnit}-${t.id}`]).length;
    }, 0);
    return {
      completed,
      total,
      percentage: Math.round((completed / Math.max(1, total)) * 100),
    };
  }, [completedTasks, currentUnit]);

  const isTermBreak = academicContext.isTermBreak;

  // Determine active 24h / 12h notification banner message when unsubmitted
  const activeDeadlineThresholdBanner = useMemo(() => {
    if (isCurrentUnitSubmitted) return null;
    if (countdownToWednesday.totalMs <= 0) return null;
    if (countdownToWednesday.totalHours <= 12) {
      return {
        level: '12h' as const,
        message:
          '🚨 သတိပြုရန်: Assignment Activity Deadline နီးကပ်နေပါပြီ (၁၂ နာရီသာ လိုပါတော့သည်)',
      };
    }
    if (countdownToWednesday.totalHours <= 24) {
      return {
        level: '24h' as const,
        message: '⏰ Assignment Activity တင်ရန် ၂၄ နာရီသာ လိုပါတော့သည်',
      };
    }
    return null;
  }, [countdownToWednesday.totalHours, countdownToWednesday.totalMs, isCurrentUnitSubmitted]);

  // Registration alert message (24h, 12h, or Open Day)
  const activeRegistrationBannerAlert = useMemo(() => {
    if (isRegAcked) return null;
    if (registrationContext.isOpenNow) {
      return {
        phase: 'open' as const,
        message:
          '📢 Course Registration စတင်ဖွင့်လှစ်ပါပြီ။ Portal တွင် ဘာသာရပ်များ စာရင်းသွင်းနိုင်ပါပြီ။',
      };
    }
    if (
      registrationContext.isUpcoming &&
      registrationContext.remainingMs > 0 &&
      registrationContext.remainingMs <= 12 * 3600000
    ) {
      return {
        phase: '12h' as const,
        message: '🚨 သတိပြုရန်: Course Registration ဖွင့်ရန် ၁၂ နာရီသာ လိုပါတော့သည်။',
      };
    }
    if (
      registrationContext.isUpcoming &&
      registrationContext.remainingMs > 12 * 3600000 &&
      registrationContext.remainingMs <= 24 * 3600000
    ) {
      return {
        phase: '24h' as const,
        message:
          '⏰ Course Registration ဖွင့်ရန် ၂၄ နာရီသာ လိုပါတော့သည်။ Portal တွင် မိမိ စတင်ချိန်ကို စစ်ဆေးထားပါ။',
      };
    }
    return null;
  }, [isRegAcked, registrationContext]);

  const handleEnableOsNotifications = async () => {
    const perm = await requestDeadlineNotificationPermission();
    setNotificationPermission(perm);
  };

  // Inline 2-Step Mark as Submitted Handler
  const handleAssignmentActionClick = () => {
    void handleEnableOsNotifications();
    if (!isConfirmingAssignment) {
      setIsConfirmingAssignment(true);
      return;
    }
    const storageKey = getAssignmentSubmittedKey(currentUnit);
    confirmDeadlineSubmission(storageKey, currentUnit);
    setIsCurrentUnitSubmitted(true);
    setIsConfirmingAssignment(false);
  };

  // Inline 2-Step Registration Acknowledgment Handler
  const handleRegistrationAckClick = () => {
    void handleEnableOsNotifications();
    if (!isConfirmingRegistration) {
      setIsConfirmingRegistration(true);
      return;
    }
    confirmRegistrationAcknowledgment(registrationContext.targetTermKey);
    setIsRegAcked(true);
    setIsConfirmingRegistration(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <AcademicCalendarHeader
        selectedUnit={`Unit ${currentUnit}${currentUnit === 9 ? ' (Final Exam)' : ''}`}
        onUnitChange={(unitStr) => {
          const match = unitStr.match(/\d+/);
          if (match) {
            setCurrentUnit(parseInt(match[0], 10));
          }
        }}
        onExportIcs={() => {
          void handleEnableOsNotifications();
          setShowIcsModal(true);
        }}
        termStartDate="2026-11-12"
      />

      {isTermBreak && (
        <div className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm">
          <Palmtree className="w-4 h-4 text-amber-400 animate-bounce" />
          <span>
            🏝️ TERM BREAK (ကျောင်းပိတ်ရက်ကာလ) — နောက်လာမည့် Term အတွက် အနားယူပြင်ဆင်နိုင်ပါသည်
          </span>
        </div>
      )}

      {/* TOP ASSIGNMENT ACTIVITY DEADLINE BANNER (11:55 PM / 23:55 GMT-5 + Inline 2-Step Mark as Submitted) */}
      <div
        className={`p-5 rounded-2xl border shadow-xl transition-all duration-300 ${
          isCurrentUnitSubmitted
            ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/40 border-emerald-500/50 shadow-emerald-500/10'
            : activeDeadlineThresholdBanner?.level === '12h'
            ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 border-rose-500/60 shadow-rose-500/15'
            : activeDeadlineThresholdBanner?.level === '24h'
            ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 border-amber-500/60 shadow-amber-500/15'
            : 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-500/40'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isCurrentUnitSubmitted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {isCurrentUnitSubmitted
                  ? '✅ တင်သွင်းပြီးပါပြီ'
                  : `Unit ${currentUnit} Assignment Activity Deadline`}
              </span>
              <span className="text-xs font-mono font-bold text-indigo-300 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Wednesday 11:55 PM (23:55 GMT-5)
              </span>
              <span className="text-xs font-mono text-emerald-300 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Local ({localTimezone}): {convertedDeadlines.wednesdayLocal}
              </span>
              {notificationPermission === 'default' && (
                <button
                  type="button"
                  onClick={() => void handleEnableOsNotifications()}
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-400/40 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Enable OS Push Alerts</span>
                </button>
              )}
            </div>

            {/* Active 24h / 12h Alert Notice if within 24h/12h and unsubmitted */}
            {!isCurrentUnitSubmitted && activeDeadlineThresholdBanner && (
              <div
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
                  activeDeadlineThresholdBanner.level === '12h'
                    ? 'bg-rose-950/80 border-rose-500/50 text-rose-200 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                }`}
              >
                <span>{activeDeadlineThresholdBanner.message}</span>
              </div>
            )}

            {/* Sub-notice inside the Assignment Deadline Card */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs text-amber-200/95 leading-relaxed">
              {THURSDAY_EXTENSION_NOTICE_MY}
            </div>
          </div>

          {/* Right Side: Live Countdown & Inline 2-Step Mark as Submitted Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0">
            {!isCurrentUnitSubmitted && (
              <div className="flex items-center space-x-1.5 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
                <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
                <span className="text-slate-400">Countdown:</span>
                <span className="font-extrabold text-white">
                  {countdownToWednesday.days}d {countdownToWednesday.hours}h{' '}
                  {countdownToWednesday.minutes}m {countdownToWednesday.seconds}s
                </span>
              </div>
            )}

            {isCurrentUnitSubmitted ? (
              <div className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>✅ တင်သွင်းပြီးပါပြီ (Unit {currentUnit})</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAssignmentActionClick}
                className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg transition-all cursor-pointer ${
                  isConfirmingAssignment
                    ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 shadow-rose-600/30 ring-2 ring-amber-400/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isConfirmingAssignment
                    ? 'သေချာပါသလား? အတည်ပြုမည်'
                    : 'စာတင်ပြီးပါပြီ (Mark as Submitted)'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* COURSE REGISTRATION PERIOD COUNTDOWN, CLARIFICATION & 2-STEP ACKNOWLEDGMENT BANNER */}
      {!isRegAcked && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950/35 to-slate-900 border border-blue-500/35 shadow-lg space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  📋 {registrationContext.targetTermName} Registration
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {activeRegistrationBannerAlert
                    ? activeRegistrationBannerAlert.message
                    : `⏳ Course Registration ဖွင့်ရန် ${registrationContext.remainingDays} ရက် ${registrationContext.remainingHours} နာရီ ကျန်ရှိပါသည်`}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                ℹ️ Course Registration ကာလ စတင်ချိန်သည် ကျောင်းသားတစ်ယောက်ချင်းစီအလိုက် ကွဲပြားနိုင်သဖြင့် မိမိ၏ သတ်မှတ်ချိန် အတိအကျကို{' '}
                <a
                  href="https://portal.uopeople.edu/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 underline hover:text-indigo-200 font-semibold"
                >
                  Student Portal (https://portal.uopeople.edu/login)
                </a>{' '}
                တွင် ဝင်ရောက်စစ်ဆေးပါ။
              </p>
            </div>

            <div className="shrink-0 flex items-center">
              <button
                type="button"
                onClick={handleRegistrationAckClick}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${
                  isConfirmingRegistration
                    ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-rose-600/30 ring-2 ring-amber-400/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isConfirmingRegistration
                    ? 'အတည်ပြုပါသလား?'
                    : 'သိပြီးပါပြီ / စာရင်းသွင်းပြီးပါပြီ'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual Timezone Clocks & Live Countdown / Term Break Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Clock 1: Official UoPeople GMT-5 Time */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              <span>UoPeople Official Time (GMT-5)</span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-white">
              {uopeopleWallClock.timeLabel}
            </div>
            <div className="text-[11px] text-slate-400">{uopeopleWallClock.dateLabel}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold font-mono">
              EST Equivalent
            </span>
          </div>
        </div>

        {/* Clock 2: Student's Local Browser Timezone */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {language === 'my' ? 'သင်၏ လက်ရှိဒေသ စံတော်ချိန်' : 'Your Local Timezone (Auto)'}
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-emerald-300">
              {now.toLocaleTimeString(undefined, { hour12: true })}
            </div>
            <div className="text-[11px] text-slate-400">
              {now.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              ({localTimezone.split('/').pop()?.replace('_', ' ')})
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold font-mono">
              {timezoneOffsetHours >= 0
                ? `+${timezoneOffsetHours}h ahead`
                : `${timezoneOffsetHours}h behind`}
            </span>
          </div>
        </div>

        {/* Conditional Card: Term Break Countdown OR Active Wednesday 11:55 PM Countdown */}
        {isTermBreak ? (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-amber-950/50 border border-amber-500/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Palmtree className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>နောက် Term စတင်ရန် ကျန်ရှိချိန် (Countdown)</span>
              </span>
              <span className="text-[10px] text-amber-300 font-mono font-bold">
                {academicState.nextTerm?.name}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center my-1.5">
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-white">
                  {termBreakCountdown.days}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Days</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-white">
                  {termBreakCountdown.hours}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Hours</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-white">
                  {termBreakCountdown.minutes}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Mins</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-amber-400">
                  {termBreakCountdown.seconds}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Secs</div>
              </div>
            </div>

            <div className="text-[10px] text-amber-200/90 truncate">
              {language === 'my' ? 'စတင်မည့်ရက်:' : 'Next Term Starts:'}{' '}
              <strong>{academicState.nextTerm?.startDate}</strong>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-rose-950/40 border border-rose-500/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>
                  {language === 'my'
                    ? 'နောက်ဆုံး သတ်မှတ်ချိန်အထိ အချိန်ကျန်'
                    : 'Wednesday Submission Countdown'}
                </span>
              </span>
              <span className="text-[10px] text-slate-300 font-mono">11:55 PM (23:55 GMT-5)</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center my-1.5">
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-white">
                  {countdownToWednesday.days}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Days</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-white">
                  {countdownToWednesday.hours}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Hours</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-white">
                  {countdownToWednesday.minutes}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Mins</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-rose-400">
                  {countdownToWednesday.seconds}
                </div>
                <div className="text-[9px] text-slate-400 uppercase">Secs</div>
              </div>
            </div>

            <div className="text-[10px] text-rose-200/80 truncate">
              {language === 'my' ? 'သင်၏ဒေသအချိန်:' : 'Your local deadline:'}{' '}
              <strong>{convertedDeadlines.wednesdayLocal}</strong>
            </div>
          </div>
        )}
      </div>

      {/* TERM BREAK DEDICATED UI & ADVISORY BANNER */}
      {isTermBreak && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 space-y-4 shadow-2xl animate-in fade-in">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Palmtree className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>🏝️ UoPeople Term Break Productivity &amp; Rest Advisory</span>
              </h2>
              <p className="text-xs text-amber-200/90">
                {language === 'my'
                  ? `လက်ရှိတွင် ${academicState.activeTerm.name} ပြီးဆုံးပြီး အားလပ်ရက် (Term Break) ဖြစ်ပါသည်။ ကျောင်းသားများအတွက် အောက်ပါအချက်များကို အထူးဂရုပြုပါရန်။`
                  : `You are currently between terms. Review the checklist below to prepare for the upcoming semester.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-amber-300 flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>1. Grade စောင့်ကြည့်ရန်</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Portal တွင် ပြီးခဲ့သော Term ၏ Final Grades များကို{' '}
                <strong>{academicState.activeTerm.gradesPublishedDate}</strong> ရက်နေ့ နောက်ဆုံးထား၍ ထုတ်ပြန်ပေးပါမည်။ စာရင်းဇယားများကို စစ်ဆေးပါ။
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-indigo-300 flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>2. Course Materials ပြင်ဆင်ရန်</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                လာမည့် Term သစ်အတွက် Moodle Course များကို မဖွင့်မီ စိတ်အပန်းဖြေပါ (သို့မဟုတ်) အင်္ဂလိပ်စာနှင့် Programming အခြေခံများကို ကြိုတင်လေ့လာထားပါ။
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>3. Late Registration သတိပေးချက်</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                အကယ်၍ လာမည့် Term အတွက် Course Registration မလုပ်ရသေးပါက Program Advisor သို့ အမြန်ဆုံး ဆက်သွယ်ပါ။
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {language === 'my'
                ? 'ကျောင်းပိတ်ရက်ဖြစ်သော်လည်း လေ့လာမှု အချိန်ဇယားကို ကြည့်လိုပါက အောက်ပါခလုတ်ကို နှိပ်ပါ -'
                : 'Want to preview upcoming study rhythms during break?'}
            </span>
            <button
              type="button"
              onClick={() => setShowBreakPreview(!showBreakPreview)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs border border-indigo-500/30 transition-all cursor-pointer"
            >
              {showBreakPreview ? 'Hide Schedule Preview' : '👀 Preview Unit 1 Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Deadlines Quick Reference Card & 7-Day Rhythm Cards */}
      {(!isTermBreak || showBreakPreview) && (
        <>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-slate-300">
                <strong className="text-white">UoPeople Two Golden Deadlines:</strong>
                <span className="ml-2 text-slate-400">
                  (1) Discussion Post due{' '}
                  <strong>Sunday 11:55 PM (23:55 GMT-5)</strong> (
                  {convertedDeadlines.sundayLocal}) · (2) Final Assignments due{' '}
                  <strong>Wednesday 11:55 PM (23:55 GMT-5)</strong> (
                  {convertedDeadlines.wednesdayLocal}).
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <div className="w-32 bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionStats.percentage}%` }}
                />
              </div>
              <span className="font-mono font-bold text-white text-xs">
                {completionStats.percentage}% done
              </span>
            </div>
          </div>

          {/* 7-Day Rhythm Day-by-Day Cards */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <span>
                {language === 'my'
                  ? 'အပတ်စဉ် နေ့အလိုက် လေ့လာမှု အချိန်ဇယား'
                  : 'Daily Study Timetable (Thursday to Wednesday)'}
              </span>
              <span className="text-slate-500 font-normal">· Unit {currentUnit}</span>
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {UOPEOPLE_SCHEDULE.map((day) => {
                const isToday = !isTermBreak && uopeopleAcademicDayIndex === day.uopeopleDayIndex;
                const dayTasks = day.tasks;
                const completedCount = dayTasks.filter(
                  (t) => completedTasks[`u${currentUnit}-${t.id}`]
                ).length;
                const allDayCompleted = completedCount === dayTasks.length && dayTasks.length > 0;

                return (
                  <div
                    key={day.dayName}
                    className={`p-5 rounded-2xl border transition-all ${
                      isToday
                        ? 'bg-slate-900/90 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                        : allDayCompleted
                        ? 'bg-slate-900/40 border-emerald-500/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2 mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`px-3 py-1 rounded-xl text-xs font-bold border ${day.color} flex items-center space-x-1.5`}
                        >
                          <span>{day.dayName}</span>
                          {isToday && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                            <span>{day.phaseTitle}</span>
                            {isToday && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold uppercase tracking-wider">
                                TODAY IN UOPEOPLE
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] text-slate-400">{day.phaseBurmese}</p>
                        </div>
                      </div>

                      {day.deadlineWarning && (
                        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>{day.deadlineWarning}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {dayTasks.map((task) => {
                        const taskKey = `u${currentUnit}-${task.id}`;
                        const isChecked = Boolean(completedTasks[taskKey]);

                        return (
                          <div
                            key={task.id}
                            onClick={() => toggleTask(taskKey)}
                            className={`cursor-pointer p-3 rounded-xl border transition-all flex items-start space-x-2.5 ${
                              isChecked
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-400 transition-colors"
                            >
                              {isChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                            <div className="flex-1 space-y-1">
                              <p
                                className={`text-xs font-semibold leading-relaxed ${
                                  isChecked ? 'line-through text-slate-400' : 'text-slate-200'
                                }`}
                              >
                                {task.text}
                              </p>
                              <p className="text-[11px] text-slate-400 leading-normal">
                                {task.burmeseText}
                              </p>
                              <div className="flex items-center space-x-2 pt-1">
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                                  ~{task.recommendedHours} hrs
                                </span>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                  {task.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* DISCUSSION RATING GUIDANCE CARD (Directly below Academic Calendar Rhythm component) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-blue-950/40 border border-indigo-500/35 shadow-lg">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 mt-0.5">
            <Lightbulb className="w-5 h-5 text-amber-300" />
          </div>
          <div className="space-y-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
            <div className="font-bold text-amber-200">
              💡 Discussion အမှတ်ပေးပုံ သတိပြုရန်:
            </div>
            <p>
              Discussion တစ်ခုချင်းစီ ဘယ်နှမှတ်ရမလဲဆိုတာ Syllabus မှာ စုစုပေါင်းအမှတ်ကို Discussion အပတ်အရေအတွက်နဲ့ စားပြီး တွက်ကြည့်နိုင်ပါတယ်။ Initial post ကို Sunday မှာ မတင်မိလို့ အမှတ်တစ်ဝက် ဖြတ်ချတာမျိုး မရှိပါဘူး (.1, .2 လောက်ပဲ လျော့နိုင်ပြီး ကျန်တာက Rubric မှာပြထားတဲ့ သတ်မှတ်ချက် မပြည့်ရင် instructor က အမှတ်လျှော့တတ်လို့ပါ)။ ဘယ်သူမဆို Discussion မှာ အမှတ်ပြည့်ရတာမျိုး နည်းပြီး အမှတ်ပေးတာက Instructor အပေါ်ပဲ မူတည်တာမို့ deadline မှာ မတင်မိလည်း စိတ်မပူဘဲ Rubric အတိုင်း အကောင်းဆုံး ရေးသားတင်သွင်းပါ။ နောက်အကျဆုံး Monday လောက် တင်နိုင်အောင် လုပ်ပါ။
            </p>
          </div>
        </div>
      </div>

      {/* RFC 5545 EXPORT MODAL */}
      {showIcsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setShowIcsModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {language === 'my'
                    ? '📅 Export RFC 5545 .ics Calendar'
                    : 'Export RFC 5545 .ics Calendar'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'my'
                    ? `သင်၏ စက်ပစ္စည်း စံတော်ချိန် (${localTimezone}) ဖြင့် အလိုအလျောက် ချိန်ညှိထားသော ပြက္ခဒိန်`
                    : `UTC Z-formatted events auto-mapped to your device timezone (${localTimezone}) with 24h & 12h VALARMs.`}
                </p>
              </div>
            </div>

            {/* Term Selector for Export */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {language === 'my' ? 'ထုတ်ယူလိုသော Term ကို ရွေးပါ:' : 'Select Term to Export:'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {UOPEOPLE_TERMS_2026_2027.map((term) => (
                  <button
                    key={term.termNumber}
                    type="button"
                    onClick={() => setSelectedExportTerm(term)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all text-left cursor-pointer ${
                      selectedExportTerm.termNumber === term.termNumber
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>{term.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{term.startDate}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Clarification Notice inside Modal */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
              <div className="font-bold text-indigo-300">
                ပါဝင်သော အဓိက ရက်စွဲများနှင့် Embedded VALARM များ (-P1D &amp; -PT12H):
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>UoPeople Course Registration Period Starts &amp; Late Registration</li>
                <li>Drop Period (End of Week 1) &amp; Course Withdrawal Period (End of Week 4)</li>
                <li>Weekly Deadlines (11:55 PM / 23:55 GMT-5) &amp; Final Exam Window</li>
              </ul>
              <p className="text-[11px] text-amber-300/90 pt-1 leading-relaxed">
                {REGISTRATION_CLARIFICATION_NOTICE_MY}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  downloadTermIcs(selectedExportTerm);
                  setShowIcsModal(false);
                }}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'my' ? '📥 Download .ics File' : 'Download .ics File'}</span>
              </button>

              <a
                href={getGoogleCalendarWebUrl(selectedExportTerm)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowIcsModal(false)}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-blue-400" />
                <span>
                  {language === 'my' ? '🌐 Add to Google Calendar' : 'Add to Google Calendar'}
                </span>
              </a>
            </div>

            {/* Quick Guide in Burmese */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1.5">
              <div className="font-bold text-indigo-300 flex items-center space-x-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span>အသုံးပြုနည်း အမြန်လမ်းညွှန် (Quick Guide):</span>
              </div>
              <p className="text-[11px] text-indigo-100/90 leading-relaxed font-sans">
                ဖိုင်ကို Download ဆွဲပြီး ဖုန်း/ကွန်ပျူတာထဲတွင် ဖွင့်လိုက်ပါက Google Calendar, Apple Calendar သို့မဟုတ် Outlook ထဲသို့ UTC Z စနစ်ဖြင့် သင်၏ ဒေသစံတော်ချိန်အတိုင်း အလိုအလျောက် ထည့်သွင်းပေးသွားမည်ဖြစ်ပြီး ၂၄ နာရီ (-P1D) နှင့် ၁၂ နာရီ (-PT12H) ကြိုတင်အသိပေး Alarm များ (VALARM) ပါဝင်ပြီးသား ဖြစ်ပါသည်။
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
