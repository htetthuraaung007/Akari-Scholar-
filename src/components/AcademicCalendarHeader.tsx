import React, { useState, useEffect } from 'react';

export interface AcademicCalendarHeaderProps {
  selectedUnit?: string;
  onUnitChange?: (unit: string) => void;
  onExportIcs?: () => void;
  // Term စတင်ရက် (UoPeople ကြာသပတေးနေ့ စတင်ရက်၊ Default: 2026-11-12)
  termStartDate?: string;
}

export const AcademicCalendarHeader: React.FC<AcademicCalendarHeaderProps> = ({
  selectedUnit = 'Unit 1',
  onUnitChange,
  onExportIcs,
  termStartDate = '2026-11-12',
}) => {
  const [currentUnit, setCurrentUnit] = useState(selectedUnit);
  // User ဘက်မှ Auto ရွေးချယ်ခွင့် ပေးမည့် Option (Default: ON)
  const [isAutoSync, setIsAutoSync] = useState(true);

  // Term အလိုက် အပတ်စဉ် ရက်စွဲကို တွက်ချက်ပြီး လက်ရှိရောက်နေသော Unit ကို Auto ရွေးထုတ်ပေးသည့် စနစ်
  const calculateCurrentUnitByDate = (): string => {
    const start = new Date(termStartDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Unit 1';
    
    // အပတ်စဉ် (၇ ရက်) အလိုက် Unit 1 မှ Unit 9 အထိ ခွဲခြားခြင်း
    const weekIndex = Math.floor(diffDays / 7) + 1;
    if (weekIndex >= 9) return 'Unit 9 (Final Exam)';
    return `Unit ${weekIndex}`;
  };

  // Component စဖွင့်ချိန် သို့မဟုတ် Auto Sync ဖွင့်ထားပါက Unit ကို အလိုအလျောက် ချိန်ညှိခြင်း
  useEffect(() => {
    if (isAutoSync) {
      const detectedUnit = calculateCurrentUnitByDate();
      setCurrentUnit(detectedUnit);
      if (onUnitChange) onUnitChange(detectedUnit);
    }
  }, [isAutoSync, termStartDate]);

  const handleUnitSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrentUnit(val);
    // User ကိုယ်တိုင် manual ရွေးချယ်လိုက်ပါက Auto Sync ကို အလိုအလျောက် ပိတ်ပေးခြင်း
    setIsAutoSync(false);
    if (onUnitChange) onUnitChange(val);
  };

  const handleToggleAuto = () => {
    const nextState = !isAutoSync;
    setIsAutoSync(nextState);
    if (nextState) {
      const detectedUnit = calculateCurrentUnitByDate();
      setCurrentUnit(detectedUnit);
      if (onUnitChange) onUnitChange(detectedUnit);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-[#080d1a] border border-slate-800 flex items-center justify-between flex-wrap gap-4">
      {/* ဘယ်ဘက် Title & Subtitle အပိုင်း */}
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
            <span>UoPeople Academic Calendar &amp; Study Rhythm</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            တရားဝင် UoPeople 2026-2027 ကျောင်းသုံးပြက္ခဒိန်၊ Term Break အားလပ်ရက်များနှင့် RFC 5545 ပြက္ခဒိန် ထုတ်ယူခြင်း
          </p>
        </div>
      </div>

      {/* ညာဘက် Auto Option, Dropdown (စာလုံးပေါင်းအမှန် "ယူနစ်:") နှင့် Export Button */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Term Badge */}
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#141b34] text-indigo-300 border border-indigo-800/40">
          TERM 2 (2026-2027)
        </span>

        {/* User Option: Auto Sync Toggle Button */}
        <button
          type="button"
          onClick={handleToggleAuto}
          title="အပတ်စဉ် ရက်စွဲအလိုက် အလိုအလျောက် သတ်မှတ်သည့် စနစ်"
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
            isAutoSync
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60 shadow'
              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isAutoSync ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span>Auto Sync: {isAutoSync ? 'ON' : 'OFF'}</span>
        </button>

        {/* Unit Dropdown Selector (စာလုံးပေါင်းအမှန်: ယူနစ်) */}
        <div className="relative">
          <select
            value={currentUnit}
            onChange={handleUnitSelect}
            className="appearance-none bg-[#0c1327] hover:bg-[#111a36] text-slate-200 border border-slate-700/80 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option value="Unit 1">ယူနစ်: Unit 1</option>
            <option value="Unit 2">ယူနစ်: Unit 2</option>
            <option value="Unit 3">ယူနစ်: Unit 3</option>
            <option value="Unit 4">ယူနစ်: Unit 4</option>
            <option value="Unit 5">ယူနစ်: Unit 5</option>
            <option value="Unit 6">ယူနစ်: Unit 6</option>
            <option value="Unit 7">ယူနစ်: Unit 7</option>
            <option value="Unit 8">ယူနစ်: Unit 8</option>
            <option value="Unit 9 (Final Exam)">ယူနစ်: Unit 9 (Final Exam)</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Export .ics Calendar Button */}
        <button
          type="button"
          onClick={onExportIcs}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>📥</span>
          <span>📅 Export .ics Calendar</span>
        </button>
      </div>
    </div>
  );
};
