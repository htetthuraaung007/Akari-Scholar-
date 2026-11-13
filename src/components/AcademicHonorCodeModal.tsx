import React from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import { ShieldCheck, GraduationCap, CheckCircle2 } from 'lucide-react';

export const AcademicHonorCodeModal: React.FC = () => {
  const { settings, updateSettings, language } = useApp();
  const t = translations[language];

  if (settings.honorCodeAccepted) return null;

  const handleAccept = () => {
    updateSettings({ honorCodeAccepted: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
          <GraduationCap className="w-6 h-6" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {t.honorCodeTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t.honorCodeDesc}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {language === 'my'
                ? 'AI ကို အိုင်ဒီယာ ထုတ်ဖော်ခြင်း၊ Outline ရေးဆွဲခြင်းနှင့် လမ်းပြဆွေးနွေးရန်သာ အသုံးပြုမည်။'
                : 'Use AI as a thought partner, Socratic mentor, and conceptual guide.'}
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {language === 'my'
                ? 'အချက်အလက်အားလုံးကို Browser ထဲတွင်သာ လျှို့ဝှက်ကုဒ်ဖြင့် သိမ်းမည်ဖြစ်ပြီး ပြင်ပသို့ မပေါက်ကြားစေပါ။'
                : 'All drafts remain client-side encrypted with zero cloud surveillance.'}
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {language === 'my'
                ? 'Reference အစစ်အမှန်များနှင့် မိမိကိုယ်ပိုင် တွေးခေါ်မှုဖြင့်သာ စာတမ်းများကို ရေးသားမည်။'
                : 'Uphold academic rigor by verifying empirical sources and maintaining personal voice.'}
            </span>
          </div>
        </div>

        <button
          onClick={handleAccept}
          className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all"
        >
          {t.honorCodeAccept}
        </button>
      </div>
    </div>
  );
};
