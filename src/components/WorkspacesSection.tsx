import React, { useState } from 'react';

// 1. All 12+ Workspace Cards Full Bilingual Dictionary (EN / MM)
export const DASHBOARD_WORKSPACES_I18N = {
  en: {
    sectionTitle: "Academic Workspaces & Workflows",
    sectionDesc: "Organized into 4 focused academic workflows for seamless study, writing, and research.",
    tabs: {
      all: "All Workflows",
      writing: "Writing Suite",
      study: "Study & Research",
      productivity: "Productivity & Wellness",
      career: "Career & Goals"
    },
    cards: [
      // Writing Suite (Cards 1 - 3)
      {
        id: 'assignment_hub',
        category: 'writing',
        categoryLabel: 'WRITING SUITE',
        badge: '4-STEP STEPPER',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '✨',
        title: 'Assignment Hub & 4-Step Stepper',
        desc: 'Strict workflow from Step 1 Rubric breakdown to Step 4 APA .docx generation to achieve Grade A.',
        cta: 'Start Workflow →',
        action: 'assignment_workspace',
        subModule: 'outline_suite'
      },
      {
        id: 'paraphraser',
        category: 'writing',
        categoryLabel: 'WRITING SUITE',
        badge: 'NATURAL TONE',
        badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        icon: '🧠',
        title: 'Paraphrasing Depth Controller & Humanizer',
        desc: 'Three strategic depth tiers (Light Polish, Academic Elevation, Complete Rephrase) for authentic scholarly tone and citation audit.',
        cta: 'Refine Tone →',
        action: 'assignment_workspace',
        subModule: 'paraphraser'
      },
      {
        id: 'apa_word',
        category: 'writing',
        categoryLabel: 'WRITING SUITE',
        badge: 'APA 7TH',
        badgeColor: 'bg-blue-950/60 text-blue-400 border-blue-800/40',
        icon: '📄',
        title: 'APA 7th & Word (.docx) Direct Export',
        desc: 'Generate strict Times New Roman 12pt, 1-inch margins, double-spaced Word documents for Assignment Activities and Discussion Posts.',
        cta: 'Export Word Doc →',
        action: 'apa_workspace'
      },

      // Study & Research (Cards 4 - 8)
      {
        id: 'course_reader',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'DATA-SAVER READER',
        badgeColor: 'bg-teal-950/60 text-teal-400 border-teal-800/40',
        icon: '📖',
        title: 'Course PDF Reader (Distraction-Free)',
        desc: 'Read heavy UoPeople & OpenStax textbooks offline by chapter. Strips heavy graphics for ultra-fast loading, minimal data, and focused reading.',
        cta: 'Read Textbook →',
        action: 'course_reader'
      },
      {
        id: 'stats_explainer',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'STATS & PAPERS',
        badgeColor: 'bg-sky-950/60 text-sky-400 border-sky-800/40',
        icon: '📊',
        title: 'Research Paper: Q&A & Stats Explainer',
        desc: 'Examine complex research PDFs, extract core arguments, and explain p-values, odds ratios, and statistical methods with ease.',
        cta: 'Audit Research →',
        action: 'stats_explainer'
      },
      {
        id: 'cross_unit',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'SYNTHESIS LINKER',
        badgeColor: 'bg-fuchsia-950/60 text-fuchsia-400 border-fuchsia-800/40',
        icon: '🔗',
        title: 'Cross-Unit Theoretical Synthesis',
        desc: 'Connect concepts across units (e.g., citing Unit 2 or Unit 4 foundational models in Unit 7 papers) to maximize assignment grading rubrics.',
        cta: 'Synthesize Theory →',
        action: 'cross_unit'
      },
      {
        id: 'lesson_explainer',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'BILINGUAL EXPLAINER',
        badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        icon: '📖',
        title: 'Lesson Conceptual Explainer (EN + MM)',
        desc: 'Comprehensive bilingual breakdown of unit slides and readings with instant flashcard generation.',
        cta: 'Read Lesson →',
        action: 'lesson_explainer'
      },
      {
        id: 'flashcards_sm2',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'SM-2 MEMORY',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '🧠',
        title: 'Flashcards & Quizzes (SM-2 Algorithm)',
        desc: 'SuperMemo SM-2 algorithm prompts recall at optimal intervals for long-term memory retention.',
        cta: 'Start Review →',
        action: 'flashcards_sm2'
      },

      // Productivity & Wellness (Cards 9 - 12)
      {
        id: 'weekly_timetable',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'TIMETABLE',
        badgeColor: 'bg-blue-950/60 text-blue-400 border-blue-800/40',
        icon: '📅',
        title: 'UoPeople Weekly Study Timetable',
        desc: '7-day academic rhythm from Thursday to Wednesday with GMT-5 dual clocks and submission countdowns.',
        cta: 'View Timetable →',
        action: 'weekly_timetable'
      },
      {
        id: 'cgpa_forecaster',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'CGPA PLANNER',
        badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        icon: '🎯',
        title: 'CGPA Forecaster & Target Planning',
        desc: 'Calculate minimum required grades across remaining credits with strict statistical forecasting.',
        cta: 'Calculate CGPA →',
        action: 'cgpa_forecaster'
      },
      {
        id: 'pomodoro_lofi',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'FOCUS AUDIO',
        badgeColor: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40',
        icon: '🎧',
        title: 'Pomodoro Focus & Study Audio',
        desc: 'Pomodoro focus timer paired with calming curated tracks and freely searchable background music from the YouTube Study Audio Studio.',
        cta: 'Start Focus →',
        action: 'pomodoro_lofi'
      },
      {
        id: 'impostor_wellness',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'WELLNESS',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '🧭',
        title: 'Overcoming Impostor Syndrome & Resilience',
        desc: 'Practical 3-step reframing strategies and calming exercises when feeling overwhelmed or doubting GPA success.',
        cta: 'Build Resilience →',
        action: 'impostor_wellness'
      },

      // Career & Goals (Cards 13 - 14)
      {
        id: 'uopeople_scholar',
        category: 'career',
        categoryLabel: 'CAREER & GOALS',
        badge: 'UOPEOPLE OFFICIAL',
        badgeColor: 'bg-rose-950/60 text-rose-400 border-rose-800/40',
        icon: '🎓',
        title: 'UoPeople Scholar (New / Renewal / Advisor Email)',
        desc: 'Templates and guidance for degree scholarships, course renewals, and academic advisor communications.',
        cta: 'Prepare Email →',
        action: 'uopeople_scholar'
      },
      {
        id: 'star_scholarship',
        category: 'career',
        categoryLabel: 'CAREER & GOALS',
        badge: 'SCHOLARSHIP',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '🔖',
        title: 'STAR Story Arc & Scholarship SOP',
        desc: 'Structure compelling international scholarship essays using Situation, Task, Action, Result framework.',
        cta: 'Draft SOP →',
        action: 'star_scholarship'
      }
    ]
  },

  mm: {
    sectionTitle: "Academic Workspaces & လုပ်ငန်းစဉ်များ",
    sectionDesc: "သင်၏ စာလေ့လာမှု လုပ်ငန်းစဉ်အလိုက် အဆင့်ဆင့် အသုံးပြုနိုင်ရန် Workspaces ၄ ခုဖြင့် ဖွဲ့စည်းထားပါသည်",
    tabs: {
      all: "အားလုံး",
      writing: "Writing Suite",
      study: "Study & Research",
      productivity: "Productivity & Wellness",
      career: "Career & Goals"
    },
    cards: [
      // Writing Suite (Cards 1 - 3)
      {
        id: 'assignment_hub',
        category: 'writing',
        categoryLabel: 'WRITING SUITE',
        badge: '4-STEP STEPPER',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '✨',
        title: 'Assignment Hub & 4-Step Stepper',
        desc: 'Step 1 Rubric မှ Step 4 APA .docx အထိ အဆင့် ၄ ဆင့်ဖြင့် A အဆင့် ရရှိရန် စနစ်တကျ ရေးဆွဲခြင်း။',
        cta: 'အဆင့်လိုက် စတင်မည် →',
        action: 'assignment_workspace',
        subModule: 'outline_suite'
      },
      {
        id: 'paraphraser',
        category: 'writing',
        categoryLabel: 'WRITING SUITE',
        badge: 'NATURAL TONE',
        badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        icon: '🧠',
        title: 'Paraphrasing Depth Controller & Humanizer',
        desc: 'Light Polish, Academic Elevation, Complete Rephrase အဆင့် ၃ ဆင့်ဖြင့် လူသားဟန် သဘာဝကျကျ မွမ်းမံပေးခြင်းနှင့် Citation Warning စစ်ဆေးခြင်း။',
        cta: 'စာရေးဟန် ညှိမည် →',
        action: 'assignment_workspace',
        subModule: 'paraphraser'
      },
      {
        id: 'apa_word',
        category: 'writing',
        categoryLabel: 'WRITING SUITE',
        badge: 'APA 7TH',
        badgeColor: 'bg-blue-950/60 text-blue-400 border-blue-800/40',
        icon: '📄',
        title: 'APA 7th နှင့် Word (.docx) တိုက်ရိုက်ထုတ်ယူမှု',
        desc: 'Assignment Activity အတွက် Title Page နှင့် References သီးခြားစာမျက်နှာပါသော Times New Roman 12pt Word ဖိုင် ထုတ်ယူခြင်း။',
        cta: 'Word ဖိုင် ထုတ်မည် →',
        action: 'apa_workspace'
      },

      // Study & Research (Cards 4 - 8)
      {
        id: 'course_reader',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'DATA-SAVER READER',
        badgeColor: 'bg-teal-950/60 text-teal-400 border-teal-800/40',
        icon: '📖',
        title: 'Course PDF Reader (Distraction-Free)',
        desc: 'Read heavy UoPeople & OpenStax textbooks offline by chapter. Strips heavy graphics for ultra-fast loading, minimal data, and focused reading.',
        cta: 'စာအုပ် ဖတ်မည် →',
        action: 'course_reader'
      },
      {
        id: 'stats_explainer',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'STATS & PAPERS',
        badgeColor: 'bg-sky-950/60 text-sky-400 border-sky-800/40',
        icon: '📊',
        title: 'သုတေသနစာတမ်း Q&A & Stats Explainer',
        desc: 'PDF စာတမ်းများ ဖတ်ရှုစစ်ဆေးခြင်းနှင့် p-value, odds ratio စသည့် ကိန်းဂဏန်းများကို ရှင်းပြချက် ရယူခြင်း။',
        cta: 'သုတေသန စစ်မည် →',
        action: 'stats_explainer'
      },
      {
        id: 'cross_unit',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'SYNTHESIS LINKER',
        badgeColor: 'bg-fuchsia-950/60 text-fuchsia-400 border-fuchsia-800/40',
        icon: '🔗',
        title: 'Cross-Unit သီအိုရီ ချိတ်ဆက်မှု (Synthesis)',
        desc: 'Unit 7 ရေးနေစဉ်တွင် Unit 2 သို့မဟုတ် Unit 4 မှ သီအိုရီများကို ပြန်လည် ချိတ်ဆက်ကိုးကား၍ အမှတ်တိုးစေခြင်း (Word ဖိုင် ထည့်သွင်းနိုင်သည်။',
        cta: 'သီအိုရီ ချိတ်ဆက်မည် →',
        action: 'cross_unit'
      },
      {
        id: 'lesson_explainer',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'BILINGUAL EXPLAINER',
        badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        icon: '📖',
        title: 'သင်ခန်းစာ ရှင်းလင်းချက် (EN + မြန်မာ)',
        desc: 'သင်ခန်းစာ သို့မဟုတ် Slide များကို အင်္ဂလိပ်ရော မြန်မာဘာသာဖြင့်ပါ အသေးစိတ် ရှင်းလင်းချက်နှင့် Flashcard တိုက်ရိုက်ထုတ်ခြင်း။',
        cta: 'ဖတ်ရှုမည် →',
        action: 'lesson_explainer'
      },
      {
        id: 'flashcards_sm2',
        category: 'study',
        categoryLabel: 'STUDY & RESEARCH',
        badge: 'SM-2 MEMORY',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '🧠',
        title: 'Flashcards & စာမေးပွဲ (SM-2 စနစ်)',
        desc: 'SuperMemo SM-2 အယ်လ်ဂိုရီသမ်ဖြင့် မေ့လွယ်သော မေးခွန်းများကို ပြန်လည်မေးပေးပြီး ရေရှည် မှတ်မိစေခြင်း။',
        cta: 'စတင်ကျက်မှတ်မည် →',
        action: 'flashcards_sm2'
      },

      // Productivity & Wellness (Cards 9 - 12)
      {
        id: 'weekly_timetable',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'TIMETABLE',
        badgeColor: 'bg-blue-950/60 text-blue-400 border-blue-800/40',
        icon: '📅',
        title: 'UoPeople အပတ်စဉ် စာလေ့လာမှု အချိန်ဇယား',
        desc: 'ကြာသပတေးနေ့ မှ ဗုဒ္ဓဟူးနေ့အထိ ၇ ရက်တာ Academic task ခွဲဝေမှု၊ GMT-5 Dual Clocks နှင့် Submission Countdown။',
        cta: 'အချိန်ဇယား ကြည့်မည် →',
        action: 'weekly_timetable'
      },
      {
        id: 'cgpa_forecaster',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'CGPA PLANNER',
        badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
        icon: '🎯',
        title: 'CGPA Forecaster & ရည်မှန်းချက်',
        desc: 'ကျန်ရှိသော Credits များတွင် အနည်းဆုံး မည်သည့် Grade များ ရယူရမည်ကို သင်္ချာနည်းကျ ကြိုတင်တွက်ချက်ပေးခြင်း။',
        cta: 'CGPA တွက်မည် →',
        action: 'cgpa_forecaster'
      },
      {
        id: 'pomodoro_lofi',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'FOCUS AUDIO',
        badgeColor: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40',
        icon: '🎧',
        title: 'Pomodoro Focus & Study Audio',
        desc: 'YouTube Study Audio Studio မှ စိတ်အေးချမ်းစေမည့် တေးသံစဉ်များ၊ လွတ်လပ်စွာ ရှာဖွေနားဆင်နိုင်သော Background Music များနှင့်အတူ တွဲဖက်အသုံးပြုနိုင်သည့် Pomodoro အာရုံစူးစိုက်မှု Timer။',
        cta: 'အာရုံစူးစိုက်မည် →',
        action: 'pomodoro_lofi'
      },
      {
        id: 'impostor_wellness',
        category: 'productivity',
        categoryLabel: 'PRODUCTIVITY & WELLNESS',
        badge: 'WELLNESS',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '🧭',
        title: 'Impostor Syndrome & စိတ်ဓာတ်ခွန်အား',
        desc: 'အမှတ်နည်းသွားချိန် သို့မဟုတ် စာမလိုက်နိုင်တော့ဘူးဟု ခံစားရချိန်တွင် GPA ပြန်ဆွဲတင်နိုင်မည့် ၃ ဆင့်နှင့် စိတ်အေးချမ်းစေမည့် အကြံပြုချက်။',
        cta: 'ခွန်အားယူမည် →',
        action: 'impostor_wellness'
      },

      // Career & Goals (Cards 13 - 14)
      {
        id: 'uopeople_scholar',
        category: 'career',
        categoryLabel: 'CAREER & GOALS',
        badge: 'UOPEOPLE OFFICIAL',
        badgeColor: 'bg-rose-950/60 text-rose-400 border-rose-800/40',
        icon: '🎓',
        title: 'UoPeople Scholar (အသစ် / သက်တမ်းတိုး / Advisor Email)',
        desc: 'UoPeople အသစ်လျှောက်ထားသူ၊ သက်တမ်းတိုးသူများအတွက် စာလုံးရေ ၁,၀၀၀ ပြည့်စုံသော လျှောက်ထားလွှာများနှင့် Advisor ဆီ ပို့ရမည့် စာစနစ်။',
        cta: 'လျှောက်လွှာ ရေးမည် →',
        action: 'uopeople_scholar'
      },
      {
        id: 'star_scholarship',
        category: 'career',
        categoryLabel: 'CAREER & GOALS',
        badge: 'SCHOLARSHIP',
        badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
        icon: '🔖',
        title: 'STAR Story Arc & Scholarship SOP',
        desc: 'STAR Method (Situation, Task, Action, Result) ဖြင့် နိုင်ငံတကာ ပညာသင်ဆု Essay များကို ဦးဆောင်မှု ပေါ်လွင်အောင် ဖွဲ့စည်းခြင်း။',
        cta: 'SOP ရေးဆွဲမည် →',
        action: 'star_scholarship'
      }
    ]
  }
};

interface WorkspacesSectionProps {
  currentLanguage?: 'en' | 'mm';
  lang?: 'en' | 'mm';
  setCurrentWorkspace: (workspace: string, cardDomId?: string) => void;
  setAssignmentInitialModule?: (module: string) => void;
}

export const WorkspacesSection: React.FC<WorkspacesSectionProps> = ({
  currentLanguage,
  lang,
  setCurrentWorkspace,
  setAssignmentInitialModule
}) => {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'all' | 'writing' | 'study' | 'productivity' | 'career'>('all');

  const resolvedLang = currentLanguage || lang || 'en';
  // Active language dictionary
  const t = DASHBOARD_WORKSPACES_I18N[resolvedLang] || DASHBOARD_WORKSPACES_I18N.en;

  // Filter cards by category
  const filteredCards = activeWorkflowTab === 'all'
    ? t.cards
    : t.cards.filter(c => c.category === activeWorkflowTab);

  return (
    <div className="space-y-4">
      {/* Workspaces Section Header & Workflow Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📚</span>
            <span>{t.sectionTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.sectionDesc}
          </p>
        </div>

        {/* Workflow Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold flex-wrap">
          <button
            type="button"
            onClick={() => setActiveWorkflowTab('all')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeWorkflowTab === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabs.all}
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkflowTab('writing')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeWorkflowTab === 'writing' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabs.writing}
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkflowTab('study')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeWorkflowTab === 'study' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabs.study}
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkflowTab('productivity')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeWorkflowTab === 'productivity' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabs.productivity}
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkflowTab('career')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeWorkflowTab === 'career' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabs.career}
          </button>
        </div>
      </div>

      {/* Dynamic Bilingual Cards Grid (၁၂ ကတ်လုံး ပါဝင်ပြီး ဘာသာစကားအလိုက် ပြောင်းလဲမည်) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map((card) => {
          const cardDomId = `card-${card.id}`;
          return (
            <div
              key={card.id}
              id={cardDomId}
              onClick={() => {
                if (card.subModule && setAssignmentInitialModule) {
                  setAssignmentInitialModule(card.subModule);
                }
                setCurrentWorkspace(card.subModule === 'paraphraser' ? 'paraphraser' : card.action, cardDomId);
              }}
              className="cursor-pointer p-5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 hover:border-indigo-500/60 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
                    {card.icon}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-indigo-900/40">
                      {card.categoryLabel}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-100 mb-1 group-hover:text-indigo-300 transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {card.desc}
                </p>
              </div>

              <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                {card.cta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
