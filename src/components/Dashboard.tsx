import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import { isCardDue } from '../utils/sm2';
import { WORKSPACE_CARDS } from '../data/workspaces';
import { syncUoPeopleCalendar } from '../utils/uopeopleCalendar';
import { WorkspaceCard } from './WorkspaceCard';
import { DashboardStreakWidget } from './DashboardStreakWidget';
import { WorkspacesSection } from './WorkspacesSection';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  FileText,
  Clock,
  Flame,
  Brain,
  ShieldCheck,
  ArrowRight,
  Target,
  Award,
  CheckCircle2,
  Calendar,
  Scissors,
  Network,
  Headphones,
  Compass,
  BarChart3,
  Layers,
} from 'lucide-react';

export const Dashboard: React.FC<{ onOpenWorkspace?: (workspaceKey: string, cardDomId?: string) => void }> = ({ onOpenWorkspace }) => {
  useEffect(() => {
    syncUoPeopleCalendar();
  }, []);

  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'writing' | 'study' | 'wellness' | 'career'>('all');
  const {
    language,
    setActiveTab,
    calculateOverallCgpa,
    forecastGpaNeeded,
    terms,
    flashcards,
    burnoutLog,
    settings,
    recentTools,
  } = useApp();

  const t = translations[language];
  const { cgpa, totalCredits } = calculateOverallCgpa();
  const dueCardsCount = flashcards.filter(isCardDue).length;
  const forecast = forecastGpaNeeded(settings.targetCgpa, settings.remainingCredits);

  // Burnout score calculation
  const burnoutRisk =
    burnoutLog.stressLevel >= 7 || burnoutLog.studyHoursToday > 7 || burnoutLog.energyLevel <= 3
      ? 'high'
      : burnoutLog.stressLevel >= 5 || burnoutLog.studyHoursToday >= 5
      ? 'moderate'
      : 'healthy';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Security Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero-Retention · Client-Side Encrypted · 100% Free</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            {language === 'my'
              ? 'ကျောင်းသားများအတွက် အခမဲ့ All-in-One Academic & Privacy Suite'
              : 'Empowering Your Academic Journey with Privacy & AI Excellence'}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            {language === 'my'
              ? 'ကျောင်းသားများ ထည့်သွင်းထားသော Assignment စာမူကြမ်း၊ အမှတ်စာရင်းနှင့် ကိုယ်ရေးအချက်အလက်များကို မည်သည့်ပြင်ပ Server တွင်မျှ သိမ်းဆည်းခြင်းမရှိပါ။ CGPA တွက်ချက်ခြင်း၊ Rubric စိစစ်ခြင်း၊ APA 7th Word ဖိုင်ထုတ်ယူခြင်းနှင့် Flashcards လေ့ကျင့်ခန်းများကို အချက်အလက်လုံခြုံစိတ်ချစွာ အသုံးပြုနိုင်ပါသည်။'
              : 'No surveillance, no subscriptions, and zero cloud data retention. Compute CGPA forecasts, break down professor rubrics for an A, export genuine APA 7th Word docs, and retain knowledge with SM-2 spaced repetition.'}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('uopeople_scholar')}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs sm:text-sm font-bold hover:from-pink-500 hover:to-rose-500 transition-all shadow-lg shadow-pink-600/30 cursor-pointer"
            >
              <Award className="w-4 h-4 text-pink-200" />
              <span>{language === 'my' ? '🎓 UoPeople Scholar' : '🎓 UoPeople Scholar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('rhythm')}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-600/25"
            >
              <Calendar className="w-4 h-4 text-cyan-300" />
              <span>{language === 'my' ? 'UoPeople အပတ်စဉ် အချိန်ဇယား' : 'UoPeople Rhythm Calendar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('assignment')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/25"
            >
              <Sparkles className="w-4 h-4" />
              <span>{language === 'my' ? '"A ရဖို့" Rubric စစ်မည်' : 'Assignment Rubric'}</span>
            </button>
            <button
              onClick={() => setActiveTab('cgpa')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <Target className="w-4 h-4 text-emerald-400" />
              <span>CGPA Forecaster</span>
            </button>
          </div>
        </div>
      </div>

      {/* Daily Learning Streak & Academic Momentum Widget */}
      <DashboardStreakWidget />

      {/* Recent Tools Section */}
      {recentTools.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/50 border border-indigo-500/30 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{language === 'my' ? '⚡ လတ်တလော အသုံးပြုခဲ့သော Tools များ' : '⚡ Recent Tools Accessed'}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {language === 'my' ? 'နောက်ဆုံး ၃ ခု' : 'Last 3 visited'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentTools.map((tool) => (
              <div
                key={tool.id}
                onClick={() => {
                  const cardDomId = `card-${tool.id}`;
                  if (onOpenWorkspace) {
                    onOpenWorkspace(tool.route, cardDomId);
                  } else {
                    if (tool.route === 'assignment') setActiveTab('assignment');
                    else if (tool.route === 'apa') setActiveTab('apa');
                    else if (tool.route === 'research') setActiveTab('research');
                    else if (tool.route === 'lesson') setActiveTab('lesson');
                    else if (tool.route === 'flashcards') setActiveTab('flashcards');
                    else if (tool.route === 'rhythm') setActiveTab('rhythm');
                    else if (tool.route === 'pomodoro') setActiveTab('pomodoro');
                    else if (tool.route === 'cgpa') setActiveTab('cgpa');
                    else if (tool.route === 'scholarship') setActiveTab('uopeople_scholar');
                    else if (tool.route === 'scholarship_sop_studio' || tool.route === 'career') setActiveTab('scholarship_sop_studio');
                    else setActiveTab(tool.route as any);
                  }
                }}
                className="cursor-pointer group flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850 transition-all shadow-md"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-0.5">
                    {tool.suiteLabel}
                  </div>
                  <div className="text-xs font-bold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                    {tool.title}
                  </div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: CGPA */}
        <div
          onClick={() => setActiveTab('cgpa')}
          className="cursor-pointer group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all hover:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.cgpa.cumulativeGpa}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{cgpa.toFixed(2)}</span>
            <span className="text-xs text-slate-400">/ 4.00</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {totalCredits} {language === 'my' ? 'Credits ပြီးမြောက်ပြီး' : 'Credits completed across'} {terms.length} terms
          </p>
        </div>

        {/* Metric 2: Target Forecast */}
        <div
          onClick={() => setActiveTab('cgpa')}
          className="cursor-pointer group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Target: {settings.targetCgpa.toFixed(2)}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-400">
              {forecast.achievable ? forecast.needed.toFixed(2) : '> 4.00'}
            </span>
            <span className="text-xs text-slate-400">min GPA needed</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {settings.remainingCredits} {language === 'my' ? 'Credits ကျန်ရှိသည်' : 'credits remaining'}
          </p>
        </div>

        {/* Metric 3: Flashcards Due */}
        <div
          onClick={() => setActiveTab('flashcards')}
          className="cursor-pointer group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 transition-all hover:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.flashcards.dueCards}
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-violet-400">{dueCardsCount}</span>
            <span className="text-xs text-slate-400">of {flashcards.length} total cards</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {language === 'my' ? 'SM-2 မေ့လွယ်/မှတ်မိ အစီအစဉ်' : 'SuperMemo SM-2 Spaced Repetition'}
          </p>
        </div>

        {/* Metric 4: Burnout Health */}
        <div
          onClick={() => setActiveTab('pomodoro')}
          className="cursor-pointer group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition-all hover:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.pomodoro.burnoutScore}
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                burnoutRisk === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : burnoutRisk === 'moderate'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-xl font-extrabold uppercase ${
                burnoutRisk === 'healthy'
                  ? 'text-emerald-400'
                  : burnoutRisk === 'moderate'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {burnoutRisk === 'healthy'
                ? 'Optimal'
                : burnoutRisk === 'moderate'
                ? 'Moderate'
                : 'High Risk'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {burnoutLog.studyHoursToday}h study · {burnoutLog.energyLevel}/10 energy
          </p>
        </div>
      </div>

      {/* Workflow Navigation & Bilingual Workspaces Grid */}
      <WorkspacesSection
        currentLanguage={language === 'my' ? 'mm' : 'en'}
        setCurrentWorkspace={(workspaceKey, cardDomId) => {
          if (onOpenWorkspace) {
            onOpenWorkspace(workspaceKey, cardDomId);
          } else {
            if (workspaceKey === 'assignment_workspace' || workspaceKey === 'assignment' || workspaceKey === 'paraphraser') {
              setActiveTab('assignment');
            } else if (workspaceKey === 'apa_workspace' || workspaceKey === 'apa') {
              setActiveTab('apa');
            } else if (
              workspaceKey === 'course_reader' ||
              workspaceKey === 'stats_explainer' ||
              workspaceKey === 'cross_unit' ||
              workspaceKey === 'research'
            ) {
              setActiveTab('research');
            } else if (workspaceKey === 'lesson_explainer' || workspaceKey === 'lesson') {
              setActiveTab('lesson');
            } else if (workspaceKey === 'flashcards_sm2' || workspaceKey === 'flashcards') {
              setActiveTab('flashcards');
            } else if (workspaceKey === 'weekly_timetable' || workspaceKey === 'rhythm') {
              setActiveTab('rhythm');
            } else if (
              workspaceKey === 'pomodoro_lofi' ||
              workspaceKey === 'impostor_wellness' ||
              workspaceKey === 'pomodoro'
            ) {
              setActiveTab('pomodoro');
            } else if (workspaceKey === 'cgpa_forecaster' || workspaceKey === 'cgpa') {
              setActiveTab('cgpa');
            } else if (workspaceKey === 'uopeople_scholar' || workspaceKey === 'scholarship') {
              setActiveTab('uopeople_scholar');
            } else if (
              workspaceKey === 'star_scholarship' ||
              workspaceKey === 'scholarship_sop_studio' ||
              workspaceKey === 'career'
            ) {
              setActiveTab('scholarship_sop_studio');
            } else {
              setActiveTab(workspaceKey as any);
            }
          }
        }}
      />
    </div>
  );
};
