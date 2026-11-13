import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Users,
  ShieldCheck,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

export const PeerCommentGenerator: React.FC = () => {
  const { language, callAcademicApi } = useApp();

  const [classmatePost, setClassmatePost] = useState('');
  const [unitTopic, setUnitTopic] = useState('Unit Topic / Main Question');
  const [peerCount, setPeerCount] = useState<1 | 2 | 3>(3);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadSample = () => {
    setUnitTopic('Unit 7: The Ethical Dilemma of Mandatory Corporate Sustainability Disclosures');
    setClassmatePost(
      `In this unit, I believe corporate social responsibility (CSR) must be made legally mandatory for all publicly traded corporations rather than voluntary. When CSR is purely voluntary, multinational firms often engage in greenwashing to protect their quarterly stock valuations rather than creating genuine environmental benefits. For example, many energy firms spend millions advertising carbon-neutral initiatives while allocating less than 5% of their capital expenditures to renewable energy. Enforceable regulatory compliance by government bodies is the only viable remedy to protect public stakeholders.`
    );
  };

  const handleGenerate = async () => {
    if (!classmatePost.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await callAcademicApi('peer_comment_generator', {
        classmatePost,
        unitTopic,
        peerCount,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate peer responses.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner / Description */}
      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start space-x-3">
        <Users className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white flex items-center space-x-2">
            <span>
              {language === 'my'
                ? 'UoPeople Discussion Forum: Classmates ၃ ယောက်အတွက် Peer Responses'
                : 'UoPeople Peer Review Comment Generator (Classmates 3x)'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
              Rubric 100+ Words & Anti-AI
            </span>
          </div>
          <p className="leading-relaxed text-slate-400">
            {language === 'my'
              ? 'UoPeople Discussion Rubric အရ အနည်းဆုံး စာလုံး ၁၀၀ ပြည့်မီစေရန်နှင့် "Overall," ကဲ့သို့ စက်ရုပ်ဆန်သော AI စကားအဖွင့်များကို ရှောင်ရှားကာ (၁) သီးသန့် ချီးကျူးချက် (၂) အခြားထောင့်မှ ဖြည့်စွက်ဆွေးနွေးချက် (၃) စဉ်းစားစရာ မေးခွန်း စသည့် ၃ ပိုင်းဖြင့် ရေးသားပေးပါသည်'
              : 'Constructive 100+ word peer comments following UoPeople grading rubrics: Specific Praise + Counter-Perspective + Socratic Inquiry. Zero robotic clichés (purges "Overall," or "Great post,").'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: INPUT */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {language === 'my' ? 'Classmate ၏ မူရင်း Post စာသား' : "Classmate's Discussion Post"}
            </label>
            <button
              type="button"
              onClick={loadSample}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              {language === 'my' ? 'နမူနာ ထည့်မည်' : 'Load Sample Post'}
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my' ? 'Unit ခေါင်းစဉ် (Topic / Context):' : 'Unit Topic / Prompt Context:'}
            </label>
            <input
              type="text"
              value={unitTopic}
              onChange={(e) => setUnitTopic(e.target.value)}
              placeholder="e.g. Unit 7: Corporate Social Responsibility and Regulation"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-400">
                {language === 'my' ? 'Classmate ၏ စာသားကို ကူးထည့်ပါ:' : "Paste Classmate's Post:"}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {classmatePost.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={8}
              value={classmatePost}
              onChange={(e) => setClassmatePost(e.target.value)}
              placeholder={
                language === 'my'
                  ? 'Classmate ရေးထားသော Discussion Post စာသားကို ဤနေရာတွင် ကူးထည့်ပါ...'
                  : "Paste the classmate's discussion post here..."
              }
              className="w-full p-3 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Number of peer responses to generate */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400">
                {language === 'my' ? 'Classmates အရေအတွက်:' : 'Classmates to reply to:'}
              </span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {([1, 2, 3] as const).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPeerCount(num)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                      peerCount === num
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {num} {language === 'my' ? 'ယောက်' : 'peer'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={loading || !classmatePost.trim()}
              onClick={handleGenerate}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
              <span>
                {loading
                  ? (language === 'my' ? 'ရေးသားနေသည်...' : 'Generating...')
                  : (language === 'my' ? `Classmates ${peerCount} ယောက်စာ ရေးမည်` : `Generate ${peerCount} Response${peerCount > 1 ? 's' : ''}`)}
              </span>
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
              {error}
            </p>
          )}
        </div>

        {/* RIGHT: OUTPUT RESULTS */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-full min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>
                {language === 'my' ? 'အမှတ်ပြည့် Peer Responses ရလဒ်' : 'Rubric-Calibrated Peer Responses'}
              </span>
            </span>

            {result && (
              <button
                type="button"
                onClick={() => handleCopy(result, 'all')}
                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
              >
                {copiedId === 'all' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied All</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All</span>
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">
                {language === 'my'
                  ? 'Rubric စံနှုန်းအလိုက် စာလုံး ၁၀၀ ကျော် အဓိပ္ပာယ်ရှိသော စာကြောင်းများကို ရေးသားနေပါသည်...'
                  : 'Synthesizing authentic 100+ word peer critiques with zero robotic openings...'}
              </p>
            </div>
          ) : result ? (
            <div className="flex-1 overflow-y-auto max-h-[550px] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {result}
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {language === 'my'
                    ? 'အထက်ပါ စာသားများသည် အပြန်အလှန် စကားပြောဟန် သဘာဝကျပြီး Moodle Discussion Forum တွင် တိုက်ရိုက် ကူးယူအသုံးပြုနိုင်ပါသည်'
                    : 'Responses comply with UoPeople academic peer assessment rubrics and contain natural human phrasing.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <MessageSquare className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-xs max-w-sm">
                {language === 'my'
                  ? 'Classmate တစ်ဦး၏ Discussion Post ကို ဘယ်ဘက်တွင် ထည့်သွင်းပြီး Classmates ၃ ယောက်အတွက် တစ်ပြိုင်နက် ထုတ်ယူနိုင်ပါသည်'
                  : "Paste a classmate's post to generate distinct, 100+ word peer responses tailored to discussion forum rubrics."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
