import React, { useState, useEffect } from 'react';
import { runDraftRubricAudit, DraftAuditResult } from '../services/draftAuditGeminiService';
import { formatDraftForMoodle } from '../utils/moodleFormatter';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

interface Props {
  sharedRubric: string;
  onUpdateSharedRubric: (rubric: string) => void;
  onJumpToOutlineTab: () => void;
}

const PERSONA_PRESETS = [
  { id: 'apa', label: '📌 APA & Citation တင်းကျပ်သူ', desc: 'Strict APA 7th edition formatting, recent peer-reviewed sources only' },
  { id: 'critical', label: '💡 Critical Thinking & ဆန့်ကျင်ဘက်အမြင်', desc: 'Demands deep counter-arguments and analytical critique rather than plain summaries' },
  { id: 'concise', label: '📄 အကျဉ်းချုပ် & ဖွဲ့စည်းပုံ တိကျသူ', desc: 'Direct, clear, concise language and strict adherence to word count constraints' },
  { id: 'custom', label: '✍️ ဆရာ့ Feedback စာသား ထည့်သွင်းမည်', desc: 'Custom syllabus notes or past instructor feedback' }
];

export const DraftAuditStudio: React.FC<Props> = ({
  sharedRubric,
  onUpdateSharedRubric,
  onJumpToOutlineTab
}) => {
  const [draftText, setDraftText] = useState(() => localStorage.getItem('akari_current_active_draft') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DraftAuditResult | null>(null);
  const [fileStats, setFileStats] = useState<string | null>(null);

  useEffect(() => {
    if (draftText) {
      localStorage.setItem('akari_current_active_draft', draftText);
    }
  }, [draftText]);

  // Moodle Formatter Modal State
  const [showMoodleModal, setShowMoodleModal] = useState(false);
  const [moodleOutput, setMoodleOutput] = useState<{ html: string; wordCount: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMoodleFormatEnabled, setIsMoodleFormatEnabled] = useState<boolean>(false);

  // Instructor Persona State (toggleable, default null)
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [customFeedbackText, setCustomFeedbackText] = useState<string>('');

  // Verification Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [editableRubric, setEditableRubric] = useState(sharedRubric);

  useEffect(() => {
    setEditableRubric(sharedRubric);
  }, [sharedRubric]);

  const handleTogglePersona = (id: string) => {
    if (selectedPersona === id) {
      setSelectedPersona(null);
    } else {
      setSelectedPersona(id);
    }
  };

  const getActiveInstructorInstruction = (): string => {
    if (!selectedPersona) return '';
    if (selectedPersona === 'custom') {
      return customFeedbackText.trim() ? `Instructor Specific Note: ${customFeedbackText.trim()}` : 'Standard Evaluation';
    }
    const match = PERSONA_PRESETS.find(p => p.id === selectedPersona);
    return match ? `${match.label}: ${match.desc}` : 'Standard Evaluation';
  };

  // Click "Draft ကို Rubric ဖြင့် တိုက်စစ်မည်"
  const handleInitiateAudit = () => {
    if (!draftText.trim()) {
      alert('စစ်ဆေးရန် Draft စာမူကြမ်းကို ဘယ်ဘက်တွင် ဦးစွာ ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    if (!sharedRubric.trim()) {
      const proceed = window.confirm(
        'A-Grade Rubric ကို ရှာမတွေ့သေးပါခင်ဗျာ။ "A ရဖို့" Tab သို့ သွားရောက်၍ မေးခွန်း/Rubric ပုံများကို ဦးစွာ ထည့်သွင်းစစ်ဆေးလိုပါသလား?'
      );
      if (proceed) {
        onJumpToOutlineTab();
      }
      return;
    }

    setEditableRubric(sharedRubric);
    setShowVerifyModal(true);
  };

  // User confirms/edits rubric and runs actual audit
  const handleConfirmAndRunAudit = async () => {
    setShowVerifyModal(false);
    onUpdateSharedRubric(editableRubric);

    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      const personaDirective = getActiveInstructorInstruction();
      const data = await runDraftRubricAudit(draftText, editableRubric, apiKey, personaDirective);
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Audit စစ်ဆေးရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။');
    } finally {
      setLoading(false);
    }
  };

  // Universal File Upload (.docx / .pdf / .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let extracted = '';

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
        extracted = res.value;
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extracted += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
      } else {
        extracted = await file.text();
      }

      const clean = extracted.trim();
      setDraftText(clean);
      const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
      setFileStats(`✓ ${file.name} | ${words.toLocaleString()} words loaded`);
    } catch {
      alert(`${file.name} ဖတ်ရှု၍ မရပါ။`);
    } finally {
      e.target.value = '';
    }
  };

  const handleClear = () => {
    setDraftText('');
    setFileStats(null);
    setResult(null);
    localStorage.removeItem('akari_current_active_draft');
  };

  const handleOpenMoodleFormatter = () => {
    if (!draftText.trim()) {
      alert('သန့်စင်ရန် Draft စာမူကြမ်းကို ဘယ်ဘက်တွင် ဦးစွာ ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }
    const result = formatDraftForMoodle(draftText);
    setMoodleOutput(result);
    setShowMoodleModal(true);
    setCopySuccess(false);
  };

  const handleCopyRichTextForMoodle = async () => {
    if (!moodleOutput) return;

    try {
      const blobHtml = new Blob([moodleOutput.html], { type: 'text/html' });
      const blobText = new Blob([draftText], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      await navigator.clipboard.write(data);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      // Fallback if rich clipboard is blocked
      navigator.clipboard.writeText(draftText);
      alert('Moodle text copied to clipboard!');
    }
  };

  const wordCount = draftText.trim() ? draftText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-4">
      {/* GUIDED VERIFICATION MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <span>🔍</span> Rubric စံနှုန်းများ စစ်ဆေးအတည်ပြုခြင်း
              </h4>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer p-1"
              >
                ✕ ပိတ်မည်
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              "A ရဖို့" Tab တွင် စစ်ဆေးထားသော Rubric စံနှုန်းများ ဖြစ်ပါသည်။ <strong>မှန်/မမှန် ကြည့်ရှုပါ၊ မမှန်ပါက တိုက်ရိုက် ပြင်ဆင်ထည့်သွင်းနိုင်ပါသည်:</strong>
            </p>

            <textarea
              rows={6}
              value={editableRubric}
              onChange={(e) => setEditableRubric(e.target.value)}
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  onJumpToOutlineTab();
                }}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>↗️</span> "A ရဖို့" Tab သို့ သွားရောက်ကြည့်ရှုမည်
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndRunAudit}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-md cursor-pointer"
                >
                  အတည်ပြု၍ တိုက်စစ်မည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Inputs */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            {/* Shared Rubric Header Pill */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">ချိတ်ဆက်ထားသော RUBRIC:</span>
                <button
                  type="button"
                  onClick={onJumpToOutlineTab}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {sharedRubric ? 'Rubric ကို ပြန်စစ်ရန်' : '+ "A ရဖို့" မှ Rubric ယူမည်'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 truncate font-mono">
                {sharedRubric || 'Rubric မရှိသေးပါ။ အောက်ပါခလုတ်နှိပ်ပါက လမ်းညွှန်ပေးပါမည်။'}
              </p>
            </div>

            {/* Instructor Bias / Persona Selector */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <span>👨‍🏫</span> ဆရာ့အကဲဖြတ်မှု ဦးစားပေးပုံစံ ရွေးချယ်ရန်:
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">
                  {selectedPersona
                    ? (PERSONA_PRESETS.find(p => p.id === selectedPersona)?.label.split(' ')[1] || '(စိတ်ကြိုက် ဦးစားပေးဖွင့်ထားသည်)')
                    : '(ပုံမှန် စံပြ Rubric စစ်ဆေးမှု)'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {PERSONA_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleTogglePersona(p.id)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all cursor-pointer ${
                      selectedPersona === p.id
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/50'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {selectedPersona && (
                  <button
                    type="button"
                    onClick={() => setSelectedPersona(null)}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-800 text-rose-300 hover:bg-rose-950 hover:text-rose-200 border border-slate-700 transition-all cursor-pointer"
                  >
                    ✕ မရွေးချယ်တော့ပါ
                  </button>
                )}
              </div>

              {selectedPersona === 'custom' && (
                <input
                  type="text"
                  value={customFeedbackText}
                  onChange={(e) => setCustomFeedbackText(e.target.value)}
                  placeholder="ဆရာပေးထားသော Feedback သို့မဟုတ် Syllabus သတိပေးချက် စာသား ထည့်ပါ..."
                  className="w-full mt-2 p-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>

            {/* Draft Input */}
            <div>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-300">သင် ရေးထားသော DRAFT စာမူကြမ်း:</span>

                  {/* Interactive ON / OFF Toggle for Moodle Format */}
                  <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 p-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsMoodleFormatEnabled(!isMoodleFormatEnabled)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isMoodleFormatEnabled
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/50'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Discussion Post ကို Moodle ထဲသို့ ကူးထည့်ရန် format သန့်စင်မှု ဖွင့်/ပိတ် ခလုတ်"
                    >
                      <span>✂️ Moodle Format:</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                        isMoodleFormatEnabled ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isMoodleFormatEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    {/* Only show the Preview/Copy Action button if the Toggle is turned ON */}
                    {isMoodleFormatEnabled && (
                      <button
                        type="button"
                        onClick={handleOpenMoodleFormatter}
                        className="px-2 py-0.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 text-[10px] font-semibold flex items-center gap-1 animate-fadeIn cursor-pointer"
                      >
                        <span>👁️ Preview & Copy</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">{wordCount} words</span>
                  <label className="cursor-pointer text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <span>📎</span>
                    <span>Upload .docx / .pdf / .txt</span>
                    <input type="file" accept=".docx,.pdf,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {(draftText || fileStats) && (
                    <button type="button" onClick={handleClear} className="text-[10px] text-rose-400 hover:underline cursor-pointer">
                      ✕ ရှင်းမည်
                    </button>
                  )}
                </div>
              </div>

              {fileStats && (
                <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg w-fit mb-2">
                  {fileStats}
                </div>
              )}

              <textarea
                rows={11}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Paste your essay draft here to audit logical flow, evidence gaps, and thesis strength..."
                className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleInitiateAudit}
            disabled={loading || !draftText.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Rubric ဖြင့် အသေးစိတ် တိုက်စစ်နေသည်...</span>
              </>
            ) : (
              <>
                <span>🧠</span>
                <span>Draft ကို Rubric ဖြင့် တိုက်စစ်မည် (Logic, Thesis, Evidence)</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Dashboard */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200">ဆရာအကဲဖြတ်မှု & အကြံပြုချက်များ</span>
            {result && !loading && (
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                Estimated: {result.estimatedGradeBand}
              </span>
            )}
          </div>

          {loading ? (
            <div className="h-72 flex flex-col items-center justify-center space-y-3">
              <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin text-indigo-500" />
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-slate-200">Rubric စံနှုန်းများဖြင့် Draft ကို တိုက်စစ်နေပါသည်...</p>
                <p className="text-[11px] text-slate-400">Logic flow, Thesis defensibility နှင့် Evidence gaps များကို တွက်ချက်နေပါသည်</p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-3.5">
              {/* Top Priority Fix */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-700/40 text-xs">
                <span className="font-bold text-amber-300 block mb-0.5">🎯 "Solid A" ဖြစ်ရန် အဓိက ဦးစားပေး:</span>
                <p className="text-slate-200 leading-relaxed">{result.topPriorityToReachSolidA}</p>
              </div>

              {/* Thesis Statement Audit */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300">Thesis Statement စစ်ဆေးချက်:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300">
                    {result.thesisAudit.verdict}
                  </span>
                </div>
                <p className="text-slate-300">{result.thesisAudit.critique}</p>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">Suggested Rewrite:</span>
                  <p className="italic text-cyan-200 font-serif">"{result.thesisAudit.suggestedThesisPolishing}"</p>
                </div>
              </div>

              {/* Rubric Gaps */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-200 block">Rubric Gaps & Missing Evidence:</span>
                <div className="space-y-1.5">
                  {result.rubricGaps.map((gap, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-950/70 border border-slate-800 flex justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-200 block">{gap.criterion}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{gap.fixAction}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 h-fit ${
                        gap.status === 'Met (Full Marks)' ? 'text-emerald-300 bg-emerald-950 border border-emerald-600/40' : 'text-rose-300 bg-rose-950 border border-rose-600/40'
                      }`}>
                        {gap.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Improved Paragraph Sample */}
              {result.improvedParagraphSample && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400">✨ A-Grade Rewrite Sample:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(result.improvedParagraphSample);
                        alert('Copied to clipboard!');
                      }}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <p className="italic text-slate-200 font-serif leading-relaxed">
                      "{result.improvedParagraphSample}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
              <span>သင်ရေးထားသော Draft စာမူကြမ်းကို ဘယ်ဘက်တွင် ထည့်သွင်း၍ စစ်ဆေးပါ</span>
            </div>
          )}
        </div>
      </div>
      {/* MOODLE CLEANED PREVIEW & COPY MODAL */}
      {showMoodleModal && moodleOutput && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50">✂️</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Moodle-Ready Cleaned Preview</h4>
                  <p className="text-[11px] text-slate-400">Online Campus (Moodle) ထဲသို့ format မပျက်ဘဲ တိုက်ရိုက်ကူးထည့်နိုင်သည့် စာသား</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoodleModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕ ပိတ်မည်
              </button>
            </div>

            {/* Live Moodle Preview Container with White Background Emulation */}
            <div className="p-4 rounded-xl bg-white text-slate-900 text-xs font-serif max-h-96 overflow-y-auto shadow-inner leading-relaxed border border-slate-300">
              <div dangerouslySetInnerHTML={{ __html: moodleOutput.html }} />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <span className="text-xs text-slate-400 font-mono">
                ✓ Core Essay: ~{moodleOutput.wordCount} words (Title & References excluded)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMoodleModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={handleCopyRichTextForMoodle}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <span>{copySuccess ? '✓ ကူးယူပြီးပါပြီ!' : '📋 Copy for Moodle'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
