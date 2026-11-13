import React, { useState } from 'react';

interface ResearchClearActionProps {
  onConfirmClear: () => void;
  disabled?: boolean;
  label?: string;
  confirmTitle?: string;
  confirmMessage?: string;
}

export const ResearchClearAction: React.FC<ResearchClearActionProps> = ({
  onConfirmClear,
  disabled = false,
  label = '🗑️ ရှင်းထုတ်မည် (Clear All)',
  confirmTitle = 'အချက်အလက်များ အားလုံး ရှင်းလင်းမည်လား?',
  confirmMessage = 'လက်ရှိ ထည့်သွင်းထားသော စာသားများ၊ ဖိုင်များနှင့် ထုတ်ယူထားသော ရလဒ်များအားလုံးကို ရှင်းထုတ်ပါမည်။ ဤလုပ်ဆောင်ချက်ကို ပြန်မဖော်နိုင်ပါ။',
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={disabled}
        className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 border border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
        title="ထည့်သွင်းထားသော အချက်အလက်နှင့် ရလဒ်များအားလုံးကို ရှင်းထုတ်မည်"
      >
        <span>{label}</span>
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <span>🗑️</span>
                <span>{confirmTitle}</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">{confirmMessage}</p>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                မလုပ်တော့ပါ (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onConfirmClear();
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/50 transition-colors cursor-pointer"
              >
                အတည်ပြု ရှင်းထုတ်မည် (Clear)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
