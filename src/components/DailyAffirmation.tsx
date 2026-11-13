import React, { useState, useEffect } from 'react';

interface QuoteData {
  quote: string;
  author: string;
}

// Fallback & Curated Academic Quotes (API အလုပ်မလုပ်ပါက အသုံးပြုမည့် စာရင်း)
const FALLBACK_QUOTES: QuoteData[] = [
  {
    quote: "The beautiful thing about learning is that no one can take it away from you.",
    author: "B.B. King"
  },
  {
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi"
  },
  {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela"
  },
  {
    quote: "It always seems impossible until it's done.",
    author: "Nelson Mandela"
  },
  {
    quote: "Small daily improvements over time lead to stunning results.",
    author: "Robin Sharma"
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier"
  }
];

export const DailyAffirmation: React.FC = () => {
  const [data, setData] = useState<QuoteData>({ quote: '', author: '' });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDailyQuote = async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    const cachedDate = localStorage.getItem('akari_affirmation_date');
    const cachedData = localStorage.getItem('akari_affirmation_data');

    // ယနေ့အတွက် သိမ်းထားပြီးဖြစ်ပါက ထပ်မံ API မခေါ်ဘဲ Cache မှ ချက်ချင်းယူမည်
    if (cachedDate === todayStr && cachedData) {
      try {
        setData(JSON.parse(cachedData));
        setLoading(false);
        return;
      } catch {
        // parsing error ဖြစ်ပါက ဆက်လက် fetch မည်
      }
    }

    try {
      // Open Source Quote API (FavQs / ZenQuotes proxy)
      const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://zenquotes.io/api/today'));
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json[0]?.q && json[0]?.a) {
          const freshQuote: QuoteData = {
            quote: json[0].q,
            author: json[0].a
          };
          setData(freshQuote);
          localStorage.setItem('akari_affirmation_date', todayStr);
          localStorage.setItem('akari_affirmation_data', JSON.stringify(freshQuote));
          setLoading(false);
          return;
        }
      }
      throw new Error('API Fallback needed');
    } catch {
      // Network/CORS အခက်အခဲရှိပါက ရက်စွဲအလိုက် စာရင်းထဲမှ အလိုအလျောက် ရွေးထုတ်မည်
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
      const selected = FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
      setData(selected);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyQuote();
  }, []);

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-950 border border-indigo-900/40 relative overflow-hidden flex items-center justify-between gap-4 shadow-lg">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 text-lg flex items-center justify-center shrink-0">
          ✨
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
              Daily Student Affirmation
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {loading ? (
            <div className="h-5 w-64 bg-slate-800/60 rounded animate-pulse" />
          ) : (
            <p className="text-xs md:text-sm font-serif italic text-slate-200 leading-relaxed">
              "{data.quote}"
              <span className="not-italic font-sans text-xs text-indigo-300/90 font-medium ml-2">
                — {data.author}
              </span>
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          localStorage.removeItem('akari_affirmation_date');
          fetchDailyQuote();
        }}
        title="နောက်တစ်ခု ပြောင်းမည်"
        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs transition-all shrink-0"
      >
        🔄
      </button>
    </div>
  );
};
