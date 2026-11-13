import React from 'react';

export const AcademicIntegrityWarningBanner: React.FC = () => {
  return (
    <div className="my-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900/60 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-start gap-3">
        {/* Prominent Warning Icon */}
        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Warning Content */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-amber-300 tracking-wide">
              ⚠️ AI Detector သတိပေးချက်နှင့် ပညာရပ်ဆိုင်ရာ စည်းမျဉ်း (Academic Integrity Warning)
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/30">
              Probabilistic Notice
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-amber-200">မြန်မာဘာသာ:</span> Turnitin, ZeroGPT နှင့် GPTZero ကဲ့သို့သော AI Detection စနစ်များသည် ခန့်မှန်းခြေ (Probabilistic) တွက်ချက်မှုသာဖြစ်ပြီး <span className="underline decoration-amber-400/50 underline-offset-2">၁၀၀% အတိအကျ မှန်ကန်မှု မရှိပါ</span> (False positives များ ဖြစ်ပေါ်တတ်သည်)။ ဤကိရိယာသည် မူရင်းအဓိပ္ပာယ်ကို ပိုမိုရှင်းလင်းစေရန် ကူညီပေးသည့် စနစ်သာဖြစ်ပြီး တင်သွင်းခြင်းမပြုမီ သင်၏ ကိုယ်ပိုင်အရေးအသားဖြင့် ပြန်လည်စစ်ဆေးတည်းဖြတ်ရန် လိုအပ်ပါသည်။
          </p>

          <p className="text-[11px] text-slate-400 italic leading-normal">
            <span className="font-semibold text-slate-300 not-italic">English:</span> AI detectors produce probabilistic scores and false positives. Always review, verify citations, and integrate your own academic voice prior to final portal submission.
          </p>
        </div>
      </div>
    </div>
  );
};

interface AiDetectorAuditCardProps {
  text?: string;
  onReplaceText?: (newText: string) => void;
  language?: 'my' | 'en';
}

// Backward compatibility alias so components importing AiDetectorAuditCard render the warning banner cleanly
export const AiDetectorAuditCard: React.FC<AiDetectorAuditCardProps> = () => {
  return <AcademicIntegrityWarningBanner />;
};
