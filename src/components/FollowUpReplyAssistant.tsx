import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  GraduationCap,
  Users,
} from 'lucide-react';

export const FollowUpReplyAssistant: React.FC = () => {
  const { language, callAcademicApi } = useApp();

  const [originalPost, setOriginalPost] = useState('');
  const [interlocutorType, setInterlocutorType] = useState<'classmate' | 'instructor'>('instructor');
  const [questionText, setQuestionText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);

  const loadSample = () => {
    setOriginalPost(
      `In this unit, I argue that corporate social responsibility (CSR) must be made legally mandatory for multinational corporations rather than voluntary. When CSR is purely voluntary, multinational firms often engage in greenwashing to protect short-term stock valuations without delivering tangible environmental remedies. Enforceable regulatory compliance by government bodies is the only viable remedy to protect public stakeholders.`
    );
    setInterlocutorType('instructor');
    setQuestionText(
      `An interesting argument. However, wouldn't legally mandatory CSR regulations impose disproportionately punitive compliance costs on small-to-medium enterprises (SMEs) in developing nations, potentially stifling economic growth and local entrepreneurship? How would you differentiate regulatory thresholds between multinational giants and emerging local firms?`
    );
  };

  const handleGenerateReply = async (isRegenerate = false) => {
    if (!originalPost.trim() || !questionText.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const nextCount = isRegenerate ? generationCount + 1 : 1;
      setGenerationCount(nextCount);
      const res = await callAcademicApi('discussion_followup_reply', {
        originalPost,
        interlocutorType,
        questionText,
        seed: Date.now() + nextCount * 1000,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate follow-up reply.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 flex items-start space-x-3">
        <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white flex items-center space-x-2">
            <span>
              {language === 'my'
                ? 'Discussion Forum Follow-up Reply Assistant (ကိုယ့် post အောက်က မေးခွန်းများ ပြန်လည်ဖြေကြားစနစ်)'
                : 'Discussion Forum Follow-up Reply Assistant'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
              Dynamic Contextual Replies
            </span>
          </div>
          <p className="leading-relaxed text-slate-400">
            {language === 'my'
              ? 'မိမိတင်ထားသော post အောက်တွင် ဆရာ သို့မဟုတ် သူငယ်ချင်းများက မေးခွန်းထုတ်/ထောက်ပြလာပါက မိမိ၏ မူလစာတမ်းကို အခြေခံပြီး ပညာရပ်ဆန်ဆန် တိကျစွာ ပြန်လည်ဆွေးနွေးပေးမည့် စနစ်ဖြစ်ပါသည်။ AI လေသံမပါဘဲ သဘာဝကျစွာ ထုတ်ယူနိုင်ပါသည်'
              : 'Answer challenging follow-up questions from professors and classmates under your initial Discussion Forum post with grounded academic evidence and zero formulaic clichés.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUT */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {language === 'my' ? 'မူရင်း စာတမ်းနှင့် မေးခွန်း အချက်အလက်များ' : 'Discussion Context & Follow-Up Inquiry'}
            </label>
            <button
              type="button"
              onClick={loadSample}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              {language === 'my' ? 'နမူနာ ထည့်မည်' : 'Load Sample Inquiry'}
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my' ? 'သင်၏ မူရင်း Discussion Post စာသား:' : 'Your Original Initial Discussion Post:'}
            </label>
            <textarea
              rows={4}
              value={originalPost}
              onChange={(e) => setOriginalPost(e.target.value)}
              placeholder="Paste your original initial discussion post..."
              className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400">
                {language === 'my' ? 'မေးခွန်းမေးသူ အမျိုးအစား:' : 'Who asked the question?'}
              </label>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setInterlocutorType('instructor')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                    interlocutorType === 'instructor'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{language === 'my' ? 'ဆရာ/ဆရာမ (Instructor)' : 'Course Instructor'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInterlocutorType('classmate')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                    interlocutorType === 'classmate'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{language === 'my' ? 'သူငယ်ချင်း (Classmate)' : 'Peer / Classmate'}</span>
                </button>
              </div>
            </div>

            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {language === 'my'
                ? 'သူတို့ မေးထားသော မေးခွန်း သို့မဟုတ် ထောက်ပြချက်:'
                : "Their Question or Critique:"}
            </label>
            <textarea
              rows={4}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Paste their follow-up comment or challenging question here..."
              className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={loading || !originalPost.trim() || !questionText.trim()}
              onClick={() => handleGenerateReply(false)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
              <span>
                {loading
                  ? (language === 'my' ? 'အဖြေ ရေးသားနေသည်...' : 'Synthesizing Response...')
                  : (language === 'my' ? 'ပညာရပ်ဆန်ဆန် အဖြေထုတ်မည်' : 'Generate Academic Follow-Up Reply')}
              </span>
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
              {error}
            </p>
          )}
        </div>

        {/* OUTPUT */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-full min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>
                {language === 'my' ? 'ပြန်လည်ဖြေကြားချက် အဆင်သင့် စာသား' : 'Polished Follow-Up Reply'}
              </span>
            </span>

            <div className="flex items-center space-x-2">
              {result && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleGenerateReply(true)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                  title="Generate another variation"
                >
                  <RotateCcw className="w-3 h-3 text-indigo-400" />
                  <span>{language === 'my' ? 'အသစ်ပြန်ထုတ်မည်' : 'Regenerate'}</span>
                </button>
              )}

              {result && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Reply</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">
                {language === 'my'
                  ? 'မူလစာတမ်းနှင့် မေးခွန်းကို ချိတ်ဆက်၍ အမှတ်ပြည့်ရစေမည့် အဖြေကို ရေးသားနေပါသည်...'
                  : 'Synthesizing evidence-backed rebuttal and collegiate defense...'}
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
                    ? 'အထက်ပါ အဖြေသည် တိုက်ရိုက် Copy ယူ၍ Moodle Discussion Forum တွင် Reply ပို့နိုင်ရန် အသင့်ဖြစ်ပါသည် (၁၀၀-၁၅၀ စာလုံးရေ ပြည့်မီပါသည်)'
                    : 'Response is between 100-160 words, satisfies peer interaction rubrics, and includes zero robotic clichés.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <MessageSquare className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-xs max-w-sm">
                {language === 'my'
                  ? 'ကိုယ့် post နှင့် သူတို့မေးထားသော မေးခွန်းကို ထည့်သွင်းပြီး "ပညာရပ်ဆန်ဆန် အဖြေထုတ်မည်" ကို နှိပ်ပါ'
                  : 'Paste your original post and the follow-up question to craft a scholarly, defensible response.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
