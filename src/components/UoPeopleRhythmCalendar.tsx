import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import { resolveLiveAcademicContext, getCurrentAcademicState, UOPEOPLE_TERMS_2026_2027, AcademicTerm } from '../utils/uopeopleCalendar';
import { downloadTermIcs, getGoogleCalendarWebUrl } from '../utils/icsGenerator';
import { AcademicCalendarHeader } from './AcademicCalendarHeader';
import {
  Calendar,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Flame,
  Download,
  BookOpen,
  MessageSquare,
  FileText,
  Users,
  Award,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Palmtree,
  CheckSquare,
  Bell,
  X,
  ExternalLink,
  Check,
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
    phaseTitle: '🚨 Discussion Initial Post Deadline',
    phaseBurmese: 'Discussion ပထမဆုံး အဖြေ တင်သွင်းရန် နောက်ဆုံးအချိန်',
    color: 'from-amber-600/25 border-amber-500/50 text-amber-300',
    deadlineWarning: 'Discussion Forum Initial Post Deadline at 23:55 GMT-5',
    deadlineGmt5Time: '23:55 GMT-5',
    tasks: [
      {
        id: 'sun-1',
        text: 'Submit Discussion Forum Initial Post before 23:55 GMT-5',
        burmeseText: 'Discussion Forum အဖြေအား နောက်ဆုံးသတ်မှတ်ချိန် 23:55 GMT-5 မတိုင်မီ တင်သွင်းခြင်း',
        recommendedHours: 0.5,
        category: 'discussion',
      },
      {
        id: 'sun-2',
        text: 'Review Written Assignment / Learning Journal prompt requirements',
        burmeseText: 'Written Assignment သို့မဟုတ် Learning Journal အတွက် မေးခွန်းများကို ကြိုတင်လေ့လာခြင်း',
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
    phaseTitle: 'Peer Assessments & Written Assignment Development',
    phaseBurmese: 'အတန်းဖော်များကို အမှတ်ပေးခြင်းနှင့် Assignment ရေးသားခြင်း',
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
        text: 'Draft Outline for Written Assignment (Intro, Body Claims, Counter-arguments)',
        burmeseText: 'Written Assignment အတွက် Outline နှင့် စာပိုဒ်အလိုက် မူကြမ်း စတင်ရေးသားခြင်း',
        recommendedHours: 2.0,
        category: 'assignment',
      },
    ],
  },
  {
    dayName: 'Tuesday',
    burmeseDay: 'အင်္ဂါနေ့ (Learning Journal & Final Drafts)',
    uopeopleDayIndex: 5,
    phaseTitle: 'Assignment Refinement & Learning Journal Completion',
    phaseBurmese: 'စာမူကြမ်းများ ပြင်ဆင်ခြင်းနှင့် Learning Journal ရေးသားခြင်း',
    color: 'from-emerald-600/20 border-emerald-500/40 text-emerald-300',
    tasks: [
      {
        id: 'tue-1',
        text: 'Finalize Written Assignment with 0% AI Humanizer & Turnitin Check',
        burmeseText: 'Written Assignment ကို သဘာဝကျသော လူသားရေးဟန် 0% AI ဖြင့် အချောသပ် ပြင်ဆင်ခြင်း',
        recommendedHours: 2.0,
        category: 'assignment',
      },
      {
        id: 'tue-2',
        text: 'Draft & complete Learning Journal entry (Reflective writing & self-evaluation)',
        burmeseText: 'Learning Journal (သင်ယူမှု သုံးသပ်ချက် မှတ်တမ်း) ရေးသား အပြီးသတ်ခြင်း',
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
    phaseTitle: '🚨 FINAL SUBMISSION DEADLINE (23:55 GMT-5)',
    phaseBurmese: 'ရက်သတ္တပတ် ပြီးဆုံးခြင်းနှင့် နောက်ဆုံး တင်သွင်းရမည့် အချိန်',
    color: 'from-rose-600/30 border-rose-500/60 text-rose-300',
    deadlineWarning: 'CRITICAL DEADLINE: All Assignments & Quizzes due at 23:55 GMT-5',
    deadlineGmt5Time: '23:55 GMT-5',
    tasks: [
      {
        id: 'wed-1',
        text: 'Submit Written Assignment in Word (.docx) format before 23:55 GMT-5',
        burmeseText: 'Written Assignment Word (.docx) ဖိုင်အား 23:55 GMT-5 မတိုင်မီ တင်သွင်းခြင်း',
        recommendedHours: 0.5,
        category: 'assignment',
      },
      {
        id: 'wed-2',
        text: 'Submit Learning Journal before 23:55 GMT-5',
        burmeseText: 'Learning Journal အား 23:55 GMT-5 မတိုင်မီ တင်သွင်းခြင်း',
        recommendedHours: 0.5,
        category: 'assignment',
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
  const t = translations[language];

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

  // Selected Unit (1 to 9)
  const [currentUnit, setCurrentUnit] = useState<number>(() => {
    const saved = localStorage.getItem('uopeople_current_unit');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [showBreakPreview, setShowBreakPreview] = useState(false);
  const [showIcsModal, setShowIcsModal] = useState(false);
  const [selectedExportTerm, setSelectedExportTerm] = useState<AcademicTerm>(academicState.activeTerm);

  // Sync selected export term when academicState changes
  useEffect(() => {
    if (academicState.activeTerm) {
      setSelectedExportTerm(academicState.activeTerm);
    }
  }, [academicState.activeTerm]);

  // Track checked tasks
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('uopeople_completed_tasks_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('uopeople_current_unit', currentUnit.toString());
  }, [currentUnit]);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      localStorage.setItem('uopeople_completed_tasks_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const localTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Yangon';
  }, []);

  const uopeopleDate = useMemo(() => {
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcMs - 5 * 3600000);
  }, [now]);

  const timezoneOffsetHours = useMemo(() => {
    const localUtcOffsetHours = -now.getTimezoneOffset() / 60;
    const uopeopleUtcOffsetHours = -5;
    return localUtcOffsetHours - uopeopleUtcOffsetHours;
  }, [now]);

  const uopeopleAcademicDayIndex = useMemo(() => {
    const day = uopeopleDate.getDay();
    const map = [3, 4, 5, 6, 0, 1, 2];
    return map[day];
  }, [uopeopleDate]);

  const countdownToWednesday = useMemo(() => {
    const year = uopeopleDate.getFullYear();
    const month = uopeopleDate.getMonth();
    const date = uopeopleDate.getDate();
    const day = uopeopleDate.getDay();

    let daysUntilWed = (3 - day + 7) % 7;
    const currentHour = uopeopleDate.getHours();
    const currentMin = uopeopleDate.getMinutes();
    if (day === 3 && (currentHour > 23 || (currentHour === 23 && currentMin >= 55))) {
      daysUntilWed = 7;
    }

    const targetGmt5 = new Date(year, month, date + daysUntilWed, 23, 55, 0);
    const diffMs = targetGmt5.getTime() - uopeopleDate.getTime();

    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds };
  }, [uopeopleDate]);

  const termBreakCountdown = useMemo(() => {
    if (!academicState.countdownTarget) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const targetMs = academicState.countdownTarget.getTime();
    const diffMs = targetMs - uopeopleDate.getTime();

    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds };
  }, [academicState.countdownTarget, uopeopleDate]);

  const convertedDeadlines = useMemo(() => {
    const sampleWedGmt5 = new Date('2026-11-11T23:55:00-05:00');
    const localWedFormatted = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZoneName: 'short',
    }).format(sampleWedGmt5);

    const sampleSunGmt5 = new Date('2026-11-08T23:55:00-05:00');
    const localSunFormatted = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZoneName: 'short',
    }).format(sampleSunGmt5);

    return {
      wednesdayLocal: localWedFormatted,
      sundayLocal: localSunFormatted,
    };
  }, []);

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
        onExportIcs={() => setShowIcsModal(true)}
        termStartDate="2026-11-12"
      />

      {isTermBreak && (
        <div className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm">
          <Palmtree className="w-4 h-4 text-amber-400 animate-bounce" />
          <span>🏝️ TERM BREAK (ကျောင်းပိတ်ရက်ကာလ) — နောက်လာမည့် Term အတွက် အနားယူပြင်ဆင်နိုင်ပါသည်</span>
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
              {uopeopleDate.toLocaleTimeString('en-US', { hour12: true })}
            </div>
            <div className="text-[11px] text-slate-400">
              {uopeopleDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
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
              <span>{language === 'my' ? 'သင်၏ လက်ရှိဒေသ စံတော်ချိန်' : 'Your Local Timezone (Auto)'}</span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-emerald-300">
              {now.toLocaleTimeString(undefined, { hour12: true })}
            </div>
            <div className="text-[11px] text-slate-400">
              {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} ({localTimezone.split('/').pop()?.replace('_', ' ')})
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold font-mono">
              {timezoneOffsetHours >= 0 ? `+${timezoneOffsetHours}h ahead` : `${timezoneOffsetHours}h behind`}
            </span>
          </div>
        </div>

        {/* Conditional Card: Term Break Countdown OR Active Wednesday Countdown */}
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
                <div className="text-lg font-mono font-extrabold text-white">{termBreakCountdown.days}</div>
                <div className="text-[9px] text-slate-400 uppercase">Days</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-white">{termBreakCountdown.hours}</div>
                <div className="text-[9px] text-slate-400 uppercase">Hours</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-white">{termBreakCountdown.minutes}</div>
                <div className="text-[9px] text-slate-400 uppercase">Mins</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-amber-500/20">
                <div className="text-lg font-mono font-extrabold text-amber-400">{termBreakCountdown.seconds}</div>
                <div className="text-[9px] text-slate-400 uppercase">Secs</div>
              </div>
            </div>

            <div className="text-[10px] text-amber-200/90 truncate">
              {language === 'my' ? 'စတင်မည့်ရက်:' : 'Next Term Starts:'} <strong>{academicState.nextTerm?.startDate}</strong>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-rose-950/40 border border-rose-500/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>{language === 'my' ? 'နောက်ဆုံး သတ်မှတ်ချိန်အထိ အချိန်ကျန်' : 'Wednesday Submission Countdown'}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">23:55 GMT-5</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center my-1.5">
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-white">{countdownToWednesday.days}</div>
                <div className="text-[9px] text-slate-400 uppercase">Days</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-white">{countdownToWednesday.hours}</div>
                <div className="text-[9px] text-slate-400 uppercase">Hours</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-white">{countdownToWednesday.minutes}</div>
                <div className="text-[9px] text-slate-400 uppercase">Mins</div>
              </div>
              <div className="p-1 rounded-lg bg-slate-950/80 border border-rose-500/20">
                <div className="text-lg font-mono font-extrabold text-rose-400">{countdownToWednesday.seconds}</div>
                <div className="text-[9px] text-slate-400 uppercase">Secs</div>
              </div>
            </div>

            <div className="text-[10px] text-rose-200/80 truncate">
              {language === 'my' ? 'သင်၏ဒေသအချိန်:' : 'Your local deadline:'} <strong>{convertedDeadlines.wednesdayLocal}</strong>
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
                <span>🏝️ UoPeople Term Break Productivity & Rest Advisory</span>
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
                Portal တွင် ပြီးခဲ့သော Term ၏ Final Grades များကို <strong>{academicState.activeTerm.gradesPublishedDate}</strong> ရက်နေ့ နောက်ဆုံးထား၍ ထုတ်ပြန်ပေးပါမည်။ စာရင်းဇယားများကို စစ်ဆေးပါ။
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
              {language === 'my' ? 'ကျောင်းပိတ်ရက်ဖြစ်သော်လည်း လေ့လာမှု အချိန်ဇယားကို ကြည့်လိုပါက အောက်ပါခလုတ်ကို နှိပ်ပါ -' : 'Want to preview upcoming study rhythms during break?'}
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

      {/* Deadlines Quick Reference Card */}
      {(!isTermBreak || showBreakPreview) && (
        <>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-slate-300">
                <strong className="text-white">UoPeople Two Golden Deadlines:</strong>
                <span className="ml-2 text-slate-400">
                  (1) Discussion Post due <strong>Sunday 23:55 GMT-5</strong> ({convertedDeadlines.sundayLocal}) · (2) Final Assignments due <strong>Wednesday 23:55 GMT-5</strong> ({convertedDeadlines.wednesdayLocal}).
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
              <span className="font-mono font-bold text-white text-xs">{completionStats.percentage}% done</span>
            </div>
          </div>

          {/* 7-Day Rhythm Day-by-Day Cards */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <span>{language === 'my' ? 'အပတ်စဉ် နေ့အလိုက် လေ့လာမှု အချိန်ဇယား' : 'Daily Study Timetable (Thursday to Wednesday)'}</span>
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
                              <p className={`text-xs font-semibold leading-relaxed ${isChecked ? 'line-through text-slate-400' : 'text-slate-200'}`}>
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
                  {language === 'my' ? '📅 Export RFC 5545 .ics Calendar' : 'Export RFC 5545 .ics Calendar'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'my' ? 'UoPeople ကျောင်းသုံးပြက္ခဒိန်ကို Apple, Google, Outlook တွင် ထည့်သွင်းရန်' : 'Bundle all official term milestones, weekly deadlines, and exam schedules with timezone conversion.'}
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

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                <span>{language === 'my' ? '🌐 Add to Google Calendar' : 'Add to Google Calendar'}</span>
              </a>
            </div>

            {/* Quick Guide in Burmese */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1.5">
              <div className="font-bold text-indigo-300 flex items-center space-x-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span>အသုံးပြုနည်း အမြန်လမ်းညွှန် (Quick Guide):</span>
              </div>
              <p className="text-[11px] text-indigo-100/90 leading-relaxed font-sans">
                ဖိုင်ကို Download ဆွဲပြီး ဖုန်း/ကွန်ပျူတာထဲတွင် ဖွင့်လိုက်ပါက Google Calendar သို့မဟုတ် Apple Calendar ထဲသို့ အလိုအလျောက် ထည့်သွင်းပေးသွားမည်ဖြစ်ပြီး Deadlines များအတွက် အသိပေး Alarm များ (VALARM) ပါဝင်ပြီးသား ဖြစ်ပါသည်။
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
