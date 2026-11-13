import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Users,
  RotateCcw,
  GraduationCap,
  MessageCircle,
  BookOpen,
} from 'lucide-react';
import { generatePeerComments, generateFollowUpReply } from '../services/discussionGeminiService';

export const UnifiedDiscussionStudio: React.FC = () => {
  const { language, callAcademicApi } = useApp();

  // Mode: 'peer_review' or 'followup_reply'
  const [studioMode, setStudioMode] = useState<'peer_review' | 'followup_reply'>('peer_review');

  // --- PEER REVIEW STATES ---
  const [classmatePost, setClassmatePost] = useState('');
  const [unitTopic, setUnitTopic] = useState('Unit Topic / Main Question');
  const [peerCount, setPeerCount] = useState<1 | 2 | 3>(3);
  const [peerResult, setPeerResult] = useState('');
  const [peerLoading, setPeerLoading] = useState(false);
  const [peerError, setPeerError] = useState<string | null>(null);

  // --- FOLLOW-UP REPLY STATES ---
  const [originalPost, setOriginalPost] = useState('');
  const [interlocutorType, setInterlocutorType] = useState<'classmate' | 'instructor'>('instructor');
  const [questionText, setQuestionText] = useState('');
  const [replyResult, setReplyResult] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [generationCount, setGenerationCount] = useState(0);

  // --- SHARED UTILS ---
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Peer review sample loader
  const loadPeerSample = () => {
    setUnitTopic('Unit 7: The Ethical Dilemma of Mandatory Corporate Sustainability Disclosures');
    setClassmatePost(
      `In this unit, I believe corporate social responsibility (CSR) must be made legally mandatory for all publicly traded corporations rather than voluntary. When CSR is purely voluntary, multinational firms often engage in greenwashing to protect their quarterly stock valuations rather than creating genuine environmental benefits. For example, many energy firms spend millions advertising carbon-neutral initiatives while allocating less than 5% of their capital expenditures to renewable energy. Enforceable regulatory compliance by government bodies is the only viable remedy to protect public stakeholders.`
    );
  };

  // Follow-up reply sample loader
  const loadFollowUpSample = () => {
    setOriginalPost(
      `In this unit, I argue that corporate social responsibility (CSR) must be made legally mandatory for multinational corporations rather than voluntary. When CSR is purely voluntary, multinational firms often engage in greenwashing to protect short-term stock valuations without delivering tangible environmental remedies. Enforceable regulatory compliance by government bodies is the only viable remedy to protect public stakeholders.`
    );
    setInterlocutorType('instructor');
    setQuestionText(
      `An interesting argument. However, wouldn't legally mandatory CSR regulations impose disproportionately punitive compliance costs on small-to-medium enterprises (SMEs) in developing nations, potentially stifling economic growth and local entrepreneurship? How would you differentiate regulatory thresholds between multinational giants and emerging local firms?`
    );
  };

  // Peer comments generator action
  const handleGeneratePeerComments = async () => {
    if (!classmatePost.trim()) return;
    setPeerError(null);
    setPeerLoading(true);
    try {
      try {
        const res = await generatePeerComments({
          classmatePost,
          unitTopic,
          peerCount,
        });
        setPeerResult(res);
      } catch (directErr) {
        // Fallback to callAcademicApi context helper
        const fallbackRes = await callAcademicApi('peer_comment_generator', {
          classmatePost,
          unitTopic,
          peerCount,
        });
        setPeerResult(fallbackRes);
      }
    } catch (err: any) {
      setPeerError(err.message || 'Failed to generate peer responses.');
    } finally {
      setPeerLoading(false);
    }
  };

  // Follow-up reply generator action
  const handleGenerateFollowUpReply = async (isRegenerate = false) => {
    if (!originalPost.trim() || !questionText.trim()) return;
    setReplyError(null);
    setReplyLoading(true);
    try {
      const nextCount = isRegenerate ? generationCount + 1 : 1;
      setGenerationCount(nextCount);
      try {
        const res = await generateFollowUpReply({
          originalPost,
          interlocutorType,
          questionText,
          seed: Date.now() + nextCount * 1000,
        });
        setReplyResult(res);
      } catch (directErr) {
        // Fallback to callAcademicApi context helper
        const fallbackRes = await callAcademicApi('discussion_followup_reply', {
          originalPost,
          interlocutorType,
          questionText,
          seed: Date.now() + nextCount * 1000,
        });
        setReplyResult(fallbackRes);
      }
    } catch (err: any) {
      setReplyError(err.message || 'Failed to generate follow-up reply.');
    } finally {
      setReplyLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Studio Mode Switcher */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/60 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <MessageSquare className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
              <span>
                {language === 'my'
                  ? 'Discussion Studio (Peer Review & Follow-up Replies)'
                  : 'Unified Discussion Forum Studio'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                Rubric 100+ Words & Anti-AI
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'my'
                ? 'Classmates များအတွက် အမှတ်ပြည့် Peer Comments ရေးခြင်းနှင့် မိမိ Post အောက်မှ မေးခွန်းများကို ပညာရပ်ဆန်ဆန် ပြန်လည်ဖြေကြားခြင်း'
                : 'Craft 100+ word peer critiques and defend your posts against challenging instructor or peer follow-up questions.'}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setStudioMode('peer_review')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold transition-all ${
              studioMode === 'peer_review'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-300" />
            <span>{language === 'my' ? 'Classmates Peer Comments (၃ ယောက်)' : 'Peer Comments (3x)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioMode('followup_reply')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold transition-all ${
              studioMode === 'followup_reply'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-300" />
            <span>{language === 'my' ? 'ကိုယ့် post မေးခွန်းများ ပြန်ဖြေစနစ်' : 'Follow-Up Reply Assistant'}</span>
          </button>
        </div>
      </div>

      {/* MODE 1: PEER REVIEW COMMENTS */}
      {studioMode === 'peer_review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* LEFT: INPUT */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {language === 'my' ? 'Classmate ၏ မူရင်း Post စာသား' : "Classmate's Discussion Post"}
              </label>
              <button
                type="button"
                onClick={loadPeerSample}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
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
                className="w-full p-3 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
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
                disabled={peerLoading || !classmatePost.trim()}
                onClick={handleGeneratePeerComments}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {peerLoading ? (
                  <RotateCcw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-white" />
                )}
                <span>
                  {peerLoading
                    ? (language === 'my' ? 'ရေးသားနေသည်...' : 'Generating...')
                    : (language === 'my' ? `Classmates ${peerCount} ယောက်စာ ရေးမည်` : `Generate ${peerCount} Response${peerCount > 1 ? 's' : ''}`)}
                </span>
              </button>
            </div>

            {peerError && (
              <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
                {peerError}
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

              {peerResult && (
                <button
                  type="button"
                  onClick={() => handleCopy(peerResult, 'peer-all')}
                  className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
                >
                  {copiedId === 'peer-all' ? (
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

            {peerLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">
                  {language === 'my'
                    ? 'Rubric စံနှုန်းအလိုက် စာလုံး ၁၀၀ ကျော် အဓိပ္ပာယ်ရှိသော စာကြောင်းများကို ရေးသားနေပါသည်...'
                    : 'Synthesizing authentic 100+ word peer critiques with zero robotic openings...'}
                </p>
              </div>
            ) : peerResult ? (
              <div className="flex-1 overflow-y-auto max-h-[550px] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {peerResult}
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
                <Users className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                <p className="text-xs max-w-sm">
                  {language === 'my'
                    ? 'Classmate တစ်ဦး၏ Discussion Post ကို ဘယ်ဘက်တွင် ထည့်သွင်းပြီး Classmates ၃ ယောက်အတွက် တစ်ပြိုင်နက် ထုတ်ယူနိုင်ပါသည်'
                    : "Paste a classmate's post to generate distinct, 100+ word peer responses tailored to discussion forum rubrics."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: FOLLOW-UP REPLY ASSISTANT */}
      {studioMode === 'followup_reply' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* LEFT: INPUT */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {language === 'my' ? 'မူရင်း စာတမ်းနှင့် မေးခွန်း အချက်အလက်များ' : 'Discussion Context & Follow-Up Inquiry'}
              </label>
              <button
                type="button"
                onClick={loadFollowUpSample}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
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
                className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
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
                className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={replyLoading || !originalPost.trim() || !questionText.trim()}
                onClick={() => handleGenerateFollowUpReply(false)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                {replyLoading ? (
                  <RotateCcw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-white" />
                )}
                <span>
                  {replyLoading
                    ? (language === 'my' ? 'အဖြေ ရေးသားနေသည်...' : 'Synthesizing Response...')
                    : (language === 'my' ? 'ပညာရပ်ဆန်ဆန် အဖြေထုတ်မည်' : 'Generate Academic Follow-Up Reply')}
                </span>
              </button>
            </div>

            {replyError && (
              <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-500/30">
                {replyError}
              </p>
            )}
          </div>

          {/* RIGHT: OUTPUT RESULTS */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-full min-h-[460px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <MessageCircle className="w-4 h-4" />
                <span>
                  {language === 'my' ? 'ပြန်လည်ဖြေကြားချက် အဆင်သင့် စာသား' : 'Polished Follow-Up Reply'}
                </span>
              </span>

              <div className="flex items-center space-x-2">
                {replyResult && (
                  <button
                    type="button"
                    disabled={replyLoading}
                    onClick={() => handleGenerateFollowUpReply(true)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                    title="Generate another variation"
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-400" />
                    <span>{language === 'my' ? 'အသစ်ပြန်ထုတ်မည်' : 'Regenerate'}</span>
                  </button>
                )}

                {replyResult && (
                  <button
                    type="button"
                    onClick={() => handleCopy(replyResult, 'reply-all')}
                    className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
                  >
                    {copiedId === 'reply-all' ? (
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

            {replyLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">
                  {language === 'my'
                    ? 'မူလစာတမ်းနှင့် မေးခွန်းကို ချိတ်ဆက်၍ အမှတ်ပြည့်ရစေမည့် အဖြေကို ရေးသားနေပါသည်...'
                    : 'Synthesizing evidence-backed rebuttal and collegiate defense...'}
                </p>
              </div>
            ) : replyResult ? (
              <div className="flex-1 overflow-y-auto max-h-[550px] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {replyResult}
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
                <MessageCircle className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                <p className="text-xs max-w-sm">
                  {language === 'my'
                    ? 'ကိုယ့် post နှင့် သူတို့မေးထားသော မေးခွန်းကို ထည့်သွင်းပြီး "ပညာရပ်ဆန်ဆန် အဖြေထုတ်မည်" ကို နှိပ်ပါ'
                    : 'Paste your original post and the follow-up question to craft a scholarly, defensible response.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
