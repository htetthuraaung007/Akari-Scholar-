import React, { useState } from 'react';
import { useApi, cleanGeminiKey, testGeminiApiKey } from '../context/ApiContext';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Key,
  ExternalLink,
  X,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';

interface QuotaExhaustedModalProps {
  onOpenSettings?: () => void;
}

export const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({ onOpenSettings }) => {
  const {
    isQuotaModalOpen,
    setIsQuotaModalOpen,
    quotaTimerFormatted,
    checkPoolHealth,
    isProbing,
    primaryApiKey,
    backupApiKey,
    setBackupApiKey,
    replaceActiveKeyAndRetry,
  } = useApi();
  const { language } = useApp();

  const [showKeyInputPopover, setShowKeyInputPopover] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [targetSlot, setTargetSlot] = useState<'primary' | 'backup'>('primary');
  const [isVerifying, setIsVerifying] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isQuotaModalOpen) return null;

  const handleTestOnly = async () => {
    setIsVerifying(true);
    setKeyError(null);
    setSuccessToast(null);
    try {
      const res = await testGeminiApiKey(newKeyValue);
      if (res.success) {
        setSuccessToast(`✅ API Key မှန်ကန်ပြီး တိုက်ရိုက်အသုံးပြုနိုင်ပါသည် (${res.latency}ms)`);
      } else {
        setKeyError(`❌ ${res.message}`);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = cleanGeminiKey(newKeyValue);
    if (!cleanKey || cleanKey.length < 8) {
      setKeyError('Key မပြည့်စုံပါ။ ကျေးဇူးပြု၍ စာလုံးအပြည့်အစုံ ကူးထည့်ပေးပါ။');
      return;
    }

    setIsVerifying(true);
    setKeyError(null);
    try {
      const testRes = await testGeminiApiKey(cleanKey);
      if (!testRes.success) {
        setKeyError(`❌ ${testRes.message}`);
        return;
      }

      setSuccessToast(`✅ API Key မှန်ကန်ပြီး တိုက်ရိုက်အသုံးပြုနိုင်ပါသည် (${testRes.latency}ms)`);

      if (targetSlot === 'primary') {
        localStorage.setItem('akari_gemini_api_key_primary', cleanKey);
        localStorage.setItem('akari_primary_gemini_key', cleanKey);
        localStorage.setItem('gemini_api_key', cleanKey);
        await replaceActiveKeyAndRetry(cleanKey);
      } else {
        localStorage.setItem('akari_gemini_api_key_backup', cleanKey);
        localStorage.setItem('akari_backup_gemini_key', cleanKey);
        setBackupApiKey(cleanKey);
      }

      setTimeout(() => {
        setIsQuotaModalOpen(false);
        setShowKeyInputPopover(false);
        setNewKeyValue('');
        setSuccessToast(null);
      }, 900);
    } catch (err: any) {
      setKeyError(err?.message || '❌ Google မှ ဤ API Key ကို လက်မခံပါ။');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/50 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-5">
        <button
          onClick={() => setIsQuotaModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Interactive Header */}
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {language === 'my'
                ? '⚠️ Gemini Free Quota ပြည့်သွားပါသည်'
                : '⚠️ Gemini Free Quota Limit Reached'}
            </h3>
            <p className="text-xs text-amber-300/90 mt-0.5">
              HTTP 429 · Free-Model Auto-Cascade Paused
            </p>
          </div>
        </div>

        {/* DIRECT ACTION: Instant Key Switcher Popover / Form */}
        {showKeyInputPopover ? (
          <form
            onSubmit={handleVerifyAndSave}
            className="p-5 rounded-2xl bg-slate-950 border border-violet-500/50 space-y-4 animate-in fade-in shadow-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-300 flex items-center space-x-1.5 uppercase tracking-wider">
                <Key className="w-4 h-4 text-violet-400" />
                <span>API Key အသစ် ချက်ချင်း ထည့်သွင်းမည်</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowKeyInputPopover(false);
                  setKeyError(null);
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Google AI Studio မှ အခမဲ့ ရယူထားသော Gemini API Key
              </label>
              <input
                type="password"
                required
                value={newKeyValue}
                onChange={(e) => {
                  setNewKeyValue(e.target.value);
                  setKeyError(null);
                  setSuccessToast(null);
                }}
                placeholder="Paste Gemini API Key (AQ... or AIza...)"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>

            {isVerifying && (
              <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200 flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                <span>🔄 Google Server သို့ စမ်းသပ်ချိတ်ဆက်နေပါသည်...</span>
              </div>
            )}

            {!isVerifying && keyError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 leading-relaxed">
                {keyError}
              </div>
            )}

            {!isVerifying && successToast && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300 font-semibold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successToast}</span>
              </div>
            )}

            {/* Target Slot Toggle */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-slate-400">Save as:</span>
              <button
                type="button"
                onClick={() => setTargetSlot('primary')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  targetSlot === 'primary'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-900 text-slate-400'
                }`}
              >
                Primary Key (Replace &amp; Retry)
              </button>
              <button
                type="button"
                onClick={() => setTargetSlot('backup')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  targetSlot === 'backup'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-900 text-slate-400'
                }`}
              >
                Backup Key
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-violet-400 hover:underline flex items-center space-x-1"
              >
                <span>🔑 Get Key from Google AI Studio ↗</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestOnly}
                  disabled={isVerifying || !newKeyValue.trim()}
                  className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>🧪 Test Key</span>
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !newKeyValue.trim()}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                  <span>💾 Save &amp; Activate</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-950 border border-violet-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>
                  {language === 'my'
                    ? 'စောင့်ဆိုင်းစရာမလိုဘဲ ချက်ချင်း ဆက်လုပ်ရန်'
                    : 'Bypass Lockout Instantly with a Fresh Key'}
                </span>
              </span>
              <p className="text-[11px] text-slate-300">
                {language === 'my'
                  ? 'Key အသစ် ထည့်သွင်းပြီး မူလမေးခွန်းများကို ချက်ချင်း ပြန်လည်ထုတ်ယူနိုင်ပါသည်'
                  : 'Enter a fresh API key and the pending generation will resume on the spot.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyInputPopover(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 shrink-0 flex items-center justify-center space-x-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>🔑 API Key အသစ် ချက်ချင်း ထည့်သွင်းမည် (Switch Key)</span>
            </button>
          </div>
        )}

        {/* Countdown & Auto-Probe Notice */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {language === 'my'
                ? 'Pacific Midnight Quota ပြန်လည် Reset ဖြစ်ရန် စောင့်ဆိုင်းချိန်:'
                : 'Pacific Midnight Quota Reset Countdown:'}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-amber-400 tracking-wider">
            {quotaTimerFormatted}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-2">
            {language === 'my'
              ? 'စနစ်မှ ၆၀ စက္ကန့်တိုင်း အလိုအလျောက် စစ်ဆေးပေးနေပြီး Quota ပြန်လည်ရရှိပါက အလိုအလျောက် ပြန်လည်အသုံးပြုနိုင်ပါမည်။'
              : 'Auto-probing every 60 seconds with exponential backoff. Service unlocks automatically when Google resets your quota.'}
          </p>
        </div>

        {/* Dual-Key Status Overview */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">
              Primary Key Status
            </span>
            <span className="font-mono text-slate-300">
              {primaryApiKey ? `${primaryApiKey.slice(0, 8)}...` : 'Not Configured'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">
              Backup Key Status
            </span>
            <span className="font-mono text-slate-300">
              {backupApiKey ? `${backupApiKey.slice(0, 8)}...` : 'Not Configured'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => checkPoolHealth()}
            disabled={isProbing}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
            <span>
              {isProbing
                ? language === 'my'
                  ? 'စစ်ဆေးနေသည်...'
                  : 'Probing...'
                : language === 'my'
                ? 'ပြန်လည်စစ်ဆေးမည်'
                : 'Check Now'}
            </span>
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                setIsQuotaModalOpen(false);
                onOpenSettings();
              }}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              <span>Manage Key Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
