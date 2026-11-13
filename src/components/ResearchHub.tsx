import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import { CleanPdfReader } from './CleanPdfReader';
import { SynthesisMatrixBuilder } from './SynthesisMatrixBuilder';
import { MethodologyStatsExplainer } from './MethodologyStatsExplainer';
import { CrossUnitSynthesisWorkspace } from './CrossUnitSynthesisWorkspace';
import { loadPersistedTabState, savePersistedTabState } from '../utils/researchPersistence';
import {
  BookOpen,
  Table,
  BarChart3,
  Network,
} from 'lucide-react';

type ResearchSubTab = 'clean_reader' | 'matrix' | 'stats' | 'synthesis';

const TAB_WARNING_BANNERS: Record<
  ResearchSubTab,
  { title: string; myanmar: string; english: string }
> = {
  clean_reader: {
    title: '⚠️ စာဖတ်ရှုခြင်းဆိုင်ရာ သတိပေးချက် (Distraction-Free Reading Advisory)',
    myanmar:
      'သတိပြုရန် - ဤနေရာတွင် ဖော်ပြထားသော အနှစ်ချုပ်နှင့် မှတ်စုများသည် စာဖတ်နှုန်း မြန်ဆန်စေရန် အထောက်အကူပြု လမ်းညွှန်ချက်သာ ဖြစ်ပါသည်။ မူရင်းစာအုပ် သို့မဟုတ် စာတမ်းပါ ပညာရပ်ဆိုင်ရာ အသေးစိတ်အချက်များကို လိုအပ်သလို ကိုယ်တိုင် တိုက်ဆိုင်စစ်ဆေး ဖတ်ရှုရန် လိုအပ်ပါသည်။',
    english:
      'Note: The extracted outlines and summaries are cognitive reading aids. Always verify critical theoretical nuances directly against the original course textbook or primary source.',
  },
  stats: {
    title: '⚠️ စာရင်းအင်းနှင့် သုတေသနစံနှုန်း သတိပေးချက် (Methodological Accuracy Advisory)',
    myanmar:
      'သတိပြုရန် - ဤစနစ်မှ ခွဲခြမ်းစိတ်ဖြာပေးသော p-value၊ Sample Size နှင့် Research Design များသည် စာတမ်းပါ စာသားများအပေါ် အခြေခံထားခြင်း ဖြစ်ပါသည်။ သုတေသန ကိုးကားချက်များ တိကျခိုင်မာစေရန် မူရင်းစာတမ်း၏ Data Table များနှင့် အမြဲမပြတ် ပြန်လည်စစ်ဆေးပါ။',
    english:
      "Notice: Extracted statistical parameters, sample sizes, and p-values are algorithmically derived. Cross-reference with the publication's official statistical tables before citing.",
  },
  matrix: {
    title: '⚠️ ပညာရပ်ဆိုင်ရာ ကိုယ်ပိုင်သုံးသပ်မှု သတိပေးချက် (Synthesis Matrix Disclaimer)',
    myanmar:
      'သတိပြုရန် - နှိုင်းယှဉ်ဇယားပါ Thematic Synthesis နှင့် ကွဲလွဲချက်များသည် အကြမ်းထည် လမ်းပြဇယားသာ ဖြစ်ပါသည်။ ကျောင်းသားများအနေဖြင့် စာတမ်းများ၏ သဘောတရားကို မိမိကိုယ်ပိုင် ဉာဏ်ဖြင့် ဝေဖန်ပိုင်းခြား သုံးသပ်ပြီးမှသာ Assignment စာမူတွင် ထည့်သွင်းအသုံးပြုပါ။',
    english:
      'Disclaimer: This synthesis matrix serves as an organizational scaffold. Ensure critical synthesis reflections reflect your independent scholarly judgment before incorporating into assignments.',
  },
  synthesis: {
    title: '⚠️ သင်ခန်းစာချိတ်ဆက်မှု စိစစ်ရေး သတိပေးချက် (Curriculum Alignment Notice)',
    myanmar:
      'သတိပြုရန် - အရင်ယူနစ်များမှ သီအိုရီများကို လက်ရှိ Assignment နှင့် ချိတ်ဆက်ရာတွင် သင်ရိုးညွှန်းတမ်း ရည်ရွယ်ချက်နှင့် ကိုက်ညီမှု ရှိမရှိ ကိုယ်တိုင် သေချာ ပြန်လည်ဆန်းစစ်ပါ။ ထွက်လာသော နမူနာစာပိုဒ်ကို တိုက်ရိုက်ကူးယူခြင်း မပြုဘဲ မိမိဟန်ဖြင့် ပြန်လည်မွမ်းမံပါ။',
    english:
      'Advisory: Prior unit theoretical bridges must align with your specific assignment prompt. Adapt and rewrite generated integrative paragraphs to maintain authentic academic voice.',
  },
};

export const ResearchHub: React.FC = () => {
  const { language } = useApp();
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<ResearchSubTab>(() =>
    loadPersistedTabState<ResearchSubTab>('matrix_active_tab', 'clean_reader')
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    savePersistedTabState('matrix_active_tab', activeTab);
  }, [activeTab]);

  const activeBanner = TAB_WARNING_BANNERS[activeTab];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-blue-400" />
          <span>{t.research.title}</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          {t.research.subtitle}
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-in fade-in">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-3 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('clean_reader')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'clean_reader'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>📖 Distraction-Free Reader View</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'stats'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{language === 'my' ? 'Methodology & Statistics ရှင်းလင်းချက်' : 'Stats & Methodology Explainer'}</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'matrix'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>{t.research.matrixTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('synthesis')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'synthesis'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>{language === 'my' ? 'Cross-Unit သီအိုရီ ချိတ်ဆက်မှု (Synthesis)' : 'Cross-Unit Knowledge Synthesis'}</span>
        </button>
      </div>

      {/* Dedicated Academic Integrity Warning Banner for Active Sub-Tab */}
      <div className="bg-amber-950/20 border border-amber-600/40 text-amber-200/90 rounded-xl p-3 text-xs space-y-1">
        <p className="font-bold text-amber-300">{activeBanner.title}</p>
        <p className="leading-relaxed">{activeBanner.myanmar}</p>
        <p className="text-amber-200/75 leading-relaxed italic">{activeBanner.english}</p>
      </div>

      {/* TAB: CLEAN PDF READER VIEW */}
      {activeTab === 'clean_reader' && <CleanPdfReader />}

      {/* TAB 2: SYNTHESIS MATRIX TABLE */}
      {activeTab === 'matrix' && <SynthesisMatrixBuilder />}

      {/* TAB 4: METHODOLOGY & STATISTICS EXPLAINER (DEEP READING TOOLS) */}
      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <MethodologyStatsExplainer />
        </div>
      )}

      {/* TAB 5: CROSS-UNIT KNOWLEDGE SYNTHESIS LINKER */}
      {activeTab === 'synthesis' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <CrossUnitSynthesisWorkspace />
        </div>
      )}
    </div>
  );
};
