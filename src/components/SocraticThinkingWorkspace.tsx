import React, { useState, useEffect, useRef } from 'react';
import {
  executeGeminiRequest,
  resolveDynamicModelCatalog,
} from '../services/geminiService';
import {
  loadPersistedTabState,
  savePersistedTabState,
} from '../utils/researchPersistence';

interface ChatMessage {
  id: string;
  sender: 'mentor' | 'user';
  text: string;
  timestamp: string;
}

const DAILY_QUERY_LIMIT = 30;
const CHAT_STORAGE_KEY = 'akari_socratic_chat_history';
const LEGACY_CHAT_STORAGE_KEY = 'socratic_chat_history';
const DRAFT_INPUT_PERSIST_KEY = 'socratic_draft_input_v1';

const INITIAL_MENTOR_MESSAGE: ChatMessage = {
  id: 'initial-mentor-msg',
  sender: 'mentor',
  text: 'မင်္ဂလာပါ။ ကျွန်ုပ်သည် သင်၏ တက္ကသိုလ်အဆင့် Socratic Mentor ဖြစ်ပါသည်။ သင်၏ Assignment အဖြေများကို တိုက်ရိုက် ရေးပေးမည် မဟုတ်ဘဲ၊ သင်ကိုယ်တိုင် ခိုင်မာသော အတွေးအခေါ်၊ Thesis နှင့် Counter-arguments များကို ကိုယ်တိုင် ထုတ်ဖော်နိုင်စေရန် ချေပမေးခွန်းများဖြင့် လမ်းပြပေးပါမည်။ အပေါ်ရှိ နမူနာမေးခွန်းများကို နှိပ်၍သော်လည်းကောင်း၊ မိမိဆွေးနွေးလိုသော အကြောင်းအရာကိုသော်လည်းကောင်း လွတ်လပ်စွာ စတင်မေးမြန်းနိုင်ပါသည်ခင်ဗျာ။',
  timestamp: '12:00 AM',
};

function loadInitialChatHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [INITIAL_MENTOR_MESSAGE];
  const saved =
    localStorage.getItem(CHAT_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ChatMessage[];
      }
    } catch {
      // Ignore corrupted local history and fall back cleanly
    }
  }
  return [INITIAL_MENTOR_MESSAGE];
}

function persistChatHistory(nextMessages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(nextMessages));
  } catch {
    // Ignore storage quota errors
  }
}

function getTodayCountFromStorage(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem('akari_socratic_query_date');
  if (savedDate === today) {
    return parseInt(localStorage.getItem('akari_socratic_query_count') || '0', 10) || 0;
  }
  localStorage.setItem('akari_socratic_query_date', today);
  localStorage.setItem('akari_socratic_query_count', '0');
  return 0;
}

// Track active in-flight Socratic promise across tab unmounts/remounts
let activeSocraticInFlight = false;

// High-impact sample starter queries for university assignments
const SAMPLE_QUESTIONS = [
  {
    title: '📌 Thesis Challenge',
    query: 'ကျွန်တော့် Assignment အတွက် "Telemedicine improves rural health in developing nations" လို့ Thesis ရေးထားပါတယ်။ ဒါကို ဘယ်လို ဆန့်ကျင်ဘက် ရှုထောင့်တွေကနေ စိန်ခေါ်ဝေဖန်နိုင်မလဲခင်ဗျာ?'
  },
  {
    title: '⚖️ Counter-Argument',
    query: 'Globalization က နိုင်ငံတကာ ကျန်းမာရေးစနစ်တွေအပေါ် ကောင်းကျိုးသက်ရောက်စေတယ်ဆိုတဲ့ အဆိုပြုချက်ကို ဆန့်ကျင်ဘက် အားနည်းချက်တွေနဲ့ ဘယ်လို ချေပဆွေးနွေးရမလဲ?'
  },
  {
    title: '🔍 Evidence & Logic Gap',
    query: 'ကျွန်တော့် စာတမ်းမှာ အချက်အလက် (Evidence) တွေ များနေပေမယ့် ကိုယ်ပိုင် သုံးသပ်ချက် (Critical Analysis) အားနည်းနေသလို ခံစားရပါတယ်။ ဘယ်လို မေးခွန်းတွေနဲ့ ကိုယ့်စာကို ပြန်စစ်သင့်လဲ?'
  }
];

export const SocraticThinkingWorkspace: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadInitialChatHistory());
  const [inputPrompt, setInputPrompt] = useState<string>(() =>
    loadPersistedTabState<string>(DRAFT_INPUT_PERSIST_KEY, '')
  );
  const [loading, setLoading] = useState<boolean>(() => activeSocraticInFlight);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Daily Limit Counter tracking
  const [dailyCount, setDailyCount] = useState<number>(() => getTodayCountFromStorage());

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Non-blocking catalog warm-up on mount
    void resolveDynamicModelCatalog();

    // Sync state if an in-flight reply completed while switched away
    setMessages(loadInitialChatHistory());
    setLoading(activeSocraticInFlight);
    setDailyCount(getTodayCountFromStorage());

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    persistChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    savePersistedTabState(DRAFT_INPUT_PERSIST_KEY, inputPrompt);
  }, [inputPrompt]);

  const handleClearChat = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => {
        if (isMountedRef.current) setConfirmReset(false);
      }, 4500);
      return;
    }

    const resetMsg: ChatMessage[] = [
      {
        id: `initial-mentor-msg-reset-${Date.now()}`,
        sender: 'mentor',
        text: 'ဆွေးနွေးမှုအသစ် စတင်ပါပြီ။ မည်သည့် Assignment ခေါင်းစဉ် သို့မဟုတ် အတွေးအခေါ်ကို စတင် စမ်းသပ်စစ်ဆေးလိုပါသလဲခင်ဗျာ?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setMessages(resetMsg);
    persistChatHistory(resetMsg);
    try {
      localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setConfirmReset(false);
    setStatusNotice(null);
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || loading || activeSocraticInFlight) return;

    const latestDailyCount = getTodayCountFromStorage();
    if (latestDailyCount >= DAILY_QUERY_LIMIT) {
      setDailyCount(latestDailyCount);
      setStatusNotice(
        `ယနေ့အတွက် မေးခွန်းကန့်သတ်ချက် (${DAILY_QUERY_LIMIT} ခု) ပြည့်သွားပါပြီခင်ဗျာ။ နက်ဖြန်တွင် ဆက်လက်ဆွေးနွေးနိုင်ပါသည်။`
      );
      return;
    }

    setStatusNotice(null);
    setConfirmReset(false);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const historyWithUser = [...messages, userMsg];
    setMessages(historyWithUser);
    persistChatHistory(historyWithUser);

    if (!textToSend) {
      setInputPrompt('');
      savePersistedTabState(DRAFT_INPUT_PERSIST_KEY, '');
    }

    activeSocraticInFlight = true;
    setLoading(true);

    const updatedDailyCount = latestDailyCount + 1;
    setDailyCount(updatedDailyCount);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('akari_socratic_query_date', today);
    localStorage.setItem('akari_socratic_query_count', updatedDailyCount.toString());

    // Token-Conservation: Sliding window - send only the last 4 messages
    const recentHistory = messages.slice(-4);
    const historyContext = recentHistory
      .map((m) => `${m.sender === 'user' ? 'Student' : 'Mentor'}: ${m.text}`)
      .join('\n');
    const contextualPrompt = historyContext
      ? `PREVIOUS DIALOGUE (Last 4 turns):\n${historyContext}\n\nCURRENT STUDENT INQUIRY:\n${query}`
      : `STUDENT INQUIRY:\n${query}`;

    const socraticSystemInstruction = `
You are a strict, insightful University Socratic Mentor.
ACADEMIC INTEGRITY & PEDAGOGY RULES:
1. NEVER give direct assignment solutions, finished thesis paragraphs, or essay rewrites.
2. Guide ONLY through Socratic questioning focused on:
   - Thesis Challenges (exposure of assumptions or vagueness)
   - Counter-Arguments (opposing scholarly perspectives)
   - Evidence & Logic Gaps (missing empirical backing or causal leaps)
3. TOKEN-SAVING BREVITY GUARD (~140 WORDS MAX):
   - No greetings, filler, or polite preambles. Jump straight to the critique.
   - Keep total output strictly under 140 words (3–4 short lines/bullets max).
4. THREE-PART STRUCTURE ONLY:
   - 🎯 Point: One concise sentence pinpointing a logic flaw, vague claim, or evidence gap.
   - ⚖️ Counter: One concise sentence introducing a strong opposing perspective or boundary condition.
   - ❓ Question: One sharp Socratic question forcing the student to defend or refine their claim.
5. LANGUAGE: If asked in Burmese, respond in natural, direct spoken-academic Burmese (keeping essential academic terms in English). If asked in English, respond in crisp academic English.
`.trim();

    try {
      const replyText = await executeGeminiRequest(
        contextualPrompt,
        'light',
        socraticSystemInstruction,
        undefined,
        360,
        undefined,
        true
      );

      const cleanedReply = (replyText || '').trim();
      if (!cleanedReply) {
        throw new Error('Empty Socratic mentor response');
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'mentor',
        text: cleanedReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const persisted = [...loadInitialChatHistory(), botMsg];
      persistChatHistory(persisted);
      if (isMountedRef.current) {
        setMessages(persisted);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'mentor',
        text: 'စနစ်ချိတ်ဆက်မှု ယာယီချို့ယွင်းနေပါသည်။ API Key အခြေအနေနှင့် အင်တာနက်ကို ပြန်လည်စစ်ဆေးပေးပါခင်ဗျာ။',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const persistedWithErr = [...loadInitialChatHistory(), errorMsg];
      persistChatHistory(persistedWithErr);
      if (isMountedRef.current) {
        setMessages(persistedWithErr);
      }
    } finally {
      activeSocraticInFlight = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Main Heading */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/40">
            <span>💡</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Socratic Mentor & Critical Academic Dialogue
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              အဖြေကို တိုက်ရိုက်မပေးဘဲ မေးခွန်းများဖြင့် ကျောင်းသားကိုယ်တိုင် အဖြေရှာနိုင်ရန် လမ်းပြပေးခြင်းနှင့် ဆန့်ကျင်ဘက် အမြင်များကို ချေပနိုင်အောင် ပြင်ဆင်ပေးခြင်း
            </p>
          </div>
        </div>

        {/* Daily Limit Tracker & Reset */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 text-[11px] font-mono border border-slate-800 text-slate-300">
            Daily Queries: <strong className={dailyCount >= DAILY_QUERY_LIMIT ? 'text-rose-400' : 'text-emerald-400'}>{dailyCount}</strong>/{DAILY_QUERY_LIMIT}
          </span>
          <button
            type="button"
            onClick={handleClearChat}
            className={`px-2.5 py-1 rounded-xl border text-xs transition-all cursor-pointer ${
              confirmReset
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200 font-semibold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
            }`}
            title="ဆွေးနွေးမှုမှတ်တမ်း အသစ်စတင်မည်"
          >
            {confirmReset ? '⚠️ Confirm Reset?' : '🔄 Reset Chat'}
          </button>
        </div>
      </div>

      {/* Socratic Academic Policy Banner */}
      <div className="px-4 py-2.5 rounded-xl bg-amber-950/20 border border-amber-850/40 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">⚠️ Socratic Academic Policy:</span>
          <span className="text-[11px] text-slate-300">
            ဤစနစ်သည် Assignment အဖြေများကို တိုက်ရိုက် မရေးပေးပါ။ သင့်ကိုယ်ပိုင် Critical Thinking စွမ်းရည် တိုးတက်စေရန် မေးခွန်းများဖြင့်သာ ထောက်ပြဆွေးနွေးပေးပါမည်။
          </span>
        </div>
        <span className="text-[10px] text-amber-300/80 font-mono">
          Token-Saving Guard Active (~140 words response)
        </span>
      </div>

      {statusNotice && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
          {statusNotice}
        </div>
      )}

      {/* Clickable Sample Question Cards */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <span>✨</span> နမူနာ စတင်ဆွေးနွေးနိုင်သော မေးခွန်းပုံစံများ (Click to load):
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {SAMPLE_QUESTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendPrompt(item.query)}
              disabled={loading || dailyCount >= DAILY_QUERY_LIMIT}
              className="p-3 rounded-xl bg-[#0d1629] border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900 transition-all text-left flex flex-col justify-between space-y-1 group disabled:opacity-50 cursor-pointer"
            >
              <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200">
                {item.title}
              </span>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {item.query}
              </p>
              <span className="text-[10px] text-cyan-400 group-hover:underline self-end">
                မေးမြန်းမည် →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
        <div className="h-[460px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[10px] font-bold text-slate-400">
                  {m.sender === 'user' ? 'You' : 'Socratic Mentor'}
                </span>
                <span className="text-[9px] text-slate-600">{m.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-950/40'
                    : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-tl-none font-serif'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">Socratic Mentor</span>
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 rounded-tl-none flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse" />
                <span>ကျိုးကြောင်းဆီလျော်မှုကို စိစစ်ပြီး မေးခွန်းများကို ပြင်ဆင်နေပါသည်...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex gap-2 pt-2 border-t border-slate-800"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={loading || dailyCount >= DAILY_QUERY_LIMIT}
            placeholder="သင် ဆွေးနွေးလိုသော Assignment အကြောင်းအရာ၊ Thesis သို့မဟုတ် မေးခွန်းကို ထည့်ပါ..."
            className="flex-1 p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim() || dailyCount >= DAILY_QUERY_LIMIT}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-950/40 transition-all shrink-0 cursor-pointer"
          >
            <span>🚀 Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

