import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import {
  Award,
  Briefcase,
  FileText,
  Sparkles,
  Copy,
  Check,
  CheckCircle,
  CheckCircle2,
  TrendingUp,
  Download,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const CareerToolkit: React.FC = () => {
  const { language, callAcademicApi, setActiveTab: setGlobalActiveTab } = useApp();
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'star' | 'ats'>('star');

  // ==========================================
  // TAB 1: STAR STORY ARC STATE (PROMPT-DRIVEN)
  // ==========================================
  const [starProgramGoal, setStarProgramGoal] = useState('Chevening / Fulbright / Prestigious International Scholarship');
  const [starPrompt, setStarPrompt] = useState('');
  const [showStructuredStar, setShowStructuredStar] = useState(false);
  const [starSituation, setStarSituation] = useState('');
  const [starTask, setStarTask] = useState('');
  const [starAction, setStarAction] = useState('');
  const [starResult, setStarResult] = useState('');
  const [starResultText, setStarResultText] = useState('');
  const [starLoading, setStarLoading] = useState(false);
  const [starGenCount, setStarGenCount] = useState(0);
  const [copiedStar, setCopiedStar] = useState(false);

  // ==========================================
  // TAB 2: ATS RÉSUMÉ CONVERTER STATE (PROMPT-DRIVEN)
  // ==========================================
  const [targetRole, setTargetRole] = useState('Junior Software Engineer / Data Analyst');
  const [rawBackgroundPrompt, setRawBackgroundPrompt] = useState('');
  const [atsResultText, setAtsResultText] = useState('');
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsGenCount, setAtsGenCount] = useState(0);
  const [copiedAts, setCopiedAts] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // High-Impact STAR Templates
  const STAR_TEMPLATES = [
    {
      title: 'Template 1: Community Offline Education & Tech Hubs',
      titleMy: 'နမူနာ ၁ - မီးပျက်မှုကြားမှ ကျောင်းသား ၂၀၀ ကျော်အတွက် Offline ပညာရေးစနစ် တည်ဆောက်ခဲ့မှု',
      promptText: `During severe electricity blackouts and exorbitant mobile data costs in Yangon, over 65% of students in our university cohort were unable to attend online classes. As student computing club leader, I spearheaded an offline peer-to-peer distribution system. I compressed lecture recordings into lightweight audio summaries and open-source interactive coding flashcards onto encrypted thumb drives, establishing 5 physical community hubs in student commuter hostels. As a result, over 210 students completed their core coursework, reducing expected departmental dropout rates from 32% to 6%, and the initiative was adopted by two other faculties.`,
      goal: 'Chevening Master’s in Educational Technology & Leadership',
    },
    {
      title: 'Template 2: Rural Medical Logistics & Emergency Aid Coordination',
      titleMy: 'နမူနာ ၂ - နယ်စွန်ဒေသ အရေးပေါ်ဆေးဝါးနှင့် ကျန်းမာရေးထောက်ပံ့မှု စီစဉ်ပေးခဲ့မှု',
      promptText: `During regional transport blockades, a rural district community clinic faced a critical shortage of essential pediatric antibiotics and clean water purification tablets. Recognizing that traditional delivery supply chains had collapsed, I coordinated a volunteer motorcycle courier network and negotiated safe transit with local community elders. I created a decentralized spreadsheet tracking inventory in real-time. Within 3 weeks, we delivered 450 kg of emergency medical supplies to 8 village health posts, preventing an outbreak of waterborne illnesses among 1,200 vulnerable infants.`,
      goal: 'Fulbright / DAAD Public Health Leadership Scholarship',
    },
    {
      title: 'Template 3: Women in STEM Peer Mentorship & Digital Skills',
      titleMy: 'နမူနာ ၃ - အမျိုးသမီးငယ်များ နည်းပညာနှင့် Programming ကျွမ်းကျင်မှု မြှင့်တင်ရေး',
      promptText: `In my university department, female enrollment in advanced computer science was only 14%, with high attrition due to lack of mentorship. I launched a peer mentorship initiative called "CodeTogether", recruiting 6 senior female developers to mentor 45 junior students across weekly hybrid coding labs. I organized our university's first female-led hackathon, securing sponsorship from 3 local software firms. All 45 participants passed their core algorithms modules, 12 secured competitive software internships, and female department retention reached 96%.`,
      goal: 'Erasmus Mundus / Tech & Society Leadership Fellowship',
    },
  ];

  // High-Impact ATS Résumé Templates
  const ATS_TEMPLATES = [
    {
      title: 'CS / Software Engineering Graduate',
      titleMy: 'နမူနာ ၁ - Computer Science / Software Developer ဘွဲ့ရ CV',
      role: 'Junior Full-Stack Engineer / Python Developer',
      promptText: `University of the People — B.S. in Computer Science (CGPA: 3.82/4.00, Dean's List)
Relevant Coursework: Data Structures, Analysis of Algorithms, Databases 1 & 2, Operating Systems, Web Programming.

Technical Skills:
- Languages: JavaScript/TypeScript, Python, Java, SQL, HTML5/CSS3
- Frameworks & Libraries: React, Node.js, Express, Tailwind CSS, FastAPI
- Tools & Cloud: Git, GitHub, Docker, PostgreSQL, Linux/Bash, REST APIs

Projects:
1. Community Clinic Patient Management System (React, Node.js, PostgreSQL): Built full-stack system serving 350+ patients monthly; reduced patient record retrieval time by 40%.
2. Offline Educational Flashcard App (Python, SQLite): Developed lightweight desktop app for students in low-connectivity areas; 500+ active student users.

Campus & Community Leadership:
- Peer Tutor for CS 1102 (Programming 1): Mentored 30+ students weekly, improving average cohort exam pass rates by 18%.`,
    },
    {
      title: 'Data Analyst / Business Intelligence Graduate',
      titleMy: 'နမူနာ ၂ - Data Analytics / Business Intelligence အထူးပြု CV',
      role: 'Data Analyst / Business Operations Analyst',
      promptText: `Bachelor of Science in Business Administration / Data Science Focus (CGPA: 3.75/4.00)
Core Competencies: Exploratory Data Analysis (EDA), Statistical Hypothesis Testing, Predictive Modeling, KPI Dashboards, Financial Forecasting.

Technical Toolset:
- Data Analysis: Python (Pandas, NumPy, Scikit-learn), R, Advanced Excel (PowerQuery, Pivot, VBA)
- Visualization & BI: Tableau, Power BI, Matplotlib, Seaborn
- Databases: PostgreSQL, MySQL, BigQuery

Key Quantitative Projects:
1. E-Commerce Customer Churn Analysis: Analyzed 25,000 transaction records using Python to identify key attrition drivers; formulated targeted retention strategy projected to reduce churn by 12%.
2. Supply Chain Cost Optimization Model: Built automated Excel and Power BI executive dashboard monitoring shipment lead times and vendor reliability.`,
    },
  ];

  // Generate STAR Story Arc
  const handleGenerateStar = async (isRegen = false) => {
    setErrorMessage(null);
    setStarLoading(true);
    const nextCount = isRegen ? starGenCount + 1 : 1;
    setStarGenCount(nextCount);
    try {
      const res = await callAcademicApi('star_story_arc', {
        programGoal: starProgramGoal,
        promptText: starPrompt.trim(),
        situation: starSituation,
        task: starTask,
        action: starAction,
        result: starResult,
        seed: Date.now() + nextCount * 17331,
        variation: nextCount,
      });
      setStarResultText(typeof res === 'string' ? res : (res?.result || JSON.stringify(res)));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate STAR narrative');
    } finally {
      setStarLoading(false);
    }
  };

  // Generate ATS Résumé
  const handleGenerateAts = async (isRegen = false) => {
    setErrorMessage(null);
    setAtsLoading(true);
    const nextCount = isRegen ? atsGenCount + 1 : 1;
    setAtsGenCount(nextCount);
    try {
      const res = await callAcademicApi('academic_to_ats', {
        rawBackground: rawBackgroundPrompt.trim(),
        promptText: rawBackgroundPrompt.trim(),
        targetRole,
        seed: Date.now() + nextCount * 27331,
        variation: nextCount,
      });
      setAtsResultText(typeof res === 'string' ? res : (res?.result || JSON.stringify(res)));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to convert to ATS résumé');
    } finally {
      setAtsLoading(false);
    }
  };

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const downloadTextFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Dedicated UoPeople Scholar Redirect Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-900/60 via-slate-900 to-indigo-900/60 border border-pink-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-300 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center space-x-2">
              <span>{language === 'my' ? 'UoPeople ပညာသင်ဆု (အသစ် / သက်တမ်းတိုး / Advisor Email) ရှာဖွေနေပါသလား?' : 'Looking for UoPeople Scholarship (New / Renewal / Advisor Email)?'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/30 text-pink-200 font-mono">Dedicated Hub</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {language === 'my'
                ? 'UoPeople စည်းမျဉ်း ၁,၀၀၀ Chars အတိအကျ စနစ်နှင့် Advisor ဆီပို့ရန် Email များအတွက် သီးသန့် 🎓 UoPeople Scholar နေရာသို့ သွားရောက်ပါ:'
                : 'Access the dedicated suite with strict 1,000-char UoPeople portal compliance, Program Advisor email generator, and rubrics:'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setGlobalActiveTab('scholarship')}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-md transition-all whitespace-nowrap cursor-pointer shrink-0"
        >
          <span>{language === 'my' ? '🎓 UoPeople Scholar သို့ သွားမည်' : 'Open UoPeople Scholar Hub'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {language === 'my' ? 'International Fellowships & ATS Career Engine' : 'International Fellowships & ATS Career Engine'}
                </h1>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Chevening / Fulbright / Jobs
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Tailored Outputs
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {language === 'my'
                  ? 'နိုင်ငံတကာ Master ပညာသင်ဆုများ (Chevening, Fulbright, DAAD) အတွက် STAR Leadership Essay နှင့် အလုပ်လျှောက်လွှာများအတွက် ATS Single-Column Résumé စနစ်'
                  : 'Flexible prompt-driven synthesis engine for prestigious international fellowship leadership essays (STAR Method) and industry-compliant single-column ATS résumés.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline text-rose-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('star')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'star'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>{language === 'my' ? '🌟 ၁။ STAR Story Arc (ခေါင်းဆောင်မှု အက်ဆေး)' : '🌟 1. STAR Story Arc (Leadership Essay)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('ats')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'ats'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{language === 'my' ? '📄 ၂။ ATS Single-Column Résumé Converter' : '📄 2. ATS Single-Column Résumé'}</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: STAR STORY ARC (NATURAL PROMPT-DRIVEN LEADERSHIP ESSAY)
         ========================================================================= */}
      {activeTab === 'star' && (
        <div className="space-y-6">
          {/* BILINGUAL PRE-PROMPT WARNING */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5 shadow-lg">
            <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>⚠️ PROMPT မပေးမီ သတိပြုရန် (STAR Pre-Prompt Warning)</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong>မြန်မာဘာသာ:</strong> Textbox ၄ ခု သီးခြားခွဲရိုက်စရာ မလိုပါ။ မိမိ ကြုံတွေ့ခဲ့ရသော အခက်အခဲ၊ ကိုယ်တိုင်ဦးဆောင်ဖြေရှင်းခဲ့သည့် အဆင့်များနှင့် ရရှိခဲ့သော လူမှုအကျိုးသက်ရောက်မှု/ကိန်းဂဏန်း (ဥပမာ- လူဘယ်နှစ်ဦးကို ကူညီနိုင်ခဲ့သည်) ကို အောက်ပါ Prompt Box တွင် မြန်မာဘာသာ သို့မဟုတ် English လို စိတ်ကြိုက် စာရိုက်ထည့်သွင်းနိုင်ပါသည်။
            </p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed italic">
              <strong>English:</strong> No rigid 4-textbox forms required. Provide a natural narrative in English or Burmese outlining your challenge, the specific actions you initiated, and measurable human results.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input & Templates */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Target Scholarship Program (လျှောက်ထားမည့် ပညာသင်ဆု / အစီအစဉ်)
                  </label>
                  <input
                    type="text"
                    value={starProgramGoal}
                    onChange={(e) => setStarProgramGoal(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-pink-500 font-sans"
                  />
                </div>

                {/* Natural Prompt Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      သင်၏ ခေါင်းဆောင်မှု/ဖြေရှင်းခဲ့မှု ဖြစ်ရပ်ဇာတ်လမ်း Prompt (မြန်မာ/English):
                    </label>
                    <span className="text-[10px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/30">
                      Flexible Prompt
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    value={starPrompt}
                    onChange={(e) => setStarPrompt(e.target.value)}
                    placeholder="ဥပမာ— ဒေသတွင်း မီးပျက်မှုနှင့် အင်တာနက်ပြတ်တောက်မှုကြောင့် ကျောင်းသား ၆၀% စာမလိုက်နိုင်သောအခါ ကျွန်တော် ဦးဆောင်၍ Thumb drive များဖြင့် offline lecture များနှင့် flashcard များ ဖြန့်ဝေပေးခဲ့သည်။ ကျောင်းသား ၂၀၀ ကျော် စာမေးပွဲ အောင်မြင်ခဲ့ပြီး drop-out ဖြစ်မှု ၆% သို့ လျော့ကျသွားခဲ့သည်..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 leading-relaxed font-sans"
                  />
                </div>

                {/* Optional Collapsible Structured STAR Accordion */}
                <div className="pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowStructuredStar(!showStructuredStar)}
                    className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
                  >
                    <span className="flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-pink-400" />
                      <span>{showStructuredStar ? 'သီးခြား အကွက် ၄ ခုဖြင့် အသေးစိတ် ဖြည့်သွင်းခြင်းကို ဖျောက်မည်' : 'အသေးစိတ် STAR အကွက် ၄ ခုဖြင့် သီးသန့်ခွဲဖြည့်လိုပါက နှိပ်ပါ (Optional)'}</span>
                    </span>
                    {showStructuredStar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showStructuredStar && (
                    <div className="mt-3 space-y-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 animate-in fade-in">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">၁။ အခြေအနေ (Situation)</label>
                        <input
                          type="text"
                          value={starSituation}
                          onChange={(e) => setStarSituation(e.target.value)}
                          placeholder="Challenge or context"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">၂။ တာဝန် (Task)</label>
                        <input
                          type="text"
                          value={starTask}
                          onChange={(e) => setStarTask(e.target.value)}
                          placeholder="Your specific responsibility"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">၃။ ဆောင်ရွက်ချက် (Action)</label>
                        <input
                          type="text"
                          value={starAction}
                          onChange={(e) => setStarAction(e.target.value)}
                          placeholder="Concrete actions you initiated"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">၄။ ရလဒ်နှင့် ဂဏန်းအချက်အလက် (Result)</label>
                        <input
                          type="text"
                          value={starResult}
                          onChange={(e) => setStarResult(e.target.value)}
                          placeholder="Quantifiable outcome and human impact"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateStar(false)}
                  disabled={starLoading || (!starPrompt.trim() && !starSituation.trim())}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {starLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>STAR ခေါင်းဆောင်မှု အက်ဆေး ရေးထုတ်နေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>ဆွဲဆောင်မှုရှိသော STAR Leadership Essay ထုတ်ယူမည်</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ready Selectable STAR Templates */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>အသင့်ရွေးချယ်နိုင်သော STAR Story Templates (1-Click)</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  ကလစ်တစ်ချက်နှိပ်ရုံဖြင့် ထိပ်တန်းပညာသင်ဆုများတွင် အမှန်တကယ် အောင်မြင်ခဲ့သော ခေါင်းဆောင်မှု ဇာတ်လမ်းများကို ထည့်သွင်းနိုင်ပါသည်:
                </p>

                <div className="space-y-2.5">
                  {STAR_TEMPLATES.map((tmpl, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pink-300">{tmpl.titleMy}</span>
                        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                          Verified Winner
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 italic font-sans">{tmpl.promptText}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setStarPrompt(tmpl.promptText);
                            setStarProgramGoal(tmpl.goal);
                            handleGenerateStar(false);
                          }}
                          className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>ဤဇာတ်လမ်းဖြင့် ရေးထုတ်မည်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStarPrompt(tmpl.promptText);
                            setStarProgramGoal(tmpl.goal);
                          }}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Prompt Box သို့ ယူထည့်မည်</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Output */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[520px] shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Polished STAR Narrative Essay
                    </span>
                  </div>

                  {starResultText && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateStar(true)}
                        disabled={starLoading}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-semibold border border-slate-700 hover:border-pink-500/50 shadow transition-all cursor-pointer disabled:opacity-50"
                        title="Generate another unique variation"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${starLoading ? 'animate-spin' : ''}`} />
                        <span>အသစ်ပြန်ထုတ်မည်</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(starResultText, setCopiedStar)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        {copiedStar ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedStar ? 'Copied!' : 'Copy Essay'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {starResultText ? (
                  <div className="flex-1 space-y-4">
                    {/* BILINGUAL POST-PROMPT SUBMISSION WARNING */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>⚠️ စာတမ်းမတင်သွင်းမီ သေချာစစ်ဆေးပါ (STAR Verification)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>မြန်မာဘာသာ:</strong> ထွက်လာသော အက်ဆေးပါ ရလဒ်ဂဏန်းများ၊ ခုနှစ်များနှင့် မိမိ၏ ဦးဆောင်မှုအဆင့်များကို စစ်ဆေးပါ။ အင်တာဗျူးမေးခွန်းများအတွက် အောက်ပါ မြန်မာဘာသာ အကြံပြုချက်များကိုပါ လေ့လာပါ။
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        <strong>English:</strong> Verify that metrics, dates, and organizational names align with your documented leadership record before submitting.
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[500px] pr-2 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap space-y-3">
                      {starResultText}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <span>💡 မကြိုက်မချင်း ပြန်လည်ရေးခိုင်းနိုင်ပါသည်။</span>
                      <button
                        onClick={() => downloadTextFile('STAR_Leadership_Narrative.txt', starResultText)}
                        className="text-pink-400 hover:text-pink-300 flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .txt</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                    <Award className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                    <p className="text-xs max-w-sm">
                      ဘယ်ဘက်တွင် မိမိ၏ ဇာတ်လမ်း Prompt သို့မဟုတ် Template တစ်ခုခုကို ရွေးချယ်ပြီး ခလုတ်နှိပ်ပါက STAR စနစ်ဖြင့် ဆွဲဆောင်မှုရှိသော အက်ဆေး ရရှိပါမည်။
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ATS SINGLE-COLUMN RÉSUMÉ CONVERTER (PROMPT-DRIVEN)
         ========================================================================= */}
      {activeTab === 'ats' && (
        <div className="space-y-6">
          {/* BILINGUAL PRE-PROMPT WARNING */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 space-y-1.5 shadow-lg">
            <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-indigo-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>⚠️ CV မပြောင်းမီ သတိပြုရန် (ATS Pre-Prompt Warning)</span>
            </div>
            <p className="text-xs text-indigo-200/90 leading-relaxed">
              <strong>မြန်မာဘာသာ:</strong> Applicant Tracking Systems (ATS) သည် နှစ်ထပ်/သုံးထပ် ကော်လံများ၊ ပုံများနှင့် အလှဆင်ဘားများကို ဖတ်မရဘဲ အလိုအလျောက် ပယ်ချလေ့ရှိပါသည်။ ဤနေရာတွင် မိမိ၏ ပညာအရည်အချင်း၊ Coursework နှင့် Project များကို ထည့်သွင်းပေးပါက ATS စနစ် 100% ဖတ်နိုင်သော Single-Column Résumé အဖြစ် အလိုအလျောက် ပြောင်းလဲပေးပါမည်။
            </p>
            <p className="text-[11px] text-indigo-300/80 leading-relaxed italic">
              <strong>English:</strong> Automated ATS bots reject multi-column layouts, graphics, and icon bars. Provide your raw background or choose a template to produce a compliant single-column resume formatted with active verbs and quantifiable impacts.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input & Templates */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Target Role / Industry (လျှောက်ထားလိုသော ရာထူး သို့မဟုတ် နယ်ပယ်)
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-pink-500 font-sans"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    မိမိ၏ ပညာအရည်အချင်း၊ Coursework နှင့် လုပ်ဆောင်ခဲ့သော Projects များ (Prompt / Raw Text):
                  </label>
                  <textarea
                    rows={8}
                    value={rawBackgroundPrompt}
                    onChange={(e) => setRawBackgroundPrompt(e.target.value)}
                    placeholder="ဥပမာ— University of the People မှ Computer Science တက်ရောက်နေခြင်း၊ GPA 3.75၊ သင်ယူပြီးစီးသော ဘာသာရပ်များ၊ Python/React ဖြင့် ရေးဆွဲခဲ့သော project များ၊ ကျောင်းတွင်း club တွင် ဦးဆောင်ခဲ့မှုများ..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 leading-relaxed font-sans"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateAts(false)}
                  disabled={atsLoading || !rawBackgroundPrompt.trim()}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {atsLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>ATS Single-Column Résumé သို့ ပြောင်းလဲနေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>ATS-Friendly Single-Column Résumé သို့ ပြောင်းမည်</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ready ATS Templates */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>အသင့်သုံးနိုင်သော နမူနာ Academic CV Templates</span>
                </span>

                <div className="space-y-2.5">
                  {ATS_TEMPLATES.map((tmpl, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pink-300">{tmpl.titleMy}</span>
                        <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
                          {tmpl.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 italic font-mono">{tmpl.promptText}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setRawBackgroundPrompt(tmpl.promptText);
                            setTargetRole(tmpl.role);
                            handleGenerateAts(false);
                          }}
                          className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>ဤအချက်အလက်ဖြင့် တိုက်ရိုက်ပြောင်းမည်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRawBackgroundPrompt(tmpl.promptText);
                            setTargetRole(tmpl.role);
                          }}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Input ထဲသို့ ယူသုံးမည်</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Output */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[520px] shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      ATS-Friendly Single-Column Résumé
                    </span>
                  </div>

                  {atsResultText && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateAts(true)}
                        disabled={atsLoading}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-semibold border border-slate-700 hover:border-pink-500/50 shadow transition-all cursor-pointer disabled:opacity-50"
                        title="Generate another variation"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${atsLoading ? 'animate-spin' : ''}`} />
                        <span>အသစ်ပြန်ထုတ်မည်</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(atsResultText, setCopiedAts)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        {copiedAts ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAts ? 'Copied!' : 'Copy Résumé'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {atsResultText ? (
                  <div className="flex-1 space-y-4">
                    {/* BILINGUAL POST-PROMPT SUBMISSION WARNING */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>⚠️ အလုပ်/ပညာသင်ဆု လျှောက်ထားမီ စစ်ဆေးရန် (ATS Check)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>မြန်မာဘာသာ:</strong> ထွက်လာသော Single-Column CV တွင် မိမိ၏ ဖုန်းနံပါတ်၊ Email၊ LinkedIn နှင့် GitHub link များကို ဖြည့်စွက်ပြီးမှ PDF သို့မဟုတ် Word အဖြစ် သိမ်းဆည်းတင်သွင်းပါ။
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        <strong>English:</strong> Ensure contact information, LinkedIn, and GitHub links are accurate before exporting to clean single-column PDF.
                      </p>
                    </div>

                    <textarea
                      rows={14}
                      value={atsResultText}
                      onChange={(e) => setAtsResultText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 leading-relaxed font-mono focus:outline-none focus:border-pink-500 resize-none flex-1"
                    />

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <span>💡 Single-column layout ဖြင့် မည်သည့် ATS စနစ်မဆို 100% ဖတ်ရှုနိုင်ပါသည်။</span>
                      <button
                        onClick={() => downloadTextFile(`${targetRole.replace(/\s+/g, '_')}_ATS_Resume.md`, atsResultText)}
                        className="text-pink-400 hover:text-pink-300 flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .md</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                    <FileText className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                    <p className="text-xs max-w-sm">
                      ဘယ်ဘက်တွင် မိမိ၏ ပညာရေးအချက်အလက်များကို ထည့်သွင်းပြီး "ATS-Friendly Single-Column Résumé သို့ ပြောင်းမည်" ကို နှိပ်ပါ။
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
