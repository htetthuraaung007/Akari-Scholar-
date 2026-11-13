import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import {
  runChainOfThoughtHumanizer,
  warmHumanizerModelCatalog,
  type HumanizedResult,
} from '../services/aiHumanizerGeminiService';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const COT_HUMANIZER_SESSION_KEY = 'cot_humanizer_state_v2';
const PLAGIARISM_SCANNER_SESSION_KEY = 'plagiarism_scanner_state_v2';

const DEFAULT_HUMANIZER_SAMPLE =
  'Public health suffers from uneven distribution. Social factors like income and geography define access. Vulnerable groups struggle with financial limits. Furthermore, it is crucial to recognize that systemic underfunding remains a core problem.';

export interface PlagiarismMatch {
  phrase: string;
  count: number;
}

interface CotHumanizerSessionState {
  humanizerInput: string;
  humanizerResult: HumanizedResult | null;
  humanizerToneRegister: 'scholarly' | 'concise';
}

interface PlagiarismScannerSessionState {
  plagiarismInput: string;
  plagiarismFileStats: string | null;
  plagiarismMatches: PlagiarismMatch[];
  plagiarismHasScanned: boolean;
}

interface PdfTextContentItem {
  str?: string;
}

/**
 * Pure, punctuation-normalized 4-gram tokenization & O(N) frequency detector (Zero Token Cost).
 */
export function scanLocalFourGramRepetitions(rawText: string): {
  wordCount: number;
  matches: PlagiarismMatch[];
} {
  const normalized = rawText
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized ? normalized.split(' ').filter(Boolean) : [];
  if (words.length < 4) {
    return { wordCount: words.length, matches: [] };
  }

  const counts = new Map<string, number>();
  for (let i = 0; i <= words.length - 4; i++) {
    const gram = `${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`;
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }

  const matches: PlagiarismMatch[] = [];
  counts.forEach((count, phrase) => {
    if (count > 1) {
      matches.push({ phrase, count });
    }
  });

  matches.sort((a, b) => b.count - a.count);
  return {
    wordCount: words.length,
    matches: matches.slice(0, 10),
  };
}

function loadHumanizerSessionState(): CotHumanizerSessionState {
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(COT_HUMANIZER_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CotHumanizerSessionState>;
        return {
          humanizerInput:
            typeof parsed.humanizerInput === 'string'
              ? parsed.humanizerInput
              : '',
          humanizerResult:
            parsed.humanizerResult && typeof parsed.humanizerResult.humanizedText === 'string'
              ? parsed.humanizerResult
              : null,
          humanizerToneRegister:
            parsed.humanizerToneRegister === 'concise' ? 'concise' : 'scholarly',
        };
      }
    } catch {
      // Ignore malformed session data
    }
  }
  return {
    humanizerInput: '',
    humanizerResult: null,
    humanizerToneRegister: 'scholarly',
  };
}

function loadPlagiarismSessionState(): PlagiarismScannerSessionState {
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(PLAGIARISM_SCANNER_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PlagiarismScannerSessionState>;
        return {
          plagiarismInput: typeof parsed.plagiarismInput === 'string' ? parsed.plagiarismInput : '',
          plagiarismFileStats:
            typeof parsed.plagiarismFileStats === 'string' ? parsed.plagiarismFileStats : null,
          plagiarismMatches: Array.isArray(parsed.plagiarismMatches)
            ? parsed.plagiarismMatches.filter(
                (m): m is PlagiarismMatch =>
                  Boolean(m) && typeof m.phrase === 'string' && typeof m.count === 'number'
              )
            : [],
          plagiarismHasScanned: Boolean(parsed.plagiarismHasScanned),
        };
      }
    } catch {
      // Ignore malformed session data
    }
  }
  return {
    plagiarismInput: '',
    plagiarismFileStats: null,
    plagiarismMatches: [],
    plagiarismHasScanned: false,
  };
}

export const LocalAiBypassStudio: React.FC = () => {
  const initialHumanizer = loadHumanizerSessionState();
  const initialPlagiarism = loadPlagiarismSessionState();

  const [activeTab, setActiveTab] = useState<'humanizer' | 'plagiarism'>('humanizer');

  // Humanizer States (Persisted in sessionStorage `cot_humanizer_state`)
  const [humanizerInput, setHumanizerInput] = useState<string>(initialHumanizer.humanizerInput);
  const [humanizerToneRegister, setHumanizerToneRegister] = useState<'scholarly' | 'concise'>(
    initialHumanizer.humanizerToneRegister
  );
  const [humanizerLoading, setHumanizerLoading] = useState<boolean>(false);
  const [humanizerResult, setHumanizerResult] = useState<HumanizedResult | null>(
    initialHumanizer.humanizerResult
  );
  const [copySuccessHumanizer, setCopySuccessHumanizer] = useState<boolean>(false);
  const [confirmClearHumanizer, setConfirmClearHumanizer] = useState<boolean>(false);
  const [humanizerNotice, setHumanizerNotice] = useState<string | null>(null);

  // Plagiarism States (Persisted in sessionStorage `plagiarism_scanner_state`)
  const [plagiarismInput, setPlagiarismInput] = useState<string>(initialPlagiarism.plagiarismInput);
  const [plagiarismFileStats, setPlagiarismFileStats] = useState<string | null>(
    initialPlagiarism.plagiarismFileStats
  );
  const [plagiarismMatches, setPlagiarismMatches] = useState<PlagiarismMatch[]>(
    initialPlagiarism.plagiarismMatches
  );
  const [plagiarismHasScanned, setPlagiarismHasScanned] = useState<boolean>(
    initialPlagiarism.plagiarismHasScanned
  );
  const [copySuccessPlagiarism, setCopySuccessPlagiarism] = useState<boolean>(false);
  const [confirmClearPlagiarism, setConfirmClearPlagiarism] = useState<boolean>(false);
  const [plagiarismNotice, setPlagiarismNotice] = useState<string | null>(null);

  // Warm verified Gemini dynamic model catalog once cleanly on mount
  useEffect(() => {
    void warmHumanizerModelCatalog();
  }, []);

  // Sync Humanizer state to sessionStorage (`cot_humanizer_state`)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: CotHumanizerSessionState = {
        humanizerInput,
        humanizerResult,
        humanizerToneRegister,
      };
      sessionStorage.setItem(COT_HUMANIZER_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [humanizerInput, humanizerResult, humanizerToneRegister]);

  // Sync Plagiarism state to sessionStorage (`plagiarism_scanner_state`)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: PlagiarismScannerSessionState = {
        plagiarismInput,
        plagiarismFileStats,
        plagiarismMatches,
        plagiarismHasScanned,
      };
      sessionStorage.setItem(PLAGIARISM_SCANNER_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [plagiarismInput, plagiarismFileStats, plagiarismMatches, plagiarismHasScanned]);

  // External Tools Directory (Neutral & Plain)
  const ONLINE_PLAGIARISM_TOOLS = [
    {
      name: 'DupliChecker',
      badge: 'Free (1,000 words)',
      url: 'https://www.duplichecker.com/',
      desc: 'Web ပေါ်ရှိ အချက်အလက်များနှင့် တိုက်ဆိုင်စစ်ဆေးပေးသည့် အခမဲ့ tool ဖြစ်သည်။',
    },
    {
      name: 'SmallSEOTools',
      badge: 'Web Checker',
      url: 'https://smallseotools.com/plagiarism-checker/',
      desc: 'စာပိုဒ်အလိုက် အင်တာနက်စာမျက်နှာများနှင့် တိုက်စစ်ပေးသည့် စနစ်ဖြစ်သည်။',
    },
    {
      name: 'PlagiarismDetector',
      badge: 'Free Tier',
      url: 'https://plagiarismdetector.net/',
      desc: 'တူညီနေသော စာကြောင်းများကို အင်တာနက်ရင်းမြစ်များနှင့် စစ်ဆေးပေးသည်။',
    },
    {
      name: 'Scribbr',
      badge: 'Academic Checker',
      url: 'https://www.scribbr.com/plagiarism-checker/',
      desc: 'ကျောင်းသုံးစာတမ်းများနှင့် ပညာရပ်ဆိုင်ရာ database များကို တိုက်စစ်ပေးသည်။',
    },
    {
      name: 'Grammarly',
      badge: 'Academic / Web',
      url: 'https://www.grammarly.com/plagiarism-checker',
      desc: 'ProQuest database နှင့် academic source များကို တိုက်စစ်ပေးသည်။',
    },
  ];

  const ONLINE_HUMANIZER_TOOLS = [
    { name: 'HumanizeAI Pro', url: 'https://www.humanizeai.pro/', badge: 'AI Rewriter' },
    { name: 'QuillBot', url: 'https://quillbot.com/paraphrasing-tool', badge: 'Paraphraser' },
    { name: 'BypassGPT', url: 'https://bypassgpt.ai/', badge: 'AI Rewriter' },
    { name: 'Undetectable AI', url: 'https://undetectable.ai/', badge: 'Tone Polisher' },
    { name: 'HIX Bypass', url: 'https://hix.ai/bypass-ai-detection', badge: 'AI Rewriter' },
  ];

  const ONLINE_AI_DETECTOR_TOOLS = [
    { name: 'ZeroGPT', url: 'https://www.zerogpt.com/' },
    { name: 'GPTZero', url: 'https://gptzero.me/' },
    { name: 'Copyleaks', url: 'https://copyleaks.com/ai-content-detector' },
    { name: 'QuillBot AI Detector', url: 'https://quillbot.com/ai-content-detector' },
  ];

  // Clear Handlers for View 2 (Humanizer)
  const executeClearHumanizer = () => {
    setHumanizerInput('');
    setHumanizerResult(null);
    setHumanizerToneRegister('scholarly');
    setHumanizerNotice(null);
    setConfirmClearHumanizer(false);
  };

  const handleRequestClearHumanizer = () => {
    if (!humanizerInput.trim() && !humanizerResult) {
      executeClearHumanizer();
      return;
    }
    setConfirmClearHumanizer(true);
  };

  // Clear Handlers for View 3 (Plagiarism Scanner)
  const executeClearPlagiarism = () => {
    setPlagiarismInput('');
    setPlagiarismFileStats(null);
    setPlagiarismMatches([]);
    setPlagiarismHasScanned(false);
    setPlagiarismNotice(null);
    setConfirmClearPlagiarism(false);
  };

  const handleRequestClearPlagiarism = () => {
    if (!plagiarismInput.trim() && !plagiarismFileStats && !plagiarismHasScanned) {
      executeClearPlagiarism();
      return;
    }
    setConfirmClearPlagiarism(true);
  };

  // Universal File Ingestion (.docx / .pdf / .txt)
  const handlePlagiarismFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPlagiarismNotice(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let extractedText = '';

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        extractedText = res.value;
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageItems = content.items as PdfTextContentItem[];
          extractedText += pageItems.map((it) => it.str || '').join(' ') + '\n';
        }
      } else {
        extractedText = await file.text();
      }

      const cleanText = extractedText.trim();
      const words = cleanText ? cleanText.split(/\s+/).length : 0;
      setPlagiarismInput(cleanText);
      setPlagiarismFileStats(`✓ ${file.name} (${words.toLocaleString()} words loaded)`);
      setPlagiarismMatches([]);
      setPlagiarismHasScanned(false);
    } catch {
      setPlagiarismNotice(`${file.name} ကို ဖတ်ရှု၍ မရပါခင်ဗျာ။`);
    } finally {
      e.target.value = '';
    }
  };

  // Humanizer Execution via Centralized Dynamic Model Resolver
  const handleHumanize = async () => {
    if (!humanizerInput.trim()) {
      setHumanizerNotice('Humanize ပြုလုပ်လိုသော စာသားကို ဘယ်ဘက်တွင် ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    setHumanizerNotice(null);
    setHumanizerLoading(true);
    try {
      const res = await runChainOfThoughtHumanizer(humanizerInput);
      setHumanizerResult(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Humanize ပြုလုပ်ရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။';
      setHumanizerNotice(message);
    } finally {
      setHumanizerLoading(false);
    }
  };

  // Local 4-Gram Algorithm (100% Client-Side, Zero Token Cost)
  const handleRunLocalPlagiarism = () => {
    if (!plagiarismInput.trim()) {
      setPlagiarismNotice('စစ်ဆေးရန် စာမူကြမ်း ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const { wordCount, matches } = scanLocalFourGramRepetitions(plagiarismInput);
    if (wordCount < 8) {
      setPlagiarismNotice('အနည်းဆုံး စကားလုံး ၈ လုံးကျော် ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    setPlagiarismNotice(null);
    setPlagiarismMatches(matches);
    setPlagiarismHasScanned(true);
  };

  const copyToClipboard = (text: string, type: 'humanizer' | 'plagiarism') => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    if (type === 'humanizer') {
      setCopySuccessHumanizer(true);
      setTimeout(() => setCopySuccessHumanizer(false), 2500);
    } else {
      setCopySuccessPlagiarism(true);
      setTimeout(() => setCopySuccessPlagiarism(false), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Side-by-Side Sub-mode Pills */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/40">
            <span>🛡️</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Local Plagiarism နှင့် မူရင်းစစ်ဆေးရေး ကိရိယာ &amp; AI Tone Studio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              သဘာဝကျသော လူသားရေးဟန်ဖြစ်စေရန် Humanizer စနစ်နှင့် စာတမ်းမူရင်းစစ်ဆေးရေး စနစ်
            </p>
          </div>
        </div>

        {/* Side-by-Side Mode Switchers */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('humanizer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'humanizer'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛡️</span>
            <span>CoT Academic Humanizer &amp; Tone Polisher</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plagiarism')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'plagiarism'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔍</span>
            <span>Plagiarism &amp; Online Integrity Suite</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 2: HUMANIZER STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'humanizer' && (
        <div className="space-y-4">
          {humanizerNotice && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between gap-2">
              <span>⚠️ {humanizerNotice}</span>
              <button
                type="button"
                onClick={() => setHumanizerNotice(null)}
                className="text-[11px] font-bold text-amber-300 hover:underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Input */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>📄</span> မူလ AI (သို့မဟုတ်) အကြမ်းစာမူကြမ်း:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-indigo-400 font-mono">
                      Academic Tone Polisher Engine
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestClearHumanizer}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                    </button>
                  </div>
                </div>

                {confirmClearHumanizer && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                    <p className="text-red-200 font-medium leading-relaxed">
                      ထည့်သွင်းထားသော စာမူကြမ်းနှင့် Humanized ရလဒ်များကို ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmClearHumanizer(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="button"
                        onClick={executeClearHumanizer}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        သေချာသည် (Clear)
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  rows={14}
                  value={humanizerInput}
                  onChange={(e) => setHumanizerInput(e.target.value)}
                  placeholder="AI အသုံးအနှုန်းများ ပါဝင်နေသော စာမူကြမ်းကို ဤနေရာတွင် ထည့်သွင်းပါ..."
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleHumanize}
                disabled={humanizerLoading || !humanizerInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all mt-2 cursor-pointer"
              >
                {humanizerLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>AI Clichés များကို ဖယ်ရှား၍ လူသားရေးဟန် ညှိနေသည်...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Humanize &amp; Elevate to Human Voice</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Output Dashboard */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-200">HUMANIZED SCHOLARLY RESULT</span>
                {humanizerResult && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHumanize}
                      className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      🔄 အသစ်ပြန်ပြောင်းမည်
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(humanizerResult.humanizedText, 'humanizer')}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer"
                    >
                      {copySuccessHumanizer ? '✓ ကူးပြီးပါပြီ' : '📋 Copy Result'}
                    </button>
                  </div>
                )}
              </div>

              {humanizerLoading ? (
                <div className="h-72 flex flex-col items-center justify-center space-y-3">
                  <div className="w-9 h-9 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-200">
                    Sentence Burstiness နှင့် အချိုးအဆစ် ညှိယူနေသည်...
                  </p>
                </div>
              ) : humanizerResult ? (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-emerald-400">
                        ✨ HUMANITY CADENCE &amp; LEXICAL DIVERSITY
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                        High Human Cadence &amp; Variance ✓
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        <strong className="text-indigo-300">Burstiness Variance:</strong>{' '}
                        {humanizerResult.burstinessScore}
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        <strong className="text-cyan-300">Target Word Count:</strong> ~
                        {humanizerResult.wordCount} words
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-serif text-slate-100 text-xs leading-relaxed space-y-2">
                    <p className="whitespace-pre-wrap">{humanizerResult.humanizedText}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-xs space-y-1">
                    <span className="font-bold text-indigo-300 block">
                      Applied Scholarly Enhancements:
                    </span>
                    <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                      {humanizerResult.styleImprovements.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="h-72 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1 text-center px-4">
                  <span>
                    ဘယ်ဘက်တွင် စာမူကြမ်းထည့်သွင်းပြီး "Humanize &amp; Elevate to Human Voice" ကို နှိပ်ပါ
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ONLINE FREE HUMANIZERS & DISCLOSURE */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-700/40 space-y-3 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-850/40">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <span>⚠️</span>
                <span>AI Detector သတိပေးချက်နှင့် Online Humanizer စနစ်များ</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-200 border border-amber-750/50">
                Probabilistic Notice
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed">
              မည်သည့် AI Humanizer ကိရိယာမျှ ၁၀၀% အပြည့်အဝ တိကျမှု မပေးနိုင်ပါ။ AI Detectors များသည်
              ဖြစ်နိုင်ခြေ (Probability) ဖြင့်သာ ခန့်မှန်းခြင်းဖြစ်၍ စာတမ်းမတင်မီ မိမိကိုယ်တိုင်
              ပြန်လည်စစ်ဆေးတည်းဖြတ်ရန် လိုအပ်ပါသည်။
            </p>

            <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-300">
                🌐 အခမဲ့ Online AI Humanizer &amp; Paraphraser များသို့ သွားရောက်ရန်:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {ONLINE_HUMANIZER_TOOLS.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] flex items-center gap-1.5 transition-all hover:border-pink-500 cursor-pointer"
                  >
                    <span>✍️</span>
                    <span>{tool.name}</span>
                    <span className="text-[9px] text-slate-500">↗</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-amber-800/30 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-300">
                🔍 လူသုံးအများဆုံး Online AI Detectors များသို့ သွားရောက်စစ်ဆေးရန်:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {ONLINE_AI_DETECTOR_TOOLS.map((detector) => (
                  <a
                    key={detector.name}
                    href={detector.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>🔍</span>
                    <span>{detector.name}</span>
                    <span className="text-[9px] text-slate-500">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: PLAGIARISM & ONLINE INTEGRITY SUITE */}
      {/* ========================================================================= */}
      {activeTab === 'plagiarism' && (
        <div className="space-y-4">
          {plagiarismNotice && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between gap-2">
              <span>⚠️ {plagiarismNotice}</span>
              <button
                type="button"
                onClick={() => setPlagiarismNotice(null)}
                className="text-[11px] font-bold text-amber-300 hover:underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Input: Paper & File Upload */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>🔍</span> တိုက်စစ်လိုသော စာမူကြမ်း:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const cached = localStorage.getItem('akari_current_active_draft');
                        if (cached) {
                          setPlagiarismInput(cached);
                          const words = cached.trim().split(/\s+/).length;
                          setPlagiarismFileStats(
                            `✓ Draft Studio မှ ဆွဲယူထားသည် (${words.toLocaleString()} words)`
                          );
                          setPlagiarismNotice(null);
                        } else {
                          setPlagiarismNotice('Draft Studio တွင် စာမူကြမ်း မတွေ့ရှိသေးပါခင်ဗျာ။');
                        }
                      }}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      🔄 Draft Studio မှ ဆွဲယူမည်
                    </button>
                    <label className="cursor-pointer text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
                      <span>📎</span> Upload .docx / .pdf / .txt
                      <input
                        type="file"
                        accept=".docx,.pdf,.txt"
                        onChange={handlePlagiarismFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRequestClearPlagiarism}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                    </button>
                  </div>
                </div>

                {confirmClearPlagiarism && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                    <p className="text-red-200 font-medium leading-relaxed">
                      တိုက်စစ်ထားသော စာမူကြမ်းနှင့် 4-Gram Scan ရလဒ်များကို ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmClearPlagiarism(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="button"
                        onClick={executeClearPlagiarism}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        သေချာသည် (Clear)
                      </button>
                    </div>
                  </div>
                )}

                {plagiarismFileStats && (
                  <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg w-fit">
                    {plagiarismFileStats}
                  </div>
                )}

                <textarea
                  rows={13}
                  value={plagiarismInput}
                  onChange={(e) => setPlagiarismInput(e.target.value)}
                  placeholder="Paste your essay draft here or upload .docx / .pdf to check local repetition or copy for online tools..."
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRunLocalPlagiarism}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>🔬</span>
                  <span>Local 4-Gram စစ်ဆေးမည် (Internal Loops)</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(plagiarismInput, 'plagiarism')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <span>{copySuccessPlagiarism ? '✓ Copied' : '📋 Copy Draft'}</span>
                </button>
              </div>
            </div>

            {/* Right: Local 4-Gram Output */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200">
                  LOCAL 4-GRAM SCANNER တွေ့ရှိချက်
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-cyan-400 border border-slate-800">
                  Zero-Token Algorithm
                </span>
              </div>

              {plagiarismMatches.length > 0 ? (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                      <span>ℹ️</span>
                      <span>စိုးရိမ်ရန်မလိုပါ (Self-Repetition Notice):</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      ဤစာရင်းသည် သင့်စာတမ်းအတွင်း အသုံးအနှုန်းနှင့် စကားစုများ မည်မျှ ထပ်ခါတလဲလဲ
                      ပါဝင်နေသည်ကိုသာ ပြသပေးခြင်းဖြစ်ပြီး Plagiarism မိခြင်း မဟုတ်သဖြင့် ဘာမှ
                      စိုးရိမ်စရာမရှိပါ။
                    </p>
                    <p className="text-[11px] text-amber-300/90 font-medium">
                      💡 အင်တာနက်နှင့် တက္ကသိုလ် Database ပေါ်ရှိ အချက်အလက်များနှင့် တကယ့် Plagiarism
                      စစ်စစ်ကို အတိအကျ သိရှိလိုပါက အောက်တွင် ဖော်ပြထားသော Online Plagiarism
                      ဝဘ်ဆိုက်များတွင် သွားရောက် တိုက်စစ်နိုင်ပါသည်။
                    </p>
                  </div>
                  <div className="space-y-2">
                    {plagiarismMatches.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs gap-2"
                      >
                        <span className="font-mono text-amber-200">"{item.phrase}"</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/40 shrink-0">
                          {item.count} ကြိမ် ထပ်နေသည်
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : plagiarismHasScanned ? (
                <div className="h-64 flex flex-col items-center justify-center text-center px-6 space-y-2">
                  <div className="px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                    ✓ ထပ်ခါတလဲလဲ တူညီနေသော 4-Gram စကားစုများ မတွေ့ရှိပါ (0 Internal Loops)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-md">
                    သင့်စာမူကြမ်းအတွင်း တူညီသော စကားလုံး ၄ လုံးဆက်တိုက် ထပ်မံပါဝင်မှု မရှိပါ။
                    အင်တာနက် Database များနှင့် တိုက်စစ်ရန် အောက်ပါ Online Checkers များကို
                    အသုံးပြုနိုင်ပါသည်။
                  </p>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                  <span>စာသားထည့်သွင်းပြီး "Local 4-Gram စစ်ဆေးမည်" ကို နှိပ်ပါ</span>
                </div>
              )}
            </div>
          </div>

          {/* ONLINE PLAGIARISM CHECKERS DIRECT ACCESS (NEUTRAL & PLAIN) */}
          <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  🌐
                </span>
                <h4 className="text-xs font-bold text-slate-100">
                  Online Plagiarism စစ်ဆေးသည့် ဝဘ်ဆိုက်များ
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 italic">Open in New Tab ↗</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              ပြင်ပ database များနှင့် တိုက်စစ်လိုပါက အပေါ်ရှိ{' '}
              <strong className="text-cyan-300">"📋 Copy Draft"</strong> ဖြင့် စာကို ကူးယူ၍
              အောက်ပါ ဝဘ်ဆိုက်များတွင် စစ်ဆေးနိုင်ပါသည်:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {ONLINE_PLAGIARISM_TOOLS.map((tool) => (
                <a
                  key={tool.name}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between group space-y-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                      {tool.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                      {tool.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{tool.desc}</p>
                  <span className="text-[10px] text-cyan-400 font-semibold group-hover:underline flex items-center gap-1 self-end">
                    စစ်ဆေးရန် သွားမည် ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

