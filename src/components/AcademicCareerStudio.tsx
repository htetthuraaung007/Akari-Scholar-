import React, { useState } from 'react';
import { executeAcademicActionWithCascade } from '../services/geminiService';

type MainStudioTab = 'scholarship' | 'academic_cv';
type EssayType = 'star_leadership' | 'sop' | 'personal_statement';

interface GeneratedResult {
  title: string;
  content: string;
  metricsIdentified: string[];
  wordCount: number;
}



export const AcademicCareerStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainStudioTab>('scholarship');
  const [essayType, setEssayType] = useState<EssayType>('sop');

  // Input States for Essay Studio
  const [targetProgram, setTargetProgram] = useState('Chulalongkorn University - Master of Public Health (MPH) Scholarship');
  const [promptNarrative, setPromptNarrative] = useState('');
  const [wordLimit, setWordLimit] = useState<'500' | '750' | '1000'>('500');

  // Input States for Academic CV
  const [targetDegreeOrRole, setTargetDegreeOrRole] = useState('Master of Public Health (MPH) / Graduate Research Assistant');
  const [rawCvProfile, setRawCvProfile] = useState('');

  // Processing & Results
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Template Quick-Loaders
  const handleLoadSampleEssay = () => {
    if (essayType === 'sop') {
      setPromptNarrative(
        'Graduated with Bachelor of Science in Health Science (CGPA: 3.94/4.00) from University of the People. Strong background in digital epidemiology, data analytics (SQL, Excel, Power BI). Seeking to pursue Master of Public Health to address healthcare disparities and telemedicine access in Myanmar rural communities like Hmawbi.'
      );
    } else if (essayType === 'star_leadership') {
      setPromptNarrative(
        'During prolonged blackouts and network disruptions in Yangon, organized an offline study circle for UoPeople health science students using USB drives and mesh messaging. Mentored over 15 peers, reducing course drop-out by 40% and helping them maintain GPA above 3.5.'
      );
    } else {
      setPromptNarrative(
        'Living in Myanmar during acute political and healthcare disruptions taught me resilience. Balancing full-time online degree studies amid daily power outages without stable internet while supporting family health education initiatives shaped my long-term commitment to public health systems.'
      );
    }
  };

  const handleLoadSampleCv = () => {
    setRawCvProfile(
      'Maung Htet Thura Aung | Yangon, Myanmar\n\n' +
      'EDUCATION:\n' +
      'Bachelor of Science in Health Science, University of the People (USA, Online) | CGPA: 3.94/4.00\n\n' +
      'TECHNICAL SKILLS:\n' +
      'Health Data Analytics, SQL, Microsoft Excel, Power BI, SIFT Method Source Verification, APA 7th Academic Writing\n\n' +
      'ACADEMIC PROJECTS & RESEARCH:\n' +
      '- The Impact of GMOs, Globalization, and Telemedicine on Myanmar Health Systems (POLS 1503)\n' +
      '- Local Tele-triage platform assessment in Hmawbi Township\n\n' +
      'LEADERSHIP & MENTORSHIP:\n' +
      'Academic Peer Mentor for Health Science undergraduates at UoPeople; Guest speaker at Bridge Forward Organization.'
    );
  };

  // AI Generation with Ultra-Low Token Protection & Dual-Path Failover
  const handleGenerate = async () => {
    const rawInput = activeTab === 'scholarship' ? promptNarrative.trim() : rawCvProfile.trim();
    if (!rawInput) {
      alert('အချက်အလက်များကို ဘယ်ဘက်တွင် ဦးစွာ ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    const apiKey = localStorage.getItem('akari_gemini_api_key_primary') || '';

    setLoading(true);
    try {
      let systemPrompt = '';
      let userPayload = '';

      if (activeTab === 'scholarship') {
        const typeLabel = essayType === 'sop' ? 'Statement of Purpose (SOP)' : essayType === 'star_leadership' ? 'STAR Leadership Essay' : 'Personal Statement';
        systemPrompt = `
You are an Elite Scholarship & Graduate Admissions Committee Advisor for Top Global Universities.
Craft a compelling, highly authentic academic ${typeLabel}.
RULES:
1. Academic Rigor: Emphasize quantifiable impact, intellectual trajectory, resilience, and scholarly maturity.
2. Tone: Confident, scholarly, humble yet assertive. Avoid cheesy cliches like "since childhood" or "burning passion".
3. Word Limit: Strictly keep within ~${wordLimit} words.
Return strictly valid JSON:
{
  "title": "${typeLabel}: ${targetProgram}",
  "content": "The full polished essay text...",
  "metricsIdentified": ["Key metric or strength extracted from narrative"],
  "wordCount": 480
}
`;
        userPayload = `TARGET PROGRAM: ${targetProgram}\nESSAY TYPE: ${typeLabel}\nSTUDENT NARRATIVE:\n${promptNarrative}`;
      } else {
        systemPrompt = `
You are a Harvard Academic CV & ATS Specialist.
Transform the provided student profile into a formal, single-column Harvard-Standard Academic CV optimized for graduate school admissions and research roles.
STRUCTURE:
- Header (Full Name, Location, Academic Credentials)
- Education (Institution, Degree, CGPA, Academic Honors)
- Technical & Research Skills
- Academic Research & Capstone Projects (with Google XYZ formula bullet points)
- Teaching, Mentorship & Community Leadership
Return strictly valid JSON:
{
  "title": "Harvard-Standard Academic CV: ${targetDegreeOrRole}",
  "content": "Formatted plain text with standard spacing and clean uppercase headers...",
  "metricsIdentified": ["CGPA 3.94/4.00", "Quantifiable impact bullets"],
  "wordCount": 350
}
`;
        userPayload = `TARGET ROLE/DEGREE: ${targetDegreeOrRole}\nRAW PROFILE:\n${rawCvProfile}`;
      }

      let generated = false;

      try {
        const raw = await executeAcademicActionWithCascade({
          action: 'direct_assist',
          primaryKey: apiKey || undefined,
          payload: {
            prompt: `${systemPrompt}\n\n${userPayload}`,
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            maxOutputTokens: 1200,
            temperature: 0.25,
          },
        });

        if (raw) {
          const cleaned = String(typeof raw === 'string' ? raw : JSON.stringify(raw))
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
          const parsed: GeneratedResult = JSON.parse(cleaned);
          parsed.wordCount = parsed.content.trim().split(/\s+/).filter(Boolean).length;
          setResult(parsed);
          generated = true;
        }
      } catch (e) {
        console.error('Career generation error:', e);
      }

      if (!generated) {
        alert('ရေးသားရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။ ကျေးဇူးပြု၍ ပြန်လည်စမ်းသပ်ပေးပါခင်ဗျာ။');
      }
    } catch {
      alert('ရေးသားရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.content) return;
    navigator.clipboard.writeText(result.content);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Main Studio Selector */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/40">
            <span>🎓</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              တက္ကသိုလ် Academic CV & Scholarship Studio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              တက္ကသိုလ် မဟာဘွဲ့ ပညာသင်ဆုများအတွက် SOP, Personal Statement, STAR Essay များနှင့် Harvard-Standard Academic CV တည်ဆောက်ရေး
            </p>
          </div>
        </div>

        {/* Dual Main Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => { setActiveTab('scholarship'); setResult(null); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'scholarship'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>✍️</span>
            <span>၁။ Scholarship SOP & Essay Studio</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('academic_cv'); setResult(null); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'academic_cv'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📄</span>
            <span>၂။ Harvard-Standard Academic CV</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: SCHOLARSHIP ESSAY & SOP STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'scholarship' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Form */}
          <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Essay Sub-Type Selection */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  ရေးသားလိုသော စာတမ်းအမျိုးအစား ရွေးချယ်ပါ:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEssayType('sop')}
                    className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                      essayType === 'sop'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🎯 Statement of Purpose (SOP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEssayType('star_leadership')}
                    className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                      essayType === 'star_leadership'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⭐ STAR Leadership Essay
                  </button>
                  <button
                    type="button"
                    onClick={() => setEssayType('personal_statement')}
                    className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                      essayType === 'personal_statement'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🌱 Personal Statement
                  </button>
                </div>
              </div>

              {/* Target University / Scholarship */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  TARGET SCHOLARSHIP / UNIVERSITY PROGRAM:
                </label>
                <input
                  type="text"
                  value={targetProgram}
                  onChange={(e) => setTargetProgram(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Narrative Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    သင့် ပညာရေး/အတွေ့အကြုံ အချက်အလက် (Prompt / Story):
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSampleEssay}
                    className="text-[10px] text-purple-400 hover:underline cursor-pointer"
                  >
                    + နမူနာ ထည့်သွင်းမည်
                  </button>
                </div>
                <textarea
                  rows={9}
                  value={promptNarrative}
                  onChange={(e) => setPromptNarrative(e.target.value)}
                  placeholder="ဘွဲ့ကြိုရမှတ်များ၊ သုတေသနပရောဂျက်များ၊ ကြုံတွေ့ခဲ့ရသော အခက်အခဲများနှင့် မဟာဘွဲ့တွင် ဆက်လက်လုပ်ဆောင်မည့် ရည်မှန်းချက်များကို ထည့်သွင်းပါ..."
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>

              {/* Word Count Limit Switcher */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-[11px] text-slate-400 font-semibold">သတ်မှတ် စာလုံးရေ (Target Word Count):</span>
                <div className="flex items-center gap-1">
                  {(['500', '750', '1000'] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setWordLimit(cnt)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                        wordLimit === cnt
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ~{cnt} w
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !promptNarrative.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>ပညာသင်ဆု စံနှုန်းဖြင့် စနစ်တကျ ရေးသားနေသည်...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Scholarship Essay တရားဝင် ထုတ်ယူမည်</span>
                </>
              )}
            </button>
          </div>

          {/* Right Output */}
          <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">POLISHED SCHOLARSHIP NARRATIVE ESSAY</span>
              {result && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                    {result.wordCount} words
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer"
                  >
                    {copySuccess ? '✓ ကူးပြီးပါပြီ' : '📋 Copy Essay'}
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="h-80 flex flex-col items-center justify-center space-y-3">
                <div className="w-9 h-9 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-300">Academic Trajectory နှင့် Leadership Voice ကို ချိန်ညှိနေသည်...</p>
              </div>
            ) : result ? (
              <div className="space-y-3">
                {result.metricsIdentified.length > 0 && (
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs">
                    <span className="font-bold text-purple-300 block mb-1">🎯 Highlighted Core Strengths & Metrics:</span>
                    <ul className="list-disc list-inside text-slate-200 text-[11px] space-y-0.5">
                      {result.metricsIdentified.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-serif text-slate-100 text-xs leading-relaxed max-h-[420px] overflow-y-auto whitespace-pre-wrap">
                  {result.content}
                </div>
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>ဘယ်ဘက်တွင် အချက်အလက်များ ဖြည့်စွက်ပြီး "Scholarship Essay တရားဝင် ထုတ်ယူမည်" ကို နှိပ်ပါ</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: HARVARD-STANDARD ACADEMIC CV & ATS */}
      {/* ========================================================================= */}
      {activeTab === 'academic_cv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Form */}
          <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  TARGET DEGREE / RESEARCH FIELD / ROLE:
                </label>
                <input
                  type="text"
                  value={targetDegreeOrRole}
                  onChange={(e) => setTargetDegreeOrRole(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    မိမိ၏ ပညာအရည်အချင်း၊ Coursework နှင့် Projects များ:
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSampleCv}
                    className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    + နမူနာ ထည့်သွင်းမည်
                  </button>
                </div>
                <textarea
                  rows={13}
                  value={rawCvProfile}
                  onChange={(e) => setRawCvProfile(e.target.value)}
                  placeholder="တက္ကသိုလ်၊ CGPA၊ သင်ယူခဲ့သော ဘာသာရပ်များ၊ သုတေသနပရောဂျက်များနှင့် ကျောင်းတွင်း ဦးဆောင်ခဲ့မှုများကို ရိုက်ထည့်ပါ..."
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !rawCvProfile.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Harvard Standard ဖြင့် စီစဉ်နေသည်...</span>
                </>
              ) : (
                <>
                  <span>📄</span>
                  <span>Harvard-Standard Academic CV သို့ ပြောင်းလဲမည်</span>
                </>
              )}
            </button>
          </div>

          {/* Right Output */}
          <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">HARVARD ACADEMIC CV PREVIEW</span>
              {result && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer"
                >
                  {copySuccess ? '✓ ကူးပြီးပါပြီ' : '📋 Copy Academic CV'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="h-80 flex flex-col items-center justify-center space-y-3">
                <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-300">Action Verbs နှင့် Quantifiable Metrics များကို ချိန်ညှိနေသည်...</p>
              </div>
            ) : result ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 text-xs leading-relaxed max-h-[460px] overflow-y-auto whitespace-pre-wrap shadow-inner">
                {result.content}
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <span>ဘယ်ဘက်တွင် Coursework နှင့် အချက်အလက်များ ထည့်သွင်းပြီး CV ပြောင်းလဲထုတ်ယူပါ</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
