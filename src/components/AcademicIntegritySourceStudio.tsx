import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { executeAcademicActionWithCascade } from '../services/geminiService';

interface TurnitinAnalysisResult {
  estimatedSimilarityBand: string;
  falsePositiveRiskAreas: { textSegment: string; reason: string; fixAdvice: string }[];
  trueOriginalityCheck: string;
  recommendedActions: string[];
}

interface ReferenceAuditItem {
  rawEntry: string;
  author: string;
  year: number | null;
  age: number | null;
  status: 'Fresh (<= 5 yrs)' | 'Acceptable (6-10 yrs)' | 'Outdated (> 10 yrs)' | 'Unknown Year';
  statusColor: string;
  recommendation: string;
}

interface ScholarlySourceItem {
  title: string;
  authors: string;
  year: string;
  sourceType: 'Journal Article' | 'Academic Book' | 'Institutional Report';
  publisher: string;
  doiOrUrl: string;
  relevance: string;
  apaCitation: string;
}

const CURRENT_YEAR = 2026;

export const AcademicIntegritySourceStudio: React.FC = () => {
  const [activeSubMode, setActiveSubMode] = useState<'turnitin' | 'source_finder' | 'recency'>('turnitin');

  // Input states
  const [paperText, setPaperText] = useState('');
  const [courseCode, setCourseCode] = useState('POLS 1503-01');
  const [promptExcerpt, setPromptExcerpt] = useState('');
  const [fileStats, setFileStats] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Turnitin result state
  const [turnitinResult, setTurnitinResult] = useState<TurnitinAnalysisResult | null>(null);

  // Recency states
  const [auditItems, setAuditItems] = useState<ReferenceAuditItem[]>([]);
  const [recencyRate, setRecencyRate] = useState<number | null>(null);

  // Source Finder states
  const [foundSources, setFoundSources] = useState<ScholarlySourceItem[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Pull Draft directly from Draft Studio's shared cache
  const handlePullDraftFromWorkspace = () => {
    const cached = localStorage.getItem('akari_current_active_draft') || localStorage.getItem('akari_draft_draftText');
    if (cached && cached.trim()) {
      setPaperText(cached.trim());
      const words = cached.trim().split(/\s+/).filter(Boolean).length;
      setFileStats(`✓ Draft Studio မှ ဆွဲယူထားသည် | ${words.toLocaleString()} words loaded`);
    } else {
      alert('Draft Studio တွင် စာမူကြမ်း ထည့်သွင်းထားခြင်း မရှိသေးပါခင်ဗျာ။');
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
      setPaperText(clean);
      const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
      setFileStats(`✓ ${file.name} | ${words.toLocaleString()} words loaded`);
    } catch {
      alert(`${file.name} ဖတ်ရှု၍ မရပါခင်ဗျာ။`);
    } finally {
      e.target.value = '';
    }
  };

  // Turnitin False-Positive Scan via Server API
  const handleScanTurnitin = async () => {
    if (!paperText.trim()) {
      alert('စစ်ဆေးရန် စာမူကြမ်း ထည့်သွင်းပါ သို့မဟုတ် Draft Studio မှ ဆွဲယူပါခင်ဗျာ။');
      return;
    }

    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      const systemPrompt = `
You are a Turnitin & Academic Integrity Specialist.
Evaluate the student paper to distinguish between FALSE POSITIVE similarity (standard UoPeople headers, course codes, prompt questions, institutional phrases, standard definitions) and TRUE academic plagiarism risk.
Return strictly valid JSON:
{
  "estimatedSimilarityBand": "e.g. 12-18% (Low / Normal for UoPeople format)",
  "trueOriginalityCheck": "1-2 sentences summarizing authentic student voice.",
  "falsePositiveRiskAreas": [
    {
      "textSegment": "Quoted sentence or phrase",
      "reason": "Why Turnitin flags this as a false positive",
      "fixAdvice": "How to rephrase or wrap in quotes/proper citation"
    }
  ],
  "recommendedActions": ["Clear actionable step"]
}
`;
      const userPayload = `COURSE: ${courseCode}\nPROMPT: ${promptExcerpt}\nDRAFT EXCERPT (first 4,000 chars):\n${paperText.substring(0, 4000)}`;

      const rawResult = await executeAcademicActionWithCascade({
        action: 'direct_assist',
        primaryKey: apiKey && apiKey.trim().length >= 10 ? apiKey.trim() : undefined,
        payload: {
          prompt: `${systemPrompt}\n\n${userPayload}`,
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          maxOutputTokens: 900,
        },
      });

      const raw = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult || {});
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      setTurnitinResult(JSON.parse(cleaned));
    } catch {
      alert('Turnitin Scan ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။');
    } finally {
      setLoading(false);
    }
  };

  // Search Scholarly Sources (Peer-reviewed & Books) via Direct BYOK
  const handleSearchSources = async () => {
    if (!paperText.trim() && !promptExcerpt.trim()) {
      alert('ရှာဖွေရန် ခေါင်းစဉ် သို့မဟုတ် စာမူကြမ်းကို ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      const systemPrompt = `
You are a University Research Librarian. Based on the topic or paper excerpt, identify 4 to 5 genuine, highly credible academic sources (peer-reviewed journal articles, foundational academic books, or official reports from UN/WHO/World Bank).
Include genuine authors, year of publication, valid DOIs or Google Scholar search paths, and perfect APA 7th reference strings.
Return strictly valid JSON array:
[
  {
    "title": "Title of article or book",
    "authors": "Author name(s)",
    "year": "2023",
    "sourceType": "Journal Article",
    "publisher": "Journal or University Press name",
    "doiOrUrl": "https://doi.org/...",
    "relevance": "Why this source provides strong evidence for the student's topic",
    "apaCitation": "Full APA 7th reference entry"
  }
]
`;
      const query = promptExcerpt.trim() ? `${promptExcerpt}\n\nExcerpt: ${paperText.substring(0, 2000)}` : paperText.substring(0, 3000);

      const rawResult = await executeAcademicActionWithCascade({
        action: 'direct_assist',
        primaryKey: apiKey && apiKey.trim().length >= 10 ? apiKey.trim() : undefined,
        payload: {
          prompt: `${systemPrompt}\n\nTopic / Paper:\n${query}`,
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          maxOutputTokens: 1200,
        },
      });

      const raw = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult || []);
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      setFoundSources(JSON.parse(cleaned));
    } catch {
      alert('သုတေသန ရှာဖွေမှု မအောင်မြင်ပါခင်ဗျာ။');
    } finally {
      setLoading(false);
    }
  };

  // Recency Calculation (Local Regex Zero-Token)
  const handleCalculateRecency = () => {
    if (!paperText.trim()) return;
    const lines = paperText.split('\n').filter((l) => l.trim().length > 15);
    let fresh = 0;
    const audited: ReferenceAuditItem[] = [];

    lines.forEach((line) => {
      const match = line.match(/\((19\d{2}|20\d{2})[a-z]?.*?\)/);
      if (match) {
        const year = parseInt(match[1], 10);
        const age = CURRENT_YEAR - year;
        const isFresh = age <= 5;
        if (isFresh) fresh++;

        audited.push({
          rawEntry: line.trim(),
          author: line.split('(')[0]?.trim() || 'Unknown Author',
          year,
          age,
          status: isFresh ? 'Fresh (<= 5 yrs)' : age <= 10 ? 'Acceptable (6-10 yrs)' : 'Outdated (> 10 yrs)',
          statusColor: isFresh
            ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/50'
            : age <= 10
            ? 'text-amber-300 bg-amber-950/80 border-amber-700/50'
            : 'text-rose-300 bg-rose-950/80 border-rose-700/50',
          recommendation: isFresh
            ? 'APA 7th စံနှုန်းမီပါသည်'
            : age <= 10
            ? '၅ နှစ်အတွင်း သုတေသနအသစ်ဖြင့် အစားထိုးနိုင်သည်'
            : '၁၀ နှစ်ကျော် သက်တမ်းလွန်နေ၍ အသစ်လဲသင့်သည်'
        });
      }
    });

    setAuditItems(audited);
    setRecencyRate(audited.length > 0 ? Math.round((fresh / audited.length) * 100) : 0);
  };

  const handleCopyCitation = (citation: string, index: number) => {
    navigator.clipboard.writeText(citation);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & 3-Pill Switcher */}
      <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
            <span>🛡️</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">
              Academic Integrity & စာအုပ်/ဂျာနယ်အစစ်များ (Turnitin & Source Studio)
            </h3>
            <p className="text-[11px] text-slate-400">
              Turnitin Similarity Filter၊ စစ်မှန်သော DOI သုတေသန ရှာဖွေရေးနှင့် APA 7th ကိုးကားသက်တမ်း စစ်ဆေးချက်
            </p>
          </div>
        </div>

        {/* Unified Sub-Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubMode('turnitin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubMode === 'turnitin'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛡️ Turnitin Shield
          </button>
          <button
            type="button"
            onClick={() => setActiveSubMode('source_finder')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubMode === 'source_finder'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔍 စာအုပ်/ဂျာနယ် အစစ်များရှာမည်
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubMode('recency');
              handleCalculateRecency();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubMode === 'recency'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 References သက်တမ်းစစ်ဆေးချက်
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Inputs */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-bold text-slate-200">
                {activeSubMode === 'turnitin'
                  ? 'ASSIGNMENT အချက်အလက်နှင့် စာမူကြမ်း:'
                  : activeSubMode === 'source_finder'
                  ? 'ASSIGNMENT ခေါင်းစဉ် သို့မဟုတ် သုတေသနအဆိုပြုချက်:'
                  : 'သုတေသန စာမူကြမ်း / REFERENCES စာရင်း:'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullDraftFromWorkspace}
                  className="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>🔄</span> Draft Studio မှ ဆွဲယူမည်
                </button>
                <label className="cursor-pointer text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1">
                  <span>📎</span> Upload File
                  <input type="file" accept=".docx,.pdf,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {fileStats && (
              <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg w-fit">
                {fileStats}
              </div>
            )}

            {(activeSubMode === 'turnitin' || activeSubMode === 'source_finder') && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold">Course Code:</label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold">Prompt / Topic (မေးခွန်း):</label>
                  <input
                    type="text"
                    value={promptExcerpt}
                    onChange={(e) => setPromptExcerpt(e.target.value)}
                    placeholder="Compare and contrast..."
                    className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>
            )}

            <textarea
              rows={12}
              value={paperText}
              onChange={(e) => setPaperText(e.target.value)}
              placeholder={
                activeSubMode === 'turnitin'
                  ? 'Paste your full paper including title page, body, and references to scan for false positives...'
                  : activeSubMode === 'source_finder'
                  ? 'Paste your essay draft, research problem, or paragraph here to discover relevant academic sources...'
                  : 'Paste your References list or full paper to audit citation ages...'
              }
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {activeSubMode === 'turnitin' && (
            <button
              type="button"
              onClick={handleScanTurnitin}
              disabled={loading || !paperText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Turnitin False-Positives များကို စစ်ဆေးနေသည်...</span>
                </>
              ) : (
                <>
                  <span>🛡️</span>
                  <span>False-Positive Shield ဖြင့် စစ်ဆေးမည်</span>
                </>
              )}
            </button>
          )}

          {activeSubMode === 'source_finder' && (
            <button
              type="button"
              onClick={handleSearchSources}
              disabled={loading || (!paperText.trim() && !promptExcerpt.trim())}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>စစ်မှန်သော သုတေသနများ ရှာဖွေနေပါသည်...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>စာအုပ်/ဂျာနယ် အစစ်များ ရှာဖွေမည်</span>
                </>
              )}
            </button>
          )}

          {activeSubMode === 'recency' && (
            <button
              type="button"
              onClick={handleCalculateRecency}
              disabled={!paperText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all mt-2 cursor-pointer"
            >
              <span>📅</span>
              <span>ကိုးကား သက်တမ်းများ တွက်ချက်စစ်ဆေးမည်</span>
            </button>
          )}
        </div>

        {/* Right Output Dashboard */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200">
              {activeSubMode === 'turnitin'
                ? 'PLAGIARISM SHIELD စစ်ဆေးတွေ့ရှိချက်'
                : activeSubMode === 'recency'
                ? 'REFERENCES သက်တမ်း ခွဲခြမ်းစိတ်ဖြာမှု'
                : 'အတည်ပြုပြီးသော စာအုပ်/ဂျာနယ် ရလဒ်များ'}
            </span>
            {turnitinResult && activeSubMode === 'turnitin' && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                Est. Similarity: {turnitinResult.estimatedSimilarityBand}
              </span>
            )}
          </div>

          {/* TURNITIN VIEW */}
          {activeSubMode === 'turnitin' &&
            (turnitinResult ? (
              <div className="space-y-3.5">
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-700/40 text-xs">
                  <span className="font-bold text-cyan-300 block mb-0.5">🎯 Authenticity Assessment:</span>
                  <p className="text-slate-200 leading-relaxed">{turnitinResult.trueOriginalityCheck}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">False-Positive Traps Identified:</span>
                  {turnitinResult.falsePositiveRiskAreas.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                      <p className="italic text-amber-200 font-serif">"{item.textSegment}"</p>
                      <p className="text-slate-400 text-[11px]">
                        <strong className="text-slate-300">Reason:</strong> {item.reason}
                      </p>
                      <p className="text-cyan-300 text-[11px]">
                        <strong className="text-cyan-400">Recommendation:</strong> {item.fixAdvice}
                      </p>
                    </div>
                  ))}
                </div>

                {turnitinResult.recommendedActions && turnitinResult.recommendedActions.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-emerald-400 block">Actionable Next Steps:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 text-[11px]">
                      {turnitinResult.recommendedActions.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>စာမူကြမ်းကို ဘယ်ဘက်တွင် ထည့်သွင်းပြီး မတင်မီ Turnitin မှားယွင်းအမှတ်တက်နိုင်သော အချက်များကို ဖယ်ရှားပါ</span>
              </div>
            ))}

          {/* SOURCE FINDER VIEW */}
          {activeSubMode === 'source_finder' &&
            (foundSources.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {foundSources.map((source, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 mr-2">
                          {source.sourceType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{source.year}</span>
                        <h4 className="font-bold text-slate-100 text-xs mt-1">{source.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{source.authors} · {source.publisher}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCitation(source.apaCitation, idx)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 shrink-0 cursor-pointer"
                      >
                        {copiedIndex === idx ? '✓ Copied' : '📋 Copy APA'}
                      </button>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                      <strong className="text-indigo-300">Relevance:</strong> {source.relevance}
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400 font-mono truncate max-w-xs">{source.apaCitation}</span>
                      {source.doiOrUrl && (
                        <a
                          href={source.doiOrUrl.startsWith('http') ? source.doiOrUrl : `https://doi.org/${source.doiOrUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline shrink-0 font-semibold"
                        >
                          View DOI / Source ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>သင်၏ Assignment ခေါင်းစဉ် သို့မဟုတ် စာမူကြမ်းကို ဘယ်ဘက်တွင် ထည့်သွင်းပြီး သုတေသနများ ရှာဖွေပါ</span>
              </div>
            ))}

          {/* RECENCY VIEW */}
          {activeSubMode === 'recency' &&
            (auditItems.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">APA 7th Recency Benchmark (&gt; 70% Recent):</span>
                  <span className={`text-xs font-bold font-mono ${recencyRate && recencyRate >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {recencyRate}% Recent (&lt;= 5 yrs)
                  </span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {auditItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{item.author}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.statusColor}`}>
                          {item.year ? `${item.year} (${item.age} yrs ago)` : 'No Year'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{item.rawEntry}</p>
                      <p className="text-[10px] text-cyan-300 mt-1 italic">{item.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>References List ပါဝင်သော စာမူကြမ်းကို ထည့်သွင်းပြီး သက်တမ်း စစ်ဆေးပါ</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
