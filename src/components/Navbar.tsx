import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../context/ApiContext';
import { translations } from '../translations';
import {
  Lock,
  Trash2,
  Key,
  Globe,
  GraduationCap,
  Eye,
  Moon,
  Clock,
  ChevronDown,
  Music,
  Menu,
  X,
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
        className="w-full lg:w-auto min-h-[44px] lg:min-h-0 flex items-center justify-between lg:justify-start space-x-1.5 px-3 lg:px-2.5 py-2 lg:py-1.5 rounded-xl lg:rounded-lg bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-500/60 text-slate-200 hover:text-white transition-all text-xs font-mono shadow-sm group cursor-pointer whitespace-nowrap shrink-0"
        title="UoPeople Server Time (GMT-5) & Device Local Time. Click for live deadline countdowns."
      >
        <div className="flex items-center space-x-1.5 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform shrink-0" />
          {/* Live dual clock display */}
          <div className="flex items-center space-x-1.5 text-[11px] whitespace-nowrap">
            <span className="font-semibold text-indigo-300">
              UoPeople <span className="text-white font-bold">{status.uopFormattedTime}</span>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-300">
              {language === 'my' ? 'မိမိစံတော်ချိန်' : 'Local'}{' '}
              <span className="text-emerald-200 font-bold">{status.localFormattedTime}</span>
            </span>
          </div>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
      </button>

      {/* Popover Breakdown */}
      {open && (
        <div className="left-0 lg:left-auto lg:right-0 absolute mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl bg-slate-900 border border-indigo-500/40 p-4 shadow-2xl z-50 text-xs text-slate-300 animate-in fade-in slide-in-from-top-2">
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
    settings,
  } = useApp();
  const { activeKey, primaryApiKey } = useApi();
  const t = translations[language];
  const [showConfirmWipe, setShowConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [floatingPlayerStatus, setFloatingPlayerStatus] = useState<{
    isOpen: boolean;
    isPlaying: boolean;
  }>({ isOpen: false, isPlaying: false });

  const hasSavedKey = Boolean(activeKey || primaryApiKey || settings.customGeminiKey);

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

  const isKeyActive = Boolean(hasSavedKey || apiHealth.status === 'healthy');

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* ZONE 1 (LEFT): App Logo + Title Badge */}
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 whitespace-nowrap">
                  <span className="font-extrabold text-sm sm:text-base lg:text-lg text-white tracking-tight truncate">
                    {t.appName}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0">
                    Free / အခမဲ့
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden xl:block truncate max-w-xs">
                  {t.appSubtitle}
                </p>
              </div>
            </div>

            {/* ZONE 2 (CENTER - DESKTOP >= 1024px): UoPeople Clocks & Timezone Badge */}
            <div className="hidden lg:flex items-center justify-center shrink-0">
              <UoPeopleTimeBadge />
            </div>

            {/* ZONE 3 (RIGHT - MOBILE & TABLET < 1024px): Prominent 🔑 API Key Button + Hamburger Menu */}
            <div className="flex lg:hidden items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenPrivacyModal}
                className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border text-xs font-extrabold tracking-wide flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                  isKeyActive
                    ? 'bg-slate-950/90 border-emerald-500/50 text-emerald-200 hover:bg-slate-900'
                    : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/80 text-white shadow-indigo-950/60'
                }`}
                title="Open Gemini API Key Vault"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isKeyActive
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                      : 'bg-rose-500 animate-pulse'
                  }`}
                />
                <span>🔑 API Key</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Toggle mobile tools menu"
                title="Tools, Timezones & Settings"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {/* ZONE 3 (RIGHT - DESKTOP >= 1024px): Clean Action Controls */}
            <div className="hidden lg:flex items-center space-x-2 shrink-0">
              {/* Optional PWA Install Button */}
              <PWAInstallButton />

              {/* Prominent API Key Vault Trigger (with live status dot & latency) */}
              <button
                type="button"
                onClick={onOpenPrivacyModal}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-sm ${
                  isKeyActive
                    ? 'bg-slate-950/90 border-emerald-500/40 text-slate-100 hover:border-emerald-400/70 hover:bg-slate-900'
                    : 'bg-slate-950/90 border-rose-500/40 text-slate-100 hover:border-rose-400/70 hover:bg-slate-900'
                }`}
                title={`Open Gemini API Key Vault (${apiHealth.message})`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    apiHealth.status === 'checking'
                      ? 'bg-indigo-400 animate-ping'
                      : isKeyActive
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                      : 'bg-rose-500'
                  }`}
                />
                <span>🔑 API Key Vault</span>
                {apiHealth.latencyMs > 0 && isKeyActive && (
                  <span className="font-mono text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {apiHealth.latencyMs}ms
                  </span>
                )}
              </button>

              {/* Audio Studio Mini Toggle */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('akari_toggle_floating_player'))}
                className={`relative flex items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  floatingPlayerStatus.isOpen || floatingPlayerStatus.isPlaying
                    ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-300 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
                title={
                  language === 'my'
                    ? 'Study Music Floating Player ဖွင့်/ပိတ်မည်'
                    : 'Toggle Floating Study Music Mini-Player'
                }
              >
                <Music
                  className={`w-4 h-4 ${
                    floatingPlayerStatus.isPlaying
                      ? 'text-emerald-400 animate-pulse'
                      : floatingPlayerStatus.isOpen
                      ? 'text-indigo-400'
                      : 'text-slate-400'
                  }`}
                />
                {floatingPlayerStatus.isPlaying && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>

              {/* Language Switcher (EN / မြန်မာ) */}
              <button
                type="button"
                onClick={() => setLanguage(language === 'my' ? 'en' : 'my')}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold hover:border-slate-700 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Change language / ဘာသာစကား ပြောင်းလဲရန်"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{language === 'my' ? 'EN' : 'မြန်မာ'}</span>
              </button>

              {/* Theme Toggle (Night Mode / Eye-care ON) */}
              <button
                type="button"
                onClick={toggleEyecareMode}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  eyecareMode
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
                title={
                  eyecareMode
                    ? 'Eye-care Dark Theme Active (Low Blue-Light). Click to switch to Standard Dark.'
                    : 'Switch to Eye-care Low-Light Theme (Reduces blue light & eye strain for night study).'
                }
              >
                {eyecareMode ? (
                  <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="text-[11px]">
                  {eyecareMode ? 'Eye-care ON' : 'Night Mode'}
                </span>
              </button>

              {/* Compact Emergency Wipe Icon Button (With Tooltip) */}
              <button
                type="button"
                onClick={() => setShowConfirmWipe(true)}
                className="p-2 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 hover:bg-red-900/40 hover:border-red-500/50 hover:text-red-300 transition-colors cursor-pointer shrink-0"
                title={t.panicClear}
                aria-label={t.panicClear}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* COLLAPSIBLE MOBILE & TABLET DRAWER (< 1024px) */}
          {mobileMenuOpen && (
            <div className="lg:hidden pt-3 pb-1 mt-2.5 border-t border-slate-800/80 space-y-3 animate-in fade-in slide-in-from-top-1">
              {/* Row 1: UoPeople Live Dual Clock & Install App */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1">
                  <UoPeopleTimeBadge />
                </div>
                <div className="flex items-center gap-2">
                  <PWAInstallButton />
                  <button
                    type="button"
                    onClick={() => {
                      checkApiHealth();
                    }}
                    className={`flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isKeyActive
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isKeyActive ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    />
                    <span>
                      {apiHealth.status === 'checking'
                        ? 'Testing API...'
                        : isKeyActive && apiHealth.latencyMs > 0
                        ? `API (${apiHealth.latencyMs}ms)`
                        : 'Check API'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Row 2: Touch-Friendly Quick Utility Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleEyecareMode();
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[44px] flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    eyecareMode
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  {eyecareMode ? <Eye className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-slate-400 shrink-0" />}
                  <span>{eyecareMode ? 'Eye-care ON' : 'Night Mode'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('akari_toggle_floating_player'));
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[44px] flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    floatingPlayerStatus.isOpen || floatingPlayerStatus.isPlaying
                      ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-300'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <Music className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Study Music</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLanguage(language === 'my' ? 'en' : 'my');
                    setMobileMenuOpen(false);
                  }}
                  className="min-h-[44px] flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{language === 'my' ? 'Switch to EN' : 'မြန်မာဘာသာ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowConfirmWipe(true);
                  }}
                  className="min-h-[44px] flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Emergency Wipe</span>
                </button>
              </div>
            </div>
          )}
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
