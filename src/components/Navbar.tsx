import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import {
  ShieldCheck,
  Lock,
  Trash2,
  Key,
  Globe,
  Flame,
  GraduationCap,
  Sparkles,
  Eye,
  Moon,
  Clock,
  Calendar,
  ChevronDown,
  Music,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { getUoPeopleTimeStatus, UoPeopleTimeStatus } from '../utils/uopeopleTime';

// Live Dual Clock Badge for Header
const UoPeopleTimeBadge: React.FC = () => {
  const { language } = useApp();
  const [status, setStatus] = useState<UoPeopleTimeStatus>(getUoPeopleTimeStatus());
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(getUoPeopleTimeStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const discHours = Math.floor(status.discussionRemainingMs / 3600000);
  const discMins = Math.floor((status.discussionRemainingMs % 3600000) / 60000);
  const actHours = Math.floor(status.activityRemainingMs / 3600000);
  const actMins = Math.floor((status.activityRemainingMs % 3600000) / 60000);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-500/60 text-slate-200 hover:text-white transition-all text-xs font-mono shadow-sm group cursor-pointer"
        title="UoPeople Server Time (GMT-5) & Device Local Time. Click for live deadline countdowns."
      >
        <Clock className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform" />
        
        {/* Live dual clock display */}
        <div className="flex items-center space-x-1.5 text-[11px]">
          <span className="font-semibold text-indigo-300">
            UoPeople <span className="text-white font-bold">{status.uopFormattedTime}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-300">
            {language === 'my' ? 'မိမိစံတော်ချိန်' : 'Local'} <span className="text-emerald-200 font-bold">{status.localFormattedTime}</span>
          </span>
        </div>

        <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
      </button>

      {/* Popover Breakdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-indigo-500/40 p-4 shadow-2xl z-50 text-xs text-slate-300 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-white text-sm">
                {language === 'my' ? 'UoPeople စံတော်ချိန် နှင့် ဖုန်းစံတော်ချိန်' : 'UoPeople Academic Time Sync'}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              GMT-5 Sync
            </span>
          </div>

          {/* Current Live Times */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-indigo-400 mb-1">
                UoPeople Time (GMT-5)
              </div>
              <div className="text-base font-extrabold text-white font-mono">
                {status.uopFormattedTime}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {status.uopFormattedDate}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1">
                {language === 'my' ? 'မိမိဒေသ စံတော်ချိန် (Local Time)' : 'Device Local Time'}
              </div>
              <div className="text-base font-extrabold text-white font-mono">
                {status.localFormattedTime}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={status.localTimezone}>
                {status.localTimezone}
              </div>
            </div>
          </div>

          {/* Live Deadlines Countdowns */}
          <div className="space-y-2 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-200">
                  {language === 'my' ? 'Discussion Assignment Deadline' : 'Discussion Forum Deadline'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {language === 'my' ? 'အပတ်စဉ် တနင်္ဂနွေနေ့ ည ၁၁:၅၉ (UoPeople Time)' : 'Every Sunday 11:59 PM (GMT-5)'}
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-bold text-amber-400">
                  {discHours}h {discMins}m
                </span>
                <div className="text-[10px] text-slate-500">
                  {language === 'my' ? 'ကျန်ရှိ' : 'remaining'}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-200">
                  {language === 'my' ? 'Assignment Activity Deadline' : 'Assignment Activity Deadline'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {language === 'my' ? 'အပတ်စဉ် ဗုဒ္ဓဟူးနေ့ ည ၁၁:၅၉ (UoPeople Time)' : 'Every Wednesday 11:59 PM (GMT-5)'}
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-bold text-indigo-400">
                  {actHours}h {actMins}m
                </span>
                <div className="text-[10px] text-slate-500">
                  {language === 'my' ? 'ကျန်ရှိ' : 'remaining'}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
            {language === 'my'
              ? '💡 အသုံးပြုသူ စက်ပစ္စည်း၏ ဒေသစံတော်ချိန်ကို တိုက်ရိုက်တွက်ချက်ထားသဖြင့် VPN ဖွင့်ထားသော်လည်း အချိန်မှားယွင်းခြင်း မရှိပါ။'
              : '💡 Device time is read directly from your system clock and remains accurate regardless of active VPN tunnels.'}
          </p>
        </div>
      )}
    </div>
  );
};

interface NavbarProps {
  onOpenPrivacyModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenPrivacyModal }) => {
  const {
    language,
    setLanguage,
    panicClearData,
    eyecareMode,
    toggleEyecareMode,
    apiHealth,
    checkApiHealth,
  } = useApp();
  const t = translations[language];
  const [showConfirmWipe, setShowConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [floatingPlayerStatus, setFloatingPlayerStatus] = useState<{
    isOpen: boolean;
    isPlaying: boolean;
  }>({ isOpen: false, isPlaying: false });

  useEffect(() => {
    const handleStateSync = (e: Event) => {
      const detail = (e as CustomEvent<{ isOpen?: boolean; isPlaying?: boolean }>).detail;
      if (detail) {
        setFloatingPlayerStatus({
          isOpen: Boolean(detail.isOpen),
          isPlaying: Boolean(detail.isPlaying),
        });
      }
    };
    window.addEventListener('akari_floating_player_state', handleStateSync);
    return () => window.removeEventListener('akari_floating_player_state', handleStateSync);
  }, []);

  const handleConfirmWipe = async () => {
    setWiping(true);
    await panicClearData();
    setWiping(false);
    setShowConfirmWipe(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg text-white tracking-tight">
                    {t.appName}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Free / အခမဲ့
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block truncate max-w-sm">
                  {t.appSubtitle}
                </p>
              </div>
            </div>

            {/* Right Action Bar */}
            <div className="flex items-center space-x-1.5 sm:space-x-2.5">
              {/* PWA Install Button */}
              <PWAInstallButton />

              {/* UoPeople Time & Local Phone Time Live Dual Clock */}
              <UoPeopleTimeBadge />

              {/* API Key Health & Quota Indicator (Live) */}
              <button
                type="button"
                onClick={checkApiHealth}
                className={`group flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  apiHealth.status === 'healthy'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                    : apiHealth.status === 'checking'
                    ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300 animate-pulse'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/40'
                }`}
                title={`Live Gemini API Status: ${apiHealth.message}. Click to re-test roundtrip latency.`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiHealth.status === 'healthy'
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                      : apiHealth.status === 'checking'
                      ? 'bg-indigo-400 animate-ping'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="hidden sm:inline font-mono text-[11px] font-bold">
                  {apiHealth.status === 'healthy'
                    ? `API ${apiHealth.latencyMs}ms`
                    : apiHealth.status === 'checking'
                    ? 'Testing...'
                    : 'API Check'}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-white hidden lg:inline">
                  ({apiHealth.quotaIndicator || 'optimal'})
                </span>
              </button>

              {/* Eye-care Low-Light Theme Toggle */}
              <button
                type="button"
                onClick={toggleEyecareMode}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  eyecareMode
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
                title={
                  eyecareMode
                    ? 'Eye-care Dark Theme Active (Low Blue-Light). Click to switch to Standard Dark.'
                    : 'Switch to Eye-care Low-Light Theme (Reduces blue light & eye strain for night study).'
                }
              >
                {eyecareMode ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
                <span className="hidden md:inline text-[11px]">
                  {eyecareMode ? 'Eye-care ON' : 'Night Mode'}
                </span>
              </button>

              {/* Floating Study Music Mini-Player Launcher */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('akari_toggle_floating_player'))}
                className={`relative flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  floatingPlayerStatus.isOpen || floatingPlayerStatus.isPlaying
                    ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-300 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
                title={
                  language === 'my'
                    ? 'Study Music Floating Player ဖွင့်/ပိတ်မည်'
                    : 'Toggle Floating Study Music Mini-Player'
                }
              >
                <Music
                  className={`w-3.5 h-3.5 ${
                    floatingPlayerStatus.isPlaying
                      ? 'text-emerald-400 animate-pulse'
                      : floatingPlayerStatus.isOpen
                      ? 'text-indigo-400'
                      : 'text-slate-400'
                  }`}
                />
                {floatingPlayerStatus.isPlaying && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>

              {/* Privacy Badge */}
              <div
                onClick={onOpenPrivacyModal}
                className="cursor-pointer group flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-900/40 transition-colors"
                title={t.privacyBadgeTooltip}
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline font-mono text-[11px] font-semibold">
                  {t.privacyBadge}
                </span>
                <span className="xl:hidden text-[11px] font-semibold">Zero-Cloud</span>
              </div>

              {/* Language Switcher */}
              <button
                onClick={() => setLanguage(language === 'my' ? 'en' : 'my')}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:border-slate-700 hover:text-white transition-colors"
                title="Change language / ဘာသာစကား ပြောင်းလဲရန်"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>{language === 'my' ? 'EN' : 'မြန်မာ'}</span>
              </button>

              {/* API & Privacy Settings */}
              <button
                onClick={onOpenPrivacyModal}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                title={t.apiSettings}
              >
                <Key className="w-4 h-4 text-violet-400" />
              </button>

              {/* Panic Wipe Button (Library & Cafe Safety) */}
              <button
                onClick={() => setShowConfirmWipe(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-900/40 hover:border-red-500/50 transition-colors"
                title={t.panicClear}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden 2xl:inline">{t.panicClear}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Panic Wipe Confirmation Modal */}
      {showConfirmWipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{t.panicClear}</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {t.panicClearConfirm}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                disabled={wiping}
                onClick={() => setShowConfirmWipe(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                {t.common.cancel}
              </button>
              <button
                disabled={wiping}
                onClick={handleConfirmWipe}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 flex items-center space-x-2"
              >
                {wiping ? (
                  <span>Clearing...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Wipe / အားလုံးဖျက်မည်</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
