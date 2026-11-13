import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Term,
  Course,
  Flashcard,
  QuizQuestion,
  CitationItem,
  BurnoutLog,
  UserSettings,
  ActiveTab,
  Grade,
} from '../types';
import { encryptAndSave, loadAndDecrypt, clearAllLocalData } from '../utils/crypto';
import { calculateSM2, ReviewGrade } from '../utils/sm2';
import { throttleGuard, LocalInBrowserEngine } from '../utils/engine';
import {
  loadKeyPoolFromStorage,
  saveKeyPoolToStorage,
  calculatePacificMidnightResetSeconds,
  executeAcademicActionWithCascade,
  testGeminiApiKey,
  getActiveApiKey,
} from '../services/geminiService';

export interface ReadingSessionProgress {
  bookId: string;
  bookTitle: string;
  lastSectionId: string;
  lastSectionTitle: string;
  scrollOffset: number;
  scrollPercentage: number;
  lastReadTimestamp: number;
}

interface AppContextType {
  terms: Term[];
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  citations: CitationItem[];
  burnoutLog: BurnoutLog;
  settings: UserSettings;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  language: 'my' | 'en';
  setLanguage: (lang: 'my' | 'en') => void;
  // CGPA helpers
  addTerm: (name: string) => void;
  deleteTerm: (termId: string) => void;
  updateTermName: (termId: string, name: string) => void;
  addCourse: (termId: string, course: Omit<Course, 'id'>) => void;
  deleteCourse: (termId: string, courseId: string) => void;
  updateCourse: (termId: string, courseId: string, updates: Partial<Course>) => void;
  calculateOverallCgpa: () => { cgpa: number; totalCredits: number };
  calculateTermGpa: (term: Term) => { gpa: number; credits: number };
  forecastGpaNeeded: (target: number, remaining: number) => { needed: number; achievable: boolean };
  // Flashcards & Quizzes
  reviewFlashcard: (cardId: string, grade: ReviewGrade) => void;
  addFlashcards: (newCards: Omit<Flashcard, 'id' | 'repetition' | 'interval' | 'easeFactor' | 'nextReviewDate' | 'consecutiveCorrect'>[]) => void;
  deleteFlashcard: (cardId: string) => void;
  addQuizzes: (newQuizzes: QuizQuestion[]) => void;
  clearQuizzes: () => void;
  deleteQuiz: (quizId: string) => void;
  // Citations
  addCitation: (item: CitationItem) => void;
  deleteCitation: (id: string) => void;
  // Burnout
  updateBurnout: (log: BurnoutLog) => void;
  // Settings & Emergency
  updateSettings: (partial: Partial<UserSettings>) => void;
  panicClearData: () => Promise<void>;
  callAcademicApi: (action: string, payload: any, targetLanguage?: string) => Promise<any>;
  exportEncryptedBackup: () => void;
  importEncryptedBackup: (jsonString: string) => Promise<boolean>;
  // Eye-care Low-Light Theme
  eyecareMode: boolean;
  toggleEyecareMode: () => void;
  // Live API Key Health & Quota
  apiHealth: ApiHealthStatus;
  checkApiHealth: () => Promise<ApiHealthStatus>;
  // Global Persistent YouTube Player State (Plays across all tabs & routes)
  youtubePlayer: GlobalMusicState;
  playYouTubeTrack: (videoId: string, title: string, playlist?: PlaylistItem[]) => void;
  togglePlayPauseYouTube: () => void;
  closeYouTubePlayer: () => void;
  toggleMinimizeYouTube: () => void;
  playNextYouTubeTrack: () => void;
  playPreviousYouTubeTrack: () => void;
  toggleRepeatMode: () => void;
  // Reading Sessions Persistence
  readingSessions: Record<string, ReadingSessionProgress>;
  saveReadingProgress: (progress: Omit<ReadingSessionProgress, 'lastReadTimestamp'>) => void;
  getReadingProgress: (bookId: string) => ReadingSessionProgress | undefined;
  clearReadingProgress: (bookId: string) => void;
  // Recent Tools Tracking
  recentTools: RecentToolItem[];
  recordRecentTool: (card: { id: string; title: string; route: string; iconName: string; suiteLabel: string }) => void;
}

export interface RecentToolItem {
  id: string;
  title: string;
  route: string;
  iconName: string;
  suiteLabel: string;
}

export type RepeatMode = 'off' | 'one' | 'all';

export interface PlaylistItem {
  videoId: string;
  title: string;
}

export interface GlobalMusicState {
  videoId: string;
  title: string;
  isPlaying: boolean;
  isOpen: boolean;
  isMinimized: boolean;
  repeatMode: RepeatMode;
  playlist: PlaylistItem[];
  currentIndex: number;
}

export interface ApiHealthStatus {
  status: 'healthy' | 'quota_exceeded' | 'high_demand' | 'missing_key' | 'error' | 'checking';
  healthy: boolean;
  latencyMs: number;
  model?: string;
  message: string;
  quotaIndicator?: 'optimal' | 'normal' | 'low';
  lastChecked?: string;
}

const GRADE_POINTS: Record<Grade, number> = {
  'A+': 4.0,
  'A': 4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B': 3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C': 2.0,
  'C-': 1.7,
  'D+': 1.3,
  'D': 1.0,
  'F': 0.0,
};

const initialTerms: Term[] = [];

const initialFlashcards: Flashcard[] = [];

const initialSettings: UserSettings = {
  language: 'my',
  useCustomKey: false,
  customGeminiKey: '',
  customOpenAiKey: '',
  customClaudeKey: '',
  activeProvider: 'server',
  targetCgpa: 0,
  remainingCredits: 0,
  isEncrypted: true,
  honorCodeAccepted: false,
  dataSaverMode: false,
  engineMode: 'cloud',
  preferredModel: 'auto',
};

const initialBurnout: BurnoutLog = {
  energyLevel: 10,
  stressLevel: 0,
  studyHoursToday: 0,
  sleepHours: 0,
  lastUpdated: '',
};

export const DEFAULT_STUDY_PLAYLIST: PlaylistItem[] = [
  { videoId: 'YjohMzHkBqI', title: 'Studio Ghibli Relaxing Piano' },
  { videoId: 'U4t25OiyJys', title: 'Myanmar Instrumental' },
  { videoId: '4xDzrJKXOOY', title: 'Deep Focus Study Piano' },
  { videoId: 'fEvM-OUbaKs', title: 'Coffee Shop Chill Bossa Nova' },
  { videoId: 'mPZkdNFkNps', title: 'Gentle Rain & Night Chill' },
  { videoId: '4Tr0otuiQuU', title: 'Peaceful Classical Study Piano' },
  { videoId: '1fueZCTYkpA', title: 'Peaceful Japanese Study Cafe' },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [terms, setTerms] = useState<Term[]>(initialTerms);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(initialFlashcards);
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [citations, setCitations] = useState<CitationItem[]>([]);
  const [burnoutLog, setBurnoutLog] = useState<BurnoutLog>(initialBurnout);
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);

  // Reading Sessions Persistence
  const [readingSessions, setReadingSessions] = useState<Record<string, ReadingSessionProgress>>(() => {
    try {
      const saved = localStorage.getItem('akari_scholar_reading_sessions_v2');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load reading sessions:', e);
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('akari_scholar_reading_sessions_v2', JSON.stringify(readingSessions));
    } catch (e) {
      console.warn('Failed to save reading sessions to localStorage:', e);
    }
  }, [readingSessions]);

  const saveReadingProgress = (progress: Omit<ReadingSessionProgress, 'lastReadTimestamp'>) => {
    setReadingSessions((prev) => ({
      ...prev,
      [progress.bookId]: {
        ...progress,
        lastReadTimestamp: Date.now(),
      },
    }));
  };

  const getReadingProgress = (bookId: string): ReadingSessionProgress | undefined => {
    return readingSessions[bookId];
  };

  const clearReadingProgress = (bookId: string) => {
    setReadingSessions((prev) => {
      const copy = { ...prev };
      delete copy[bookId];
      return copy;
    });
  };

  // Eye-care Low-Light Theme State (Night study protection against blue light & eye strain)
  const [eyecareMode, setEyecareMode] = useState<boolean>(() => {
    return localStorage.getItem('akari_eyecare_mode') === 'true';
  });

  useEffect(() => {
    if (eyecareMode) {
      document.body.classList.add('eyecare-mode');
    } else {
      document.body.classList.remove('eyecare-mode');
    }
    localStorage.setItem('akari_eyecare_mode', eyecareMode ? 'true' : 'false');
  }, [eyecareMode]);

  const toggleEyecareMode = () => {
    setEyecareMode((prev) => !prev);
  };

  // Live API Key Health & Quota Indicator State
  const [apiHealth, setApiHealth] = useState<ApiHealthStatus>({
    status: 'checking',
    healthy: true,
    latencyMs: 0,
    message: 'Testing API connection...',
    quotaIndicator: 'optimal',
  });

  const checkApiHealth = async (): Promise<ApiHealthStatus> => {
    setApiHealth((prev) => ({ ...prev, status: 'checking', message: 'Verifying API status...' }));
    try {
      const candidateKey =
        (settings.useCustomKey && settings.customGeminiKey ? settings.customGeminiKey : '') ||
        getActiveApiKey();
      if (!candidateKey) {
        const missingObj: ApiHealthStatus = {
          status: 'missing_key',
          healthy: false,
          latencyMs: 0,
          message: 'Ready for your Gemini API Key in Key Vault',
          quotaIndicator: 'normal',
          lastChecked: new Date().toLocaleTimeString(),
        };
        setApiHealth(missingObj);
        return missingObj;
      }
      const res = await testGeminiApiKey(candidateKey);
      const isQuota = res.message.includes('429') || res.message.toLowerCase().includes('quota');
      const statusObj: ApiHealthStatus = {
        status: res.success ? 'healthy' : isQuota ? 'quota_exceeded' : 'error',
        healthy: res.success,
        latencyMs: res.latency || 0,
        model: 'gemini-2.5-flash',
        message: res.message,
        quotaIndicator: res.success ? 'optimal' : 'low',
        lastChecked: new Date().toLocaleTimeString(),
      };
      setApiHealth(statusObj);
      return statusObj;
    } catch {
      const failObj: ApiHealthStatus = {
        status: 'error',
        healthy: false,
        latencyMs: 0,
        message: 'Network connection error - Ensure VPN is active and stable',
        quotaIndicator: 'low',
        lastChecked: new Date().toLocaleTimeString(),
      };
      setApiHealth(failObj);
      return failObj;
    }
  };

  useEffect(() => {
    checkApiHealth();
  }, [settings.useCustomKey, settings.customGeminiKey]);

  // Decrypt and load data from local client storage on initial mount
  useEffect(() => {
    async function loadData() {
      try {
        const decrypted = await loadAndDecrypt<{
          terms: Term[];
          flashcards: Flashcard[];
          quizzes: QuizQuestion[];
          citations: CitationItem[];
          burnoutLog: BurnoutLog;
          settings: UserSettings;
        }>();

        if (decrypted) {
          if (decrypted.terms) setTerms(decrypted.terms);
          if (decrypted.flashcards) setFlashcards(decrypted.flashcards);
          if (decrypted.quizzes) setQuizzes(decrypted.quizzes);
          if (decrypted.citations) setCitations(decrypted.citations);
          if (decrypted.burnoutLog) setBurnoutLog(decrypted.burnoutLog);
          if (decrypted.settings) {
            const loadedSettings = { ...decrypted.settings };
            const retiredModels = new Set([
              'gemini-2.5-flash',
              'gemini-2.5-flash-lite',
              'gemini-flash-latest',
              'gemini-2.0-flash',
              'gemini-1.5-flash',
              'gemini-1.5-pro',
            ]);
            if (loadedSettings.preferredModel && retiredModels.has(loadedSettings.preferredModel)) {
              loadedSettings.preferredModel = 'auto';
            }
            setSettings((prev) => ({ ...prev, ...loadedSettings }));
          }
        }
      } catch (e) {
        console.warn('Initial state decryption note:', e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Save encrypted whenever core state changes
  useEffect(() => {
    if (!isLoaded) return;
    const dataToSave = {
      terms,
      flashcards,
      quizzes,
      citations,
      burnoutLog,
      settings,
    };
    encryptAndSave(dataToSave);
  }, [terms, flashcards, quizzes, citations, burnoutLog, settings, isLoaded]);

  // Language state shortcut
  const language = settings.language;
  const setLanguage = (lang: 'my' | 'en') => {
    setSettings((prev) => ({ ...prev, language: lang }));
  };

  // CGPA calculations
  const calculateTermGpa = (term: Term) => {
    let totalPoints = 0;
    let credits = 0;
    for (const c of term.courses) {
      const point = c.customPoint !== undefined ? c.customPoint : GRADE_POINTS[c.grade];
      totalPoints += point * c.credits;
      credits += c.credits;
    }
    const gpa = credits > 0 ? Number((totalPoints / credits).toFixed(2)) : 0;
    return { gpa, credits };
  };

  const calculateOverallCgpa = () => {
    let totalPoints = 0;
    let totalCredits = 0;
    for (const term of terms) {
      for (const c of term.courses) {
        const point = c.customPoint !== undefined ? c.customPoint : GRADE_POINTS[c.grade];
        totalPoints += point * c.credits;
        totalCredits += c.credits;
      }
    }
    const cgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;
    return { cgpa, totalCredits };
  };

  const forecastGpaNeeded = (target: number, remaining: number) => {
    const { cgpa: currentCgpa, totalCredits: currentCredits } = calculateOverallCgpa();
    if (remaining <= 0) return { needed: 0, achievable: false };

    const totalTargetPoints = target * (currentCredits + remaining);
    const currentTotalPoints = currentCgpa * currentCredits;
    const neededPoints = totalTargetPoints - currentTotalPoints;
    const neededGpa = Number((neededPoints / remaining).toFixed(2));

    return {
      needed: neededGpa,
      achievable: neededGpa <= 4.0,
    };
  };

  // Term & Course handlers
  const addTerm = (name: string) => {
    const newTerm: Term = {
      id: `term-${Date.now()}`,
      name: name.trim() || `Term ${terms.length + 1}`,
      courses: [],
    };
    setTerms((prev) => [...prev, newTerm]);
  };

  const deleteTerm = (termId: string) => {
    setTerms((prev) => prev.filter((t) => t.id !== termId));
  };

  const updateTermName = (termId: string, name: string) => {
    setTerms((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, name } : t))
    );
  };

  const addCourse = (termId: string, course: Omit<Course, 'id'>) => {
    const newCourse: Course = { ...course, id: `c-${Date.now()}` };
    setTerms((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, courses: [...t.courses, newCourse] } : t))
    );
  };

  const deleteCourse = (termId: string, courseId: string) => {
    setTerms((prev) =>
      prev.map((t) =>
        t.id === termId
          ? { ...t, courses: t.courses.filter((c) => c.id !== courseId) }
          : t
      )
    );
  };

  const updateCourse = (termId: string, courseId: string, updates: Partial<Course>) => {
    setTerms((prev) =>
      prev.map((t) =>
        t.id === termId
          ? {
              ...t,
              courses: t.courses.map((c) => (c.id === courseId ? { ...c, ...updates } : c)),
            }
          : t
      )
    );
  };

  // SM-2 Spaced Repetition Review
  const reviewFlashcard = (cardId: string, grade: ReviewGrade) => {
    setFlashcards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        const result = calculateSM2(card, grade);
        return {
          ...card,
          ...result,
          lastReviewedDate: new Date().toISOString(),
        };
      })
    );
  };

  const addFlashcards = (
    newCards: Omit<
      Flashcard,
      'id' | 'repetition' | 'interval' | 'easeFactor' | 'nextReviewDate' | 'consecutiveCorrect'
    >[]
  ) => {
    const fullCards: Flashcard[] = newCards.map((c, i) => ({
      ...c,
      id: `fc-${Date.now()}-${i}`,
      repetition: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      consecutiveCorrect: 0,
    }));
    setFlashcards((prev) => [...prev, ...fullCards]);
  };

  const deleteFlashcard = (cardId: string) => {
    setFlashcards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const addQuizzes = (newQuizzes: QuizQuestion[]) => {
    setQuizzes((prev) => [...prev, ...newQuizzes]);
  };

  const clearQuizzes = () => {
    setQuizzes([]);
  };

  const deleteQuiz = (quizId: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
  };

  // Citations
  const addCitation = (item: CitationItem) => {
    setCitations((prev) => [item, ...prev]);
  };

  const deleteCitation = (id: string) => {
    setCitations((prev) => prev.filter((c) => c.id !== id));
  };

  // Burnout Log
  const updateBurnout = (log: BurnoutLog) => {
    setBurnoutLog(log);
  };

  // Settings
  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  // Panic wipe
  const panicClearData = async () => {
    await clearAllLocalData();
    setTerms([]);
    setFlashcards([]);
    setQuizzes([]);
    setCitations([]);
    setBurnoutLog({
      energyLevel: 10,
      stressLevel: 0,
      studyHoursToday: 0,
      sleepHours: 0,
      lastUpdated: '',
    });
    setSettings(initialSettings);
  };

  // JSON Encrypted Backup Export
  const exportEncryptedBackup = () => {
    const rawData = localStorage.getItem('students_suite_encrypted_store_v2');
    const salt = localStorage.getItem('students_suite_crypto_salt_v1') || localStorage.getItem('akari_crypto_salt_v1');
    const backupObj = {
      type: 'students_suite_encrypted_backup',
      version: 2,
      timestamp: new Date().toISOString(),
      salt,
      store: rawData ? JSON.parse(rawData) : null,
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_suite_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON Encrypted Backup Import
  const importEncryptedBackup = async (jsonString: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonString);
      if (
        (parsed.type !== 'students_suite_encrypted_backup' && parsed.type !== 'akari_scholar_encrypted_backup') ||
        !parsed.store
      ) {
        return false;
      }
      if (parsed.salt) localStorage.setItem('students_suite_crypto_salt_v1', parsed.salt);
      localStorage.setItem('students_suite_encrypted_store_v2', JSON.stringify(parsed.store));
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  };

  // Academic AI API caller with Throttle Guard and Local fallback
  const callAcademicApi = async (action: string, payload: any, targetLanguage = 'both') => {
    // 1. Check if Offline or in Local In-Browser Engine Mode
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline || settings.engineMode === 'local') {
      if (action === 'lesson_explainer') {
        const summary = LocalInBrowserEngine.summarize(payload.content, 4);
        return JSON.stringify({
          analysisTitle: "Local Offline Summary & Concept Extraction",
          keyConceptTags: ["Offline Synthesis", "Text Extraction", "Concept Note"],
          englishAnalysis: {
            executiveSynthesis: summary.join('\n\n') || "Extracted summary points based on local offline parsing.",
            thematicPillars: [
              {
                title: "Primary Extracted Theme",
                explanation: summary[0] || "Foundational concept extracted from the provided text.",
              },
              {
                title: "Mechanism & Interaction",
                explanation: summary[1] || "Secondary key concept extracted from reading material.",
              },
            ],
            actionableTakeaways: [
              "Review foundational definitions directly in your textbook.",
              "Prepare synthesized notes for discussion forum responses.",
            ],
          },
          burmeseAnalysis: {
            comprehensiveExplanation: "ကျောင်းသားများ နားလည်လွယ်စေရန် အော့ဖ်လိုင်း အနှစ်ချုပ် စနစ်ဖြင့် ထုတ်ယူထားသော သင်ခန်းစာ အကြောင်းအရာ ဖြစ်ပါသည်။\n\n" + (summary.join('\n\n') || "စာသားမှ အဓိက အချက်အလက်များကို ထုတ်နုတ်ထားပါသည်။"),
            coreTakeaways: [
              {
                pointTitle: "အဓိက သဘောတရား",
                explanation: "စာအုပ်ပါ အဓိက သဘောတရားများကို အခြေခံ၍ လေ့ကျင့်ပါရန်။",
              },
            ],
            uopeopleAcademicApplication: "UoPeople Assignment များတွင် အခြေခံ သဘောတရားများကို တိကျစွာ ကိုးကား ရေးသားပါ။",
          },
        });
      }
      if (action === 'generate_study_cards') {
        const cards = LocalInBrowserEngine.generateLocalFlashcards(payload.content);
        return JSON.stringify({
          flashcards: cards,
          quizzes: [
            {
              question: `According to the text, what is the significance of ${cards[0]?.concept || 'the main concept'}?`,
              options: [cards[0]?.back || 'Primary definition', 'An unrelated variable', 'Experimental noise', 'None of the above'],
              correctIndex: 0,
              explanation: 'Derived from local extractive reading analysis.',
            },
          ],
        });
      }
    }

    // Sanitize payload content strings to max 20,000 characters to prevent timeouts & payload explosion
    if (payload && typeof payload === 'object') {
      if (typeof payload.content === 'string') {
        payload.content = payload.content.slice(0, 20000);
      }
      if (typeof payload.text === 'string') {
        payload.text = payload.text.slice(0, 20000);
      }
    }

    // 2. Throttle Guard (Guards 15 RPM Free Tier limit)
    await throttleGuard.throttle();

    const customKey =
      settings.useCustomKey && settings.customGeminiKey ? settings.customGeminiKey.trim() : undefined;

    return await executeAcademicActionWithCascade({
      action,
      payload,
      targetLanguage: targetLanguage || settings.language,
      preferredModel:
        settings.preferredModel && settings.preferredModel !== 'auto'
          ? settings.preferredModel
          : undefined,
      primaryKey: customKey,
    });
  };

  // Global Persistent YouTube Player State (never unmounts across tabs)
  const [youtubePlayer, setYoutubePlayer] = useState<GlobalMusicState>({
    videoId: '',
    title: '',
    isPlaying: false,
    isOpen: false,
    isMinimized: false,
    repeatMode: 'off',
    playlist: [],
    currentIndex: 0,
  });

  const playYouTubeTrack = (videoId: string, title: string, customPlaylist?: PlaylistItem[]) => {
    setYoutubePlayer((prev) => {
      let list = customPlaylist && customPlaylist.length > 0 ? customPlaylist : prev.playlist;
      if (!list || list.length === 0) {
        list = DEFAULT_STUDY_PLAYLIST;
      }
      let idx = list.findIndex((item) => item.videoId === videoId);
      if (idx === -1) {
        list = [{ videoId, title }, ...list];
        idx = 0;
      }
      return {
        ...prev,
        videoId,
        title,
        playlist: list,
        currentIndex: idx,
        isPlaying: true,
        isOpen: true,
        isMinimized: false,
      };
    });
  };

  const playNextYouTubeTrack = () => {
    setYoutubePlayer((prev) => {
      const list = prev.playlist && prev.playlist.length > 0 ? prev.playlist : DEFAULT_STUDY_PLAYLIST;
      let nextIndex = prev.currentIndex + 1;
      if (nextIndex >= list.length) {
        nextIndex = 0; // Wrap around to start of playlist
      }
      const nextTrack = list[nextIndex];
      return {
        ...prev,
        videoId: nextTrack.videoId,
        title: nextTrack.title,
        currentIndex: nextIndex,
        isPlaying: true,
        isOpen: true,
      };
    });
  };

  const playPreviousYouTubeTrack = () => {
    setYoutubePlayer((prev) => {
      const list = prev.playlist && prev.playlist.length > 0 ? prev.playlist : DEFAULT_STUDY_PLAYLIST;
      let prevIndex = prev.currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = list.length - 1; // Wrap to end
      }
      const prevTrack = list[prevIndex];
      return {
        ...prev,
        videoId: prevTrack.videoId,
        title: prevTrack.title,
        currentIndex: prevIndex,
        isPlaying: true,
        isOpen: true,
      };
    });
  };

  const toggleRepeatMode = () => {
    setYoutubePlayer((prev) => {
      const nextMode: RepeatMode =
        prev.repeatMode === 'off' ? 'one' : prev.repeatMode === 'one' ? 'all' : 'off';
      return {
        ...prev,
        repeatMode: nextMode,
      };
    });
  };

  const togglePlayPauseYouTube = () => {
    setYoutubePlayer((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  };

  const closeYouTubePlayer = () => {
    setYoutubePlayer((prev) => ({
      ...prev,
      isPlaying: false,
      isOpen: false,
    }));
  };

  const toggleMinimizeYouTube = () => {
    setYoutubePlayer((prev) => ({
      ...prev,
      isMinimized: !prev.isMinimized,
    }));
  };

  const [recentTools, setRecentTools] = useState<RecentToolItem[]>(() => {
    try {
      const saved = localStorage.getItem('akari_recent_tools_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const recordRecentTool = (card: { id: string; title: string; route: string; iconName: string; suiteLabel: string }) => {
    setRecentTools((prev) => {
      const filtered = prev.filter((item) => item.id !== card.id);
      const updated = [
        { id: card.id, title: card.title, route: card.route, iconName: card.iconName, suiteLabel: card.suiteLabel },
        ...filtered,
      ].slice(0, 3);
      try {
        localStorage.setItem('akari_recent_tools_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  return (
    <AppContext.Provider
      value={{
        terms,
        flashcards,
        quizzes,
        citations,
        burnoutLog,
        settings,
        activeTab,
        setActiveTab,
        language,
        setLanguage,
        addTerm,
        deleteTerm,
        updateTermName,
        addCourse,
        deleteCourse,
        updateCourse,
        calculateOverallCgpa,
        calculateTermGpa,
        forecastGpaNeeded,
        reviewFlashcard,
        addFlashcards,
        deleteFlashcard,
        addQuizzes,
        clearQuizzes,
        deleteQuiz,
        addCitation,
        deleteCitation,
        updateBurnout,
        updateSettings,
        panicClearData,
        callAcademicApi,
        exportEncryptedBackup,
        importEncryptedBackup,
        eyecareMode,
        toggleEyecareMode,
        apiHealth,
        checkApiHealth,
        youtubePlayer,
        playYouTubeTrack,
        togglePlayPauseYouTube,
        closeYouTubePlayer,
        toggleMinimizeYouTube,
        playNextYouTubeTrack,
        playPreviousYouTubeTrack,
        toggleRepeatMode,
        readingSessions,
        saveReadingProgress,
        getReadingProgress,
        clearReadingProgress,
        recentTools,
        recordRecentTool,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
