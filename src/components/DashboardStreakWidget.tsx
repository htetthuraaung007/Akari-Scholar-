import React, { useEffect } from 'react';
import { useStreak } from '../context/StreakContext';
import { useApp } from '../context/AppContext';
import {
  Flame,
  Shield,
  Award,
  Sparkles,
  CheckCircle2,
  Calendar,
  Zap,
  X,
} from 'lucide-react';

export const DashboardStreakWidget: React.FC = () => {
  const { streak, recentMilestone, clearRecentMilestone, recordStudyActivity } = useStreak();
  const { language } = useApp();

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Adjust day index for Mon-Sun or Thu-Wed (let's map getDay(): Sun=6, Mon=0...)
  const normalizedWeeklyMap = useMemoWeeklyMap(streak.weeklyActivityMap);

  function useMemoWeeklyMap(map: boolean[]) {
    // map is [Sun, Mon, Tue, Wed, Thu, Fri, Sat] from getDay()
    // Let's reorder to Mon, Tue, Wed, Thu, Fri, Sat, Sun
    return [map[1], map[2], map[3], map[4], map[5], map[6], map[0]];
  }

  return (
    <>
      {/* Glowing Glassmorphism Streak Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/40 p-6 shadow-2xl space-y-4">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Fire Icon & Counter */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
                <Flame className="w-8 h-8 fill-amber-200" />
              </div>
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/50">
                {streak.currentStreak}D
              </span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  🔥 {streak.currentStreak} {language === 'my' ? 'ရက်ဆက် စာလေ့လာမှု (Streak)' : 'Days Streak'}
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 font-mono">
                  Longest: {streak.longestStreak}D
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {streak.todayCompleted
                  ? language === 'my'
                    ? '✅ ယနေ့အတွက် စာလေ့လာမှု ပြီးမြောက်ပါပြီ! မနက်ဖြန်လည်း ဆက်ထိန်းထားကြစို့။'
                    : '✅ Today’s study goal achieved! Keep the momentum going.'
                  : streak.currentStreak === 0
                  ? language === 'my'
                    ? '⚡ စာစတင်လေ့လာရန် Pomodoro၊ Flashcards သို့မဟုတ် Research ကိရိယာတစ်ခုခုကို အသုံးပြုပါ။'
                    : '⚡ Complete a Pomodoro, Flashcard session, or Research query today to begin your streak.'
                  : language === 'my'
                  ? '⚡ ယနေ့ စာလေ့လာမှုအတွက် Pomodoro, Flashcards သို့မဟုတ် Research ကို အသုံးပြုပါ။'
                  : '⚡ Complete a Pomodoro, Flashcard session, or Research query today to maintain your streak.'}
              </p>
            </div>
          </div>

          {/* Right: 7-Day Rhythm Dot Tracker & Freeze Shield */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* 7-Day Dots */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider text-center sm:text-left">
                {language === 'my' ? 'ယခုတစ်ပတ် လှုပ်ရှားမှု' : 'Weekly Activity'}
              </div>
              <div className="flex items-center space-x-1.5">
                {daysOfWeek.map((dayLabel, idx) => {
                  const isActive = normalizedWeeklyMap[idx];
                  return (
                    <div key={dayLabel} className="flex flex-col items-center space-y-1">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40 scale-105'
                            : 'bg-slate-950/80 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {isActive ? <CheckCircle2 className="w-4 h-4 text-slate-950" /> : '·'}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Streak Freeze Shield Badge */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center space-x-2.5">
              <Shield className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Streak Freeze</div>
                <div className="text-xs font-bold text-indigo-300 font-mono">
                  🛡️ {streak.streakFreezesRemaining} Available
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Freeze Used Notice if any */}
        {streak.freezeUsedTodayNotice && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center space-x-2 animate-in fade-in">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{streak.freezeUsedTodayNotice}</span>
          </div>
        )}
      </div>

      {/* Milestone celebration modal */}
      {recentMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={clearRecentMilestone}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-rose-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-amber-500/40 animate-bounce">
              <Award className="w-8 h-8 text-amber-100" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider border border-amber-500/40">
                🎉 Milestone Unlocked!
              </span>
              <h3 className="text-xl font-extrabold text-white">
                {recentMilestone}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {language === 'my'
                  ? 'သင်၏ မဆုတ်မနစ်သော ဇွဲလုံ့လနှင့် နေ့စဉ် စာလေ့လာမှု အလေ့အထအတွက် ဤဂုဏ်ပြုဆုတံဆိပ်ကို ပေးအပ်အပ်ပါသည်။'
                  : 'Congratulations on maintaining consistent academic momentum. Keep pushing forward!'}
              </p>
            </div>

            <button
              type="button"
              onClick={clearRecentMilestone}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white font-bold text-xs shadow-lg shadow-amber-500/30 transition-all cursor-pointer"
            >
              {language === 'my' ? 'ဆက်လက်လေ့လာမည်' : 'Continue Learning'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
