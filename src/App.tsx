import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ApiProvider, useApi } from './context/ApiContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StreakProvider } from './context/StreakContext';
import { Navbar } from './components/Navbar';
import { PrivacySettingsModal } from './components/PrivacySettingsModal';
import { QuotaExhaustedModal } from './components/QuotaExhaustedModal';
import { AcademicHonorCodeModal } from './components/AcademicHonorCodeModal';
import { Dashboard } from './components/Dashboard';
import { CgpaCalculator } from './components/CgpaCalculator';
import { ApaFormatter } from './components/ApaFormatter';
import { LessonExplainer } from './components/LessonExplainer';
import { FlashcardStudy } from './components/FlashcardStudy';
import { ScholarshipReviewer } from './components/ScholarshipReviewer';
import { ScholarshipSopStudio } from './components/ScholarshipSopStudio';
import { BurnoutPomodoro } from './components/BurnoutPomodoro';
import { LocalAiBypassStudio } from './components/LocalAiBypassStudio';
import { UoPeopleRhythmCalendar } from './components/UoPeopleRhythmCalendar';
import { AssignmentWorkspace } from './components/AssignmentWorkspace';
import { SocraticThinkingWorkspace } from './components/SocraticThinkingWorkspace';
import { ResearchHub } from './components/ResearchHub';
import { DeadlineNotificationBanner } from './components/DeadlineNotificationBanner';
import { StudyAudioStudio } from './components/StudyAudioStudio';
import { translations } from './translations';
import { ActiveTab } from './types';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  Lock,
  WifiOff,
} from 'lucide-react';

export type MainTabType = 'dashboard' | 'uopeople_scholar' | 'socratic' | 'originality' | 'rubric_guide';

const PRIMARY_NAV_ITEMS: { id: MainTabType; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'ပင်မစာမျက်နှာ', icon: '🏠' },
  { id: 'uopeople_scholar', label: 'UoPeople Scholar', icon: '🎓' },
  { id: 'socratic', label: 'Socratic thinking', icon: '💡' },
  { id: 'originality', label: 'စာမူရင်းစိစစ်မှုနှင့် အသုံးအနှုန်း', icon: '🔍' },
  { id: 'rubric_guide', label: 'Assignment လမ်းညွှန်နှင့်စံနှုန်း', icon: '✨' },
];

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, language, settings, eyecareMode } = useApp();
  const { activeKey, primaryApiKey } = useApi();
  const hasActiveKey = Boolean(activeKey || primaryApiKey || settings.customGeminiKey);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(() => localStorage.getItem('akari_active_workspace'));
  const [lastSelectedCardId, setLastSelectedCardId] = useState<string | null>(null);
  const [assignmentInitialModule, setAssignmentInitialModule] = useState<
    'outline_suite' | 'discussion_reply' | 'paraphraser' | 'emergency_rescuer'
  >('outline_suite');
  
  // Persist state to localStorage on change
  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('akari_active_workspace', activeWorkspace);
    } else {
      localStorage.removeItem('akari_active_workspace');
    }
  }, [activeWorkspace]);

  useEffect(() => {
    localStorage.setItem('akari_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleNavigateTab = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
        setActiveWorkspace(null);
      }
    };
    const handleOpenKeyModal = () => {
      setPrivacyModalOpen(true);
    };
    window.addEventListener('akari_navigate_tab', handleNavigateTab);
    window.addEventListener('akari_open_api_key_modal', handleOpenKeyModal);
    return () => {
      window.removeEventListener('akari_navigate_tab', handleNavigateTab);
      window.removeEventListener('akari_open_api_key_modal', handleOpenKeyModal);
    };
  }, [setActiveTab]);
  const t = translations[language];
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const isOnline = useOnlineStatus();

  // Workspace Card ကို နှိပ်သည့်အခါ Key အားလုံးကို တိုက်စစ်၍ လမ်းကြောင်းလွှဲပေးခြင်း
  const handleOpenWorkspace = (workspaceKey: string, cardDomId?: string) => {
    if (cardDomId) {
      setLastSelectedCardId(cardDomId);
    }

    // Key နာမည်ဟောင်း/သစ် အားလုံးအတွက် လမ်းကြောင်းဖွင့်ပေးခြင်း
    if (
      workspaceKey === 'paraphraser' ||
      workspaceKey === 'paraphraser_humanizer' ||
      cardDomId === 'card-paraphraser-humanizer' ||
      cardDomId === 'card-paraphraser'
    ) {
      setAssignmentInitialModule('paraphraser');
      setActiveWorkspace(null);
      setActiveTab('rubric_guide');
    } else if (
      workspaceKey === 'star_scholarship' ||
      workspaceKey === 'scholarship_sop_studio' ||
      workspaceKey === 'career' ||
      (workspaceKey === 'scholarship' && cardDomId === 'card-scholarship-sop')
    ) {
      setActiveWorkspace('scholarship_sop_studio');
    } else if (
      workspaceKey === 'uopeople_scholar' ||
      workspaceKey === 'scholar' ||
      workspaceKey === 'scholarship'
    ) {
      setActiveWorkspace(null);
      setActiveTab('uopeople_scholar');
    } else if (workspaceKey === 'socratic' || workspaceKey === 'socratic_mentor') {
      setActiveWorkspace(null);
      setActiveTab('socratic');
    } else if (
      workspaceKey === 'originality' ||
      workspaceKey === 'plagiarism'
    ) {
      setActiveWorkspace(null);
      setActiveTab('originality');
    } else if (
      workspaceKey === 'rubric_guide' ||
      workspaceKey === 'assignment_stepper' ||
      workspaceKey === 'assignment' ||
      workspaceKey === 'assignment_workspace'
    ) {
      setAssignmentInitialModule('outline_suite');
      setActiveWorkspace(null);
      setActiveTab('rubric_guide');
    } else if (
      workspaceKey === 'apa_workspace' ||
      workspaceKey === 'apa'
    ) {
      setActiveWorkspace(null);
      setActiveTab('apa');
    } else if (
      workspaceKey === 'course_reader' ||
      workspaceKey === 'stats_explainer' ||
      workspaceKey === 'cross_unit' ||
      workspaceKey === 'research'
    ) {
      setActiveWorkspace(null);
      setActiveTab('research');
    } else if (
      workspaceKey === 'lesson_explainer' ||
      workspaceKey === 'lesson'
    ) {
      setActiveWorkspace(null);
      setActiveTab('lesson');
    } else if (
      workspaceKey === 'flashcards_sm2' ||
      workspaceKey === 'flashcards'
    ) {
      setActiveWorkspace(null);
      setActiveTab('flashcards');
    } else if (
      workspaceKey === 'weekly_timetable' ||
      workspaceKey === 'rhythm'
    ) {
      setActiveWorkspace(null);
      setActiveTab('rhythm');
    } else if (
      workspaceKey === 'cgpa_forecaster' ||
      workspaceKey === 'cgpa'
    ) {
      setActiveWorkspace(null);
      setActiveTab('cgpa');
    } else if (
      workspaceKey === 'pomodoro_lofi' ||
      workspaceKey === 'impostor_wellness' ||
      workspaceKey === 'pomodoro'
    ) {
      setActiveWorkspace(null);
      setActiveTab('pomodoro');
    } else {
      setActiveWorkspace(null);
      setActiveTab('dashboard');
    }
  };

  // Back နှိပ်ပြီး Dashboard သို့ Scroll ပြန်ဆွဲခြင်း
  const handleBackToDashboard = () => {
    const targetCardId = lastSelectedCardId;
    setActiveWorkspace(null);
    setActiveTab('dashboard');

    if (targetCardId) {
      setTimeout(() => {
        const el = document.getElementById(targetCardId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    }
  };

  const renderCurrentView = () => {
    // 1. သီးသန့် SOP / Academic CV Studio ဖွင့်ထားပါက ဖွင့်ပေးမည်
    if (activeWorkspace === 'scholarship_sop_studio') {
      return <ScholarshipSopStudio onBackToDashboard={handleBackToDashboard} />;
    }

    // 2. အဓိက Tab ၅ ခုနှင့် သက်ဆိုင်ရာ Workspaces အား ပြသပေးခြင်း
    if (activeTab === 'uopeople_scholar' || activeTab === 'scholarship') {
      return <ScholarshipReviewer />;
    }
    if (activeTab === 'socratic') {
      return <SocraticThinkingWorkspace />;
    }
    if (activeTab === 'originality') {
      return <LocalAiBypassStudio />;
    }
    if (activeTab === 'rubric_guide' || activeTab === 'assignment') {
      return (
        <AssignmentWorkspace
          initialModule={assignmentInitialModule}
          onBackToDashboard={lastSelectedCardId ? handleBackToDashboard : undefined}
        />
      );
    }
    if (activeTab === 'rhythm') {
      return <UoPeopleRhythmCalendar />;
    }
    if (activeTab === 'cgpa') {
      return <CgpaCalculator />;
    }
    if (activeTab === 'research') {
      return <ResearchHub />;
    }
    if (activeTab === 'apa') {
      return (
        <ApaFormatter
          onBackToDashboard={lastSelectedCardId ? handleBackToDashboard : undefined}
        />
      );
    }
    if (activeTab === 'lesson') {
      return <LessonExplainer />;
    }
    if (activeTab === 'flashcards') {
      return <FlashcardStudy />;
    }
    if (activeTab === 'pomodoro') {
      return <BurnoutPomodoro />;
    }

    // 3. ပင်မ Dashboard ပြသခြင်း
    return (
      <Dashboard
        onOpenWorkspace={(workspaceKey: string, cardId?: string) => {
          handleOpenWorkspace(workspaceKey, cardId);
        }}
      />
    );
  };

  const showWorkspaceBackBar =
    activeWorkspace === null &&
    activeTab !== 'dashboard' &&
    activeTab !== 'rubric_guide' &&
    activeTab !== 'assignment' &&
    activeTab !== 'apa' &&
    Boolean(lastSelectedCardId);

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden flex flex-col bg-[#070b14] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white ${
        eyecareMode ? 'eyecare-mode' : ''
      } ${settings.dataSaverMode ? 'subpixel-antialiased' : 'antialiased'}`}
    >
      {/* Top Navbar */}
      <Navbar onOpenPrivacyModal={() => setPrivacyModalOpen(true)} />

      {/* ပုံသေ Tab ၅ ခု Navbar */}
      <header className="border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md px-4 py-2.5 sticky top-0 z-40">
        <nav className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-7xl mx-auto">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive =
              activeWorkspace === null &&
              (activeTab === item.id ||
                (item.id === 'uopeople_scholar' && activeTab === 'scholarship') ||
                (item.id === 'rubric_guide' && activeTab === 'assignment'));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveWorkspace(null);
                  setLastSelectedCardId(null);
                  if (item.id === 'rubric_guide') {
                    setAssignmentInitialModule('outline_suite');
                  }
                  setActiveTab(item.id);
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-950/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6">
        {/* Automatic Deadline Reminder Notification Banner */}
        <DeadlineNotificationBanner />

        {/* Back to Dashboard Bar when opened from a Workspace Card */}
        {showWorkspaceBackBar && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Dashboard သို့ ပြန်သွားမည်"
            >
              <span>← Back</span>
            </button>
          </div>
        )}

        {/* Tab Content Area */}
        <main className="flex-1">
          {renderCurrentView()}
        </main>
      </div>

      {/* Floating Offline Notification when internet drops */}
      {!isOnline && (
        <div className="fixed bottom-16 left-4 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold shadow-2xl animate-bounce">
          <WifiOff className="w-4 h-4" />
          <span>{t.offlineStatus}</span>
        </div>
      )}

      {/* Floating Quick-Action Bottom Access when no Primary API Key is saved */}
      {!hasActiveKey && (
        <div className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-6 z-40 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => setPrivacyModalOpen(true)}
            className="pointer-events-auto min-h-[44px] px-4 py-2.5 rounded-2xl bg-slate-900/95 hover:bg-slate-800 border border-amber-500/60 text-amber-200 shadow-2xl shadow-black/80 backdrop-blur-md flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
          >
            <span>⚠️ Gemini API Key မထည့်ရသေးပါ - နှိပ်၍ထည့်ရန်</span>
          </button>
        </div>
      )}

      {/* Persistent Global Background Audio Studio (Runs at root so audio never unmounts across tab switches or Back navigation) */}
      <StudyAudioStudio
        onNavigateToPomodoroTab={() => {
          setActiveTab('pomodoro');
          setActiveWorkspace(null);
        }}
        isInPomodoroWorkspace={activeTab === 'pomodoro' && activeWorkspace === null}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#050811]/95 backdrop-blur-md py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium tracking-wide">Students Support · Free Academic & Privacy Suite</span>
          </div>

          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900/80 border border-indigo-500/25 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs tracking-wide text-slate-300">
              Architected by{' '}
              <span className="font-extrabold bg-gradient-to-r from-indigo-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
                ELVIS (HTET THURA AUNG)
              </span>
            </span>
            <span className="text-slate-600 font-bold">·</span>
            <span className="text-[11px] sm:text-xs font-semibold text-indigo-300/90 tracking-wide">
              Empowering Academic Excellence
            </span>
          </div>
        </div>
      </footer>

      {/* Privacy & BYOK Modal */}
      <PrivacySettingsModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      {/* Quota Exhausted Modal with Pacific Midnight Countdown */}
      <QuotaExhaustedModal onOpenSettings={() => setPrivacyModalOpen(true)} />

      {/* Academic Honor Code Modal (Onboarding) */}
      <AcademicHonorCodeModal />
    </div>
  );
};

export default function App() {
  return (
    <ApiProvider>
      <AuthProvider>
        <StreakProvider>
          <AppProvider>
            <MainLayout />
          </AppProvider>
        </StreakProvider>
      </AuthProvider>
    </ApiProvider>
  );
}

