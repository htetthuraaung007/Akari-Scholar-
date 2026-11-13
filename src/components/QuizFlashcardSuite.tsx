import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../context/ApiContext';
import { useStreak } from '../context/StreakContext';
import { translations } from '../translations';
import {
  isCardDue,
  calculateSM2ForItem,
  NumericReviewGrade,
  getTodayDateString,
} from '../utils/sm2';
import { QuizQuestion, QuizSessionRecord, FlashcardItem, SM2CardState } from '../types';
import {
  batchIngestSources,
  getDailyUsage,
  incrementDailyUsage,
  loadFlashcardDeck,
  saveFlashcardDeck,
  generateDirectFlashcards,
  collectQuizErrorsToDeck,
  getQuizStorageKeyForWeek,
  preprocessChapterScopedPayload,
  executeGeminiRequest,
  resolveDynamicModelCatalog,
} from '../services/geminiService';
import {
  loadPersistedTabState,
  savePersistedTabState,
  clearPersistedTabState,
} from '../utils/researchPersistence';
import {
  resolveAcademicPayload,
  isPublicOpenAccessDomain,
  ResolvedAcademicPaper,
} from '../services/academicResolver';
import {
  stripTextbookNoise,
  sanitizeAcademicQuestionStem,
  isForbiddenMetaQuestion,
} from '../utils/textbookStripper';
import { safeExtractJsonArray } from '../utils/jsonSanitizer';
import { shuffleQuizOptions } from '../utils/quizUtils';
import {
  normalizeAcademicSourceUrl,
} from '../utils/academicSourceFetcher';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizReview } from './QuizReview';
import { MathRenderer } from './MathRenderer';
import {
  Brain,
  Sparkles,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronLeft,
  Award,
  AlertTriangle,
  Flame,
  FileText,
  Sliders,
  Globe,
  Link as LinkIcon,
  X,
  History,
  Calendar,
  ShieldCheck,
  BookOpen,
  Zap,
  Key,
  Upload,
  FileUp,
  Target,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'akari_scholar_quizzes_v1';
const SUITE_PERSISTENCE_KEY = 'akari_quiz_flashcard_suite_state_v1';

interface RawGeneratedQuizItem {
  id?: string;
  question?: string;
  q?: string;
  options?: string[];
  correctIndex?: number;
  questionType?: 'mcq' | 'except' | 'true_false';
  explanation?: string;
  realWorldApplication?: string;
}

interface PersistedSuiteState {
  activeMode: 'quiz' | 'flashcards';
  quizSubView: 'runner' | 'review' | 'history';
  sources: string[];
  currentSourceInput: string;
  selectedWeek: string;
  chapterScope: string;
  quizInputText: string;
  questionCountPreset: number;
  customQuestionCount: number;
  isCustomCount: boolean;
  examStyle: 'uopeople' | 'standard';
  showGeneratorPanel: boolean;
  currentQuizIndex: number;
  selectedOption: number | null;
  quizScore: number;
  isAnswerSubmitted: boolean;
  userAnswers: Record<number, number>;
  currentSessionId: string | null;
  currentAttemptNumber: number;
  quizElapsedSeconds: number;
  deckFilter: 'due' | 'error' | 'all';
  currentCardIndex: number;
  fcSourceInput: string;
  fcTextPayload: string;
  fcChapterScope: string;
  fcCardCount: number;
  fcWeekTag: string;
}

const ACADEMIC_WEEKS = [
  'Week 1',
  'Week 2',
  'Week 3',
  'Week 4',
  'Week 5',
  'Week 6',
  'Week 7',
  'Week 8 / Final Review',
];

export const QuizFlashcardSuite: React.FC = () => {
  const {
    language,
    flashcards: appContextFlashcards,
    addFlashcards: addAppContextFlashcards,
    quizzes,
    addQuizzes,
    clearQuizzes,
  } = useApp();

  const {
    primaryApiKey,
    triggerKeyReplacementPrompt,
  } = useApi();

  const t = translations[language];
  const { recordStudyActivity } = useStreak();

  const initialPersisted = useRef<PersistedSuiteState>(
    loadPersistedTabState<PersistedSuiteState>(SUITE_PERSISTENCE_KEY, {
      activeMode: 'quiz',
      quizSubView: 'runner',
      sources: [],
      currentSourceInput: '',
      selectedWeek: 'Week 1',
      chapterScope: '',
      quizInputText: '',
      questionCountPreset: 10,
      customQuestionCount: 12,
      isCustomCount: false,
      examStyle: 'uopeople',
      showGeneratorPanel: quizzes.length === 0,
      currentQuizIndex: 0,
      selectedOption: null,
      quizScore: 0,
      isAnswerSubmitted: false,
      userAnswers: {},
      currentSessionId: null,
      currentAttemptNumber: 1,
      quizElapsedSeconds: 0,
      deckFilter: 'due',
      currentCardIndex: 0,
      fcSourceInput: '',
      fcTextPayload: '',
      fcChapterScope: '',
      fcCardCount: 20,
      fcWeekTag: 'Week 1',
    })
  ).current;

  // Daily Usage Tracking & Generic Dynamic Engine Status Pill
  const [dailyUsage, setDailyUsage] = useState(getDailyUsage());
  const [activeModeBadge, setActiveModeBadge] = useState<string>('⚡ Active Dynamic Free-Tier Cascade');

  // Top-level mode: 'quiz' (Mode A) | 'flashcards' (Mode B)
  const [activeMode, setActiveMode] = useState<'quiz' | 'flashcards'>(initialPersisted.activeMode);

  // Sub-views for Quiz: 'runner' | 'review' | 'history'
  const [quizSubView, setQuizSubView] = useState<'runner' | 'review' | 'history'>(
    initialPersisted.quizSubView
  );

  // -------------------------------------------------------------
  // Mode 1: Exam Practice Quiz State
  // -------------------------------------------------------------
  const [sources, setSources] = useState<string[]>(initialPersisted.sources);
  const [currentSourceInput, setCurrentSourceInput] = useState(initialPersisted.currentSourceInput);
  const [selectedWeek, setSelectedWeek] = useState<string>(initialPersisted.selectedWeek);
  const [chapterScope, setChapterScope] = useState<string>(initialPersisted.chapterScope);
  const [quizInputText, setQuizInputText] = useState(initialPersisted.quizInputText);
  const [questionCountPreset, setQuestionCountPreset] = useState<number>(
    initialPersisted.questionCountPreset
  );
  const [customQuestionCount, setCustomQuestionCount] = useState<number>(
    initialPersisted.customQuestionCount
  );
  const [isCustomCount, setIsCustomCount] = useState<boolean>(initialPersisted.isCustomCount);
  const [examStyle, setExamStyle] = useState<'uopeople' | 'standard'>(initialPersisted.examStyle);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizGenError, setQuizGenError] = useState<string | null>(null);
  const [paywallNotice, setPaywallNotice] = useState<string | null>(null);
  const [sourcePayload, setSourcePayload] = useState<ResolvedAcademicPaper | null>(null);
  const [currentSourceUrl, setCurrentSourceUrl] = useState<string>('');
  const [showGeneratorPanel, setShowGeneratorPanel] = useState(
    quizzes.length === 0 ? initialPersisted.showGeneratorPanel : false
  );
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Exam Timer State
  const [quizElapsedSeconds, setQuizElapsedSeconds] = useState(initialPersisted.quizElapsedSeconds);

  // Auto-Cascade Status Toast
  const [cascadeToast, setCascadeToast] = useState<{ message: string; model: string } | null>(null);

  // Active Quiz Runner State
  const [currentQuizIndex, setCurrentQuizIndex] = useState(initialPersisted.currentQuizIndex);
  const [selectedOption, setSelectedOption] = useState<number | null>(
    initialPersisted.selectedOption
  );
  const [quizScore, setQuizScore] = useState(initialPersisted.quizScore);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(initialPersisted.isAnswerSubmitted);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>(
    initialPersisted.userAnswers
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialPersisted.currentSessionId
  );
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState<number>(
    initialPersisted.currentAttemptNumber
  );
  const [errorCardsAddedBadge, setErrorCardsAddedBadge] = useState<number | null>(null);

  // LocalStorage Persistence & Sessions
  const [savedSessions, setSavedSessions] = useState<QuizSessionRecord[]>([]);
  const [historyWeekFilter, setHistoryWeekFilter] = useState<string>('all');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Mode 2: Dedicated Spaced Repetition Flashcard State (SM-2)
  // Unified LocalStorage Deck: `akari_flashcard_deck`
  // -------------------------------------------------------------
  const [flashcardDeck, setFlashcardDeck] = useState<FlashcardItem[]>(() =>
    loadFlashcardDeck(appContextFlashcards)
  );
  const [deckFilter, setDeckFilter] = useState<'due' | 'error' | 'all'>(initialPersisted.deckFilter);
  const [currentCardIndex, setCurrentCardIndex] = useState(initialPersisted.currentCardIndex);
  const [isFlipped, setIsFlipped] = useState(false);

  // Direct Flashcard Generator Modal State (Method A)
  const [showDirectFlashcardModal, setShowDirectFlashcardModal] = useState(false);
  const [fcSourceInput, setFcSourceInput] = useState(initialPersisted.fcSourceInput);
  const [fcTextPayload, setFcTextPayload] = useState(initialPersisted.fcTextPayload);
  const [fcChapterScope, setFcChapterScope] = useState(initialPersisted.fcChapterScope);
  const [fcCardCount, setFcCardCount] = useState<number>(initialPersisted.fcCardCount);
  const [fcWeekTag, setFcWeekTag] = useState<string>(initialPersisted.fcWeekTag);
  const [isGeneratingDirectCards, setIsGeneratingDirectCards] = useState(false);
  const [fcGenError, setFcGenError] = useState<string | null>(null);

  // Manual Card Creation & Clear All Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [showClearAllCardsModal, setShowClearAllCardsModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newConcept, setNewConcept] = useState('');

  // Derived Flashcard Metrics & SM-2 Phase Breakdown
  const totalCards = flashcardDeck.length;
  const dueCardsList = flashcardDeck.filter(isCardDue);
  const dueCardsCount = dueCardsList.length;
  const errorCardsList = flashcardDeck.filter((c) => c.source === 'quiz_error');
  const errorCardCount = errorCardsList.length;

  const masteredCardsCount = flashcardDeck.filter(
    (c) => (c.repetition || 0) >= 3 || (c.interval || 1) >= 10
  ).length;
  const reviewCardsCount = flashcardDeck.filter(
    (c) =>
      !((c.repetition || 0) >= 3 || (c.interval || 1) >= 10) &&
      ((c.repetition || 0) >= 1 || (c.interval || 1) > 1)
  ).length;
  const learningCardsCount = Math.max(0, totalCards - masteredCardsCount - reviewCardsCount);
  const masteredPercentage = totalCards > 0 ? Math.round((masteredCardsCount / totalCards) * 100) : 0;

  const activeStudyList =
    deckFilter === 'due'
      ? dueCardsList
      : deckFilter === 'error'
      ? errorCardsList
      : flashcardDeck;

  const currentCard = activeStudyList[currentCardIndex] || null;

  // Exam timer interval when in active quiz runner
  useEffect(() => {
    if (activeMode !== 'quiz' || quizSubView !== 'runner' || quizzes.length === 0) return;
    const timer = setInterval(() => {
      setQuizElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMode, quizSubView, quizzes.length]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Warm up verified dynamic Gemini model catalog once on mount & persist workspace state
  useEffect(() => {
    void resolveDynamicModelCatalog(primaryApiKey || undefined);
  }, [primaryApiKey]);

  useEffect(() => {
    savePersistedTabState<PersistedSuiteState>(SUITE_PERSISTENCE_KEY, {
      activeMode,
      quizSubView,
      sources,
      currentSourceInput,
      selectedWeek,
      chapterScope,
      quizInputText,
      questionCountPreset,
      customQuestionCount,
      isCustomCount,
      examStyle,
      showGeneratorPanel,
      currentQuizIndex,
      selectedOption,
      quizScore,
      isAnswerSubmitted,
      userAnswers,
      currentSessionId,
      currentAttemptNumber,
      quizElapsedSeconds,
      deckFilter,
      currentCardIndex,
      fcSourceInput,
      fcTextPayload,
      fcChapterScope,
      fcCardCount,
      fcWeekTag,
    });
  }, [
    activeMode,
    quizSubView,
    sources,
    currentSourceInput,
    selectedWeek,
    chapterScope,
    quizInputText,
    questionCountPreset,
    customQuestionCount,
    isCustomCount,
    examStyle,
    showGeneratorPanel,
    currentQuizIndex,
    selectedOption,
    quizScore,
    isAnswerSubmitted,
    userAnswers,
    currentSessionId,
    currentAttemptNumber,
    quizElapsedSeconds,
    deckFilter,
    currentCardIndex,
    fcSourceInput,
    fcTextPayload,
    fcChapterScope,
    fcCardCount,
    fcWeekTag,
  ]);

  // Load saved quiz sessions on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedSessions(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved quiz sessions from localStorage', e);
    }
  }, []);

  // Persist flashcardDeck whenever it updates
  const updateFlashcardDeck = (newDeck: FlashcardItem[]) => {
    setFlashcardDeck(newDeck);
    saveFlashcardDeck(newDeck);
  };

  // Show transient toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const showCascadeNotification = (message: string, model: string) => {
    setCascadeToast({ message, model });
    setTimeout(() => setCascadeToast(null), 4000);
  };

  const persistSessions = (updated: QuizSessionRecord[], weekTag?: string) => {
    setSavedSessions(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (weekTag) {
        const weekKey = getQuizStorageKeyForWeek(weekTag);
        const weekSessions = updated.filter((s) => s.weekTag === weekTag);
        localStorage.setItem(weekKey, JSON.stringify(weekSessions));
      }
    } catch (e) {
      console.error('Failed to save quiz sessions to localStorage', e);
    }
  };

  const effectiveQuestionCount = isCustomCount
    ? Math.min(Math.max(customQuestionCount, 1), 30)
    : questionCountPreset;

  const quizWordCount = quizInputText.trim()
    ? quizInputText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const isLargeQuizPayloadWarning = quizWordCount > 4000 && !chapterScope.trim();

  const fcWordCount = fcTextPayload.trim()
    ? fcTextPayload.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const isLargeFcPayloadWarning = fcWordCount > 4000 && !fcChapterScope.trim();

  // -------------------------------------------------------------
  // Multi-Source Management
  // -------------------------------------------------------------
  const PAYWALL_ALERT_TEXT =
    "🔒 ဤ DOI စာတမ်းသည် Closed-Access (Paywalled Journal) ဖြစ်နေပါသည်။ စာတမ်းတစ်စောင်လုံးမှ မေးခွန်း ၁၀-၂၀ ပုဒ် အပြည့်အစုံ ရရှိရန် UoPeople Library မှ ဒေါင်းလုဒ်လုပ်ထားသော PDF ကို 'READING NOTES / PDF DROP-ZONE' တွင် တင်ပေးပါရန်။";

  const handleAddSource = () => {
    if (!currentSourceInput.trim()) return;

    const potential = currentSourceInput
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const merged = [...sources];
    let normalizedNotice = false;
    for (const item of potential) {
      const { normalizedUrl, wasDetailLink } = normalizeAcademicSourceUrl(item, chapterScope);
      if (wasDetailLink) normalizedNotice = true;
      if (merged.length < 5 && !merged.includes(normalizedUrl)) {
        merged.push(normalizedUrl);
        setCurrentSourceUrl(normalizedUrl);

        if (isPublicOpenAccessDomain(normalizedUrl) || !/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i.test(normalizedUrl)) {
          setPaywallNotice(null);
          setSourcePayload(null);
        } else {
          // Proactively probe DOI paywall status in the background (strictly for DOIs not on public domains)
          resolveAcademicPayload(normalizedUrl, chapterScope)
            .then((resolved) => {
              setSourcePayload(resolved);
              const extractedWords = resolved.fullText.trim()
                ? resolved.fullText.trim().split(/\s+/).length
                : 0;
              if (
                resolved.sourceType === 'paywalled' &&
                extractedWords < 1000 &&
                !isPublicOpenAccessDomain(normalizedUrl)
              ) {
                setPaywallNotice(PAYWALL_ALERT_TEXT);
              } else {
                setPaywallNotice(null);
              }
            })
            .catch(() => {});
        }
      }
    }

    setSources(merged);
    setCurrentSourceInput('');
    if (normalizedNotice) {
      showToast('✨ OpenStax Book Link ကို Chapter ဖတ်ရှုနိုင်သော Web View သို့ အလိုအလျောက် ပြောင်းလဲပေးထားပါသည်');
    }
  };

  const handleRemoveSource = (idxToRemove: number) => {
    setSources((prev) => {
      const next = prev.filter((_, i) => i !== idxToRemove);
      if (next.length === 0 || next.every((u) => isPublicOpenAccessDomain(u) || !/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i.test(u))) {
        setPaywallNotice(null);
        setSourcePayload(null);
      }
      return next;
    });
  };

  const loadSampleSources = () => {
    setSources([
      'https://openstax.org/books/college-algebra/pages/1-1-real-numbers-algebra-essentials',
      'https://doi.org/10.1016/j.jbusres.2021.03.042',
      'https://openstax.org/books/principles-management/pages/7-1-overview-of-managerial-decision-making',
    ]);
    setSelectedWeek('Week 3');
    setQuizInputText(
      'UoPeople Unit 3 Focus: Organizational Decision-Making under Bounded Rationality, Herbert Simon Heuristics, Confirmation Bias, and Groupthink suppression of critical dissent.'
    );
  };

  const handlePdfFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'quiz' | 'flashcard' = 'quiz'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');
      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const textChunks: string[] = [];
      const maxPages = Math.min(pdfDoc.numPages, 45);
      for (let p = 1; p <= maxPages; p++) {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        const pageStrings = content.items
          .map((item: unknown) =>
            typeof item === 'object' && item !== null && 'str' in item
              ? String((item as { str?: unknown }).str || '')
              : ''
          )
          .filter((s: string) => s.trim().length > 0);
        if (pageStrings.length > 0) {
          textChunks.push(pageStrings.join(' '));
        }
      }
      const rawExtractedText = textChunks.join('\n\n');
      const extractedText = stripTextbookNoise(rawExtractedText);
      if (target === 'flashcard') {
        setFcTextPayload((prev) => (prev ? `${prev}\n\n${extractedText}` : extractedText));
      } else {
        setQuizInputText((prev) =>
          prev ? `${prev}\n\n[UPLOADED PDF CONTENT]:\n${extractedText}` : extractedText
        );
      }
      setPaywallNotice(null);
      showToast(`Uploaded & cleaned ${file.name} (${extractedText.split(/\s+/).filter(Boolean).length} words)`);
    } catch (err) {
      console.error('PDF parsing error:', err);
      showToast('Failed to parse PDF file. Please ensure it contains selectable text.');
    }
  };

  // -------------------------------------------------------------
  // MODE 1: Practice Quiz Generation Engine
  // -------------------------------------------------------------
  const handleGenerateQuiz = async (isNewAttempt = false) => {
    // Also capture any URL currently typed in the source input field
    const pendingInputUrls = currentSourceInput.trim()
      ? currentSourceInput
          .split(/[,\n]+/)
          .map((s) => normalizeAcademicSourceUrl(s.trim(), chapterScope).normalizedUrl)
          .filter(Boolean)
      : [];
    const activeSources = Array.from(new Set([...sources, ...pendingInputUrls])).slice(0, 5);
    if (pendingInputUrls.length > 0) {
      setSources(activeSources);
      setCurrentSourceInput('');
    }

    if (activeSources.length === 0 && !quizInputText.trim()) {
      const emptyMsg = 'ကျေးဇူးပြု၍ စာအုပ် Link သို့မဟုတ် Reading Notes ထည့်သွင်းပေးပါ။';
      setQuizGenError(emptyMsg);
      showToast(emptyMsg);
      return;
    }

    setQuizGenError(null);
    setIsGenerating(true);
    setErrorCardsAddedBadge(null);

    try {
      let directExtractedContext = '';
      let useSearchGrounding = false;
      let linkFetchError: string | null = null;

      if (activeSources.length > 0) {
        try {
          const fetchedChunks: string[] = [];
          let foundPaywalledDoi = false;
          for (const srcUrl of activeSources) {
            setCurrentSourceUrl(srcUrl);
            try {
              const resolved = await resolveAcademicPayload(srcUrl, chapterScope);
              setSourcePayload(resolved);
              const wordCount = resolved.fullText.trim()
                ? resolved.fullText.trim().split(/\s+/).length
                : 0;

              if (
                resolved.sourceType === 'paywalled' &&
                wordCount < 1000 &&
                !isPublicOpenAccessDomain(srcUrl)
              ) {
                foundPaywalledDoi = true;
                setPaywallNotice(PAYWALL_ALERT_TEXT);
              }

              if (resolved.fullText && resolved.fullText.trim().length > 60) {
                fetchedChunks.push(`### [SOURCE: ${resolved.title || srcUrl}]\n${resolved.fullText}`);
              }
            } catch (fetchErr: any) {
              linkFetchError = fetchErr?.message || null;
              // Fallback to batchIngestSources
              const fallbackIngest = await batchIngestSources([srcUrl], chapterScope);
              if (fallbackIngest.hasSubstantialContext) {
                fetchedChunks.push(fallbackIngest.consolidatedContext);
                linkFetchError = null;
              }
            }
          }
          if (!foundPaywalledDoi) {
            setPaywallNotice(null);
          }

          if (fetchedChunks.length > 0) {
            directExtractedContext = fetchedChunks.join('\n\n---\n\n');
            useSearchGrounding = false;
          } else {
            useSearchGrounding = true;
          }
        } catch (err: any) {
          linkFetchError = err?.message || null;
          useSearchGrounding = true;
        }
      }

      const rawMergedContent = [
        directExtractedContext ? directExtractedContext : '',
        quizInputText.trim() ? `STUDENT SUPPLEMENTARY NOTES:\n${quizInputText.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      if (!rawMergedContent.trim()) {
        const emptyErrMsg =
          linkFetchError || 'ကျေးဇူးပြု၍ စာအုပ် Link သို့မဟုတ် Reading Notes ထည့်သွင်းပေးပါ။';
        setQuizGenError(emptyErrMsg);
        showToast(emptyErrMsg);
        setIsGenerating(false);
        return;
      }

      const scopedMergedContent = preprocessChapterScopedPayload(
        rawMergedContent,
        chapterScope,
        5000
      );

      const priorQuestions = isNewAttempt ? quizzes.map((q) => q.question) : [];
      const targetScope = chapterScope.trim() || `${selectedWeek} Course Material`;
      const sourceHints =
        useSearchGrounding && activeSources.length > 0
          ? `\nREFERENCED SOURCES (Synthesize concepts accurately):\n${activeSources.map((s, idx) => `[${idx + 1}] ${s}`).join('\n')}\n`
          : '';
      const exclusionBlock =
        isNewAttempt && priorQuestions.length > 0
          ? `\nDO NOT REPEAT ANY OF THESE PREVIOUS QUESTIONS:\n${priorQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}\n`
          : '';

      const systemInstruction = `You are a distinguished university professor designing an authentic examination for University of the People (UoPeople).
Output ONLY a raw, valid JSON array (no Markdown code fences, no preamble).
Every question MUST be a 4-choice MCQ ("options" array with EXACTLY 4 distinct plausible options A, B, C, D) and valid "correctIndex" (0, 1, 2, or 3).
${
  examStyle === 'uopeople'
    ? 'Include UoPeople-style conceptual traps, scenario applications, and negative-constraint ("All of the following are true EXCEPT..." / "...does NOT...") distractors that look plausible to superficial readers.'
    : 'Focus on clear, direct conceptual comprehension and theoretical application.'
}
Use LaTeX syntax wrapped in single dollar signs ($...$) for mathematical formulas, numbers, or statistical symbols.
Schema for each item:
[
  {
    "id": "q1",
    "questionType": "mcq" | "except",
    "question": "Rigorous 4-choice question stem testing theory, methodology, or application...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Detailed rationale citing the specific course theory and contrasting why each distractor trap is incorrect.",
    "realWorldApplication": "1 concise sentence demonstrating practical real-world relevance."
  }
]`;

      const quizPrompt = `Construct EXACTLY ${effectiveQuestionCount} rigorous 4-choice MCQ questions for ${selectedWeek}.
Scope / Chapter Focus: ${targetScope}
Exam Style: ${examStyle === 'uopeople' ? 'UoPeople Tricky (Distractor Traps & Applied Scenarios)' : 'Standard Academic Comprehension'}
${sourceHints}${exclusionBlock}
SOURCE MATERIAL:
"""
${scopedMergedContent}
"""`;

      const rawRes = await executeGeminiRequest(
        quizPrompt,
        'light',
        systemInstruction,
        undefined,
        3800,
        undefined,
        true,
        'application/json'
      );

      setActiveModeBadge('⚡ Active Dynamic Free-Tier Cascade');

      const rawQuestions = safeExtractJsonArray<RawGeneratedQuizItem>(rawRes);

      const validAcademicList = rawQuestions.filter((q) => {
        const stem = sanitizeAcademicQuestionStem(q?.question || q?.q || '');
        const hasFourOptions = Array.isArray(q?.options) && q.options.length >= 2;
        return stem.length > 5 && hasFourOptions && !isForbiddenMetaQuestion(stem);
      });

      const finalRawQuestions = (validAcademicList.length > 0 ? validAcademicList : rawQuestions).map(
        (q, idx) => ({
          id: q.id || `uop-raw-${Date.now()}-${idx}`,
          question: q.question || q.q || '',
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          questionType: q.questionType || 'mcq',
          explanation: q.explanation || 'Grounded in course theory.',
          realWorldApplication: q.realWorldApplication || '',
        })
      );
      const randomizedQuestions = shuffleQuizOptions(finalRawQuestions);

      if (randomizedQuestions.length > 0) {
        const formatted: QuizQuestion[] = randomizedQuestions.map((q, i) => ({
          id: q.id || `uop-quiz-${Date.now()}-${i}`,
          question: sanitizeAcademicQuestionStem(q.question),
          options: q.options,
          correctIndex: q.correctIndex,
          questionType: q.questionType,
          sectionHeader: chapterScope.trim()
            ? `${selectedWeek} • ${chapterScope.trim()}`
            : selectedWeek,
          explanation: q.explanation,
          realWorldApplication: q.realWorldApplication,
          selectedAnswer: undefined,
          userAnswerIndex: undefined,
          isCorrect: undefined,
        }));

        setDailyUsage(incrementDailyUsage(1200));

        clearQuizzes();
        addQuizzes(formatted);

        const newSessionId = `session-${Date.now()}`;
        setCurrentSessionId(newSessionId);
        setCurrentAttemptNumber(isNewAttempt ? currentAttemptNumber + 1 : 1);

        // Reset Quiz runner & timer
        setCurrentQuizIndex(0);
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
        setQuizScore(0);
        setUserAnswers({});
        setQuizElapsedSeconds(0);
        setQuizSubView('runner');
        setShowGeneratorPanel(false);

        confetti({ particleCount: 70, spread: 60 });
        showToast(
          language === 'my'
            ? `မေးခွန်း ${formatted.length} ခု အောင်မြင်စွာ ထုတ်ယူပြီးပါပြီ!`
            : `Successfully generated ${formatted.length} ${
                examStyle === 'uopeople' ? 'UoPeople tricky' : 'standard'
              } questions!`
        );
      } else {
        setQuizGenError(
          language === 'my'
            ? 'AI ထံမှ မှန်ကန်သော မေးခွန်းပုံစံ မရရှိခဲ့ပါ။ ထပ်မံကြိုးစားပေးပါရန်။'
            : 'AI did not return valid quiz questions. Please check sources and try again.'
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to generate quiz questions';
      setQuizGenError(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // Quiz Interaction Handlers
  // -------------------------------------------------------------
  const handleSelectQuizOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
    setIsAnswerSubmitted(true);
    setUserAnswers((prev) => ({ ...prev, [currentQuizIndex]: index }));

    const currentQuiz = quizzes[currentQuizIndex];
    if (currentQuiz) {
      const isCorrect = index === currentQuiz.correctIndex;
      if (isCorrect) {
        setQuizScore((prev) => prev + 1);
      }
      currentQuiz.selectedAnswer = index;
      currentQuiz.userAnswerIndex = index;
      currentQuiz.isCorrect = isCorrect;
    }
  };

  const handleNextQuizQuestion = () => {
    if (currentQuizIndex < quizzes.length - 1) {
      const nextIdx = currentQuizIndex + 1;
      setCurrentQuizIndex(nextIdx);
      const prevAnswer = userAnswers[nextIdx];
      if (prevAnswer !== undefined) {
        setSelectedOption(prevAnswer);
        setIsAnswerSubmitted(true);
      } else {
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
      }
    } else {
      finalizeQuizSession();
    }
  };

  const handlePrevQuizQuestion = () => {
    if (currentQuizIndex > 0) {
      const prevIdx = currentQuizIndex - 1;
      setCurrentQuizIndex(prevIdx);
      const prevAnswer = userAnswers[prevIdx];
      if (prevAnswer !== undefined) {
        setSelectedOption(prevAnswer);
        setIsAnswerSubmitted(true);
      } else {
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
      }
    }
  };

  const finalizeQuizSession = () => {
    recordStudyActivity('flashcards');
    setQuizSubView('review');
    confetti({ particleCount: 100, spread: 75 });

    const finalScore = quizzes.reduce((acc, q, idx) => {
      const ans = userAnswers[idx];
      return ans === q.correctIndex ? acc + 1 : acc;
    }, 0);

    const questionsWithAnswers: QuizQuestion[] = quizzes.map((q, idx) => ({
      ...q,
      selectedAnswer: userAnswers[idx],
      userAnswerIndex: userAnswers[idx],
      isCorrect: userAnswers[idx] === q.correctIndex,
    }));

    const sourceTitle =
      sources.length > 0
        ? sources[0].replace(/^https?:\/\/(www\.)?/, '').slice(0, 45) +
          (sources.length > 1 ? ` (+${sources.length - 1} more)` : '')
        : quizInputText.slice(0, 40) + '...';

    const sessionRecord: QuizSessionRecord = {
      id: currentSessionId || `session-${Date.now()}`,
      weekTag: selectedWeek,
      sourceTitle,
      sources,
      totalQuestions: quizzes.length,
      score: finalScore,
      attemptsCount: currentAttemptNumber,
      createdAt: Date.now(),
      examStyle,
      questions: questionsWithAnswers,
    };

    const existingIndex = savedSessions.findIndex((s) => s.id === sessionRecord.id);
    let updated: QuizSessionRecord[];
    if (existingIndex >= 0) {
      updated = [...savedSessions];
      updated[existingIndex] = sessionRecord;
    } else {
      updated = [sessionRecord, ...savedSessions];
    }

    persistSessions(updated, selectedWeek);
  };

  // -------------------------------------------------------------
  // METHOD (B): Quiz Error Collector (Zero Gemini API Cost)
  // -------------------------------------------------------------
  const handleSendMistakesToErrorDeck = () => {
    const questionsWithChoices: QuizQuestion[] = quizzes.map((q, idx) => ({
      ...q,
      selectedAnswer: userAnswers[idx],
      userAnswerIndex: userAnswers[idx],
    }));

    const { updatedDeck, addedCount, skippedDuplicates } = collectQuizErrorsToDeck(
      questionsWithChoices,
      selectedWeek,
      flashcardDeck
    );

    updateFlashcardDeck(updatedDeck);
    setErrorCardsAddedBadge(addedCount);

    if (addedCount > 0) {
      confetti({ particleCount: 60, spread: 55 });
      showToast(
        `✅ မှားသွားသော မေးခွန်း (${addedCount}) ပုဒ်ကို Flashcard Error Deck ထဲသို့ ထည့်သွင်းပြီးပါပြီ!`
      );
    } else if (skippedDuplicates > 0) {
      showToast(`ℹ️ ဤမှားသောမေးခွန်းများသည် Flashcard Deck ထဲတွင် ရှိပြီးသားဖြစ်ပါသည်။`);
    } else {
      showToast(`🎉 အမှားမရှိပါ! အားလုံးမှန်ကန်ပါသည်။`);
    }
  };

  const handleAddSingleQuestionToDeck = (q: QuizQuestion) => {
    const questionWithWrongMarker: QuizQuestion = {
      ...q,
      selectedAnswer: -1,
      userAnswerIndex: -1,
    };
    const { updatedDeck, addedCount } = collectQuizErrorsToDeck(
      [questionWithWrongMarker],
      selectedWeek,
      flashcardDeck
    );
    updateFlashcardDeck(updatedDeck);
    if (addedCount > 0) {
      showToast('📥 ဤမေးခွန်းကို Flashcard Error Deck ထဲသို့ ထည့်သွင်းပြီးပါပြီ!');
    } else {
      showToast('ℹ️ ဤမေးခွန်းသည် Flashcard Deck ထဲတွင် ရှိပြီးသားဖြစ်ပါသည်။');
    }
  };

  // -------------------------------------------------------------
  // Review Mode Actions
  // -------------------------------------------------------------
  const handleRetestMissed = () => {
    const missed = quizzes.filter((q, idx) => userAnswers[idx] !== q.correctIndex);
    if (missed.length === 0) {
      showToast(
        language === 'my'
          ? 'ဂုဏ်ယူပါသည်! အားလုံးမှန်ကန်သဖြင့် အမှားမရှိပါ'
          : 'Perfect score! There are no missed questions to retest.'
      );
      return;
    }

    const resetMissed: QuizQuestion[] = missed.map((q, i) => ({
      ...q,
      id: `retest-${Date.now()}-${i}`,
      selectedAnswer: undefined,
      userAnswerIndex: undefined,
      isCorrect: undefined,
    }));

    clearQuizzes();
    addQuizzes(resetMissed);
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setQuizScore(0);
    setUserAnswers({});
    setQuizElapsedSeconds(0);
    setErrorCardsAddedBadge(null);
    setCurrentAttemptNumber((prev) => prev + 1);
    setQuizSubView('runner');

    showToast(
      language === 'my'
        ? `မှားယွင်းခဲ့သော မေးခွန်း ${resetMissed.length} ခုအား ပြန်လည်ဖြေဆိုပါမည်`
        : `Launching focused re-test on ${resetMissed.length} missed questions.`
    );
  };

  const handleRetakeFullQuiz = () => {
    const resetAll: QuizQuestion[] = quizzes.map((q) => ({
      ...q,
      selectedAnswer: undefined,
      userAnswerIndex: undefined,
      isCorrect: undefined,
    }));
    clearQuizzes();
    addQuizzes(resetAll);
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setQuizScore(0);
    setUserAnswers({});
    setQuizElapsedSeconds(0);
    setErrorCardsAddedBadge(null);
    setCurrentAttemptNumber((prev) => prev + 1);
    setQuizSubView('runner');
  };

  const handleGenerateFreshAttempt = () => {
    handleGenerateQuiz(true);
  };

  // -------------------------------------------------------------
  // Term Data Reset
  // -------------------------------------------------------------
  const handleConfirmResetAllTermData = () => {
    localStorage.removeItem(STORAGE_KEY);
    ACADEMIC_WEEKS.forEach((w) => {
      localStorage.removeItem(getQuizStorageKeyForWeek(w));
    });
    clearPersistedTabState(SUITE_PERSISTENCE_KEY);
    setSavedSessions([]);
    clearQuizzes();
    setSources([]);
    setCurrentSourceInput('');
    setChapterScope('');
    setQuizInputText('');
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setQuizScore(0);
    setUserAnswers({});
    setQuizElapsedSeconds(0);
    setCurrentSessionId(null);
    setShowResetConfirmModal(false);
    setQuizSubView('runner');
    setShowGeneratorPanel(true);
    showToast(
      language === 'my'
        ? 'Term ပြီးဆုံးသဖြင့် စာမေးပွဲနှင့် Quiz မှတ်တမ်းများ အားလုံးကို အောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ'
        : 'All term quiz history and local records successfully wiped.'
    );
  };

  const handleLoadPastSession = (session: QuizSessionRecord) => {
    clearQuizzes();
    addQuizzes(session.questions);
    setSelectedWeek(session.weekTag);
    setSources(session.sources || []);
    setCurrentSessionId(session.id);
    setCurrentAttemptNumber(session.attemptsCount || 1);
    setErrorCardsAddedBadge(null);

    const reconstructedAnswers: Record<number, number> = {};
    session.questions.forEach((q, idx) => {
      const ans = q.selectedAnswer !== undefined ? q.selectedAnswer : q.userAnswerIndex;
      if (ans !== undefined) {
        reconstructedAnswers[idx] = ans;
      }
    });
    setUserAnswers(reconstructedAnswers);
    setQuizScore(session.score || 0);

    setQuizSubView('review');
    showToast(`Loaded ${session.weekTag} Quiz Session (${session.totalQuestions} Questions)`);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSessions.filter((s) => s.id !== sessionId);
    persistSessions(updated);
    showToast('Quiz session deleted');
  };

  // -------------------------------------------------------------
  // MODE 2: Method (A) Direct High-Yield Flashcard Generator
  // -------------------------------------------------------------
  const handleGenerateDirectFlashcards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fcSourceInput.trim() && !fcTextPayload.trim()) {
      setFcGenError('ကျေးဇူးပြု၍ စာအုပ် Link/DOI သို့မဟုတ် စာသား ထည့်သွင်းပေးပါ။');
      return;
    }

    setIsGeneratingDirectCards(true);
    setFcGenError(null);

    try {
      let combinedText = fcTextPayload.trim();

      if (fcSourceInput.trim()) {
        const urls = fcSourceInput
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const ingested = await batchIngestSources(urls);
        if (ingested.consolidatedContext) {
          combinedText = [ingested.consolidatedContext, combinedText].filter(Boolean).join('\n\n');
        }
      }

      const newItems = await generateDirectFlashcards({
        textPayload: combinedText || fcSourceInput.trim(),
        cardCount: fcCardCount,
        sourceWeek: fcWeekTag,
        chapterScope: fcChapterScope.trim(),
      });

      // Deduplicate and safely APPEND new SM-2 cards without touching existing Quiz Error Deck or review histories
      const existingFronts = new Set(flashcardDeck.map((c) => c.front.trim().toLowerCase()));
      const today = getTodayDateString();
      const uniqueNew: FlashcardItem[] = newItems
        .filter((item) => !existingFronts.has(item.front.trim().toLowerCase()))
        .map((item) => {
          const defaultSm2State: SM2CardState = {
            interval: 1,
            repetition: 0,
            easeFactor: 2.5,
            nextReviewDate: today,
            history: [],
          };
          return {
            ...item,
            ...defaultSm2State,
          };
        });

      const updatedDeck = [...flashcardDeck, ...uniqueNew];
      updateFlashcardDeck(updatedDeck);

      // Sync with AppContext flashcards for backup compatibility
      addAppContextFlashcards(
        uniqueNew.map((c) => ({
          front: c.front,
          back: c.back,
          concept: `${c.sourceWeek} • Direct Concept`,
        }))
      );

      setDailyUsage(getDailyUsage());
      setShowDirectFlashcardModal(false);
      setFcSourceInput('');
      setFcTextPayload('');
      setDeckFilter('due');
      setIsFlipped(false);

      confetti({ particleCount: 80, spread: 65 });
      showToast(`✨ Flashcard အသစ် (${uniqueNew.length}) ကတ် တိုက်ရိုက်ထုတ်ယူပြီးပါပြီ!`);
    } catch (err: unknown) {
      setFcGenError(
        err instanceof Error ? err.message : 'Flashcard ထုတ်ယူရာတွင် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်။'
      );
    } finally {
      setIsGeneratingDirectCards(false);
    }
  };

  // -------------------------------------------------------------
  // MODE 2: SuperMemo SM-2 Active Recall Grading Handler
  // -------------------------------------------------------------
  const handleSM2Grade = (numericGrade: NumericReviewGrade) => {
    if (!currentCard) return;

    const updatedCard = calculateSM2ForItem(currentCard, numericGrade);
    const updatedDeck = flashcardDeck.map((c) => (c.id === currentCard.id ? updatedCard : c));
    updateFlashcardDeck(updatedDeck);
    recordStudyActivity('flashcards');
    setIsFlipped(false);

    // Check remaining cards in active filter
    const nextDueList =
      deckFilter === 'due'
        ? updatedDeck.filter(isCardDue)
        : deckFilter === 'error'
        ? updatedDeck.filter((c) => c.source === 'quiz_error')
        : updatedDeck;

    if (nextDueList.length === 0) {
      setCurrentCardIndex(0);
      confetti({ particleCount: 90, spread: 70 });
    } else if (currentCardIndex >= nextDueList.length) {
      setCurrentCardIndex(0);
    }
  };

  const handleCreateManualCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    const today = getTodayDateString();
    const manualItem: FlashcardItem = {
      id: `fc-manual-${Date.now()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      source: 'direct_generation',
      sourceWeek: newConcept.trim() || selectedWeek,
      interval: 1,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: today,
      history: [],
      concept: newConcept.trim() || selectedWeek,
    };
    updateFlashcardDeck([manualItem, ...flashcardDeck]);
    setNewFront('');
    setNewBack('');
    setNewConcept('');
    setShowAddForm(false);
    showToast('✅ Flashcard အသစ် ထည့်သွင်းပြီးပါပြီ');
  };

  const handleDeleteFlashcardItem = (id: string) => {
    const updated = flashcardDeck.filter((c) => c.id !== id);
    updateFlashcardDeck(updated);
    if (currentCardIndex >= updated.length && currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
    }
    setIsFlipped(false);
    showToast('🗑️ Flashcard ဖျက်ပြီးပါပြီ');
  };

  const handleConfirmClearAllFlashcards = () => {
    updateFlashcardDeck([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowClearAllCardsModal(false);
    showToast(
      language === 'my'
        ? '🗑️ Flashcard ကတ်အားလုံးကို ရှင်းလင်းပြီးပါပြီ'
        : 'All flashcards cleared from deck'
    );
  };

  const currentQuiz = quizzes[currentQuizIndex];
  const incorrectCount = quizzes.filter((q, idx) => userAnswers[idx] !== q.correctIndex).length;
  const filteredSessions =
    historyWeekFilter === 'all'
      ? savedSessions
      : savedSessions.filter((s) => s.weekTag === historyWeekFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-violet-600 text-white text-xs sm:text-sm font-bold shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-violet-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Auto-Cascade Notification Toast */}
      {cascadeToast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-amber-600 text-white text-xs font-bold shadow-2xl flex items-center space-x-2 animate-in slide-in-from-top-4 border border-amber-400/40">
          <Zap className="w-4 h-4 text-amber-200 animate-pulse" />
          <span>{cascadeToast.message}</span>
        </div>
      )}

      {/* Header & Distinct Workspace Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <Brain className="w-8 h-8 text-violet-400" />
            <span>{t.flashcards.title}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {language === 'my'
              ? 'Mode A: UoPeople စာမေးပွဲ လေ့ကျင့်ခန်း (Practice Quiz) နှင့် Mode B: SuperMemo SM-2 Spaced Repetition Flashcards (Direct Generator + Quiz Error Deck)'
              : 'Decoupled Exam Calibration Quiz & Token-Frugal SuperMemo SM-2 Flashcard Engine.'}
          </p>
        </div>

        {/* Distinct Top-Level Mode Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl self-start lg:self-auto shrink-0 shadow-lg gap-1">
          <button
            onClick={() => setActiveMode('quiz')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeMode === 'quiz'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>🎯 Exam Practice Quiz</span>
          </button>
          <button
            onClick={() => {
              setActiveMode('flashcards');
              setIsFlipped(false);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeMode === 'flashcards'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🗂️ Spaced Repetition Flashcards (SM-2)</span>
            {dueCardsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                {dueCardsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================
          MODE 1: EXAM PRACTICE QUIZ WORKSTATION
         ======================================================== */}
      {activeMode === 'quiz' && (
        <div className="space-y-6">
          {/* Sub-Navigation & Term Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setQuizSubView('runner')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  quizSubView === 'runner'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Active Quiz ({quizzes.length})</span>
              </button>

              <button
                disabled={quizzes.length === 0}
                onClick={() => setQuizSubView('review')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer ${
                  quizSubView === 'review'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Result &amp; Review</span>
              </button>

              <button
                onClick={() => setQuizSubView('history')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  quizSubView === 'history'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Weekly History ({savedSessions.length})</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowGeneratorPanel(!showGeneratorPanel)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  showGeneratorPanel
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showGeneratorPanel ? 'Close Quiz Setup' : '+ New Quiz Setup'}</span>
              </button>

              <button
                onClick={() => setShowResetConfirmModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 hover:border-rose-500/50 transition-colors flex items-center space-x-1.5 cursor-pointer"
                title="Reset All Term Data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Term</span>
              </button>
            </div>
          </div>

          {/* Privacy & Auto-Cascade Resilience Status Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-start space-x-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="text-slate-200 font-semibold">🔒 LocalStorage Namespace:</span>{' '}
                `akari_saved_quizzes_{selectedWeek.replace(/\s+/g, '_')}` · မှားသွားသော မေးခွန်းများကို Gemini Token လုံးဝမကုန်ဘဲ Error Deck သို့ တိုက်ရိုက် ပို့နိုင်ပါသည်။
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                📊 ယနေ့ ထုတ်ယူမှု: {dailyUsage.requestsToday} ကြိမ်
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-950/60 text-violet-300 border border-violet-500/30">
                {activeModeBadge}
              </span>
            </div>
          </div>

          {/* ========================================================
              PRACTICE QUIZ GENERATOR PANEL (PURE QUIZ SETUP ONLY)
             ======================================================== */}
          {showGeneratorPanel && (
            <div className="p-6 sm:p-7 rounded-3xl bg-slate-900 border border-violet-500/30 space-y-6 animate-in fade-in shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-violet-400 text-xs font-extrabold uppercase tracking-wider">
                    <Flame className="w-4 h-4" />
                    <span>🎯 Exam Practice Quiz Generator (4-Choice MCQs &amp; Distractor Traps)</span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    {language === 'my'
                      ? 'DOI, OpenStax URL သို့မဟုတ် PDF စာ안များမှ UoPeople စာမေးပွဲပုံစံ 4-choice MCQ မေးခွန်းများ (5, 10, 15, 20) ထုတ်ယူပါ။'
                      : 'Generate calibrated 4-choice MCQs with distractor traps from DOIs, OpenStax URLs, or uploaded PDFs.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadSampleSources}
                  className="px-3.5 py-1.5 rounded-xl bg-violet-950/60 text-violet-300 border border-violet-500/30 hover:bg-violet-900 text-xs font-semibold shrink-0 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>+ OpenStax &amp; DOI နမူနာ ထည့်မည်</span>
                </button>
              </div>

              {quizGenError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{quizGenError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerKeyReplacementPrompt(() => handleGenerateQuiz(false))}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shrink-0 flex items-center space-x-1 cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>Switch Key</span>
                  </button>
                </div>
              )}

              {/* Source Ingestion Pills */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-violet-400" />
                    <span>Academic Sources / DOI / OpenStax URL (အများဆုံး ၅ ခု)</span>
                  </span>
                  <span className={sources.length === 5 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    ({sources.length} / 5 Sources Added)
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      disabled={sources.length >= 5}
                      value={currentSourceInput}
                      onChange={(e) => setCurrentSourceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSource();
                        }
                      }}
                      placeholder="e.g. https://openstax.org/books/... or doi.org/10.1016/..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={sources.length >= 5 || !currentSourceInput.trim()}
                    onClick={handleAddSource}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition-all shrink-0 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Source</span>
                  </button>
                </div>

                {sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sources.map((src, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-200 text-xs max-w-full group"
                      >
                        <Globe className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="truncate max-w-[280px] sm:max-w-[420px] font-mono text-[11px]" title={src}>
                          {src}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(idx)}
                          className="text-violet-400 hover:text-rose-400 ml-1 p-0.5 rounded transition-colors cursor-pointer"
                          title="Remove source"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PDF Drop-Zone & Reading Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                    <span>Reading Notes / PDF Drop-Zone</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-violet-950/60 border border-violet-500/30 text-violet-300 hover:bg-violet-900 text-[11px] font-semibold cursor-pointer transition-colors">
                      <Upload className="w-3 h-3" />
                      <span>Upload PDF</span>
                      <input
                        ref={pdfFileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handlePdfFileUpload(e, 'quiz')}
                        className="hidden"
                      />
                    </label>
                    <span className="text-slate-500 text-[11px]">
                      {quizInputText.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                </div>

                {sourcePayload?.sourceType === 'paywalled' &&
                  paywallNotice &&
                  !isPublicOpenAccessDomain(currentSourceUrl) && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-start space-x-2.5 leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span className="font-semibold">{paywallNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          dropZoneTextareaRef.current?.focus();
                          pdfFileInputRef.current?.click();
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer transition-colors text-xs shrink-0 self-start sm:self-center"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        <span>[ 📂 Select PDF File ]</span>
                      </button>
                    </div>
                  )}

                <textarea
                  ref={dropZoneTextareaRef}
                  rows={4}
                  value={quizInputText}
                  onChange={(e) => setQuizInputText(e.target.value)}
                  placeholder="Paste textbook excerpt, lecture slides, formulas, or specific concept notes..."
                  className="w-full p-3.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 leading-relaxed font-sans"
                />

                {/* Static Helper Callout */}
                <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/25 text-indigo-200/90 text-xs leading-relaxed">
                  💡 အကြံပြုချက်: Textbook တစ်အုပ်လုံးထက် သင်လေ့လာလိုသည့် Chapter (ဥပမာ- Chapter 2) သို့မဟုတ် ခေါင်းစဉ်ခွဲကို သီးသန့် ထည့်သွင်းခြင်းက မေးခွန်းထုတ်ယူမှု အလွန်မြန်ဆန်စေပြီး Daily Quota ကို အများဆုံး ချွေတာနိုင်ပါသည်။
                </div>
              </div>

              {/* Chapter / Section Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Search className="w-3.5 h-3.5 text-violet-400" />
                  <span>Chapter Filter / Section Scope (အခန်း သို့မဟုတ် ခေါင်းစဉ်ခွဲ သတ်မှတ်ရန် - Optional)</span>
                </label>
                <input
                  type="text"
                  value={chapterScope}
                  onChange={(e) => setChapterScope(e.target.value)}
                  placeholder="e.g. Chapter 2, Section 2.1, or Bounded Rationality..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Volume & Exam Caliber Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {/* 1. Academic Week Tag */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-violet-400" />
                    <span>Academic Week</span>
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-violet-500"
                  >
                    {ACADEMIC_WEEKS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Question Volume Selector: 5, 10, 15, or 20 */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-violet-400" />
                    <span>Question Volume ({effectiveQuestionCount} Qs)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1.5">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setQuestionCountPreset(num);
                          setIsCustomCount(false);
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer flex-1 ${
                          !isCustomCount && questionCountPreset === num
                            ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/30'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {num} Qs
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Examination Style */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>Exam Calibration</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setExamStyle('uopeople')}
                      className={`p-2.5 rounded-xl text-left border transition-all flex flex-col cursor-pointer ${
                        examStyle === 'uopeople'
                          ? 'bg-violet-950/40 text-violet-200 border-violet-500 ring-1 ring-violet-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-xs text-white">🎓 UoPeople Tricky</span>
                      <span className="text-[10px] text-slate-400">Negative &amp; distractor traps</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExamStyle('standard')}
                      className={`p-2.5 rounded-xl text-left border transition-all flex flex-col cursor-pointer ${
                        examStyle === 'standard'
                          ? 'bg-violet-950/40 text-violet-200 border-violet-500 ring-1 ring-violet-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-xs text-white">📝 Standard</span>
                      <span className="text-[10px] text-slate-400">Direct comprehension</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Payload Size Warning (>4,000 Words without Chapter Filter) */}
              {isLargeQuizPayloadWarning && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-start space-x-3 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    ⚠️ စာသားပမာဏ များပြားနေပါသည် (Large Payload Detected): တိကျသော မေးခွန်းများရရှိရန်နှင့် အမှားစစ်ဆေးရာတွင် စာအုပ်ထဲ လွယ်ကူစွာ ပြန်ရှာနိုင်ရန် 'Chapter Filter' တွင် အခန်းသတ်မှတ်ပေးပါ (သို့မဟုတ်) လိုအပ်သော စာပိုဒ်ကိုသာ ကူးယူထည့်သွင်းပေးပါ။
                  </span>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  Target:{' '}
                  <span className="font-bold text-white">{effectiveQuestionCount} MCQs</span> for{' '}
                  <span className="text-violet-300 font-semibold">{selectedWeek}</span>
                  {chapterScope.trim() && (
                    <span className="ml-1 text-emerald-400 font-semibold">
                      ({chapterScope.trim()})
                    </span>
                  )}
                </div>

                <button
                  disabled={
                    isGenerating ||
                    (sources.length === 0 && !currentSourceInput.trim() && !quizInputText.trim())
                  }
                  onClick={() => handleGenerateQuiz(false)}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>
                    {isGenerating
                      ? '⚡ မေးခွန်းများ ထုတ်ယူနေပါသည်...'
                      : `Generate ${effectiveQuestionCount} Practice Quiz Questions`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              SUB-VIEW 1: ACTIVE QUIZ RUNNER
             ======================================================== */}
          {quizSubView === 'runner' && (
            <div>
              {quizzes.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 space-y-4 shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto">
                    <Target className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {language === 'my'
                      ? 'လက်ရှိတွင် ဖြေဆိုရန် Practice Quiz မရှိသေးပါ'
                      : 'No Active Practice Quiz Questions'}
                  </h3>
                  <p className="text-xs max-w-md mx-auto text-slate-400 leading-relaxed">
                    {language === 'my'
                      ? 'အထက်ပါ Quiz Setup တွင် DOI၊ OpenStax Link သို့မဟုတ် PDF ထည့်သွင်းပြီး စာမေးပွဲ မေးခွန်းများ (5, 10, 15, 20) ထုတ်ယူပါ။'
                      : 'Add textbook URLs, DOIs, or PDFs above and select 5, 10, 15, or 20 questions to start.'}
                  </p>
                  <div className="flex justify-center space-x-3 pt-2">
                    <button
                      onClick={() => {
                        loadSampleSources();
                        setShowGeneratorPanel(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Load Sample Sources &amp; Demo
                    </button>
                  </div>
                </div>
              ) : currentQuiz ? (
                <QuizQuestionCard
                  question={currentQuiz}
                  currentQuizIndex={currentQuizIndex}
                  totalQuestions={quizzes.length}
                  selectedWeek={selectedWeek}
                  currentAttemptNumber={currentAttemptNumber}
                  quizElapsedSeconds={quizElapsedSeconds}
                  quizScore={quizScore}
                  selectedOption={selectedOption}
                  isAnswerSubmitted={isAnswerSubmitted}
                  formatTimer={formatTimer}
                  onSelectOption={handleSelectQuizOption}
                  onPrevQuestion={handlePrevQuizQuestion}
                  onNextQuestion={handleNextQuizQuestion}
                  onRetakeFullQuiz={handleRetakeFullQuiz}
                />
              ) : null}
            </div>
          )}

          {/* ========================================================
              SUB-VIEW 2: RESULT SCREEN & METHOD (B) ERROR DECK TRANSFER
             ======================================================== */}
          {quizSubView === 'review' && (
            <QuizReview
              language={language}
              selectedWeek={selectedWeek}
              currentAttemptNumber={currentAttemptNumber}
              quizElapsedSeconds={quizElapsedSeconds}
              quizScore={quizScore}
              quizzes={quizzes}
              userAnswers={userAnswers}
              incorrectCount={incorrectCount}
              errorCardsAddedBadge={errorCardsAddedBadge}
              errorCardCount={errorCardCount}
              generatingQuiz={isGenerating}
              formatTimer={formatTimer}
              onSendMistakesToErrorDeck={handleSendMistakesToErrorDeck}
              onRetestMissed={handleRetestMissed}
              onGenerateFreshAttempt={handleGenerateFreshAttempt}
              onOpenErrorDeck={() => {
                setActiveMode('flashcards');
                setDeckFilter('error');
                setCurrentCardIndex(0);
                setIsFlipped(false);
              }}
              onRetakeFullQuiz={handleRetakeFullQuiz}
              onAddSingleQuestionToDeck={handleAddSingleQuestionToDeck}
            />
          )}

          {/* ========================================================
              SUB-VIEW 3: WEEKLY HISTORY & LOCALSTORAGE ARCHIVES
             ======================================================== */}
          {quizSubView === 'history' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Term Quiz History (`akari_saved_quizzes_*`)
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Filter Week:</span>
                  <select
                    value={historyWeekFilter}
                    onChange={(e) => setHistoryWeekFilter(e.target.value)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold"
                  >
                    <option value="all">All Weeks ({savedSessions.length})</option>
                    {ACADEMIC_WEEKS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 space-y-3">
                  <History className="w-10 h-10 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-white">
                    {language === 'my'
                      ? 'လေ့ကျင့်မှု မှတ်တမ်း မရှိသေးပါ'
                      : 'No Quiz Sessions Saved Yet'}
                  </h3>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSessions.map((session) => {
                    const accuracy = Math.round(
                      ((session.score || 0) / (session.totalQuestions || 1)) * 100
                    );
                    const formattedDate = new Date(session.createdAt).toLocaleDateString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    );

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleLoadPastSession(session)}
                        className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-violet-500/40 cursor-pointer transition-all space-y-3 group shadow-lg"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-600/20 text-violet-300 border border-violet-500/30">
                              {session.weekTag}
                            </span>
                            <span className="text-xs text-slate-500">{formattedDate}</span>
                            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              Attempt #{session.attemptsCount || 1}
                            </span>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <span className="text-sm font-bold text-white font-mono">
                                {session.score ?? 0} / {session.totalQuestions}
                              </span>
                              <span
                                className={`ml-2 text-xs font-bold ${
                                  accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                ({accuracy}%)
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="text-slate-600 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-slate-300 line-clamp-1">
                          <span className="text-slate-500 font-semibold">Source/Topic:</span>{' '}
                          {session.sourceTitle}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-violet-400 font-semibold">
                          <span>Click to Review or Transfer Mistakes to Error Deck</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODE 2: DEDICATED SPACED REPETITION FLASHCARDS (SM-2)
         ======================================================== */}
      {activeMode === 'flashcards' && (
        <div className="space-y-6">
          {/* Header Summary Banner + SM-2 Progress Ring Visualizer */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold">
                <span className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 flex items-center space-x-2">
                  <span>📚 စုစုပေါင်း ကတ်:</span>
                  <span className="text-white font-mono text-base">{totalCards}</span>
                </span>
                <span className="px-3.5 py-2 rounded-xl bg-violet-950/50 border border-violet-500/40 text-violet-200 flex items-center space-x-2">
                  <span>⏰ ယနေ့ လေ့ကျင့်ရန် ကျန်:</span>
                  <span className="text-violet-300 font-mono text-base">{dueCardsCount}</span>
                </span>
                <span className="px-3.5 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 flex items-center space-x-2">
                  <span>❌ Quiz အမှားကတ်:</span>
                  <span className="text-rose-300 font-mono text-base">{errorCardCount}</span>
                </span>
              </div>

              {/* Actions Header */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFcGenError(null);
                    setShowDirectFlashcardModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>✨ စာအုပ်/စာတမ်းမှ Flashcard အသစ် ၂၀-၃၀ ကတ် တိုက်ရိုက်ထုတ်မည်</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Manual Card</span>
                </button>

                <button
                  type="button"
                  disabled={totalCards === 0}
                  onClick={() => setShowClearAllCardsModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 text-xs font-semibold flex items-center space-x-1.5 border border-rose-500/30 transition-colors cursor-pointer"
                  title={language === 'my' ? 'Flashcard ကတ်အားလုံး ရှင်းလင်းမည်' : 'Clear All Flashcards'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'my' ? 'ကတ်အားလုံး ရှင်းမည်' : 'Clear All Cards'}</span>
                </button>
              </div>
            </div>

            {/* Subtle SM-2 Deck Phase Progress Ring Chart */}
            {(() => {
              const radius = 17;
              const circumference = 2 * Math.PI * radius;
              const masteredLen = totalCards > 0 ? (masteredCardsCount / totalCards) * circumference : 0;
              const reviewLen = totalCards > 0 ? (reviewCardsCount / totalCards) * circumference : 0;
              const learningLen = totalCards > 0 ? (learningCardsCount / totalCards) * circumference : 0;

              return (
                <div className="pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-3.5">
                    <div
                      className="relative w-11 h-11 shrink-0 flex items-center justify-center"
                      aria-label={`SM-2 Deck Progress: ${masteredPercentage}% Mastered`}
                    >
                      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                        <circle
                          cx="22"
                          cy="22"
                          r={radius}
                          fill="transparent"
                          stroke="rgba(30, 41, 59, 0.9)"
                          strokeWidth="4.5"
                        />
                        {masteredLen > 0 && (
                          <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            fill="transparent"
                            stroke="#34d399"
                            strokeWidth="4.5"
                            strokeDasharray={`${masteredLen} ${circumference}`}
                            strokeDashoffset={0}
                            className="transition-all duration-500"
                          />
                        )}
                        {reviewLen > 0 && (
                          <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            fill="transparent"
                            stroke="#a78bfa"
                            strokeWidth="4.5"
                            strokeDasharray={`${reviewLen} ${circumference}`}
                            strokeDashoffset={-masteredLen}
                            className="transition-all duration-500"
                          />
                        )}
                        {learningLen > 0 && (
                          <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            fill="transparent"
                            stroke="#fbbf24"
                            strokeWidth="4.5"
                            strokeDasharray={`${learningLen} ${circumference}`}
                            strokeDashoffset={-(masteredLen + reviewLen)}
                            className="transition-all duration-500"
                          />
                        )}
                      </svg>
                      <span className="absolute text-[10px] font-mono font-bold text-slate-200">
                        {masteredPercentage}%
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-200">
                        SM-2 Mastery Progress
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {totalCards === 0
                          ? language === 'my'
                            ? 'ကတ်များ ထည့်သွင်းပြီးပါက SM-2 အဆင့်တိုးတက်မှုကို ဤနေရာတွင် မြင်တွေ့ရပါမည်'
                            : 'Add cards to track Learning, Review, and Mastered phases'
                          : `${masteredCardsCount} of ${totalCards} cards mastered`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-slate-400 font-medium">Learning</span>
                      <span className="font-mono font-bold text-amber-300">{learningCardsCount}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
                      <span className="text-slate-400 font-medium">Review</span>
                      <span className="font-mono font-bold text-violet-300">{reviewCardsCount}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-slate-400 font-medium">Mastered</span>
                      <span className="font-mono font-bold text-emerald-300">{masteredCardsCount}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Sub-Filter Pills (Due Today vs Error Deck vs All Cards) */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDeckFilter('due');
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deckFilter === 'due'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⏰ Due Today ({dueCardsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeckFilter('error');
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deckFilter === 'error'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ❌ Quiz Error Deck ({errorCardCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeckFilter('all');
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deckFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📚 All Cards ({totalCards})
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Storage: `akari_flashcard_deck` · SuperMemo SM-2 Interval Engine
            </span>
          </div>

          {/* Zero Due State or Active 3D Flashcard Reviewer */}
          {deckFilter === 'due' && dueCardsCount === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900/70 border border-emerald-500/30 text-center space-y-4 shadow-2xl max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                🎉 ယနေ့အတွက် ပြန်လှန်လေ့ကျင့်ရန် ကတ်များ အားလုံး ပြီးမြောက်ပါပြီ။
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                SuperMemo SM-2 ရက်ချိန်းအရ ယနေ့ ပြန်လှန်ရမည့် ကတ်အားလုံး ပြီးဆုံးသွားပါပြီ။ ကတ်အသစ်များ ထပ်မံထုတ်ယူနိုင်သလို စုစုပေါင်းကတ် ({totalCards}) ကိုလည်း ကြိုတင်လေ့ကျင့်နိုင်ပါသည်။
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirectFlashcardModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>✨ စာအုပ်/စာတမ်းမှ Flashcard အသစ် ၂၀-၃၀ ကတ် တိုက်ရိုက်ထုတ်မည်</span>
                </button>
                {totalCards > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeckFilter('all');
                      setCurrentCardIndex(0);
                      setIsFlipped(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  >
                    📚 စုစုပေါင်း ကတ်အားလုံး ({totalCards}) ကို လေ့လာမည်
                  </button>
                )}
              </div>
            </div>
          ) : activeStudyList.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 space-y-3 max-w-xl mx-auto">
              <Layers className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">
                ဤ ကဏ္ဍတွင် Flashcard မရှိသေးပါ
              </h3>
              <p className="text-xs max-w-sm mx-auto">
                အထက်ပါ [✨ စာအုပ်/စာတမ်းမှ Flashcard အသစ် ၂၀-၃၀ ကတ် တိုက်ရိုက်ထုတ်မည်] ခလုတ်ဖြင့် စတင်ထုတ်ယူပါ။
              </p>
            </div>
          ) : currentCard ? (
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Card Top Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-slate-300">
                    Card {currentCardIndex + 1} of {activeStudyList.length}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      currentCard.source === 'quiz_error'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {currentCard.source === 'quiz_error'
                      ? '❌ Quiz Error Deck'
                      : '✨ High-Yield Concept'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-violet-300 font-semibold border border-slate-700 text-[11px]">
                    {currentCard.sourceWeek}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                  <span>Interval: {currentCard.interval}d</span>
                  <span>EF: {currentCard.easeFactor}</span>
                  <span>Next: {currentCard.nextReviewDate}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteFlashcardItem(currentCard.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3D Interactive Card Flip */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className={`cursor-pointer min-h-[260px] sm:min-h-[320px] p-6 sm:p-10 rounded-3xl border transition-all duration-300 flex flex-col justify-between shadow-2xl relative select-none ${
                  isFlipped
                    ? 'bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-950 border-indigo-500/50'
                    : 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 hover:border-violet-500/40'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                      isFlipped
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                    }`}
                  >
                    {isFlipped
                      ? '💡 Back: Concise Definition / Core Rule'
                      : '🎯 Front: Key Term / Concept Prompt'}
                  </span>
                  <RotateCw
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                      isFlipped ? 'rotate-180 text-indigo-400' : ''
                    }`}
                  />
                </div>

                <div className="my-auto text-center py-6 px-2 space-y-4">
                  <div className="text-base sm:text-xl font-bold text-white leading-relaxed whitespace-pre-wrap">
                    <MathRenderer content={isFlipped ? currentCard.back : currentCard.front} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>Click card anywhere to flip (3D Active Recall)</span>
                  <span>Repetition #{currentCard.repetition}</span>
                </div>
              </div>

              {/* Active Recall Buttons (SM-2 Grading) */}
              {isFlipped ? (
                <div className="space-y-2.5 animate-in fade-in">
                  <span className="text-xs font-bold text-slate-300 text-center block">
                    {language === 'my'
                      ? 'SM-2 မှတ်ဉာဏ် အဆင့်သတ်မှတ်ပါ (နှိပ်လိုက်သည်နှင့် နောက်တစ်ကတ်သို့ အလိုအလျောက် ရွှေ့ပါမည်):'
                      : 'Grade Active Recall (SuperMemo SM-2 Interval):'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSM2Grade(1)}
                      className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 hover:bg-rose-900/70 text-xs font-bold transition-all flex flex-col items-center cursor-pointer shadow-lg"
                    >
                      <span>🔴 Again (1 ရက်)</span>
                      <span className="text-[10px] font-normal text-rose-300/80 mt-0.5">
                        Grade 1 · Reset
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSM2Grade(3)}
                      className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 hover:bg-amber-900/70 text-xs font-bold transition-all flex flex-col items-center cursor-pointer shadow-lg"
                    >
                      <span>🟠 Hard (3 ရက်)</span>
                      <span className="text-[10px] font-normal text-amber-300/80 mt-0.5">
                        Grade 3 · Short Interval
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSM2Grade(4)}
                      className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/70 text-xs font-bold transition-all flex flex-col items-center cursor-pointer shadow-lg"
                    >
                      <span>🟢 Good (6 ရက်)</span>
                      <span className="text-[10px] font-normal text-emerald-300/80 mt-0.5">
                        Grade 4 · Optimal SM-2
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSM2Grade(5)}
                      className="p-3.5 rounded-2xl bg-blue-950/50 border border-blue-500/40 text-blue-200 hover:bg-blue-900/70 text-xs font-bold transition-all flex flex-col items-center cursor-pointer shadow-lg"
                    >
                      <span>🔵 Easy (10+ ရက်)</span>
                      <span className="text-[10px] font-normal text-blue-300/80 mt-0.5">
                        Grade 5 · Mastery
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    disabled={currentCardIndex === 0}
                    onClick={() => {
                      setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                      setIsFlipped(false);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold disabled:opacity-30 cursor-pointer flex items-center space-x-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-600/20 transition-all cursor-pointer"
                  >
                    👁️ အဖြေ ကြည့်မည် (Reveal Answer)
                  </button>

                  <button
                    type="button"
                    disabled={currentCardIndex >= activeStudyList.length - 1}
                    onClick={() => {
                      setCurrentCardIndex((prev) =>
                        Math.min(activeStudyList.length - 1, prev + 1)
                      );
                      setIsFlipped(false);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold disabled:opacity-30 cursor-pointer flex items-center space-x-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================
          MODAL: METHOD (A) TOKEN-LEAN DIRECT FLASHCARD GENERATOR
         ======================================================== */}
      {showDirectFlashcardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-violet-500/40 rounded-3xl p-6 sm:p-7 max-w-xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    ✨ Direct High-Yield Flashcard Generator (Method A)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Active Dynamic Free-Tier Cascade · Capped at 3,500 Words · Instant SM-2 Deck
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectFlashcardModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {fcGenError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs">
                ❌ {fcGenError}
              </div>
            )}

            <form onSubmit={handleGenerateDirectFlashcards} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  OpenStax URL / DOI Reference (Optional):
                </label>
                <input
                  type="text"
                  value={fcSourceInput}
                  onChange={(e) => setFcSourceInput(e.target.value)}
                  placeholder="e.g. https://openstax.org/books/... or 10.1016/..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Chapter Filter / Section Scope (Optional):
                </label>
                <input
                  type="text"
                  value={fcChapterScope}
                  onChange={(e) => setFcChapterScope(e.target.value)}
                  placeholder="e.g. Chapter 2, Section 2.1, or Key Concepts..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Abstract / High-Yield Chapter Notes (Auto-trimmed to 3,500 words):
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-violet-950/60 border border-violet-500/30 text-violet-300 hover:bg-violet-900 text-[11px] font-semibold cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Upload PDF</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handlePdfFileUpload(e, 'flashcard')}
                        className="hidden"
                      />
                    </label>
                    <span className="text-slate-500 text-[11px]">{fcWordCount} words</span>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={fcTextPayload}
                  onChange={(e) => setFcTextPayload(e.target.value)}
                  placeholder="Paste chapter summary, key definitions, or abstract here..."
                  className="w-full p-3.5 text-xs bg-slate-950 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 leading-relaxed"
                />
                <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/25 text-indigo-200/90 text-[11px] leading-relaxed">
                  💡 အကြံပြုချက်: Textbook တစ်အုပ်လုံးထက် သင်လေ့လာလိုသည့် Chapter (ဥပမာ- Chapter 2) သို့မဟုတ် ခေါင်းစဉ်ခွဲကို သီးသန့် ထည့်သွင်းခြင်းက မေးခွန်းထုတ်ယူမှု အလွန်မြန်ဆန်စေပြီး Daily Quota ကို အများဆုံး ချွေတာနိုင်ပါသည်။
                </div>
              </div>

              {isLargeFcPayloadWarning && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    ⚠️ စာသားပမာဏ များပြားနေပါသည် (Large Payload Detected): တိကျသော မေးခွန်းများရရှိရန်နှင့် အမှားစစ်ဆေးရာတွင် စာအုပ်ထဲ လွယ်ကူစွာ ပြန်ရှာနိုင်ရန် 'Chapter Filter' တွင် အခန်းသတ်မှတ်ပေးပါ (သို့မဟုတ်) လိုအပ်သော စာပိုဒ်ကိုသာ ကူးယူထည့်သွင်းပေးပါ။
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    Card Volume (20–30 Cards):
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[20, 25, 30].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setFcCardCount(cnt)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          fcCardCount === cnt
                            ? 'bg-violet-600 text-white border-violet-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {cnt} ကတ်
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    Source Week Tag:
                  </label>
                  <select
                    value={fcWeekTag}
                    onChange={(e) => setFcWeekTag(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold"
                  >
                    {ACADEMIC_WEEKS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDirectFlashcardModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingDirectCards || (!fcSourceInput.trim() && !fcTextPayload.trim())}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shadow-lg shadow-violet-600/30 flex items-center space-x-2 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isGeneratingDirectCards ? 'animate-spin' : ''}`} />
                  <span>
                    {isGeneratingDirectCards
                      ? '⚡ Flashcard များ ထုတ်ယူနေပါသည်...'
                      : `✨ Generate ${fcCardCount} High-Yield Flashcards`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: RESET ALL TERM DATA CONFIRMATION
         ======================================================== */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {language === 'my'
                  ? 'Term ပြီးဆုံး၍ Data အားလုံး ရှင်းလင်းမည်လား?'
                  : 'Reset All Term Quiz Data?'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {language === 'my'
                ? `လက်ရှိ Term တွင် သိမ်းဆည်းထားသော အပတ်စဉ် Quiz များ (${savedSessions.length} sessions) နှင့် စာမေးပွဲ ရလဒ်များ အားလုံးကို Browser မှ အပြီးတိုင် ဖျက်ပစ်ပါမည်။`
                : `This will permanently wipe all ${savedSessions.length} saved weekly quiz sessions from local storage.`}
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAllTermData}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-lg shadow-rose-600/30 flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Reset All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CLEAR ALL FLASHCARDS CONFIRMATION
         ======================================================== */}
      {showClearAllCardsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {language === 'my'
                  ? 'Flashcard ကတ်အားလုံးကို ရှင်းထုတ်မည်လား?'
                  : 'Clear All Flashcards?'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {language === 'my'
                ? `လက်ရှိ သိမ်းဆည်းထားသော Flashcard စုစုပေါင်း (${totalCards}) ကတ်နှင့် Quiz Error Deck ကတ်များ အားလုံးကို အပြီးတိုင် ဖျက်ပစ်ပါမည်။`
                : `This will permanently remove all ${totalCards} flashcards (including Quiz Error Deck cards) from your local deck.`}
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllCardsModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllFlashcards}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-lg shadow-rose-600/30 flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'my' ? 'ကတ်အားလုံး ရှင်းမည်' : 'Clear All Cards'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD MANUAL FLASHCARD
         ======================================================== */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">{t.flashcards.createCard}</h3>
            <form onSubmit={handleCreateManualCard} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.flashcards.frontLabel}
                </label>
                <input
                  type="text"
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="e.g. Heuristic (စိတ်ပိုင်းဆိုင်ရာ ဖြတ်လမ်းနည်း)"
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.flashcards.backLabel}
                </label>
                <textarea
                  rows={3}
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Explanation / Answer..."
                  className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Source Week Tag
                </label>
                <input
                  type="text"
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  placeholder="e.g. Week 1"
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md cursor-pointer"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizFlashcardSuite;
