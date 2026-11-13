import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

interface ReferenceAuditItem {
  rawEntry: string;
  author: string;
  year: number | null;
  age: number | null;
  status: 'Fresh (<= 5 yrs)' | 'Acceptable (6-10 yrs)' | 'Outdated (> 10 yrs)' | 'Unknown Year';
  statusColor: string;
  recommendation: string;
}

interface RecencySummary {
  totalCount: number;
  freshCount: number;
  acceptableCount: number;
  outdatedCount: number;
  recencyRate: number; // % within last 5 years
  verdict: 'Excellent (Pass APA 7th)' | 'Needs Updating' | 'High Risk of Deduction';
}

const CURRENT_YEAR = 2026;

export const ScholarlySourceFinder: React.FC = () => {
  const [activeSubMode, setActiveSubMode] = useState<'search' | 'verify' | 'recency'>('search');

  // Common Search / Verification States
  const [inputText, setInputText] = useState('');
  const [fileStats, setFileStats] = useState<string | null>(null);

  // Recency Auditor States
  const [recencyInput, setRecencyInput] = useState('');
  const [auditItems, setAuditItems] = useState<ReferenceAuditItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<RecencySummary | null>(null);

  // Helper: Extract References section if an entire paper is uploaded
  const extractReferencesOnly = (text: string): string => {
    const refMatch = text.split(/(?:^|\n)\s*references\s*(?:\n|$)/i);
    if (refMatch.length > 1) {
      return refMatch[refMatch.length - 1].trim();
    }
    return text.trim();
  };

  // Universal Document Ingestion (.docx / .pdf / .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetMode: 'search' | 'recency') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let extracted = '';

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        extracted = res.value;
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extracted += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
      } else {
        extracted = await file.text();
      }

      const clean = extracted.trim();
      const words = clean ? clean.split(/\s+/).length : 0;
      setFileStats(`✓ ${file.name} | ${words.toLocaleString()} words loaded`);

      if (targetMode === 'recency') {
        const refText = extractReferencesOnly(clean);
        setRecencyInput(refText);
      } else {
        setInputText(clean);
      }
    } catch {
      alert(`${file.name} ကို ဖတ်ရှု၍ မရပါခင်ဗျာ။`);
    } finally {
      e.target.value = '';
    }
  };

  // Citation Recency Auditor Calculation Engine (Zero-Token Client Side)
  const handleRunRecencyAudit = () => {
    if (!recencyInput.trim()) {
      alert('စစ်ဆေးရန် References စာရင်းကို ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const lines = recencyInput
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 15); // filter out tiny artifact lines

    if (lines.length === 0) {
      alert('ခိုင်မာသော Reference စာရင်း မတွေ့ရှိပါခင်ဗျာ။');
      return;
    }

    let fresh = 0;
    let acceptable = 0;
    let outdated = 0;

    const audited: ReferenceAuditItem[] = lines.map((line) => {
      // Regex to find 4-digit year enclosed in parentheses e.g. (2023) or (2018, March 16)
      const yearMatch = line.match(/\((19\d{2}|20\d{2})[a-z]?.*?\)/);
      let year: number | null = null;
      let age: number | null = null;
      let status: ReferenceAuditItem['status'] = 'Unknown Year';
      let statusColor = 'text-slate-400 bg-slate-900 border-slate-700';
      let recommendation = 'ခုနှစ် ထင်ရှားစွာ မပါရှိပါ။ (Year) တိကျစွာ ထည့်သွင်းပေးပါ။';

      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
        age = CURRENT_YEAR - year;

        if (age <= 5) {
          fresh++;
          status = 'Fresh (<= 5 yrs)';
          statusColor = 'text-emerald-300 bg-emerald-950/80 border-emerald-700/50';
          recommendation = 'စံပြသုတေသနသက်တမ်း (APA 7th စံနှုန်းနှင့် ကိုက်ညီပါသည်)။';
        } else if (age <= 10) {
          acceptable++;
          status = 'Acceptable (6-10 yrs)';
          statusColor = 'text-amber-300 bg-amber-950/80 border-amber-700/50';
          recommendation = 'လက်ခံနိုင်သော သက်တမ်းဖြစ်သော်လည်း ၅ နှစ်အတွင်း သုတေသနအသစ်ဖြင့် အစားထိုးပါက ပိုမိုကောင်းမွန်ပါမည်။';
        } else {
          outdated++;
          status = 'Outdated (> 10 yrs)';
          statusColor = 'text-rose-300 bg-rose-950/80 border-rose-700/50';
          recommendation = '၁၀ နှစ်ကျော် သက်တမ်းလွန်နေပါသည်။ သီအိုရီမူရင်းမဟုတ်ပါက ဆရာအမှတ်လျှော့နိုင်သဖြင့် မဖြစ်မနေ အသစ်လဲသင့်ပါသည်။';
        }
      }

      // Extract basic author
      const author = line.split('(')[0]?.trim() || 'Unknown Author';

      return {
        rawEntry: line,
        author,
        year,
        age,
        status,
        statusColor,
        recommendation
      };
    });

    const total = audited.length;
    const recencyRate = total > 0 ? Math.round((fresh / total) * 100) : 0;

    let verdict: RecencySummary['verdict'] = 'Excellent (Pass APA 7th)';
    if (recencyRate < 50 || outdated >= 3) {
      verdict = 'High Risk of Deduction';
    } else if (recencyRate < 70) {
      verdict = 'Needs Updating';
    }

    setAuditItems(audited);
    setAuditSummary({
      totalCount: total,
      freshCount: fresh,
      acceptableCount: acceptable,
      outdatedCount: outdated,
      recencyRate,
      verdict
    });
  };

  const handleClearRecency = () => {
    setRecencyInput('');
    setAuditItems([]);
    setAuditSummary(null);
    setFileStats(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
            <span>📚</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">
              Scholarly Source Finder & Citation Verifier (စစ်မှန်သော သုတေသန ရှာဖွေစစ်ဆေးရေး)
            </h3>
            <p className="text-[11px] text-slate-400">
              Peer-reviewed Journals၊ Classic Books၊ DOI Grounding နှင့် APA 7th သက်တမ်းစစ်ဆေးချက်
            </p>
          </div>
        </div>

        {/* 3-Pill Sub Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubMode('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubMode === 'search'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔍 ၁။ စာအုပ်/ဂျာနယ် အစစ်များရှာမည်
          </button>
          <button
            type="button"
            onClick={() => setActiveSubMode('verify')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubMode === 'verify'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛡️ ၂။ References ခိုင်မာမှု စစ်ဆေးမည်
          </button>
          <button
            type="button"
            onClick={() => setActiveSubMode('recency')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubMode === 'recency'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 ၃။ ကိုးကား သက်တမ်းစစ်ဆေးချက်
          </button>
        </div>
      </div>

      {/* MODE 1 & 2: Search & Verify Views */}
      {(activeSubMode === 'search' || activeSubMode === 'verify') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  {activeSubMode === 'search'
                    ? 'ASSIGNMENT ခေါင်းစဉ် သို့မဟုတ် စာမူကြမ်းကို ထည့်ပါ:'
                    : 'စစ်ဆေးလိုသော REFERENCES စာရင်းကို ထည့်ပါ:'}
                </label>
                <label className="cursor-pointer text-[11px] font-semibold text-cyan-400 hover:underline flex items-center gap-1">
                  <span>📎</span> Upload .docx / .pdf
                  <input type="file" accept=".docx,.pdf,.txt" onChange={(e) => handleFileUpload(e, 'search')} className="hidden" />
                </label>
              </div>

              {fileStats && (
                <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg w-fit">
                  {fileStats}
                </div>
              )}

              <textarea
                rows={12}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  activeSubMode === 'search'
                    ? 'သင်၏ သင်ခန်းစာ ခေါင်းစဉ်၊ အဆိုပြုချက် သို့မဟုတ် စာပိုဒ်ကို ထည့်သွင်းပါက ခိုင်မာသော သုတေသန စာအုပ်/ဂျာနယ် အစစ်များကို ရှာပေးပါမည်...'
                    : 'စစ်ဆေးလိုသော APA References များကို ဤနေရာတွင် ကူးထည့်ပါ...'
                }
                className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all mt-2"
            >
              <span>✨</span>
              <span>{activeSubMode === 'search' ? 'စာအုပ်/ဂျာနယ် အစစ်များ ရှာဖွေမည်' : 'References ခိုင်မာမှု စစ်ဆေးမည်'}</span>
            </button>
          </div>

          <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex flex-col justify-center items-center text-slate-500 text-xs">
            <span>ဘယ်ဘက်တွင် အချက်အလက် ထည့်သွင်းပြီး ခလုတ်ကို နှိပ်ပါ</span>
          </div>
        </div>
      )}

      {/* MODE 3: CITATION AGE & RECENCY AUDITOR VIEW */}
      {activeSubMode === 'recency' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Inputs */}
          <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  REFERENCES LIST ကို ကူးထည့်ပါ (သို့မဟုတ် ဖိုင်တင်ပါ):
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1">
                    <span>📎</span> Word / PDF တင်မည်
                    <input type="file" accept=".docx,.pdf,.txt" onChange={(e) => handleFileUpload(e, 'recency')} className="hidden" />
                  </label>
                  {(recencyInput || auditSummary) && (
                    <button type="button" onClick={handleClearRecency} className="text-[10px] text-rose-400 hover:underline">
                      ✕ ရှင်းမည်
                    </button>
                  )}
                </div>
              </div>

              {fileStats && (
                <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg w-fit">
                  {fileStats}
                </div>
              )}

              <textarea
                rows={12}
                value={recencyInput}
                onChange={(e) => setRecencyInput(e.target.value)}
                placeholder="Paste your APA 7th References entries here...&#10;&#10;e.g.&#10;Council on Foreign Relations. (2025). Global health then and now...&#10;Ghimire, B. K. et al. (2023). Assessment of benefits...&#10;World Health Organization. (2014)..."
                className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400 italic">
                * တက္ကသိုလ် Assignment များတွင် နောက်ဆုံး ၅ နှစ်အတွင်း သုတေသနများ (&gt; 70%) ပါဝင်ရန် လိုအပ်ပါသည်။
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunRecencyAudit}
              disabled={!recencyInput.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all mt-2"
            >
              <span>📅</span>
              <span>ကိုးကား သက်တမ်းများ တွက်ချက်စစ်ဆေးမည် (Audit Recency)</span>
            </button>
          </div>

          {/* Right Output Dashboard */}
          <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">ကိုးကား သက်တမ်း ခွဲခြမ်းစိတ်ဖြာမှု ရလဒ်</span>
              {auditSummary && (
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  auditSummary.verdict === 'Excellent (Pass APA 7th)'
                    ? 'text-emerald-300 bg-emerald-950 border-emerald-600/40'
                    : auditSummary.verdict === 'Needs Updating'
                    ? 'text-amber-300 bg-amber-950 border-amber-600/40'
                    : 'text-rose-300 bg-rose-950 border-rose-600/40'
                }`}>
                  {auditSummary.verdict}
                </span>
              )}
            </div>

            {auditSummary ? (
              <div className="space-y-4">
                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block uppercase">Total Entries</span>
                    <span className="text-sm font-extrabold text-slate-100 mt-0.5 block">{auditSummary.totalCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center">
                    <span className="text-[10px] text-emerald-400 block uppercase">&lt;= 5 Years (Fresh)</span>
                    <span className="text-sm font-extrabold text-emerald-300 mt-0.5 block">{auditSummary.freshCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-center">
                    <span className="text-[10px] text-amber-400 block uppercase">6 - 10 Years</span>
                    <span className="text-sm font-extrabold text-amber-300 mt-0.5 block">{auditSummary.acceptableCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-center">
                    <span className="text-[10px] text-slate-400 block uppercase">&gt; 10 Years (Outdated)</span>
                    <span className="text-sm font-extrabold text-rose-300 mt-0.5 block">{auditSummary.outdatedCount}</span>
                  </div>
                </div>

                {/* Recency Progress Bar */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">APA 7th Recency Benchmark (&gt; 70% Recent):</span>
                    <span className="font-mono font-bold text-emerald-400">{auditSummary.recencyRate}% Recent</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        auditSummary.recencyRate >= 70
                          ? 'bg-emerald-500'
                          : auditSummary.recencyRate >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(auditSummary.recencyRate, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Detailed Entry Cards */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {auditItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-200 truncate">{item.author}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${item.statusColor}`}>
                          {item.year ? `${item.year} (${item.age} yrs ago)` : 'No Year'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-serif leading-relaxed line-clamp-2">
                        {item.rawEntry}
                      </p>
                      <div className="pt-1 text-[11px] text-slate-300 flex items-center gap-1.5">
                        <span>💡</span>
                        <span>{item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>References List ကို ဘယ်ဘက်တွင် ထည့်သွင်းပြီး သက်တမ်း တွက်ချက်စစ်ဆေးပါ</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
