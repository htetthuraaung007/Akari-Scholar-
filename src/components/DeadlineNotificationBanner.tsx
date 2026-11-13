import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  getUoPeopleTimeStatus,
  confirmDeadlineSubmission,
  UoPeopleTimeStatus,
} from '../utils/uopeopleTime';
import { resolveLiveAcademicContext } from '../utils/uopeopleCalendar';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Flame,
  Globe,
  HelpCircle,
  Coffee,
} from 'lucide-react';

export const DeadlineNotificationBanner: React.FC = () => {
  const { language } = useApp();
  const [timeStatus, setTimeStatus] = useState<UoPeopleTimeStatus & { isTermBreak: boolean }>(getUoPeopleTimeStatus());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Pure automated context calculation based on system/calendar dates
  const context = useMemo(() => resolveLiveAcademicContext(), []);

  // Update live clock and deadline check every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStatus(getUoPeopleTimeStatus());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // If currently an active term according to calendar resolver, display deadline notifications
  if (!context.isTermBreak) {
    const activeAlert = timeStatus.activeDeadlineAlert;
    if (!activeAlert) return null;

    const isUrgent = activeAlert.isUrgent12h;

    const handleFirstClick = () => {
      setShowConfirmModal(true);
    };

    const handleFinalConfirm = () => {
      confirmDeadlineSubmission(activeAlert.deadlineKey);
      setShowConfirmModal(false);
    };

    return (
      <>
        {/* Top Floating Notification Banner */}
        <div
          className={`rounded-2xl border p-4 shadow-2xl transition-all animate-in slide-in-from-top-4 duration-300 ${
            isUrgent
              ? 'bg-gradient-to-r from-red-950/90 via-slate-900 to-red-950/70 border-red-500/60 shadow-red-500/20'
              : 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/70 border-amber-500/60 shadow-amber-500/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div
                className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                  isUrgent
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {isUrgent ? <Flame className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700 text-slate-200">
                    {isUrgent ? (language === 'my' ? '⚠️ ၁၂ နာရီအလို အရေးပေါ်' : '⚠️ Under 12 Hours') : (language === 'my' ? '📅 ၁ ရက်အလို သတိပေးချက်' : '📅 24-Hour Notice')}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {activeAlert.remainingHours}h {activeAlert.remainingMins}m {language === 'my' ? 'ကျန်ရှိ' : 'remaining'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white mt-1">
                  {language === 'my'
                    ? `${activeAlert.type === 'discussion' ? 'Discussion Assignment' : 'Assignment Activity'} တင်ရန် Deadline နီးကပ်နေပါပြီ`
                    : `Upcoming ${activeAlert.title}`}
                </h4>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
                  <span className="flex items-center space-x-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>UoPeople Time: <strong className="text-white">{activeAlert.uopDeadlineStr}</strong></span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'my' ? 'ဖုန်းဒေသစံတော်ချိန်:' : 'Local Time:'} <strong className="text-emerald-300">{activeAlert.localDeadlineStr}</strong></span>
                  </span>
                </div>
              </div>
            </div>

            {/* Submission Mark Button */}
            <div className="flex items-center space-x-2 shrink-0 sm:self-center">
              <button
                type="button"
                onClick={handleFirstClick}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === 'my' ? 'တင်ပြီးပါပြီ (Mark as Submitted)' : 'Mark as Submitted'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Two-Step Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                {language === 'my' ? 'သေချာတင်ပြီးခဲ့သလား?' : 'Confirm Moodle Submission'}
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
                {language === 'my'
                  ? `University of the People Moodle Portal တွင် သင်၏ ${activeAlert.type === 'discussion' ? 'Discussion Assignment' : 'Assignment Activity'} ကို အမှန်တကယ် တင်သွင်းပြီးစီးခဲ့ပြီလား သေချာစစ်ဆေး အတည်ပြုပေးပါ။`
                  : `Please confirm that you have successfully submitted your ${activeAlert.type === 'discussion' ? 'Discussion Post' : 'Written Assignment Activity'} into the UoPeople Moodle portal.`}
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 mb-6 flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {language === 'my'
                    ? 'အတည်ပြုပြီးပါက ဤအပတ်အတွက် သတိပေးချက် notification ထပ်မံပေါ်လာမည် မဟုတ်တော့ပါ။'
                    : 'Once confirmed, this deadline reminder notification will not appear again for this week.'}
                </span>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {language === 'my' ? 'မတင်ရသေးပါ (Cancel)' : 'Not Yet'}
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'my' ? 'ဟုတ်ကဲ့၊ သေချာတင်ပြီးပါပြီ' : 'Yes, Confirmed'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Pure automated Term Break Banner (Zero manual override buttons)
  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/60 p-4 shadow-xl transition-all animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start space-x-3">
        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mt-0.5 shrink-0">
          <Coffee className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              🏖️ {language === 'my' ? 'Term Break ကာလ (Term မစသေးပါ)' : 'UoPeople Term Break Active'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Official Academic Calendar
            </span>
          </div>
          <h4 className="text-sm font-bold text-white mt-1">
            {language === 'my'
              ? 'လက်ရှိတွင် Term Break အားလပ်ရက် ဖြစ်ပါသဖြင့် အပတ်စဉ် Assignment များ မရှိသေးပါ'
              : 'Classes are currently on Term Break. No weekly assignments or deadlines are due.'}
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {language === 'my'
              ? 'နောက် Term အတွက် Course Registration စစ်ဆေးခြင်း၊ စာအုပ်များ ကြိုတင်ဖတ်ရှုခြင်းနှင့် Scholarship လျှောက်ထားခြင်းများ ပြုလုပ်နိုင်ပါသည်။'
              : 'Enjoy your break, register for upcoming term courses, or prepare materials in advance.'}
          </p>
        </div>
      </div>
    </div>
  );
};
