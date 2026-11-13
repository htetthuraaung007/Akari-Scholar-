import React, { useState, useEffect } from 'react';
import { executeGeminiRequest } from '../services/geminiService';

const PARAPHRASER_STORAGE_KEY = 'paraphraser_active_state_v2';

interface ParaphraserPersistedState {
  paraphraseText: string;
  paraphraseDepth: 'standard' | 'deep' | 'academic';
  paraphraseResult: string;
  usedEngine: string;
}

function loadParaphraserState(): ParaphraserPersistedState {
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(PARAPHRASER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ParaphraserPersistedState>;
        return {
          paraphraseText: typeof parsed.paraphraseText === 'string' ? parsed.paraphraseText : '',
          paraphraseDepth:
            parsed.paraphraseDepth === 'standard' ||
            parsed.paraphraseDepth === 'deep' ||
            parsed.paraphraseDepth === 'academic'
              ? parsed.paraphraseDepth
              : 'academic',
          paraphraseResult: typeof parsed.paraphraseResult === 'string' ? parsed.paraphraseResult : '',
          usedEngine: typeof parsed.usedEngine === 'string' ? parsed.usedEngine : '',
        };
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return {
    paraphraseText: '',
    paraphraseDepth: 'academic',
    paraphraseResult: '',
    usedEngine: '',
  };
}

// Open-Source Rule-Based Academic Synonyms & Structural Dictionary (Free Fallback)
const ACADEMIC_REPHRASE_DICTIONARY: Record<string, string> = {
  'delve': 'examine',
  'delve into': 'investigate',
  'testament to': 'evidence of',
  'beacon': 'model',
  'furthermore': 'moreover',
  'it is important to note': 'notably',
  'in conclusion': 'ultimately',
  'a lot of': 'substantial',
  'shows that': 'demonstrates that',
  'big problem': 'critical challenge',
  'help': 'facilitate',
  'make sure': 'ensure',
  'get': 'obtain',
  'good': 'advantageous',
  'bad': 'detrimental',
  'very': 'markedly',
  'think': 'hypothesize'
};

export const Paraphraser: React.FC = () => {
  const initialPersisted = loadParaphraserState();

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paraphraseText, setParaphraseText] = useState(initialPersisted.paraphraseText);
  const [paraphraseDepth, setParaphraseDepth] = useState<'standard' | 'deep' | 'academic'>(
    initialPersisted.paraphraseDepth
  );
  const [paraphraseResult, setParaphraseResult] = useState(initialPersisted.paraphraseResult);
  const [usedEngine, setUsedEngine] = useState<string>(initialPersisted.usedEngine);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearToast, setClearToast] = useState(false);

  // Sync Paraphraser state to sessionStorage across tab switches
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stateToSave: ParaphraserPersistedState = {
        paraphraseText,
        paraphraseDepth,
        paraphraseResult,
        usedEngine,
      };
      sessionStorage.setItem(PARAPHRASER_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore storage quota errors
    }
  }, [paraphraseText, paraphraseDepth, paraphraseResult, usedEngine]);

  const executeClearParaphraser = () => {
    setParaphraseText('');
    setParaphraseResult('');
    setUsedEngine('');
    setErrorMessage(null);
    setShowClearConfirm(false);
    setClearToast(true);
    setTimeout(() => setClearToast(false), 2000);
  };

  const handleRequestClear = () => {
    if (!paraphraseText.trim() && !paraphraseResult.trim()) {
      executeClearParaphraser();
      return;
    }
    setShowClearConfirm(true);
  };

  // 1. Free Open-Source Client-Side Rephraser Engine
  const runFreeOpenSourceEngine = (input: string, depth: 'standard' | 'deep' | 'academic'): string => {
    let result = input;

    Object.entries(ACADEMIC_REPHRASE_DICTIONARY).forEach(([target, replacement]) => {
      const regex = new RegExp(`\\b${target}\\b`, 'gi');
      result = result.replace(regex, replacement);
    });

    if (depth === 'academic' || depth === 'deep') {
      result = result
        .replace(/\bcan not\b/gi, 'cannot')
        .replace(/\bdon't\b/gi, 'do not')
        .replace(/\bwon't\b/gi, 'will not')
        .replace(/\bcan't\b/gi, 'cannot');
    }

    return result.trim();
  };

  // 2. Main Paraphrase Controller (Centralized executeGeminiRequest with Open-Source Fallback)
  const handleParaphraseSubmit = async () => {
    if (!paraphraseText.trim()) {
      setErrorMessage('ကျေးဇူးပြု၍ Paraphrase ပြုလုပ်လိုသော စာသားကို ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const systemInstruction =
      'You are a professional Academic Tone Polisher and Humanizer. Output ONLY the clean paraphrased text in 100% formal academic English with zero meta commentary.';
    const prompt = `TASK: Paraphrase the following academic passage using "${paraphraseDepth}" mode.
STRICT RULES:
1. OUTPUT MUST BE 100% IN ACADEMIC ENGLISH ONLY.
2. Completely remove AI clichés ("delve", "testament", "beacon", "furthermore", "it is important to note").
3. Retain all citations intact (e.g. author, year, page numbers).
4. Maintain a natural scholarly rhythm that flows naturally through AI detectors.

INPUT TEXT:
${paraphraseText}`;

    try {
      const text = await executeGeminiRequest(prompt, 'light', systemInstruction, undefined, 1000);
      if (text && text.trim()) {
        setParaphraseResult(text.trim());
        setUsedEngine('Gemini Auto-Cascade (Token-Optimized)');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.warn('Centralized paraphrase error, falling back to local open-source engine:', e);
      setErrorMessage(
        e?.message
          ? `AI Engine Notice: ${e.message} (Switched to Free Open-Source Fallback)`
          : 'AI Engine unavailable; switched to Free Open-Source Fallback.'
      );
    }

    // Fallback: Free Open-Source Engine (If all keys/models are unavailable or network fails)
    const localRephrased = runFreeOpenSourceEngine(paraphraseText, paraphraseDepth);
    setParaphraseResult(localRephrased);
    setUsedEngine('Free Open-Source Academic Engine (Zero-API)');
    setLoading(false);
  };

  const handleCopy = () => {
    if (!paraphraseResult) return;
    navigator.clipboard.writeText(paraphraseResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {clearToast && (
        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <span>✓</span>
          <span>စာသားများကို အောင်မြင်စွာ ရှင်းထုတ်ပြီးပါပြီ။</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[11px] font-bold text-amber-300 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Main 2-Column Paraphrase Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Input & Depth Selector */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-bold text-slate-200">မူရင်း စာသား:</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['standard', 'deep', 'academic'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setParaphraseDepth(d)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${
                      paraphraseDepth === d
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRequestClear}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
              </button>
            </div>
          </div>

          {showClearConfirm && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
              <p className="text-red-200 font-medium leading-relaxed">
                ထည့်သွင်းထားသော မူရင်းစာသားနှင့် Paraphrased ရလဒ်များကို ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={executeClearParaphraser}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  သေချာသည် (Clear)
                </button>
              </div>
            </div>
          )}

          <textarea
            rows={13}
            value={paraphraseText}
            onChange={(e) => setParaphraseText(e.target.value)}
            placeholder="Enter text to paraphrase..."
            className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
          />

          <button
            type="button"
            onClick={handleParaphraseSubmit}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>🔄</span>
            <span>{loading ? 'Paraphrasing...' : 'Paraphrase & Depth Control (English)'}</span>
          </button>
        </div>

        {/* Right Column: Output Area */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">PARAPHRASED SCHOLARLY RESULT (ENGLISH)</span>
                {usedEngine && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                    {usedEngine}
                  </span>
                )}
              </div>
              {paraphraseResult && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copied ? '✓ Copied' : '📋 Copy Clean Text'}
                </button>
              )}
            </div>

            <div className="h-[360px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-serif leading-relaxed whitespace-pre-wrap mt-2">
              {paraphraseResult || 'Paraphrased text will appear here in 100% English...'}
            </div>
          </div>
        </div>
      </div>

      {/* AI Detector သတိပေးချက်နှင့် Online Humanizer စနစ်များ */}
      <div className="p-4 rounded-2xl bg-[#0c0d12] border border-amber-900/40 space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
            <span>⚠️</span>
            <span>AI Detector သတိပေးချက်နှင့် Online Humanizer စနစ်များ</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-800/60 text-amber-400 bg-amber-950/40">
            Probabilistic Notice
          </span>
        </div>

        <p className="text-[11px] text-amber-200/90 leading-relaxed">
          မည်သည့် AI Humanizer ကိရိယာမျှ ၁၀၀% အပြည့်အဝ တိကျမှု မပေးနိုင်ပါ။ AI Detectors များသည် ဖြစ်နိုင်ခြေ (Probability) ဖြင့်သာ ခန့်မှန်းခြင်းဖြစ်၍ စာတမ်းမတင်မီ မိမိကိုယ်တိုင် ပြန်လည်စစ်ဆေးတည်းဖြတ်ရန် လိုအပ်ပါသည်။
        </p>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1">
            <span>🌐</span> အခမဲ့ Online AI Humanizer & Paraphraser များသို့ သွားရောက်ရန်:
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            {[
              { name: 'HumanizeAI Pro', url: 'https://www.humanizeai.pro' },
              { name: 'QuillBot', url: 'https://quillbot.com' },
              { name: 'BypassGPT', url: 'https://bypassgpt.ai' },
              { name: 'Undetectable AI', url: 'https://undetectable.ai' },
              { name: 'HIX Bypass', url: 'https://hix.ai/bypass-gpt' }
            ].map((tool, idx) => (
              <a
                key={idx}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-[11px] text-slate-300 hover:text-amber-300 transition-all flex items-center gap-1"
              >
                <span>✍️</span>
                <span>{tool.name}</span>
                <span className="text-[9px] text-slate-500">↗</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
