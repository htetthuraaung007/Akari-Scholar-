import React, { useState, useEffect } from 'react';
import { generateAdvisorEmail } from '../utils/advisorEmailGenerator';
import { executeGeminiRequest, resolveDynamicModelCatalog } from '../services/geminiService';
import { loadPersistedTabState, savePersistedTabState } from '../utils/researchPersistence';
import {
  generateGmailWebUrl,
  generateOutlookWebUrl,
  generateYahooWebUrl,
  generateMailtoUrl,
  copyToClipboard,
} from '../utils/emailDispatcher';
import {
  Mail,
  Send,
  Copy,
  Check,
  Download,
  Sparkles,
  ShieldCheck,
  FileText,
  Lightbulb,
  ExternalLink,
} from 'lucide-react';

interface AdvisorEmailSuiteProps {
  language: 'my' | 'en';
}

const ADVISOR_EMAIL_SESSION_KEY = 'sop_tab3_state';

export interface AdvisorEmailState {
  studentName: string;
  studentId: string;
  paCgpa: string;
  paDegree: string;
  scholarshipScope: string;
  urgentNote: string;
  paEmailResult: string;
  activeOutputTab: 'email' | 'notes';
  hasCleared?: boolean;
}

function getInitialAdvisorState(): AdvisorEmailState {
  const existingSession =
    typeof window !== 'undefined' ? window.sessionStorage.getItem(ADVISOR_EMAIL_SESSION_KEY) : null;

  const defaultStudentName =
    (typeof window !== 'undefined' && localStorage.getItem('akari_pa_studentName')) || 'Student Name';
  const defaultStudentId =
    (typeof window !== 'undefined' && localStorage.getItem('akari_pa_studentId')) || 's123456';
  const defaultCgpa =
    (typeof window !== 'undefined' && localStorage.getItem('akari_pa_cgpa')) || '3.65';
  const defaultDegree =
    (typeof window !== 'undefined' && localStorage.getItem('akari_pa_degree')) ||
    'Bachelor of Science in Computer Science';
  const defaultScope =
    (typeof window !== 'undefined' && localStorage.getItem('akari_pa_scholarshipScope')) ||
    'လာမည့် Term များအတွက် Assessment Fee Scholarship လျှောက်ထားလိုခြင်း';
  const defaultUrgent =
    (typeof window !== 'undefined' && localStorage.getItem('akari_pa_urgentNote')) || '';

  const fallback: AdvisorEmailState = {
    studentName: defaultStudentName,
    studentId: defaultStudentId,
    paCgpa: defaultCgpa,
    paDegree: defaultDegree,
    scholarshipScope: defaultScope,
    urgentNote: defaultUrgent,
    paEmailResult: '',
    activeOutputTab: 'email',
    hasCleared: false,
  };

  const persisted = loadPersistedTabState<AdvisorEmailState>(ADVISOR_EMAIL_SESSION_KEY, fallback);
  if (persisted.hasCleared) {
    return persisted;
  }

  if (!existingSession && !persisted.paEmailResult) {
    persisted.paEmailResult = generateAdvisorEmail({
      advisorName: 'Program Advisor',
      studentName: persisted.studentName || 'Student Name',
      studentId: persisted.studentId || 's123456',
      degreeProgram: persisted.paDegree || 'Bachelor of Science in Computer Science',
      cgpa: persisted.paCgpa || '3.65',
      scholarshipScope: persisted.scholarshipScope,
      customNotesPrompt: persisted.urgentNote,
      seed: Date.now(),
      variation: 1,
    });
  }

  return persisted;
}

export const AdvisorEmailSuite: React.FC<AdvisorEmailSuiteProps> = () => {
  const initialState = getInitialAdvisorState();

  // Zero-Loss State Persistence across sub-tab switching (`sop_tab3_state`)
  const [studentName, setStudentName] = useState(initialState.studentName);
  const [studentId, setStudentId] = useState(initialState.studentId);
  const [paCgpa, setPaCgpa] = useState(initialState.paCgpa);
  const [paDegree, setPaDegree] = useState(initialState.paDegree);
  const [scholarshipScope, setScholarshipScope] = useState(initialState.scholarshipScope);
  const [urgentNote, setUrgentNote] = useState(initialState.urgentNote);
  const [paEmailResult, setPaEmailResult] = useState<string>(initialState.paEmailResult);
  const [activeOutputTab, setActiveOutputTab] = useState<'email' | 'notes'>(
    initialState.activeOutputTab
  );
  const [hasCleared, setHasCleared] = useState<boolean>(Boolean(initialState.hasCleared));
  const [paLoading, setPaLoading] = useState(false);
  const [confirmClearForm, setConfirmClearForm] = useState(false);

  // Modal and copy states
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedTab, setCopiedTab] = useState(false);

  // Warm up verified dynamic Gemini catalog once
  useEffect(() => {
    void resolveDynamicModelCatalog();
  }, []);

  // Sync inputs and generated output to sessionStorage (`sop_tab3_state`) & localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('akari_pa_studentName', studentName);
      localStorage.setItem('akari_pa_studentId', studentId);
      localStorage.setItem('akari_pa_cgpa', paCgpa);
      localStorage.setItem('akari_pa_degree', paDegree);
      localStorage.setItem('akari_pa_scholarshipScope', scholarshipScope);
      localStorage.setItem('akari_pa_urgentNote', urgentNote);
    }
    savePersistedTabState<AdvisorEmailState>(ADVISOR_EMAIL_SESSION_KEY, {
      studentName,
      studentId,
      paCgpa,
      paDegree,
      scholarshipScope,
      urgentNote,
      paEmailResult,
      activeOutputTab,
      hasCleared,
    });
  }, [
    studentName,
    studentId,
    paCgpa,
    paDegree,
    scholarshipScope,
    urgentNote,
    paEmailResult,
    activeOutputTab,
    hasCleared,
  ]);

  const executeClearForm = () => {
    setStudentName('');
    setStudentId('');
    setPaCgpa('');
    setPaDegree('');
    setScholarshipScope('');
    setUrgentNote('');
    setPaEmailResult('');
    setHasCleared(true);
    setConfirmClearForm(false);
  };

  const handleRequestClearForm = () => {
    const hasContent =
      Boolean(studentName.trim()) ||
      Boolean(studentId.trim()) ||
      Boolean(paCgpa.trim()) ||
      Boolean(paDegree.trim()) ||
      Boolean(scholarshipScope.trim()) ||
      Boolean(urgentNote.trim()) ||
      Boolean(paEmailResult.trim());

    if (!hasContent) {
      executeClearForm();
      return;
    }
    setConfirmClearForm(true);
  };

  const handleGenerate = async (overridePrompt?: string) => {
    setHasCleared(false);
    setConfirmClearForm(false);
    setPaLoading(true);
    const promptToUse = overridePrompt !== undefined ? overridePrompt : urgentNote;
    const seed = Date.now();
    const variation = Math.floor(Math.random() * 10) + 1;

    try {
      const systemInstruction = `You are a university academic communications advisor for University of the People (UoPeople).
Draft a professional, courteous, and persuasive email to a UoPeople Program Advisor requesting authorization to unlock/renew the Assessment Fee Scholarship form before registration closes.
Output strictly in plain text starting with:
SUBJECT: <concise specific subject line>

Followed by a blank line and the formal email body. Do NOT use Markdown code fences or robotic clichés.`;

      const prompt = `STUDENT DETAILS:
- Student Name: ${studentName || 'Student Name'}
- Student ID: ${studentId || 's123456'}
- Degree Program: ${paDegree}
- Cumulative GPA: ${paCgpa}
- Scholarship Scope / Term Plan: ${scholarshipScope}
- Additional Circumstances / Urgency (translate naturally to academic English if in Burmese): ${promptToUse || 'Standard scholarship renewal authorization request before registration deadline.'}
- Variation Seed: ${seed}-${variation}`;

      const res = await executeGeminiRequest(
        prompt,
        'light',
        systemInstruction,
        undefined,
        1200,
        undefined,
        true
      );

      if (res && res.trim().length > 60) {
        setPaEmailResult(res.trim());
        return;
      }
      throw new Error('Empty advisor email output');
    } catch {
      const generated = generateAdvisorEmail({
        advisorName: 'Program Advisor',
        studentName: studentName || 'Student Name',
        studentId: studentId || 's123456',
        degreeProgram: paDegree,
        cgpa: paCgpa,
        scholarshipScope,
        customNotesPrompt: promptToUse,
        seed,
        variation,
      });
      setPaEmailResult(generated);
    } finally {
      setPaLoading(false);
    }
  };

  const recipientEmail = 'advisor@uopeople.edu';

  // Parse subject and body from paEmailResult
  const parseEmailContent = (text: string) => {
    const lines = text.split('\n');
    let subject = `Request to Unlock Scholarship Renewal Application - ${studentName || 'Student'} (${studentId || 'ID'})`;
    let body = text;
    if (lines[0] && lines[0].startsWith('SUBJECT:')) {
      subject = lines[0].replace('SUBJECT:', '').trim();
      body = lines.slice(2).join('\n').trim();
    }
    return { subject, body };
  };

  const { subject: emailSubject, body: emailBody } = parseEmailContent(paEmailResult);

  const PA_EMAIL_TEMPLATES = [
    {
      title: 'Advisor Template 1: Scholarship Renewal Portal Unlock Request',
      titleMy: 'Advisor ပုံစံ ၁ - Scholarship Renewal Portal ဖွင့်ပေးရန် တောင်းဆိုလွှာ',
      customNotes: 'Please unlock the scholarship renewal form so I can complete registration before the deadline.',
    },
    {
      title: 'Advisor Template 2: Urgent Registration Deadline Approaching',
      titleMy: 'Advisor ပုံစံ ၂ - သင်တန်းအပ်ရန် ရက်နီးကပ်လာ၍ အရေးပေါ် ခွင့်ပြုချက်တောင်းခံခြင်း',
      customNotes: 'Registration closes in a few days. I have maintained good CGPA and need scholarship authorization urgently.',
    },
    {
      title: 'Advisor Template 3: Regional Financial Hardship Explanation',
      titleMy: 'Advisor ပုံစံ ၃ - ဒေသတွင်း ငွေကြေးဖောင်းပွမှုနှင့် စီးပွားရေးအခက်အခဲ ရှင်းလင်းတင်ပြခြင်း',
      customNotes: 'Explaining local currency inflation and severe economic constraints preventing independent fee payment.',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner Notice */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 space-y-1.5 shadow-lg">
        <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-indigo-300">
          <Mail className="w-4 h-4 shrink-0 text-indigo-400" />
          <span>⚠️ PROGRAM ADVISOR ဆီသို့ ခွင့်ပြုချက်တောင်းခံခြင်း (Advisor Petition Suite)</span>
        </div>
        <p className="text-xs text-indigo-200/90 leading-relaxed">
          <strong>မြန်မာဘာသာ:</strong> UoPeople တွင် Course Registration မပိတ်မီ Scholarship Renewal လျှောက်ထားနိုင်ရန် Program Advisor ဆီသို့ email ကြိုတင်ပို့ပြီး Portal ဖွင့်ပေးရန် တောင်းဆိုရပါမည်။ ဤအစုံအလင်တွင် Email အပြင် မဟာဗျူဟာကျသော Tactical Guidance များပါဝင်ပါသည်။
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Form & Templates */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <span className="text-pink-500">✉️</span>
                <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                  Advisor ဆီ Email ပို့ရန်
                </h3>
              </div>
              <button
                type="button"
                onClick={handleRequestClearForm}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>🗑️ စာကြမ်းရှင်းထုတ်မည် (Clear Form)</span>
              </button>
            </div>

            {confirmClearForm && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                <p className="text-red-200 font-medium leading-relaxed">
                  ထည့်သွင်းထားသော အချက်အလက်များနှင့် ထွက်ရှိထားသော စာမူကြမ်းများကို အားလုံးရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearForm(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={executeClearForm}
                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    သေချာသည် (Clear)
                  </button>
                </div>
              </div>
            )}

            {/* Row 1: Student Name & Student ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Your Name (အမည်)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-pink-500"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Student Name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Student ID (ကျောင်းသား ID)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-pink-500 font-mono"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="s123456"
                />
              </div>
            </div>

            {/* Row 2: Degree Program & Current CGPA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Degree Program (မေဂျာ)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-pink-500"
                  value={paDegree}
                  onChange={(e) => setPaDegree(e.target.value)}
                  placeholder="Bachelor of Science in Computer Science"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Current CGPA
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-pink-500 font-mono"
                  value={paCgpa}
                  onChange={(e) => setPaCgpa(e.target.value)}
                  placeholder="3.65"
                />
              </div>
            </div>

            {/* Scholarship Scope / Term Plan */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ပညာသင်ဆု လိုအပ်သော ကာလ / အခြေအနေ:
              </label>
              <input
                type="text"
                placeholder="ဥပမာ- လာမည့် Term များအတွက် Assessment Fee Scholarship လျှောက်ထားလိုခြင်း"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-100 focus:outline-none focus:border-pink-500 transition-colors"
                value={scholarshipScope}
                onChange={(e) => setScholarshipScope(e.target.value)}
              />
            </div>

            {/* Reason / Urgent Context */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                အရေးပေါ် အခြေအနေ သို့မဟုတ် အထူးမှတ်ချက် (မြန်မာ/English):
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-pink-500 resize-none leading-relaxed"
                value={urgentNote}
                onChange={(e) => setUrgentNote(e.target.value)}
                placeholder="ဥပမာ- လာမည့် Term အတွက် Registration မပိတ်မီ Scholarship Renewal Form ဖွင့်ပေးရန် လိုအပ်နေခြင်း..."
              />
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={paLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-pink-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {paLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>✨</span>
              )}
              <span>Email စာမူကြမ်း ပြန်လည်ရေးထုတ်မည်</span>
            </button>
          </div>

          {/* Ready Advisor Templates */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-xl">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>အသင့်ရွေးနိုင်သော Advisor Email Templates</span>
            </span>
            <div className="space-y-2">
              {PA_EMAIL_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const existing = urgentNote.trim();
                    const combinedContext = existing && !PA_EMAIL_TEMPLATES.some((t) => t.customNotes === existing)
                      ? `${existing} (${tmpl.customNotes})`
                      : tmpl.customNotes;
                    handleGenerate(combinedContext);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-pink-500/40 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-pink-300 group-hover:text-pink-200">{tmpl.titleMy}</div>
                  <div className="text-[10px] text-slate-400">{tmpl.customNotes}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Expandable 2-Tab Output View */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[550px] shadow-xl">
            {/* Output Sub-tabs (Strictly 2 tabs) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveOutputTab('email')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeOutputTab === 'email'
                      ? 'bg-pink-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>TAB 1: Email Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOutputTab('notes')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeOutputTab === 'notes'
                      ? 'bg-pink-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>TAB 2: Action Notes</span>
                </button>
              </div>

              {activeOutputTab === 'email' && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(true)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer animate-pulse"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>📧 Email တိုက်ရိုက်ပို့မည် (Dispatch)</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: EMAIL TEMPLATE */}
            {activeOutputTab === 'email' && (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ready-to-Send Email Draft</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paEmailResult).then(() => { setCopiedTab(true); setTimeout(() => setCopiedTab(false), 2000); })}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                    >
                      {copiedTab ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTab ? 'Copied!' : 'Copy Draft'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const element = document.createElement('a');
                        const file = new Blob([paEmailResult], { type: 'text/plain;charset=utf-8' });
                        element.href = URL.createObjectURL(file);
                        element.download = `Program_Advisor_Email_${studentId}.txt`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.txt</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={16}
                  value={paEmailResult}
                  onChange={(e) => setPaEmailResult(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-mono focus:outline-none focus:border-pink-500 resize-none flex-1"
                />
              </div>
            )}

            {/* TAB 2: ACTION NOTES & TACTICAL GUIDANCE (Consolidated with Strategic Outline Essence) */}
            {activeOutputTab === 'notes' && (
              <div className="space-y-3 text-xs text-slate-200 flex-1 overflow-y-auto pr-1">
                <div className="p-3.5 rounded-2xl bg-emerald-950/35 border border-emerald-500/30 text-emerald-200">
                  <h4 className="font-bold text-sm mb-1">💡 Tactical Student Advice & Guidelines (လက်တွေ့ လမ်းညွှန်ချက်များ)</h4>
                  <p className="text-[11px] text-slate-300">Advisor ထံမှ အမြန်ဆုံး အတည်ပြုချက်ရရှိရန် ဤအချက်များကို လိုက်နာပါ။</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                  <span className="text-rose-400 mt-0.5">⏰</span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">
                      Timing Strategy (အချိန်ကိုက် ပေးပို့ခြင်း):
                    </h5>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      UoPeople ၏ Scholarship Funds (ပညာသင်ဆု ဘဏ္ဍာငွေ ခွဲဝေမှု) သည် ဦးရာလူစနစ်နှင့် ရန်ပုံငွေ ကျန်ရှိမှုအပေါ် မူတည်သဖြင့် Course Registration မစတင်မီ (သို့မဟုတ်) အစောပိုင်းရက်များတွင် Advisor ထံ ကြိုတင် ဆက်သွယ်ထားခြင်းဖြင့် အခွင့်အလမ်း ပိုမိုရရှိနိုင်ပါသည်။
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                  <span className="text-cyan-400 mt-0.5">🔄</span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">
                      Follow-up Policy (ပြန်လည် ဆက်သွယ်ခြင်း စည်းမျဉ်း):
                    </h5>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      လုပ်ငန်းရက် ၃ ရက် (၇၂ နာရီ) အတွင်း အကြောင်းမပြန်ပါက ပို့ထားသော မူရင်း Email Thread ထဲမှပင် ယဉ်ယဉ်ကျေးကျေး Follow-up ထပ်မံပေးပို့၍ သတိပေး အသိပေးပါ။
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                  <span className="text-indigo-400 mt-0.5">🌐</span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">
                      Portal Synchronization (Portal စနစ် ချိတ်ဆက်မှု):
                    </h5>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      Advisor က approve လုပ်ပြီးပါက portal ၏ 'Payments & Financial Aid' အောက်တွင် Scholarship application widget ပွင့်လာပါမည်။
                    </p>
                  </div>
                </div>

                {/* Standardized Strategic Summary */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
                  <span className="text-amber-400 mt-0.5">📌</span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-bold text-amber-300">Email ပို့ဖို့ အဓိက အနှစ်ချုပ်:</span> Advisor ထံ စာပို့ရာတွင် Student ID၊ လက်ရှိ CGPA နှင့် လာမည့် Term များအတွက် စကောလားရှစ် လိုအပ်ရသည့် အခက်အခဲကို တိကျစွာ ဖော်ပြထားခြင်းက ခွင့်ပြုချက် အမြန်ဆုံးရရှိစေပါသည်။
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          EMAIL DISPATCH MODAL (Multi-Client Deep-Link Dispatcher)
          ========================================================================= */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  📧 Multi-Client Email Dispatcher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-xl bg-slate-800 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs space-y-1">
              <div className="font-bold text-indigo-300">Recipient: <span className="font-mono text-white">{recipientEmail}</span></div>
              <div className="text-[11px] text-slate-300 truncate">Subject: {emailSubject}</div>
            </div>

            <div className="space-y-2.5">
              {/* Option A: Gmail */}
              <a
                href={generateGmailWebUrl(recipientEmail, emailSubject, emailBody)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowDispatchModal(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center font-bold">G</div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">Open in Gmail (Web / App)</div>
                    <div className="text-[10px] text-slate-400">Direct compose link in new tab</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
              </a>

              {/* Option B: Outlook */}
              <a
                href={generateOutlookWebUrl(recipientEmail, emailSubject, emailBody)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowDispatchModal(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold">O</div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">Open in Outlook (Office 365)</div>
                    <div className="text-[10px] text-slate-400">Microsoft Outlook web compose</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
              </a>

              {/* Option C: Yahoo Mail */}
              <a
                href={generateYahooWebUrl(recipientEmail, emailSubject, emailBody)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowDispatchModal(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">Y</div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">Open in Yahoo Mail</div>
                    <div className="text-[10px] text-slate-400">Yahoo Web Mail compose</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
              </a>

              {/* Option D: Default Client */}
              <a
                href={generateMailtoUrl(recipientEmail, emailSubject, emailBody)}
                onClick={() => setShowDispatchModal(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">M</div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">Default System Mail Client</div>
                    <div className="text-[10px] text-slate-400">Apple Mail, Thunderbird, Windows Mail</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
              </a>
            </div>

            {/* Option E: One-Click Copy Fallback */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">One-Click Copy Fallback</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(emailSubject).then(() => { setCopiedSubject(true); setTimeout(() => setCopiedSubject(false), 2000); })}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  {copiedSubject ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSubject ? 'Copied Subject' : 'Copy Subject'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(emailBody).then(() => { setCopiedBody(true); setTimeout(() => setCopiedBody(false), 2000); })}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBody ? 'Copied Body' : 'Copy Body'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`TO: ${recipientEmail}\nSUBJECT: ${emailSubject}\n\n${emailBody}`).then(() => { setCopiedFull(true); setTimeout(() => setCopiedFull(false), 2000); })}
                  className="py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-semibold text-white shadow transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  {copiedFull ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFull ? 'Copied Full!' : 'Copy Full Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
