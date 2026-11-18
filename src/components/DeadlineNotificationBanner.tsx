import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  getUoPeopleTimeStatus,
  confirmDeadlineSubmission,
  confirmRegistrationAcknowledgment,
  requestDeadlineNotificationPermission,
  THURSDAY_EXTENSION_NOTICE_MY,
  REGISTRATION_CLARIFICATION_NOTICE_MY,
  UOPEOPLE_SUBMISSION_UPDATED_EVENT,
  UOPEOPLE_REG_ACK_UPDATED_EVENT,
  UoPeopleTimeStatus,
} from '../utils/uopeopleTime';
import { resolveLiveAcademicContext } from '../utils/uopeopleCalendar';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  Globe,
  Coffee,
  Calendar,
} from 'lucide-react';

export const DeadlineNotificationBanner: React.FC = () => {
  const { language } = useApp();
  const [timeStatus, setTimeStatus] = useState<UoPeopleTimeStatus & { isTermBreak: boolean }>(
    getUoPeopleTimeStatus()
  );
  const [isConfirmingAssignment, setIsConfirmingAssignment] = useState(false);
  const [isConfirmingRegistration, setIsConfirmingRegistration] = useState(false);

  const context = useMemo(() => resolveLiveAcademicContext(), []);

  useEffect(() => {
    const refreshStatus = () => {
      setTimeStatus(getUoPeopleTimeStatus());
    };
    const interval = setInterval(refreshStatus, 15000);
    window.addEventListener(UOPEOPLE_SUBMISSION_UPDATED_EVENT, refreshStatus);
    window.addEventListener(UOPEOPLE_REG_ACK_UPDATED_EVENT, refreshStatus);
    window.addEventListener('storage', refreshStatus);
    return () => {
      clearInterval(interval);
      window.removeEventListener(UOPEOPLE_SUBMISSION_UPDATED_EVENT, refreshStatus);
      window.removeEventListener(UOPEOPLE_REG_ACK_UPDATED_EVENT, refreshStatus);
      window.removeEventListener('storage', refreshStatus);
    };
  }, []);

  const activeAlert = !context.isTermBreak ? timeStatus.activeDeadlineAlert : null;
  const activeRegAlert = timeStatus.activeRegistrationAlert;

  const handleAssignmentBtnClick = () => {
    void requestDeadlineNotificationPermission();
    if (!isConfirmingAssignment) {
      setIsConfirmingAssignment(true);
      return;
    }
    if (activeAlert) {
      confirmDeadlineSubmission(activeAlert.deadlineKey, activeAlert.weekNumber);
      setIsConfirmingAssignment(false);
      setTimeStatus(getUoPeopleTimeStatus());
    }
  };

  const handleRegistrationBtnClick = () => {
    void requestDeadlineNotificationPermission();
    if (!isConfirmingRegistration) {
      setIsConfirmingRegistration(true);
      return;
    }
    if (activeRegAlert) {
      confirmRegistrationAcknowledgment(activeRegAlert.targetTermKey);
      setIsConfirmingRegistration(false);
      setTimeStatus(getUoPeopleTimeStatus());
    }
  };

  return (
    <div className="space-y-3">
      {/* Registration Period Alert Banner (24h, 12h, or Open Day — suppressed upon 2-step acknowledgment) */}
      {activeRegAlert && (
        <div
          className={`rounded-2xl border p-4 shadow-xl transition-all animate-in slide-in-from-top-4 duration-300 ${
            activeRegAlert.phase === '12h'
              ? 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/70 border-rose-500/60'
              : 'bg-gradient-to-r from-indigo-950/90 via-slate-900 to-blue-950/70 border-indigo-500/50'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl mt-0.5 shrink-0 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">{activeRegAlert.message}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {REGISTRATION_CLARIFICATION_NOTICE_MY}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 sm:self-center">
              <button
                type="button"
                onClick={handleRegistrationBtnClick}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${
                  isConfirmingRegistration
                    ? 'bg-amber-600 hover:bg-rose-600 text-white shadow-amber-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
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

      {/* Active Term Assignment Activity 24h / 12h Alert Banner OR Term Break Banner */}
      {!context.isTermBreak ? (
        activeAlert ? (
          <div
            className={`rounded-2xl border p-4 shadow-2xl transition-all animate-in slide-in-from-top-4 duration-300 ${
              activeAlert.isUrgent12h
                ? 'bg-gradient-to-r from-red-950/90 via-slate-900 to-red-950/70 border-red-500/60 shadow-red-500/20'
                : 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/70 border-amber-500/60 shadow-amber-500/20'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                    activeAlert.isUrgent12h
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {activeAlert.isUrgent12h ? (
                    <Flame className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700 text-slate-200">
                      {activeAlert.isUrgent12h
                        ? language === 'my'
                          ? '🚨 ၁၂ နာရီအလို အရေးပေါ်'
                          : '🚨 Under 12 Hours'
                        : language === 'my'
                        ? '⏰ ၂၄ နာရီအလို သတိပေးချက်'
                        : '⏰ 24-Hour Notice'}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {activeAlert.remainingHours}h {activeAlert.remainingMins}m{' '}
                      {language === 'my' ? 'ကျန်ရှိ' : 'remaining'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">
                    {activeAlert.alertBannerText}
                  </h4>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span className="flex items-center space-x-1">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        UoPeople Time:{' '}
                        <strong className="text-white">11:55 PM (23:55 GMT-5)</strong>
                      </span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {language === 'my' ? 'ဖုန်းဒေသစံတော်ချိန်:' : 'Local Time:'}{' '}
                        <strong className="text-emerald-300">
                          {activeAlert.localDeadlineStr}
                        </strong>
                      </span>
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    {THURSDAY_EXTENSION_NOTICE_MY}
                  </p>
                </div>
              </div>

              {/* Inline Two-Step Mark as Submitted Button */}
              <div className="flex items-center space-x-2 shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={handleAssignmentBtnClick}
                  className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all hover:scale-[1.02] cursor-pointer ${
                    isConfirmingAssignment
                      ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-rose-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isConfirmingAssignment
                      ? 'သေချာပါသလား? အတည်ပြုမည်'
                      : 'စာတင်ပြီးပါပြီ (Mark as Submitted)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null
      ) : (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/60 p-4 shadow-xl transition-all animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mt-0.5 shrink-0">
              <Coffee className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                  🏖️{' '}
                  {language === 'my'
                    ? 'Term Break ကာလ (Term မစသေးပါ)'
                    : 'UoPeople Term Break Active'}
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
      )}
    </div>
  );
};
