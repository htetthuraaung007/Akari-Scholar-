import React, { useState, useEffect } from 'react';
import { loadPersistedTabState, savePersistedTabState } from '../utils/researchPersistence';

type StudioSection = 'sop' | 'star' | 'personal' | 'academic_cv';

interface GeneratedEssayResult {
  title: string;
  content: string;
  strengths: string[];
  wordCount: number;
}

interface StarEssayTabState {
  targetProgram: string;
  promptNarrative: string;
  wordLimit: '500' | '750' | '1000';
  result: GeneratedEssayResult | null;
}

interface StarCvTabState {
  targetRoleOrDegree: string;
  rawCvProfile: string;
  result: GeneratedEssayResult | null;
}

const STAR_ACTIVE_TAB_KEY = 'star_studio_active_tab_v2';
const STAR_SOP_SESSION_KEY = 'star_studio_sop_state_v2';
const STAR_LEADERSHIP_SESSION_KEY = 'star_studio_star_state_v2';
const STAR_PERSONAL_SESSION_KEY = 'star_studio_personal_state_v2';
const STAR_CV_SESSION_KEY = 'star_studio_cv_state_v2';

const DEFAULT_SOP_STATE: StarEssayTabState = {
  targetProgram: '',
  promptNarrative: '',
  wordLimit: '500',
  result: null,
};

const DEFAULT_STAR_STATE: StarEssayTabState = {
  targetProgram: '',
  promptNarrative: '',
  wordLimit: '500',
  result: null,
};

const DEFAULT_PERSONAL_STATE: StarEssayTabState = {
  targetProgram: '',
  promptNarrative: '',
  wordLimit: '500',
  result: null,
};

const DEFAULT_CV_STATE: StarCvTabState = {
  targetRoleOrDegree: '',
  rawCvProfile: '',
  result: null,
};

export const ScholarshipSopStudio: React.FC<{ onBackToDashboard?: () => void }> = ({ onBackToDashboard }) => {
  const [activeSection, setActiveSection] = useState<StudioSection>(() =>
    loadPersistedTabState<StudioSection>(STAR_ACTIVE_TAB_KEY, 'sop')
  );

  // Isolated Per-Tab States (Persisted in sessionStorage)
  const [sopState, setSopState] = useState<StarEssayTabState>(() =>
    loadPersistedTabState<StarEssayTabState>(STAR_SOP_SESSION_KEY, DEFAULT_SOP_STATE)
  );
  const [starState, setStarState] = useState<StarEssayTabState>(() =>
    loadPersistedTabState<StarEssayTabState>(STAR_LEADERSHIP_SESSION_KEY, DEFAULT_STAR_STATE)
  );
  const [personalState, setPersonalState] = useState<StarEssayTabState>(() =>
    loadPersistedTabState<StarEssayTabState>(STAR_PERSONAL_SESSION_KEY, DEFAULT_PERSONAL_STATE)
  );
  const [cvState, setCvState] = useState<StarCvTabState>(() =>
    loadPersistedTabState<StarCvTabState>(STAR_CV_SESSION_KEY, DEFAULT_CV_STATE)
  );

  // Execution & UI Guard States
  const [loadingSection, setLoadingSection] = useState<StudioSection | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [confirmClearSection, setConfirmClearSection] = useState<StudioSection | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    savePersistedTabState<StudioSection>(STAR_ACTIVE_TAB_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => {
    savePersistedTabState<StarEssayTabState>(STAR_SOP_SESSION_KEY, sopState);
  }, [sopState]);

  useEffect(() => {
    savePersistedTabState<StarEssayTabState>(STAR_LEADERSHIP_SESSION_KEY, starState);
  }, [starState]);

  useEffect(() => {
    savePersistedTabState<StarEssayTabState>(STAR_PERSONAL_SESSION_KEY, personalState);
  }, [personalState]);

  useEffect(() => {
    savePersistedTabState<StarCvTabState>(STAR_CV_SESSION_KEY, cvState);
  }, [cvState]);

  const currentEssayState: StarEssayTabState =
    activeSection === 'sop'
      ? sopState
      : activeSection === 'star'
      ? starState
      : personalState;

  const updateCurrentEssayState = (updater: (prev: StarEssayTabState) => StarEssayTabState) => {
    if (activeSection === 'sop') {
      setSopState(updater);
    } else if (activeSection === 'star') {
      setStarState(updater);
    } else if (activeSection === 'personal') {
      setPersonalState(updater);
    }
  };

  const setResultForSection = (section: StudioSection, nextResult: GeneratedEssayResult | null) => {
    if (section === 'sop') {
      setSopState((prev) => ({ ...prev, result: nextResult }));
    } else if (section === 'star') {
      setStarState((prev) => ({ ...prev, result: nextResult }));
    } else if (section === 'personal') {
      setPersonalState((prev) => ({ ...prev, result: nextResult }));
    } else {
      setCvState((prev) => ({ ...prev, result: nextResult }));
    }
  };

  const activeResult =
    activeSection === 'academic_cv' ? cvState.result : currentEssayState.result;
  const isCurrentLoading = loadingSection === activeSection;

  const handleSwitchSection = (nextSection: StudioSection) => {
    setActiveSection(nextSection);
    setConfirmClearSection(null);
    setCopySuccess(false);
    setNoticeMessage(null);
  };

  // Independent Clear Handlers per Tab
  const executeClearSection = (section: StudioSection) => {
    if (section === 'sop') {
      setSopState({ targetProgram: '', promptNarrative: '', wordLimit: '500', result: null });
    } else if (section === 'star') {
      setStarState({ targetProgram: '', promptNarrative: '', wordLimit: '500', result: null });
    } else if (section === 'personal') {
      setPersonalState({ targetProgram: '', promptNarrative: '', wordLimit: '500', result: null });
    } else {
      setCvState({ targetRoleOrDegree: '', rawCvProfile: '', result: null });
    }
    setConfirmClearSection(null);
    setCopySuccess(false);
    setNoticeMessage(null);
  };

  const handleRequestClear = () => {
    const hasContent =
      activeSection === 'academic_cv'
        ? Boolean(cvState.targetRoleOrDegree.trim()) ||
          Boolean(cvState.rawCvProfile.trim()) ||
          Boolean(cvState.result)
        : Boolean(currentEssayState.targetProgram.trim()) ||
          Boolean(currentEssayState.promptNarrative.trim()) ||
          Boolean(currentEssayState.result);

    if (!hasContent) {
      executeClearSection(activeSection);
      return;
    }
    setConfirmClearSection(activeSection);
  };

  // Quick Sample Narrative Loaders
  const handleLoadSample = () => {
    setNoticeMessage(null);
    if (activeSection === 'sop') {
      setSopState((prev) => ({
        ...prev,
        promptNarrative:
          'Graduated with Bachelor of Science in Health Science (CGPA: 3.94/4.00) from University of the People. Background in digital health, epidemiological data analysis using SQL, Excel, and Power BI. Seeking to pursue an MPH at Chulalongkorn University to conduct research on rural healthcare disparities and telemedicine access in Myanmar.',
      }));
    } else if (activeSection === 'star') {
      setStarState((prev) => ({
        ...prev,
        promptNarrative:
          'During prolonged infrastructure outages and rolling blackouts in Yangon, organized an offline study collective for UoPeople health science undergraduates using USB drives, distributed lecture notes, and peer study cohorts. Mentored over 15 students, cutting course drop-out by 40% and helping them maintain GPAs above 3.5.',
      }));
    } else if (activeSection === 'personal') {
      setPersonalState((prev) => ({
        ...prev,
        promptNarrative:
          'Living in Myanmar through severe domestic socio-economic disruptions and electricity shortages taught me resilience. Balancing full-time online undergraduate coursework without dependable power or internet while coordinating local health literacy initiatives cemented my resolve to pursue systemic public health reforms.',
      }));
    } else if (activeSection === 'academic_cv') {
      setCvState((prev) => ({
        ...prev,
        rawCvProfile:
          'Maung Htet Thura Aung | Yangon, Myanmar\n\n' +
          'EDUCATION:\n' +
          'Bachelor of Science in Health Science, University of the People (USA, Online) | CGPA: 3.94/4.00 (Graduated with High Honors)\n\n' +
          'TECHNICAL & RESEARCH COMPETENCIES:\n' +
          'Health Data Analytics, SQL, Microsoft Excel, Power BI, SIFT Method Source Verification, APA 7th Academic Writing\n\n' +
          'ACADEMIC RESEARCH & CAPSTONE PROJECTS:\n' +
          '- The Impact of GMOs, Globalization, and Telemedicine on Myanmar Health Systems (POLS 1503)\n' +
          '- Feasibility Analysis of Localized Tele-triage Platforms in Hmawbi Township\n\n' +
          'LEADERSHIP, MENTORSHIP & VOLUNTEERING:\n' +
          'Academic Peer Mentor for Health Science undergraduates at UoPeople; Guest speaker on digital education at Bridge Forward Organization.',
      }));
    }
  };

  // Ultra-Low-Token Gemini Cascade Execution
  const handleGenerate = async () => {
    const sectionAtStart = activeSection;
    const isCv = sectionAtStart === 'academic_cv';
    const inputContent = isCv
      ? cvState.rawCvProfile.trim()
      : currentEssayState.promptNarrative.trim();

    if (!inputContent) {
      setNoticeMessage('အချက်အလက်များကို ဘယ်ဘက်တွင် ဦးစွာ ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const apiKey = (localStorage.getItem('akari_gemini_api_key_primary') || '').trim();
    const targetProgramVal = currentEssayState.targetProgram;
    const wordLimitVal = currentEssayState.wordLimit;
    const targetRoleVal = cvState.targetRoleOrDegree;

    setNoticeMessage(null);
    setLoadingSection(sectionAtStart);
    try {
      let systemPrompt = '';
      let userPayload = '';

      if (isCv) {
        systemPrompt = `
You are a Harvard Academic CV & ATS Architect.
Convert the student profile into a formal, single-column Harvard-Standard Academic CV optimized for graduate school admissions and academic research assistant roles.
STRUCTURE:
- Header (Full Name, Contact, Academic Credentials)
- Education (Institution, Degree, CGPA 3.94/4.00, Academic Honors)
- Technical & Research Competencies
- Academic Research & Capstone Projects (Strict Google XYZ formula: Accomplished [X], as measured by [Y], by doing [Z])
- Mentorship & Community Leadership
Return strictly valid JSON:
{
  "title": "Harvard-Standard Academic CV: ${targetRoleVal}",
  "content": "Clean plain-text format with uppercase section headers and clean spacing...",
  "strengths": ["Quantifiable XYZ Impact Bullets", "Academic Rigor"],
  "wordCount": 350
}
`;
        userPayload = `TARGET ROLE/PROGRAM: ${targetRoleVal}\nRAW PROFILE:\n${inputContent}`;
      } else {
        const modeLabel =
          sectionAtStart === 'sop'
            ? 'Statement of Purpose (SOP)'
            : sectionAtStart === 'star'
            ? 'STAR Leadership & Influence Essay'
            : 'Personal Statement (Resilience & Overcoming Hardships)';

        systemPrompt = `
You are an Elite Graduate Admissions & Scholarship Committee Advisor for Top Global Universities.
Write an authentic, highly persuasive, university-standard ${modeLabel}.
RULES:
1. Tone: Intellectual maturity, humble confidence, grounded academic voice. Avoid cliché melodrama.
2. Structure: Clear logical flow, evidence-backed impact, intellectual curiosity, and explicit alignment with the target program.
3. Length: Strictly keep within ~${wordLimitVal} words.
Return strictly valid JSON:
{
  "title": "${modeLabel}: ${targetProgramVal}",
  "content": "The full polished essay text ready for submission...",
  "strengths": ["Key analytical strength or quantifiable milestone highlighted"],
  "wordCount": 480
}
`;
        userPayload = `TARGET PROGRAM: ${targetProgramVal}\nTYPE: ${modeLabel}\nSTUDENT NARRATIVE:\n${inputContent}`;
      }

      let generated = false;

      // Primary Path: Server-side proxy (uses server GEMINI_API_KEY with auto-cascade)
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-gemini-key'] = apiKey;

        const serverRes = await fetch('/api/academic/assist', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'direct_assist',
            payload: {
              prompt: `${systemPrompt}\n\n${userPayload}`,
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              maxOutputTokens: 900,
              temperature: 0.25,
            },
          }),
        });

        if (serverRes.ok) {
          const serverData = await serverRes.json();
          const raw = serverData.result || serverData.text;
          if (raw) {
            const cleaned = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed: GeneratedEssayResult = JSON.parse(cleaned);
            parsed.wordCount = parsed.content.trim().split(/\s+/).filter(Boolean).length;
            setResultForSection(sectionAtStart, parsed);
            generated = true;
          }
        }
      } catch (e) {
        console.error('Scholarship server assist error:', e);
      }

      if (!generated) {
        setNoticeMessage('ရေးသားရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။ ကျေးဇူးပြု၍ ပြန်လည်စမ်းသပ်ပေးပါခင်ဗျာ။');
      }
    } catch {
      setNoticeMessage('ရေးသားရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။');
    } finally {
      setLoadingSection(null);
    }
  };

  const handleCopy = () => {
    if (!activeResult?.content) return;
    void navigator.clipboard.writeText(activeResult.content);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Dashboard သို့ ပြန်သွားမည်"
            >
              ← Back
            </button>
          )}
          <div className="p-2.5 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/40">
            <span>⭐</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              STAR Story Arc &amp; Scholarship SOP Studio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              တက္ကသိုလ် မဟာဘွဲ့နှင့် နိုင်ငံတကာ ပညာသင်ဆုများအတွက် SOP, STAR Leadership Essay, Personal Statement နှင့် Academic CV စနစ်
            </p>
          </div>
        </div>

        {/* 4 Dedicated Section Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={() => handleSwitchSection('sop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'sop' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎯 Statement of Purpose (SOP)
          </button>
          <button
            type="button"
            onClick={() => handleSwitchSection('star')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'star' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⭐ STAR Leadership
          </button>
          <button
            type="button"
            onClick={() => handleSwitchSection('personal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'personal' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌱 Personal Statement
          </button>
          <button
            type="button"
            onClick={() => handleSwitchSection('academic_cv')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'academic_cv' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📄 Harvard Academic CV
          </button>
        </div>
      </div>

      {/* Persistent Bilingual Advisory / Disclaimer Callout Banner */}
      <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-600/40 shadow-sm space-y-2.5">
        <div className="flex items-center">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-600/40 text-xs font-extrabold text-amber-300 tracking-wide">
            ⚠️ အရေးကြီး သတိပေးချက် · Scholarship Application Advisory
          </span>
        </div>

        <div className="space-y-2 text-xs text-amber-200/90 leading-relaxed">
          <p>
            သတိပြုရန် - ဤစနစ်သည် ပညာသင်ဆုနှင့် တက္ကသိုလ်ဝင်ခွင့် လျှောက်ထားရာတွင် မိမိ၏ အချက်အလက်များကို ပိုမိုစနစ်ကျစေရန် ကူညီပေးသော အထောက်အကူပြု Tool တစ်ခုသာ ဖြစ်ပါသည်။ ဤနေရာမှ ထွက်လာသော စာမူကို အသုံးပြုရုံဖြင့် ပညာသင်ဆု သို့မဟုတ် တက္ကသိုလ်ဝင်ခွင့် ရရှိမည်ဟု လုံးဝ အာမမခံပါ။
          </p>
          <p>
            နိုင်ငံတကာ ပညာသင်ဆု ရွေးချယ်ရေး ကော်မတီများသည် လျှောက်ထားသူ၏ ကိုယ်ပိုင် အတွေ့အကြုံစစ်စစ်နှင့် စိတ်အားထက်သန်မှုကိုသာ အဓိက အကဲဖြတ်ကြခြင်း ဖြစ်သည်။ ထို့ကြောင့် ဤနေရာမှ ရရှိသော အကြမ်းထည် စာမူများကို နမူနာ လမ်းညွှန်အဖြစ်သာ ယူ၍ မိမိ၏ ကိုယ်ပိုင်အသံ၊ လက်တွေ့လုပ်ဆောင်ချက်များနှင့်အညီ စကားလုံး အပိုဒ်တိုင်းကို ကိုယ်တိုင် သေချာ ပြန်လည်မွမ်းမံ တည်းဖြတ်ပြီးမှသာ အသုံးပြုပါရန် အလေးအနက် အကြံပြုအပ်ပါသည်။
          </p>
        </div>

        <div className="pt-2 border-t border-amber-600/30 text-[11px] text-amber-200/80 leading-relaxed">
          <p>
            Important Advisory: This studio serves strictly as an academic structuring and drafting aid. Utilization of this tool does NOT guarantee admission, scholarship awards, or interview selection. International scholarship committees place paramount value on authentic personal narrative, verified field impact, and individual voice. Treat all generated drafts solely as foundational blueprints—thoroughly revise, fact-check, and personalize every single paragraph with your own authentic reflections prior to final submission.
          </p>
        </div>
      </div>

      {noticeMessage && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span>⚠️ {noticeMessage}</span>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-[11px] font-bold text-amber-300 hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            {confirmClearSection === activeSection && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                <p className="text-red-200 font-medium leading-relaxed">
                  ထည့်သွင်းထားသော အချက်အလက်များနှင့် ထွက်ရှိထားသော စာမူကြမ်းများကို အားလုံးရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearSection(null)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={() => executeClearSection(activeSection)}
                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    သေချာသည် (Clear)
                  </button>
                </div>
              </div>
            )}

            {activeSection !== 'academic_cv' ? (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    TARGET SCHOLARSHIP / DEGREE PROGRAM:
                  </label>
                  <input
                    type="text"
                    value={currentEssayState.targetProgram}
                    onChange={(e) =>
                      updateCurrentEssayState((prev) => ({
                        ...prev,
                        targetProgram: e.target.value,
                      }))
                    }
                    className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-bold text-slate-300">
                      သင့် ပညာရေး/အတွေ့အကြုံ အချက်အလက် (Prompt / Story):
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleLoadSample}
                        className="text-[10px] text-purple-400 hover:underline cursor-pointer"
                      >
                        + နမူနာ ထည့်သွင်းမည်
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestClear}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️ ရှင်းထုတ်မည် (Clear All)</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={10}
                    value={currentEssayState.promptNarrative}
                    onChange={(e) =>
                      updateCurrentEssayState((prev) => ({
                        ...prev,
                        promptNarrative: e.target.value,
                      }))
                    }
                    placeholder="ဘွဲ့ကြိုရမှတ်များ၊ သုတေသနပရောဂျက်များ၊ ရပ်ရွာအကျိုးပြု လုပ်ဆောင်ချက်များနှင့် မဟာဘွဲ့ ရည်မှန်းချက်များကို ထည့်သွင်းပါ..."
                    className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-purple-500 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-[11px] text-slate-400 font-semibold">Target Word Count:</span>
                  <div className="flex items-center gap-1">
                    {(['500', '750', '1000'] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() =>
                          updateCurrentEssayState((prev) => ({ ...prev, wordLimit: cnt }))
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                          currentEssayState.wordLimit === cnt
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        ~{cnt} w
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    TARGET DEGREE / RESEARCH FIELD / ROLE:
                  </label>
                  <input
                    type="text"
                    value={cvState.targetRoleOrDegree}
                    onChange={(e) =>
                      setCvState((prev) => ({
                        ...prev,
                        targetRoleOrDegree: e.target.value,
                      }))
                    }
                    className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-bold text-slate-300">
                      မိမိ၏ ပညာအရည်အချင်း၊ Coursework နှင့် Projects များ:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleLoadSample}
                        className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                      >
                        + နမူနာ ထည့်သွင်းမည်
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestClear}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️ ရှင်းထုတ်မည် (Clear All)</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={13}
                    value={cvState.rawCvProfile}
                    onChange={(e) =>
                      setCvState((prev) => ({ ...prev, rawCvProfile: e.target.value }))
                    }
                    placeholder="တက္ကသိုလ်၊ ဘွဲ့၊ CGPA၊ သုတေသနပရောဂျက်များနှင့် ကျောင်းတွင်း ဦးဆောင်ခဲ့မှုများကို ထည့်သွင်းပါ..."
                    className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              isCurrentLoading ||
              (activeSection !== 'academic_cv'
                ? !currentEssayState.promptNarrative.trim()
                : !cvState.rawCvProfile.trim())
            }
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all mt-2 cursor-pointer"
          >
            {isCurrentLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>ပညာသင်ဆု စံနှုန်းဖြင့် စနစ်တကျ ရေးသားနေသည်...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>{activeSection === 'academic_cv' ? 'Harvard-Standard Academic CV ပြောင်းလဲမည်' : 'Scholarship Essay တရားဝင် ထုတ်ယူမည်'}</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200">
              {activeSection === 'academic_cv' ? 'HARVARD ACADEMIC CV PREVIEW' : 'POLISHED SCHOLARSHIP NARRATIVE ESSAY'}
            </span>
            {activeResult && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                  {activeResult.wordCount} words
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all cursor-pointer"
                >
                  {copySuccess ? '✓ ကူးပြီးပါပြီ' : '📋 Copy Output'}
                </button>
                <button
                  type="button"
                  onClick={handleRequestClear}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>🗑️ ရှင်းထုတ်မည် (Clear All)</span>
                </button>
              </div>
            )}
          </div>

          {isCurrentLoading ? (
            <div className="h-80 flex flex-col items-center justify-center space-y-3">
              <div className="w-9 h-9 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-300">Academic Trajectory နှင့် Leadership Voice ကို ချိန်ညှိနေသည်...</p>
            </div>
          ) : activeResult ? (
            <div className="space-y-3">
              {activeResult.strengths.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs">
                  <span className="font-bold text-purple-300 block mb-1">🎯 Core Strengths & Quantifiable Impacts:</span>
                  <ul className="list-disc list-inside text-slate-200 text-[11px] space-y-0.5">
                    {activeResult.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-serif text-slate-100 text-xs leading-relaxed max-h-[440px] overflow-y-auto whitespace-pre-wrap">
                {activeResult.content}
              </div>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
              <span>ဘယ်ဘက်တွင် အချက်အလက်များ ဖြည့်စွက်ပြီး ခလုတ်ကို နှိပ်ပါ</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
