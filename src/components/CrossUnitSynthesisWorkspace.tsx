import React, { useState, useEffect } from 'react';
import { runCrossUnitSynthesis, CrossUnitSynthesisResult } from '../services/crossUnitGeminiService';
import { extractTextFromPdfFile } from '../utils/pdfReader';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import {
  loadPersistedTabState,
  savePersistedTabState,
  clearPersistedTabState,
} from '../utils/researchPersistence';
import { ResearchClearAction } from './ResearchClearAction';

interface IngestionStats {
  name: string;
  words: number;
  chars: number;
}

interface Tab4PersistedState {
  currentTopic: string;
  currentNotes: string;
  pastUnits: string;
  pastNotes: string;
  result: CrossUnitSynthesisResult | null;
  currentFileStats: IngestionStats | null;
  pastFileStats: IngestionStats | null;
}

const TAB4_STORAGE_KEY = 'matrix_tab4_data';
const TAB4_DEFAULT_STATE: Tab4PersistedState = {
  currentTopic: '',
  currentNotes: '',
  pastUnits: '',
  pastNotes: '',
  result: null,
  currentFileStats: null,
  pastFileStats: null,
};

export const CrossUnitSynthesisWorkspace: React.FC = () => {
  const [initialState] = useState<Tab4PersistedState>(() =>
    loadPersistedTabState<Tab4PersistedState>(TAB4_STORAGE_KEY, TAB4_DEFAULT_STATE)
  );
  const [currentTopic, setCurrentTopic] = useState(initialState.currentTopic);
  const [currentNotes, setCurrentNotes] = useState(initialState.currentNotes);
  const [pastUnits, setPastUnits] = useState(initialState.pastUnits);
  const [pastNotes, setPastNotes] = useState(initialState.pastNotes);
  const [loading, setLoading] = useState(false);
  const [parsingField, setParsingField] = useState<'current' | 'past' | null>(null);
  const [result, setResult] = useState<CrossUnitSynthesisResult | null>(initialState.result);

  // Ingestion stats badges
  const [currentFileStats, setCurrentFileStats] = useState<IngestionStats | null>(
    initialState.currentFileStats
  );
  const [pastFileStats, setPastFileStats] = useState<IngestionStats | null>(
    initialState.pastFileStats
  );

  useEffect(() => {
    savePersistedTabState<Tab4PersistedState>(TAB4_STORAGE_KEY, {
      currentTopic,
      currentNotes,
      pastUnits,
      pastNotes,
      result,
      currentFileStats,
      pastFileStats,
    });
  }, [currentTopic, currentNotes, pastUnits, pastNotes, result, currentFileStats, pastFileStats]);

  // Reset / Clear All Handler
  const handleClearAll = () => {
    setCurrentTopic('');
    setCurrentNotes('');
    setPastUnits('');
    setPastNotes('');
    setResult(null);
    setCurrentFileStats(null);
    setPastFileStats(null);
    clearPersistedTabState(TAB4_STORAGE_KEY);
  };

  // Auto-detect headers from parsed text if inputs are empty
  const autoDetectTitle = (text: string, defaultFallback: string) => {
    if (!text) return defaultFallback;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const candidate = lines.find(l => /unit|assignment|capstone|chapter|module|paper|study/i.test(l));
    return candidate ? candidate.substring(0, 60) : defaultFallback;
  };

  // Universal Full-Text Document Parser
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'current' | 'past'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingField(target);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let extractedText = '';

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ 
          arrayBuffer: arrayBuffer.slice(0) 
        });
        extractedText = res.value || '';
        
        extractedText = extractedText
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

      } else if (ext === 'pdf') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          const totalPages = pdf.numPages;
          const textChunks: string[] = [];

          for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageStr = content.items
              .map((item: any) => item.str)
              .join(' ');
            textChunks.push(pageStr);
          }
          extractedText = textChunks.join('\n\n').trim();
        } catch {
          extractedText = await extractTextFromPdfFile(file);
        }

      } else {
        extractedText = (await file.text()).trim();
      }

      if (!extractedText) {
        throw new Error('ဖိုင်ထဲမှ စာသားများကို ဖတ်မရပါခင်ဗျာ။');
      }

      const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
      const charCount = extractedText.length;
      const statsInfo: IngestionStats = { name: file.name, words: wordCount, chars: charCount };

      if (target === 'current') {
        setCurrentNotes(extractedText);
        setCurrentFileStats(statsInfo);
        if (!currentTopic.trim()) {
          setCurrentTopic(autoDetectTitle(extractedText, file.name.replace(/\.[^/.]+$/, '')));
        }
      } else {
        setPastNotes(extractedText);
        setPastFileStats(statsInfo);
        if (!pastUnits.trim()) {
          setPastUnits(autoDetectTitle(extractedText, 'Previous Learning Units'));
        }
      }
    } catch (err: any) {
      alert(err.message || `${file.name} ကို ဖတ်ရှုရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။`);
    } finally {
      setParsingField(null);
      e.target.value = '';
    }
  };

  const handleSynthesize = async () => {
    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    if (!currentNotes.trim() && !pastNotes.trim()) {
      alert('အနည်းဆုံး စာသား သို့မဟုတ် ဖိုင်တစ်ခုခု ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const effectiveCurrentTopic = currentTopic.trim() || autoDetectTitle(currentNotes, 'Current Assignment Activity');
    const effectivePastUnits = pastUnits.trim() || autoDetectTitle(pastNotes, 'Previous Learning Units');

    setLoading(true);
    try {
      const data = await runCrossUnitSynthesis(
        effectiveCurrentTopic,
        currentNotes,
        effectivePastUnits,
        pastNotes,
        apiKey
      );
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Synthesis လုပ်ဆောင်ရာတွင် အမှားအယွင်းရှိပါသည်');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-950/80 text-purple-400 border border-purple-800/50">
            <span>🔗</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Cross-Unit သီအိုရီ၊ Method နှင့် အချက်အလက်များ ချိတ်ဆက်မှု (Synthesis Studio)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              ရှေ့သင်ခန်းစာများမှ Theory, Methodology, Evidence နှင့် Policy များကို လက်ရှိ Assignment နှင့် ပေါင်းစပ်ထုတ်ယူခြင်း
            </p>
          </div>
        </div>

        {/* Reset / Clear All Button */}
        {(currentNotes || pastNotes || result || currentTopic || pastUnits) && (
          <ResearchClearAction onConfirmClear={handleClearAll} />
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Inputs */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Field 1 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  ၁။ လက်ရှိ ရေးသားနေသော Unit ခေါင်းစဉ် (Current Assignment Topic):
                </label>
                {currentTopic && (
                  <button
                    type="button"
                    onClick={() => setCurrentTopic('')}
                    className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    (ရှင်းမည်)
                  </button>
                )}
              </div>
              <input
                type="text"
                value={currentTopic}
                onChange={(e) => setCurrentTopic(e.target.value)}
                placeholder="e.g. Unit 7: Ethical Governance of AI (အလွတ်ထားပါက ဖိုင်ထဲမှ အလိုအလျောက် ယူပါမည်)"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Field 2 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-300">
                    ၂။ လက်ရှိ ရေးသားထားသော မူကြမ်း သို့မဟုတ် အဓိက အချက်များ:
                  </label>
                  {currentNotes && (
                    <button
                      type="button"
                      onClick={() => { setCurrentNotes(''); setCurrentFileStats(null); }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      (ရှင်းမည်)
                    </button>
                  )}
                </div>
                <label className="cursor-pointer text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                  <span>📎</span>
                  <span>{parsingField === 'current' ? 'ဖတ်နေသည်...' : 'Upload .docx / .pdf / .txt'}</span>
                  <input
                    type="file"
                    accept=".docx,.pdf,.txt"
                    onChange={(e) => handleFileUpload(e, 'current')}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={5}
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                placeholder="လက်ရှိ assignment မူကြမ်းစာသားများ..."
                className="w-full p-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
              />
              {currentFileStats && (
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 mt-1.5 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                  <span>✓</span>
                  <span className="truncate max-w-[180px]">{currentFileStats.name}</span>
                  <span className="text-emerald-300/90 font-mono text-[10px]">
                    ({currentFileStats.words.toLocaleString()} words / {currentFileStats.chars.toLocaleString()} chars loaded)
                  </span>
                </div>
              )}
            </div>

            {/* Field 3 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  ၃။ ပြန်လည်ချိတ်ဆက်လိုသော ရှေ့သင်ခန်းစာများ (Past Units to Connect):
                </label>
                {pastUnits && (
                  <button
                    type="button"
                    onClick={() => setPastUnits('')}
                    className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    (ရှင်းမည်)
                  </button>
                )}
              </div>
              <input
                type="text"
                value={pastUnits}
                onChange={(e) => setPastUnits(e.target.value)}
                placeholder="e.g. Unit 2 & Unit 4 (အလွတ်ထားပါက ဖိုင်ထဲမှ အလိုအလျောက် ယူပါမည်)"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Field 4 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-300">
                    ၄။ ရှေ့သင်ခန်းစာ မှတ်စုများ သို့မဟုတ် အရေးကြီး အနှစ်ချုပ်:
                  </label>
                  {pastNotes && (
                    <button
                      type="button"
                      onClick={() => { setPastNotes(''); setPastFileStats(null); }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      (ရှင်းမည်)
                    </button>
                  )}
                </div>
                <label className="cursor-pointer text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                  <span>📎</span>
                  <span>{parsingField === 'past' ? 'ဖတ်နေသည်...' : 'Upload Past .docx / .pdf'}</span>
                  <input
                    type="file"
                    accept=".docx,.pdf,.txt"
                    onChange={(e) => handleFileUpload(e, 'past')}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={5}
                value={pastNotes}
                onChange={(e) => setPastNotes(e.target.value)}
                placeholder="ရှေ့သင်ခန်းစာ မှတ်စုများ သို့မဟုတ် သီအိုရီ/နည်းစနစ် အနှစ်ချုပ်..."
                className="w-full p-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
              />
              {pastFileStats && (
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 mt-1.5 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                  <span>✓</span>
                  <span className="truncate max-w-[180px]">{pastFileStats.name}</span>
                  <span className="text-emerald-300/90 font-mono text-[10px]">
                    ({pastFileStats.words.toLocaleString()} words / {pastFileStats.chars.toLocaleString()} chars loaded)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleSynthesize}
            disabled={loading || (!currentNotes.trim() && !pastNotes.trim())}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>သီအိုရီနှင့် အချက်အလက်များ ချိတ်ဆက်တွက်ချက်နေသည်...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>သီအိုရီများ etc., ချိတ်ဆက်ပေးရန် (Generate Synthesis)</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Output (Conceptual Bridge Table + Concrete Theoretical Application) */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-purple-300">
              CROSS-UNIT CONCEPTUAL BRIDGE & THEORETICAL APPLICATION
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-purple-400 border border-purple-800/50">
              A-Grade Rubric Booster
            </span>
          </div>

          {result ? (
            <div className="space-y-4">
              {/* Executive Summary Banner */}
              {result.currentAssignmentSummary && (
                <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-700/40 text-xs text-slate-200 leading-relaxed">
                  <strong className="text-purple-300">Synthesis Overview:</strong>{' '}
                  {result.currentAssignmentSummary}
                </div>
              )}

              {/* Pillar Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">Integrated Pillars:</span>
                {result.integratedPillars?.map((badge, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-700/50 flex items-center gap-1.5"
                  >
                    <span className="text-[10px] text-purple-400 font-mono">[{badge.unit}]</span>
                    <span>{badge.label}</span>
                    <span className="text-[10px] text-slate-400">({badge.category})</span>
                  </span>
                ))}
              </div>

              {/* 1. 🔗 Conceptual Bridge Table */}
              {result.pillarCards && result.pillarCards.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span>🔗</span>
                      <span>1. Conceptual Bridge Table (Past Units ➔ Current Assignment)</span>
                    </h4>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5 w-36">Past Unit & Pillar</th>
                          <th className="p-2.5 min-w-[160px]">Core Theory / Method</th>
                          <th className="p-2.5 min-w-[200px]">Conceptual Bridge to Current Topic</th>
                          <th className="p-2.5 min-w-[160px]">Rubric Value / Nuance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/50 text-slate-200">
                        {result.pillarCards.map((card, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/90">
                            <td className="p-2.5 align-top">
                              <span className="font-mono text-[11px] font-bold text-purple-300 block">
                                {card.sourceUnit}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 inline-block mt-1">
                                {card.pillarType}
                              </span>
                            </td>
                            <td className="p-2.5 align-top">
                              <div className="font-bold text-white mb-0.5">{card.title}</div>
                              <div className="text-slate-300 leading-relaxed">{card.coreConcept}</div>
                            </td>
                            <td className="p-2.5 align-top text-emerald-300 leading-relaxed font-medium">
                              {card.applicationToCurrentWork}
                            </td>
                            <td className="p-2.5 align-top text-amber-300/90 leading-relaxed">
                              {card.criticalNuance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. 💡 Concrete Theoretical Application (Ready-to-Submit Scholarly Paragraphs) */}
              <div className="p-4 rounded-xl bg-slate-900 border border-purple-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>
                      2. Concrete Theoretical Application (Assignment ထဲ တိုက်ရိုက်ထည့်နိုင်သော စာပိုဒ်)
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      if (result.readyToSubmitParagraph) {
                        navigator.clipboard.writeText(result.readyToSubmitParagraph);
                      }
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <span>📋</span> Copy Application
                  </button>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-3">
                  {result.readyToSubmitParagraph && result.readyToSubmitParagraph !== '{}' ? (
                    result.readyToSubmitParagraph
                      .split(/\n{2,}/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .map((para, pIdx) => (
                        <p
                          key={pIdx}
                          className="text-xs sm:text-sm text-slate-200 font-serif leading-relaxed"
                        >
                          {para}
                        </p>
                      ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Synthesis prose unavailable for this input. Please click Generate Synthesis again.
                    </p>
                  )}
                </div>
              </div>

              {/* Rubric Guidance */}
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-700/30 flex items-start gap-2.5 text-xs">
                <span className="text-indigo-400 mt-0.5">🎯</span>
                <div>
                  <span className="font-bold text-indigo-200">UoPeople Assessment Rubric Tip:</span>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    {result.rubricAlignmentTip}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1 text-center p-6">
              <span className="text-2xl mb-2">🔗</span>
              <span>ဖိုင်တင်ထားပါက အောက်ပါခလုတ်ကို နှိပ်ပြီး ချက်ချင်း စတင်နိုင်ပါသည်</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
