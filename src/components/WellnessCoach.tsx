import React, { useState, useEffect, useRef } from 'react';
import { Compass, ShieldCheck, Trash2 } from 'lucide-react';
import { checkAiQuota, recordAiUsage, QuotaState } from '../utils/aiQuotaGuard';
import { askWellnessCoach, resolveDynamicModelCatalog } from '../services/geminiService';

interface WellnessCoachProps {
  language?: 'my' | 'en';
}

interface PersistedWellnessState {
  anxietyInput: string;
  selectedPreset?: string;
  anxietyAdvice: string;
}

const WELLNESS_STATE_STORAGE_KEY = 'akari_wellness_coach_state_v2';
let activeWellnessInFlight = false;

function loadPersistedWellnessState(): PersistedWellnessState {
  if (typeof window === 'undefined') {
    return { anxietyInput: '', selectedPreset: undefined, anxietyAdvice: '' };
  }
  try {
    const raw = localStorage.getItem(WELLNESS_STATE_STORAGE_KEY);
    if (!raw) return { anxietyInput: '', selectedPreset: undefined, anxietyAdvice: '' };
    const parsed = JSON.parse(raw) as Partial<PersistedWellnessState>;
    return {
      anxietyInput: typeof parsed.anxietyInput === 'string' ? parsed.anxietyInput : '',
      selectedPreset: typeof parsed.selectedPreset === 'string' ? parsed.selectedPreset : undefined,
      anxietyAdvice: typeof parsed.anxietyAdvice === 'string' ? parsed.anxietyAdvice : '',
    };
  } catch {
    return { anxietyInput: '', selectedPreset: undefined, anxietyAdvice: '' };
  }
}

function savePersistedWellnessState(nextState: PersistedWellnessState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WELLNESS_STATE_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage quota issues
  }
}

const PRESET_SCENARIOS = [
  {
    en: 'I scored lower than expected on my recent assignment / quiz and feel discouraged.',
    my: 'မကြာသေးမီက စာမေးပွဲ/assignment အမှတ်နည်းသွားလို့ စိတ်ဓာတ်ကျပြီး GPA ကျသွားမည်ကို စိုးရိမ်နေပါသည်',
    badge: 'LOW SCORE SHOCK',
  },
  {
    en: "I'm falling behind on course readings and peer discussion posts this term.",
    my: 'ယခု Term မှာ စာဖတ်ချိန် မလောက်တော့ဘဲ Discussion Forum တွေ မလိုက်နိုင်တော့ဘူးလို့ ခံစားရပါသည်',
    badge: 'FALLING BEHIND',
  },
  {
    en: 'I feel like an impostor. Everyone around me seems smarter and faster than me.',
    my: 'တခြားသူတွေက ပိုတော်ပြီး ကိုယ်က မလိုက်နိုင်ဘူးလို့ ခံစားရပြီး စိတ်အားငယ်နေပါသည်',
    badge: 'IMPOSTOR SYNDROME',
  },
  {
    en: 'I am feeling emotionally drained, overwhelmed by daily life or work pressures, and struggling with self-doubt.',
    my: 'နေ့စဉ်ဘဝ၊ အလုပ် သို့မဟုတ် ကိုယ်ရေးကိုယ်တာ အခက်အခဲများကြောင့် စိတ်ပင်ပန်းနွမ်းနယ်ပြီး အားငယ်စိတ်ဓာတ်ကျသလို ခံစားနေရပါသည်',
    badge: '🌱 အထွေထွေ စိတ်ဖိစီးမှု & အားငယ်ခြင်း (General Burnout & Stress)',
  },
];

export const WellnessCoach: React.FC<WellnessCoachProps> = ({ language = 'my' }) => {
  const initialPersisted = useRef<PersistedWellnessState>(loadPersistedWellnessState()).current;

  const [anxietyInput, setAnxietyInput] = useState<string>(initialPersisted.anxietyInput);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(
    initialPersisted.selectedPreset
  );
  const [anxietyAdvice, setAnxietyAdvice] = useState<string>(initialPersisted.anxietyAdvice);
  const [isLoading, setIsLoading] = useState<boolean>(() => activeWellnessInFlight);
  const [anxietyError, setAnxietyError] = useState<string | null>(null);
  const [quotaState, setQuotaState] = useState<QuotaState>(() => checkAiQuota('wellness'));
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Non-blocking catalog warm-up on mount
    void resolveDynamicModelCatalog();

    // Sync persisted advice & in-flight state when returning from another tab
    const latest = loadPersistedWellnessState();
    setAnxietyAdvice(latest.anxietyAdvice);
    setAnxietyInput(latest.anxietyInput);
    setSelectedPreset(latest.selectedPreset);
    setIsLoading(activeWellnessInFlight);
    setQuotaState(checkAiQuota('wellness'));

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    savePersistedWellnessState({
      anxietyInput,
      selectedPreset,
      anxietyAdvice,
    });
  }, [anxietyInput, selectedPreset, anxietyAdvice]);

  const handleClearAdvice = () => {
    setAnxietyAdvice('');
    setAnxietyError(null);
    savePersistedWellnessState({
      anxietyInput,
      selectedPreset,
      anxietyAdvice: '',
    });
  };

  const handleSubmit = async () => {
    if (isLoading || activeWellnessInFlight) return;

    const currentQuota = checkAiQuota('wellness');
    setQuotaState(currentQuota);

    if (!currentQuota.canSend) {
      if (currentQuota.message) {
        setAnxietyError(currentQuota.message);
      }
      return;
    }

    const trimmed = anxietyInput.trim();
    if (!trimmed) return;

    setAnxietyError(null);
    activeWellnessInFlight = true;
    setIsLoading(true);

    try {
      const responseText = await askWellnessCoach(trimmed, selectedPreset, language);
      const finalAdvice = (responseText || '').trim();
      if (!finalAdvice) {
        throw new Error('Empty coaching response');
      }

      // Record daily fair-use count only after a successful response
      recordAiUsage('wellness');

      savePersistedWellnessState({
        anxietyInput: trimmed,
        selectedPreset,
        anxietyAdvice: finalAdvice,
      });

      if (isMountedRef.current) {
        setAnxietyAdvice(finalAdvice);
        setQuotaState(checkAiQuota('wellness'));
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err || '');
      const isExhausted =
        /429|RESOURCE_EXHAUSTED|quota|capacity|overloaded/i.test(rawMsg);
      const isInvalidKey =
        /API key not valid|API_KEY_INVALID|missing_key|401|403/i.test(rawMsg);

      const errorMessage =
        language === 'my'
          ? isInvalidKey
            ? '⚠️ ထည့်သွင်းထားသော Gemini API Key မှန်ကန်မှု မရှိသေးပါ။ Settings ထဲတွင် Key ကို ပြန်လည်စစ်ဆေးပေးပါ။'
            : isExhausted
              ? '⚠️ သိမ်းဆည်းထားသော API Key များနှင့် Free-Tier Model များအားလုံး ခေတ္တပြည့်နေပါသည်။ ခဏအကြာတွင် ပြန်လည်ကြိုးစားကြည့်ပါ (သို့မဟုတ် Backup Key အပိုထည့်သွင်းနိုင်ပါသည်)။'
              : `⚠️ တုံ့ပြန်မှုရယူရာတွင် ခေတ္တအခက်အခဲ ဖြစ်ပေါ်နေပါသည် (${rawMsg || 'Connection busy'})။ ထပ်မံကြိုးစားကြည့်ပါ။`
          : isInvalidKey
            ? '⚠️ The configured Gemini API key appears invalid. Please verify your key in Settings.'
            : isExhausted
              ? '⚠️ All configured API keys and free-tier models across the cascade pool are temporarily at capacity. Please try again shortly or add a backup key.'
              : `⚠️ Could not complete the request (${rawMsg || 'Connection busy'}). Please try again.`;

      if (isMountedRef.current) {
        setAnxietyError(errorMessage);
      }
    } finally {
      activeWellnessInFlight = false;
      if (isMountedRef.current) {
        setIsLoading(false);
        setQuotaState(checkAiQuota('wellness'));
      }
    }
  };

  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center flex-wrap gap-2">
              <span>
                {language === 'my'
                  ? 'Impostor Syndrome & စိတ်ဖိစီးမှု ခွန်အားဖြည့်စနစ်'
                  : 'Impostor Syndrome & Emotional Stress Grounding'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {language === 'my' ? 'စကားပြောဟန် သဘာဝလမ်းညွှန်' : 'Adaptive Empathetic Reframing'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'my'
                ? 'သင်ကြားရေး ဖိစီးမှုများသာမက နေ့စဉ်ဘဝနှင့် စိတ်ပိုင်းဆိုင်ရာ ပင်ပန်းနွမ်းနယ်မှုများအတွက်ပါ လက်တွေ့ကျပြီး နွေးထွေးသည့် လမ်းညွှန်ချက်များ'
                : 'Compassionate cognitive reframing, grounding exercises, and practical recovery steps for life or academic stress.'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Scenario Chips */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300">
          {language === 'my'
            ? 'လက်ရှိ ရင်ဆိုင်နေရသော အခြေအနေကို ရွေးချယ်ပါ (သို့မဟုတ် မိမိခံစားချက်ကို အောက်တွင် လွတ်လပ်စွာ ရိုက်ထည့်ပါ):'
            : 'Select a scenario or freely type whatever is on your mind below:'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {PRESET_SCENARIOS.map((sc, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setAnxietyInput(language === 'my' ? sc.my : sc.en);
                setSelectedPreset(sc.badge);
                setAnxietyError(null);
              }}
              className={`p-3 rounded-2xl bg-slate-950/70 border text-left transition-all hover:bg-slate-900 group cursor-pointer ${
                selectedPreset === sc.badge
                  ? 'border-indigo-500/70 bg-indigo-950/30'
                  : 'border-slate-800 hover:border-indigo-500/50'
              }`}
            >
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                {sc.badge}
              </span>
              <span className="text-slate-300 group-hover:text-white transition-colors line-clamp-2">
                {language === 'my' ? sc.my : sc.en}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Accurate Key-Ownership Advisory Warning */}
      <div className="mb-4 p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-start gap-3 shadow-md">
        <span className="text-amber-400 text-sm mt-0.5">⚠️</span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
            <span className="text-xs font-bold text-amber-300">
              သင့် Gemini API Key အသုံးပြုမှုနှင့် Fair-Use သတိပေးချက်
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
              📊 ယနေ့ အသုံးပြုနိုင်မှု: {quotaState.remainingToday}/5 ကြိမ် ကျန်ရှိ
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            ဤစနစ်သည် <span className="text-amber-200 font-semibold underline underline-offset-2">သင်ကိုယ်တိုင် ထည့်သွင်းထားသော Gemini API Key</span> ကို သင့် Browser ပေါ်တွင်သာ တိုက်ရိုက် ခေါ်ယူအသုံးပြုခြင်း ဖြစ်ပါသည်။ Server ပေါ်တွင် မည်သည့် Data မှ သိမ်းဆည်းခြင်း မရှိပါ။ သင့် Key ၏ တစ်ရက်တာ အခမဲ့ခွဲတမ်း (Free Quota) မကုန်ဆုံးစေရန်နှင့် အမှန်တကယ် လိုအပ်သော အခိုက်အတန့်များတွင်သာ ကိုယ်တိုင် ချင့်ချိန် အသုံးပြုပေးပါရန် အလေးအနက် မေတ္တာရပ်ခံအပ်ပါသည်။
          </p>
        </div>
      </div>

      {/* Input & Submission */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={anxietyInput}
            onChange={(e) => {
              const nextVal = e.target.value;
              setAnxietyInput(nextVal);
              if (selectedPreset) {
                const matchedPreset = PRESET_SCENARIOS.find((s) => s.badge === selectedPreset);
                const presetText = matchedPreset
                  ? language === 'my'
                    ? matchedPreset.my
                    : matchedPreset.en
                  : '';
                if (nextVal !== presetText) {
                  setSelectedPreset(undefined);
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading && anxietyInput.trim() && quotaState.canSend) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={quotaState.remainingToday <= 0}
            placeholder={
              language === 'my'
                ? 'သင့်စိတ်ထဲတွင် စိုးရိမ်ပူပန်နေသောအရာ၊ စိတ်ဖိစီးမှု သို့မဟုတ် ကြုံတွေ့နေရသော အခက်အခဲများကို လွတ်လပ်စွာ ရေးသားပါ...'
                : 'Freely share whatever worry, stress, burnout, or personal/academic difficulty is on your mind...'
            }
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!quotaState.canSend || isLoading || !anxietyInput.trim()}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>စဉ်းစားနေသည်...</span>
              </>
            ) : (
              <span>🚀 ခွန်အားယူမည်</span>
            )}
          </button>
        </div>

        {/* Daily Limit Status Banner */}
        {quotaState.remainingToday <= 0 && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 font-medium">
            သင့် Gemini API Key ၏ ယနေ့အတွက် သတ်မှတ်ထားသော အကြိမ်ရေ (၅ ကြိမ်) ပြည့်သွားပါပြီ။ မနက်ဖြန်တွင် ပြန်လည်အသုံးပြုနိုင်ပါသည်။
          </div>
        )}

        {anxietyError && quotaState.remainingToday > 0 && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 leading-relaxed">
            {anxietyError}
          </div>
        )}

        {anxietyAdvice ? (
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {language === 'my'
                    ? 'စိတ်အေးချမ်းစေမည့် လမ်းညွှန်ချက်:'
                    : 'Empathetic Grounding & Perspective:'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearAdvice}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                title={language === 'my' ? 'လမ်းညွှန်ချက်ကို ရှင်းမည်' : 'Clear advice card'}
              >
                <Trash2 className="w-3 h-3" />
                <span>{language === 'my' ? 'ရှင်းမည်' : 'Clear'}</span>
              </button>
            </div>
            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {anxietyAdvice}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
            {language === 'my'
              ? 'ရင်ဆိုင်နေရသော အခက်အခဲကို ရွေးချယ်ပါ သို့မဟုတ် စာရိုက်ထည့်ပါ'
              : 'Select a scenario above or type what is on your mind to receive compassionate grounding.'}
          </div>
        )}
      </div>
    </div>
  );
};

