import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import { PrivacySettingsModal } from './PrivacySettingsModal';
import {
  sanitizePayloadText,
  executeGeminiRequest,
  LessonAnalysisResult,
} from '../services/geminiService';
import { safeExtractJsonObject, safeExtractJsonArray } from '../utils/jsonSanitizer';
import {
  loadPersistedTabState,
  savePersistedTabState,
  clearPersistedTabState,
} from '../utils/researchPersistence';
import {
  parseUniversalDocument,
  DocumentFileType,
} from '../services/documentParser';
import {
  BookOpen,
  Sparkles,
  Brain,
  Copy,
  Check,
  ArrowRight,
  FileCheck,
  Highlighter,
  Palette,
  AlertCircle,
  Tag,
  CheckCircle2,
  Bookmark,
  Layers,
  Image as ImageIcon,
  X,
  Key,
  Scissors,
  GraduationCap,
  Lightbulb,
  Trash2,
  Paperclip,
  FileText,
  Presentation,
  FileSpreadsheet,
} from 'lucide-react';

type HighlightColor = 'amber' | 'emerald' | 'cyan' | 'violet';

const COLOR_THEMES: Record<
  HighlightColor,
  { name: string; badge: string; bg: string; dot: string; border: string }
> = {
  amber: {
    name: 'Amber Gold',
    badge: 'text-amber-200 font-extrabold bg-amber-500/20 border border-amber-500/40 shadow-sm shadow-amber-500/10',
    bg: 'bg-amber-500',
    dot: 'bg-amber-400',
    border: 'border-amber-500/50',
  },
  emerald: {
    name: 'Emerald Green',
    badge: 'text-emerald-200 font-extrabold bg-emerald-500/20 border border-emerald-500/40 shadow-sm shadow-emerald-500/10',
    bg: 'bg-emerald-500',
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/50',
  },
  cyan: {
    name: 'Electric Cyan',
    badge: 'text-cyan-200 font-extrabold bg-cyan-500/20 border border-cyan-500/40 shadow-sm shadow-cyan-500/10',
    bg: 'bg-cyan-500',
    dot: 'bg-cyan-400',
    border: 'border-cyan-500/50',
  },
  violet: {
    name: 'Neon Violet',
    badge: 'text-violet-200 font-extrabold bg-violet-500/20 border border-violet-500/40 shadow-sm shadow-violet-500/10',
    bg: 'bg-violet-500',
    dot: 'bg-violet-400',
    border: 'border-violet-500/50',
  },
};

export interface AttachedDocument {
  fileName: string;
  fileType: DocumentFileType;
  sizeKb: number;
  previewUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  isTruncated?: boolean;
  rawWordCount?: number;
}

interface GeneratedPracticeQuestion {
  id: string;
  questionType?: 'mcq' | 'except' | 'true_false';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  trapType?: string;
}

interface GeneratedFlashcardItem {
  front: string;
  back: string;
  concept: string;
}

interface LessonPersistedState {
  lessonContent: string;
  attachedDocument: AttachedDocument | null;
  parsedData: LessonAnalysisResult | null;
  rawTextResult: string;
  activeOutputTab: 'burmese' | 'english';
  cardsGeneratedSuccess: boolean;
  generatedQuizzes: GeneratedPracticeQuestion[];
  generatedFlashcards: GeneratedFlashcardItem[];
}

const LESSON_STORAGE_KEY = 'lesson_explainer_workspace_v1';
const LESSON_DEFAULT_STATE: LessonPersistedState = {
  lessonContent: '',
  attachedDocument: null,
  parsedData: null,
  rawTextResult: '',
  activeOutputTab: 'burmese',
  cardsGeneratedSuccess: false,
  generatedQuizzes: [],
  generatedFlashcards: [],
};

export const LessonExplainer: React.FC = () => {
  const { language, addFlashcards, addQuizzes, setActiveTab } = useApp();
  const t = translations[language];
  const [initialState] = useState<LessonPersistedState>(() =>
    loadPersistedTabState<LessonPersistedState>(LESSON_STORAGE_KEY, LESSON_DEFAULT_STATE)
  );

  // Text & Multi-Format Document State
  const [lessonContent, setLessonContent] = useState(initialState.lessonContent);
  const [attachedDocument, setAttachedDocument] = useState<AttachedDocument | null>(
    initialState.attachedDocument
  );
  const [isDragging, setIsDragging] = useState(false);
  const [extractingDocument, setExtractingDocument] = useState(false);
  const [truncationNotice, setTruncationNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Results & UI State
  const [parsedData, setParsedData] = useState<LessonAnalysisResult | null>(initialState.parsedData);
  const [rawTextResult, setRawTextResult] = useState(initialState.rawTextResult);
  const [loading, setLoading] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [cardsGeneratedSuccess, setCardsGeneratedSuccess] = useState(
    initialState.cardsGeneratedSuccess
  );
  const [generatedQuizzes, setGeneratedQuizzes] = useState<GeneratedPracticeQuestion[]>(
    initialState.generatedQuizzes
  );
  const [generatedFlashcards, setGeneratedFlashcards] = useState<GeneratedFlashcardItem[]>(
    initialState.generatedFlashcards
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showQuizPreview, setShowQuizPreview] = useState(
    initialState.generatedQuizzes.length > 0 || initialState.generatedFlashcards.length > 0
  );
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [apiKeyMissingNotice, setApiKeyMissingNotice] = useState(false);

  // Active Output View Tab: 'burmese' | 'english'
  const [activeOutputTab, setActiveOutputTab] = useState<'burmese' | 'english'>(
    initialState.activeOutputTab
  );

  // AI Highlighting Controls
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('amber');
  const [filterConcept, setFilterConcept] = useState<string | null>(null);

  useEffect(() => {
    // Avoid exceeding sessionStorage quota with huge base64 image payloads if needed
    const docForStorage = attachedDocument
      ? {
          ...attachedDocument,
          imageBase64:
            attachedDocument.imageBase64 && attachedDocument.imageBase64.length < 300000
              ? attachedDocument.imageBase64
              : undefined,
          previewUrl:
            attachedDocument.previewUrl && attachedDocument.previewUrl.length < 300000
              ? attachedDocument.previewUrl
              : undefined,
        }
      : null;

    savePersistedTabState<LessonPersistedState>(LESSON_STORAGE_KEY, {
      lessonContent,
      attachedDocument: docForStorage,
      parsedData,
      rawTextResult,
      activeOutputTab,
      cardsGeneratedSuccess,
      generatedQuizzes,
      generatedFlashcards,
    });
  }, [
    lessonContent,
    attachedDocument,
    parsedData,
    rawTextResult,
    activeOutputTab,
    cardsGeneratedSuccess,
    generatedQuizzes,
    generatedFlashcards,
  ]);

  // Word and Character Limit Thresholds:
  // Safe Target: < 1,000 words
  // Warning State: 1,001 to 1,500 words
  // Hard Ceiling (Max Cap): 1,500 words (or 10,000 characters)
  const wordCount = useMemo(() => {
    const trimmed = lessonContent.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [lessonContent]);

  const charCount = useMemo(() => {
    return lessonContent.length;
  }, [lessonContent]);

  const isExceeded = wordCount > 1500 || charCount > 10000;
  const isWarning = !isExceeded && wordCount > 1000;
  const isNormal = !isExceeded && !isWarning;
  const exceededWords = Math.max(0, wordCount - 1500);

  // Quick Action: Trim to First 1,400 Words
  const handleTrimTo1400Words = () => {
    const trimmed = lessonContent.trim();
    if (!trimmed) return;
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > 1400) {
      const cut = words.slice(0, 1400).join(' ');
      setLessonContent(cut);
    } else if (lessonContent.length > 10000) {
      setLessonContent(lessonContent.slice(0, 9900));
    }
  };

  // Dedicated Comprehensive State Reset: Clear All
  const handleClearAll = () => {
    setLessonContent('');
    setAttachedDocument(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setParsedData(null);
    setRawTextResult('');
    setErrorMessage(null);
    setTruncationNotice(false);
    setCardsGeneratedSuccess(false);
    setGeneratedQuizzes([]);
    setGeneratedFlashcards([]);
    setSelectedAnswers({});
    setShowQuizPreview(false);
    setFilterConcept(null);
    setApiKeyMissingNotice(false);
    clearPersistedTabState(LESSON_STORAGE_KEY);
  };

  // Remove Attached Document Chip
  const handleRemoveDocument = () => {
    setAttachedDocument(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setTruncationNotice(false);
  };

  // Universal File Processor (PDF, Word, PPTX, Excel, CSV, Images)
  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setTruncationNotice(false);
    setExtractingDocument(true);

    try {
      const parsed = await parseUniversalDocument(file);

      setAttachedDocument({
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        sizeKb: parsed.sizeKb,
        previewUrl: parsed.previewUrl,
        imageBase64: parsed.imageBase64,
        imageMimeType: parsed.imageMimeType,
        isTruncated: parsed.isTruncated,
        rawWordCount: parsed.rawWordCount,
      });

      if (parsed.extractedText) {
        setLessonContent(parsed.extractedText);
        if (parsed.isTruncated) {
          setTruncationNotice(true);
        }
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(
        err?.message ||
          (language === 'my'
            ? 'ဖိုင်မှ အချက်အလက် ထုတ်ယူရာတွင် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်။'
            : 'Failed to extract text from document.')
      );
    } finally {
      setExtractingDocument(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Clipboard Paste Handler (Supports screenshot paste via Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleProcessFile(file);
          return;
        }
      }
    }
  };

  const loadSampleLesson = () => {
    setLessonContent(
      `MATH 1201: College Algebra - Linear Models & X-Intercept Applications
A linear model is an equation of the form y = mx + b, where m represents the constant rate of change (slope) and b represents the initial value (y-intercept).

Example Application (Business Break-Even Analysis):
Suppose a company manufactures custom textbook binders. The setup cost is $400, and each binder costs $5 to produce. The total cost function is C(x) = 5x + 400.
The company sells each binder for $25, giving a revenue function of R(x) = 25x.

1. Finding the Break-Even Point:
Set Revenue equal to Cost:
R(x) = C(x)
25x = 5x + 400
20x = 400
x = 20 units.
At 20 units sold, total revenue ($500) equals total cost ($500), resulting in $0 net profit.

2. Understanding Intercepts in Context:
- The y-intercept of the cost function is (0, 400), representing fixed overhead costs before producing any units.
- The x-intercept of the profit function P(x) = R(x) - C(x) = 20x - 400 occurs at x = 20, representing the production volume required to cross from loss into profitability.`
    );
  };

  // Action A: Bilingual Lesson Explainer routed through centralized executeGeminiRequest ('standard')
  const handleExplain = async () => {
    const hasText = lessonContent.trim().length > 0;
    const hasImage = Boolean(attachedDocument?.imageBase64);

    if ((!hasText && !hasImage) || isExceeded) return;

    setErrorMessage(null);
    setApiKeyMissingNotice(false);
    setLoading(true);
    setFilterConcept(null);
    setParsedData(null);
    setRawTextResult('');

    try {
      const sanitizedPayload = sanitizePayloadText(lessonContent.trim(), 20000);
      const systemInstruction = `You are an elite bilingual academic professor and curriculum specialist at University of the People.
Analyze the provided course content (lecture text, slides, spreadsheet/document excerpts, or attached diagram/slide image) thoroughly.
Return ONLY a valid JSON object (no markdown code fences) matching this exact schema:
{
  "analysisTitle": "Specific Subject Matter Title",
  "keyConceptTags": ["Concept 1", "Formula / Model 2", "Concept 3", "Concept 4"],
  "englishAnalysis": {
    "executiveSynthesis": "Comprehensive multi-paragraph English study synthesis covering: (1) Core Concepts & Key Formulas, (2) Step-by-Step Analytical Breakdown with worked logic, and (3) Bilingual Study Summary conclusions.",
    "thematicPillars": [
      {
        "title": "Core Concept / Formula Title",
        "explanation": "Detailed theoretical mechanism, formula derivation, and step-by-step analytical breakdown grounded in the text."
      }
    ],
    "actionableTakeaways": [
      "Concrete takeaway 1 for exams and assignments",
      "Concrete takeaway 2"
    ]
  },
  "burmeseAnalysis": {
    "comprehensiveExplanation": "### ရှင်းလင်းသော အဓိက သဘောတရားများ (Core Concepts & Key Formulas)\\n...\\n\\n### အဆင့်ဆင့် အသေးစိတ် ရှင်းလင်းချက် (Step-by-Step Analytical Breakdown)\\n...\\n\\n### မြန်မာ + English အနှစ်ချုပ် (Bilingual Study Summary)\\n...",
    "coreTakeaways": [
      {
        "pointTitle": "အဓိက သဘောတရား / ဖော်မြူလာ",
        "explanation": "သဘာဝကျသော ပညာရပ်ဆိုင်ရာ မြန်မာဘာသာ ရှင်းလင်းချက်နှင့် လက်တွေ့ ဥပမာ"
      }
    ],
    "uopeopleAcademicApplication": "UoPeople Discussion Forum, Assignment, Learning Journal နှင့် Final Exam များတွင် ဤသင်ခန်းစာကို လက်တွေ့အသုံးချနည်း"
  }
}`;

      const prompt = `Produce a rigorous Bilingual Academic Lesson Breakdown (English + Myanmar) from the following material.
Ensure you include:
1. Core Concepts & Key Formulas (ရှင်းလင်းသော အဓိက သဘောတရားများ)
2. Step-by-Step Analytical Breakdown (အဆင့်ဆင့် အသေးစိတ် ရှင်းလင်းချက်)
3. Bilingual Study Summary (မြန်မာ + English အနှစ်ချုပ်)

COURSE MATERIAL:
"""
${sanitizedPayload || 'Analyze the attached lecture slide or study image thoroughly.'}
"""`;

      const imagePayload = attachedDocument?.imageBase64
        ? [{ name: attachedDocument.fileName || 'lesson_slide', dataUrl: attachedDocument.imageBase64 }]
        : undefined;

      const rawRes = await executeGeminiRequest(
        prompt,
        'standard',
        systemInstruction,
        imagePayload,
        3600,
        undefined,
        false,
        'application/json'
      );

      const parsed = safeExtractJsonObject<any>(rawRes);
      if (parsed && (parsed.burmeseAnalysis || parsed.englishAnalysis || parsed.analysisTitle)) {
        const normalized: LessonAnalysisResult = {
          analysisTitle: parsed.analysisTitle || parsed.topicTitle || 'Academic Deep-Dive Analysis',
          keyConceptTags: Array.isArray(parsed.keyConceptTags)
            ? parsed.keyConceptTags
            : ['Core Concepts', 'Analytical Breakdown'],
          englishAnalysis: {
            executiveSynthesis:
              parsed.englishAnalysis?.executiveSynthesis ||
              parsed.detailedBreakdown?.english?.comprehensiveSummary ||
              '',
            thematicPillars: Array.isArray(parsed.englishAnalysis?.thematicPillars)
              ? parsed.englishAnalysis.thematicPillars
              : [],
            actionableTakeaways: Array.isArray(parsed.englishAnalysis?.actionableTakeaways)
              ? parsed.englishAnalysis.actionableTakeaways
              : [],
          },
          burmeseAnalysis: {
            comprehensiveExplanation:
              parsed.burmeseAnalysis?.comprehensiveExplanation ||
              parsed.detailedBreakdown?.myanmar?.conceptualExplanation ||
              '',
            coreTakeaways: Array.isArray(parsed.burmeseAnalysis?.coreTakeaways)
              ? parsed.burmeseAnalysis.coreTakeaways
              : [],
            uopeopleAcademicApplication:
              parsed.burmeseAnalysis?.uopeopleAcademicApplication ||
              parsed.detailedBreakdown?.myanmar?.assignmentTips ||
              '',
          },
        };
        setParsedData(normalized);
      } else {
        setRawTextResult(String(rawRes || ''));
      }
    } catch (err: any) {
      console.error('Lesson explainer error:', err);
      const msg = err?.message || 'Failed to analyze lesson content';
      setErrorMessage(msg);
      if (
        msg.includes('No Gemini API Key') ||
        msg.includes('INVALID_KEY') ||
        msg.includes('API key not valid') ||
        msg.includes('403') ||
        msg.includes('API Key')
      ) {
        setApiKeyMissingNotice(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Action B: UoPeople Tricky Quiz (10 Questions) & Flashcards via executeGeminiRequest ('light')
  const handleGenerateCardsAndQuiz = async () => {
    if ((!lessonContent.trim() && !parsedData && !rawTextResult) || isExceeded) return;
    setErrorMessage(null);
    setGeneratingCards(true);
    setCardsGeneratedSuccess(false);

    try {
      const rawSource =
        lessonContent.trim() ||
        [
          parsedData?.analysisTitle || '',
          parsedData?.englishAnalysis?.executiveSynthesis || '',
          parsedData?.burmeseAnalysis?.comprehensiveExplanation || '',
        ]
          .filter(Boolean)
          .join('\n\n') ||
        rawTextResult;

      const source = sanitizePayloadText(rawSource, 16000);
      const systemInstruction = `You are a strict University of the People (UoPeople) Exam Designer.
Return ONLY a valid JSON object (no markdown fences) matching this exact schema:
{
  "quizzes": [
    {
      "id": "q1",
      "questionType": "mcq" | "except" | "true_false",
      "trapType": "Conceptual Nuance | Negative Constraint | Formula Edge Case | Cause-Effect Trap",
      "question": "Scenario-based or nuanced UoPeople exam question...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Clear academic rationale explaining why the correct option holds and why distractors fail."
    }
  ],
  "flashcards": [
    {
      "front": "Key Term / Formula / Principle",
      "back": "Concise definition & real-world academic application.",
      "concept": "Core Concept Tag"
    }
  ]
}
Requirements:
- "quizzes" MUST contain EXACTLY 10 tricky UoPeople-style practice questions (mix of scenario MCQs, "EXCEPT / NOT" negative constraints, and nuanced True/False with 2 options ["True", "False"]).
- "flashcards" MUST contain 8 to 10 high-yield key term flashcards.
- Ground every item strictly in the provided lesson material.`;

      const quizPrompt = `Generate EXACTLY 10 UoPeople-style tricky practice questions (with rationale explanations) and 8-10 key term flashcards from this course material:\n\n"""\n${source}\n"""`;

      const rawRes = await executeGeminiRequest(
        quizPrompt,
        'light',
        systemInstruction,
        undefined,
        3600,
        undefined,
        true,
        'application/json'
      );

      let parsedObj = safeExtractJsonObject<any>(rawRes);
      if (!parsedObj) {
        const arr = safeExtractJsonArray<any>(rawRes);
        if (arr && arr.length > 0) {
          parsedObj = { quizzes: arr, flashcards: [] };
        }
      }

      if (!parsedObj || (!Array.isArray(parsedObj.quizzes) && !Array.isArray(parsedObj.flashcards))) {
        throw new Error('Could not parse structured UoPeople Quiz & Flashcards from response.');
      }

      const timestamp = Date.now();
      const rawQuizzes: any[] = Array.isArray(parsedObj.quizzes) ? parsedObj.quizzes.slice(0, 10) : [];
      const rawFlashcards: any[] = Array.isArray(parsedObj.flashcards)
        ? parsedObj.flashcards.slice(0, 12)
        : [];

      const normalizedQuizzes: GeneratedPracticeQuestion[] = rawQuizzes.map((q: any, i: number) => {
        const opts = Array.isArray(q.options) && q.options.length >= 2
          ? q.options.map((o: any) => String(o))
          : ['True', 'False'];
        const safeCorrect =
          typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length
            ? q.correctIndex
            : 0;
        return {
          id: `quiz-${timestamp}-${i}`,
          questionType:
            q.questionType === 'except' || q.questionType === 'true_false' ? q.questionType : 'mcq',
          question: String(q.question || `Practice Question ${i + 1}`),
          options: opts,
          correctIndex: safeCorrect,
          explanation: String(q.explanation || 'Review the corresponding theoretical concept in the lesson.'),
          trapType: q.trapType ? String(q.trapType) : undefined,
        };
      });

      const normalizedFlashcards: GeneratedFlashcardItem[] = rawFlashcards.map((f: any) => ({
        front: String(f.front || f.f || 'Key Concept'),
        back: String(f.back || f.b || 'Definition and academic application.'),
        concept: String(f.concept || parsedData?.analysisTitle || 'Lesson Study'),
      }));

      if (normalizedFlashcards.length > 0) {
        addFlashcards(normalizedFlashcards);
      }
      if (normalizedQuizzes.length > 0) {
        addQuizzes(normalizedQuizzes);
      }

      setGeneratedQuizzes(normalizedQuizzes);
      setGeneratedFlashcards(normalizedFlashcards);
      setSelectedAnswers({});
      setShowQuizPreview(true);
      setCardsGeneratedSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate UoPeople Quiz & Flashcards');
    } finally {
      setGeneratingCards(false);
    }
  };

  // Copy Content Handler
  const handleCopy = () => {
    let copyContent = '';
    if (parsedData) {
      if (activeOutputTab === 'burmese') {
        copyContent = `# ${parsedData.analysisTitle}\n\n`;
        copyContent += `### သဘောတရားနှင့် အသေးစိတ် ရှင်းလင်းချက်\n${parsedData.burmeseAnalysis.comprehensiveExplanation}\n\n`;
        if (parsedData.burmeseAnalysis.coreTakeaways?.length > 0) {
          copyContent += `### အဓိက သဘောတရားနှင့် တွေ့ရှိချက်များ\n`;
          parsedData.burmeseAnalysis.coreTakeaways.forEach((t) => {
            copyContent += `* **${t.pointTitle}**: ${t.explanation}\n`;
          });
          copyContent += '\n';
        }
        if (parsedData.burmeseAnalysis.uopeopleAcademicApplication) {
          copyContent += `### UoPeople Academic Application\n${parsedData.burmeseAnalysis.uopeopleAcademicApplication}\n`;
        }
      } else {
        copyContent = `# ${parsedData.analysisTitle}\n\n`;
        copyContent += `### Executive Academic Synthesis\n${parsedData.englishAnalysis.executiveSynthesis}\n\n`;
        if (parsedData.englishAnalysis.thematicPillars?.length > 0) {
          copyContent += `### Thematic Pillars\n`;
          parsedData.englishAnalysis.thematicPillars.forEach((p) => {
            copyContent += `* **${p.title}**: ${p.explanation}\n`;
          });
          copyContent += '\n';
        }
        if (parsedData.englishAnalysis.actionableTakeaways?.length > 0) {
          copyContent += `### Actionable Takeaways\n`;
          parsedData.englishAnalysis.actionableTakeaways.forEach((a) => {
            copyContent += `* ${a}\n`;
          });
        }
      }
    } else {
      copyContent = rawTextResult;
    }

    navigator.clipboard.writeText(copyContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Badge icon selector for attached document types
  const getFileBadgeDetails = (type: DocumentFileType) => {
    switch (type) {
      case 'pdf':
        return {
          icon: <FileText className="w-4 h-4 text-rose-400" />,
          style: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
          label: 'PDF',
        };
      case 'docx':
        return {
          icon: <FileText className="w-4 h-4 text-blue-400" />,
          style: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
          label: 'DOCX',
        };
      case 'pptx':
        return {
          icon: <Presentation className="w-4 h-4 text-amber-400" />,
          style: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          label: 'PPTX',
        };
      case 'xlsx':
      case 'csv':
        return {
          icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
          style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          label: type.toUpperCase(),
        };
      case 'image':
        return {
          icon: <ImageIcon className="w-4 h-4 text-cyan-400" />,
          style: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
          label: 'IMAGE',
        };
      default:
        return {
          icon: <FileText className="w-4 h-4 text-slate-400" />,
          style: 'bg-slate-800 text-slate-300 border-slate-700',
          label: 'DOC',
        };
    }
  };

  // Render text containing math/code expressions and bold concepts
  const renderMathAndText = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={lineIdx} className="h-2" />;

      const isHeading = trimmed.startsWith('#');
      if (isHeading) {
        const cleanHeading = trimmed.replace(/^#+\s*/, '');
        return (
          <h4
            key={lineIdx}
            className="text-sm font-bold text-emerald-300 pt-3 pb-1 border-b border-slate-800 flex items-center space-x-2"
          >
            <span className="text-emerald-400">❖</span>
            <span>{cleanHeading}</span>
          </h4>
        );
      }

      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
      const content = isBullet ? trimmed.replace(/^[-*]\s*/, '') : line;

      // Tokenize by backticks, math code, or bold markers
      const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

      const parsedElements = parts.map((part, pIdx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          const codeVal = part.slice(1, -1);
          return (
            <code
              key={pIdx}
              className="bg-slate-950 text-emerald-300 font-mono px-1.5 py-0.5 rounded border border-slate-800 text-xs mx-0.5 inline-block"
            >
              {codeVal}
            </code>
          );
        }

        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          const isSelectedFilter =
            filterConcept && boldText.toLowerCase().includes(filterConcept.toLowerCase());

          return (
            <strong
              key={pIdx}
              className={`transition-all rounded px-1 py-0.5 mx-0.5 inline-block ${
                highlightEnabled
                  ? `${COLOR_THEMES[highlightColor].badge} ${
                      isSelectedFilter ? 'ring-2 ring-white scale-105' : ''
                    }`
                  : 'font-extrabold text-white'
              }`}
            >
              {boldText}
            </strong>
          );
        }

        // Inline math detector for expressions like y = mx + b, x = 20, C(x) = 5x + 400
        const mathMatches = part.split(
          /(\b[A-Za-z]\([A-Za-z0-9]+\)\s*=\s*[^,.\n]+|\b[a-zA-Z]\s*=\s*[-+]?[0-9a-zA-Z\.\s\+\-\*\/]+)/g
        );

        return (
          <span key={pIdx}>
            {mathMatches.map((sub, sIdx) => {
              if (
                /^[A-Za-z]\([A-Za-z0-9]+\)\s*=\s*/.test(sub) ||
                /^[a-zA-Z]\s*=\s*[-+]?[0-9]/.test(sub)
              ) {
                return (
                  <code
                    key={sIdx}
                    className="bg-slate-950 text-cyan-300 font-mono px-1.5 py-0.5 rounded border border-slate-800 text-[11px] mx-0.5"
                  >
                    {sub}
                  </code>
                );
              }
              return sub;
            })}
          </span>
        );
      });

      if (isBullet) {
        return (
          <div key={lineIdx} className="flex items-start space-x-2 pl-2 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
            <div className="flex-1 leading-relaxed text-slate-200">{parsedElements}</div>
          </div>
        );
      }

      return (
        <p key={lineIdx} className="leading-relaxed text-slate-200 my-1">
          {parsedElements}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-emerald-400" />
          <span>{t.lesson.title}</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          {language === 'my'
            ? 'သင်ခန်းစာ အကြောင်းအရာများ၊ PDF၊ Word၊ PPTX၊ Excel သို့မဟုတ် Slide ပုံရိပ်များကို တိုက်ရိုက် ထည့်သွင်း၍ မြန်မာ/အင်္ဂလိပ် နှစ်ဘာသာဖြင့် အဆင့်ဆင့် အသေးစိတ် ရှင်းလင်းချက် ရယူပါ'
            : 'Comprehensive bilingual academic synthesis & deep conceptual breakdown for UoPeople readings, multi-format documents (PDF, Word, PPTX, Excel), and lecture slides.'}
        </p>
      </div>

      {/* API Key Missing Notification Alert */}
      {apiKeyMissingNotice && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <Key className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-sans font-medium">
              {language === 'my'
                ? '⚠️ မိမိ၏ ကိုယ်ပိုင် Gemini API Key (BYOK) ထည့်သွင်းလိုပါက Privacy Settings တွင် စိတ်ကြိုက် သတ်မှတ်နိုင်ပါသည်'
                : '⚠️ Optional: Configure your personal Gemini API Key in Privacy Settings.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 transition-colors shadow cursor-pointer flex items-center space-x-1"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{language === 'my' ? 'Key ထည့်သွင်းမည် (Settings)' : 'Open Key Settings'}</span>
          </button>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-3 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Box & Universal Document Extractor */}
        <div className="space-y-4">
          <div
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-5 rounded-2xl bg-slate-900 border transition-all shadow-xl relative ${
              isDragging ? 'border-emerald-500 bg-slate-900/90 ring-2 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            {/* Header with Title and Clear All & Sample Buttons */}
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{t.lesson.inputPlaceholder}</span>
              </label>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer flex items-center space-x-1 transition-colors"
                  title="Clear all text, attached files, and output"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'my' ? '🗑️ အားလုံးရှင်းမည် (Clear All)' : '🗑️ Clear All'}</span>
                </button>

                <button
                  type="button"
                  onClick={loadSampleLesson}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold cursor-pointer"
                >
                  {t.common.sample} (College Algebra)
                </button>
              </div>
            </div>

            {/* Document Extracting In-Browser Indicator */}
            {extractingDocument && (
              <div className="mb-3 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs flex items-center space-x-2.5 animate-pulse">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>
                  {language === 'my'
                    ? 'စာရွက်စာတမ်းမှ စာသားများကို ဖတ်ရှုထုတ်ယူနေပါသည်... (Extracting document text in browser...)'
                    : 'Extracting document text in-browser...'}
                </span>
              </div>
            )}

            {/* Auto-Trim Truncation Banner */}
            {truncationNotice && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {language === 'my'
                      ? '⚠️ စာရွက်စာတမ်းမှ ပထမဆုံး စာလုံးရေ ၁,၅၀၀ ကို အလိုအလျောက် ရွေးထုတ်ပေးထားပါသည်။ (Auto-trimmed to first 1,500 words for deep synthesis).'
                      : '⚠️ Document auto-trimmed to first 1,500 words for deep academic synthesis.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTruncationNotice(false)}
                  className="text-amber-400 hover:text-amber-200 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Uploaded Document Chip above Textarea */}
            {attachedDocument && (
              <div className="mb-3 p-3 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-between text-xs animate-in fade-in shadow-inner">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {attachedDocument.previewUrl ? (
                    <img
                      src={attachedDocument.previewUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-lg border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                        getFileBadgeDetails(attachedDocument.fileType).style
                      }`}
                    >
                      {getFileBadgeDetails(attachedDocument.fileType).icon}
                    </div>
                  )}
                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                          getFileBadgeDetails(attachedDocument.fileType).style
                        }`}
                      >
                        {getFileBadgeDetails(attachedDocument.fileType).label}
                      </span>
                      <span className="text-white font-bold truncate">
                        {attachedDocument.fileName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {attachedDocument.sizeKb} KB
                      {attachedDocument.rawWordCount
                        ? ` · ${attachedDocument.rawWordCount.toLocaleString()} words`
                        : ''}
                      {attachedDocument.isTruncated
                        ? ' · (Auto-trimmed to 1,500 words)'
                        : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveDocument}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer ml-2"
                  title="Remove document chip"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                rows={11}
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Paste reading content, lecture slides, research text, or drag & drop PDF, Word, PowerPoint, Excel, or screenshot here..."
                className={`w-full p-3.5 text-xs sm:text-sm bg-slate-950 rounded-xl text-white placeholder-slate-500 focus:outline-none font-sans leading-relaxed transition-colors border ${
                  isExceeded
                    ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/20'
                    : isWarning
                    ? 'border-amber-500/60 focus:border-amber-500 ring-1 ring-amber-500/20'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />

              {/* Secondary Inline Clear Trigger */}
              {lessonContent.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="absolute bottom-3 right-3 px-2 py-1 rounded bg-slate-900/90 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow"
                  title="Clear textarea and reset"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>{language === 'my' ? 'ရှင်းမည်' : 'Clear'}</span>
                </button>
              )}
            </div>

            {/* Real-Time Dynamic Input Counter & Visual Feedback */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
              {isExceeded ? (
                <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
                  <span>⛔</span>
                  <span>
                    {wordCount.toLocaleString()} / 1,500 words (Limit exceeded by {exceededWords.toLocaleString()} words)
                  </span>
                </div>
              ) : isWarning ? (
                <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
                  <span>⚠️</span>
                  <span>
                    {wordCount.toLocaleString()} / 1,500 words (Approaching maximum limit)
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                  <span>
                    {wordCount.toLocaleString()} words | {charCount.toLocaleString()} chars (Optimal length)
                  </span>
                </div>
              )}

              <span className="text-[11px] text-slate-500 font-sans">
                Safe: &lt; 1,000 words | Cap: 1,500 words
              </span>
            </div>

            {/* Exceeded Word Limit Warning Banner with Auto-Trim Action */}
            {isExceeded && (
              <div className="mt-3 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start space-x-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <p className="leading-relaxed font-sans">
                    စာလုံးရေ ၁,၅၀၀ ထက် ကျော်လွန်နေပါသည် (Exceeded Word Limit)။ API ပျက်ကျခြင်းနှင့် အချက်အလက် မပြည့်စုံခြင်းကို ကာကွယ်ရန် ကျေးဇူးပြု၍ အခန်းခွဲ သို့မဟုတ် အပိုင်းလိုက် (Chunks) ခွဲခြား၍ ထည့်သွင်းပေးပါရန်။
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTrimTo1400Words}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs whitespace-nowrap shrink-0 transition-colors shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>✂️ Trim to First 1,400 Words</span>
                </button>
              </div>
            )}

            {/* Action Buttons: Universal Multi-Format Upload & Explain */}
            <div className="mt-4 flex flex-wrap gap-2.5 items-center justify-between border-t border-slate-800/80 pt-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
                accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={extractingDocument}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                title="Upload PDF, Word, PPTX, Excel, or Image"
              >
                <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {language === 'my'
                    ? '📎 ဖိုင်/ပုံ/စာရွက်စာတမ်း တင်သွင်းမည် (PDF, Word, PPTX, Excel, Image)'
                    : '📎 Upload Document (PDF, Word, PPTX, Excel, Image)'}
                </span>
              </button>

              <button
                disabled={loading || (wordCount === 0 && !attachedDocument?.imageBase64) || isExceeded}
                onClick={handleExplain}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loading ? 'Analyzing Content...' : t.lesson.explainBtn}</span>
              </button>
            </div>
          </div>

          {/* Flashcard & UoPeople Tricky Quiz Generation Action Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-violet-400 font-bold text-xs uppercase tracking-wider">
                <Brain className="w-4 h-4" />
                <span>
                  {language === 'my'
                    ? 'UoPeople Tricky Quiz & Flashcards အလိုအလျောက် ထုတ်ယူခြင်း'
                    : 'UoPeople Tricky Quiz & SM-2 Flashcards'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {language === 'my'
                  ? 'ထည့်သွင်းထားသော သင်ခန်းစာမှ UoPeople စာမေးပွဲပုံစံ လှည့်ကွက်ပါ မေးခွန်းများနှင့် မှတ်ဉာဏ်ကတ် ၁၀ ခု ထုတ်ယူပါ'
                  : 'Generate a 10-question UoPeople-style tricky exam and SM-2 spaced repetition deck from this content.'}
              </p>
            </div>

            <button
              disabled={generatingCards || (!lessonContent.trim() && !parsedData && !rawTextResult)}
              onClick={handleGenerateCardsAndQuiz}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white text-xs font-bold shrink-0 transition-colors shadow-md shadow-violet-600/20 cursor-pointer"
            >
              <Brain className="w-4 h-4" />
              <span>{generatingCards ? 'Generating Exam...' : 'Generate 10 Questions'}</span>
            </button>
          </div>

          {cardsGeneratedSuccess && (
            <div className="p-4 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-200 text-xs flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-violet-400 shrink-0" />
                <span>
                  {language === 'my'
                    ? `UoPeople Quiz (${generatedQuizzes.length} ခု) နှင့် Flashcards (${generatedFlashcards.length} ခု) ကို အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ!`
                    : `Created ${generatedQuizzes.length} UoPeople Tricky Questions & ${generatedFlashcards.length} Flashcards!`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {(generatedQuizzes.length > 0 || generatedFlashcards.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setShowQuizPreview((p) => !p)}
                    className="font-semibold text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                  >
                    {showQuizPreview ? 'Hide Inline Preview' : 'Preview Questions'}
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('flashcards')}
                  className="font-bold underline text-violet-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                >
                  <span>{language === 'my' ? 'Quiz စတင်ဖြေဆိုမည်' : 'Take Quiz Now'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Inline UoPeople 10 Tricky Questions & Key Term Flashcards Preview */}
          {showQuizPreview && (generatedQuizzes.length > 0 || generatedFlashcards.length > 0) && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-violet-500/30 space-y-4 shadow-xl animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-violet-400" />
                  <span>
                    UoPeople Practice Exam ({generatedQuizzes.length} Questions) &amp; Flashcards ({generatedFlashcards.length})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuizPreview(false)}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Collapse
                </button>
              </div>

              {generatedQuizzes.length > 0 && (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {generatedQuizzes.map((q, qIdx) => {
                    const chosen = selectedAnswers[q.id];
                    const hasAnswered = chosen !== undefined;
                    return (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-violet-300">
                            Q{qIdx + 1}. ({q.questionType === 'except' ? 'EXCEPT' : q.questionType === 'true_false' ? 'True/False' : 'MCQ'})
                          </span>
                          {q.trapType && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-700/40">
                              {q.trapType}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-100 font-medium leading-relaxed">{q.question}</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oIdx) => {
                            const isPicked = chosen === oIdx;
                            const isCorrect = oIdx === q.correctIndex;
                            let style =
                              'bg-slate-900 border-slate-800 text-slate-300 hover:border-violet-500/50';
                            if (hasAnswered) {
                              if (isCorrect) {
                                style = 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 font-semibold';
                              } else if (isPicked) {
                                style = 'bg-rose-950/60 border-rose-500/60 text-rose-200';
                              }
                            }
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                                }
                                className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${style}`}
                              >
                                <span className="font-mono font-bold mr-1.5">
                                  {String.fromCharCode(65 + oIdx)}.
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                        {hasAnswered && (
                          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                            <strong className="text-emerald-300">Rationale:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {generatedFlashcards.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider block">
                    Key Term Flashcards ({generatedFlashcards.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {generatedFlashcards.map((fc, fIdx) => (
                      <div
                        key={fIdx}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]"
                      >
                        <div className="font-bold text-cyan-300">{fc.front}</div>
                        <div className="text-slate-300 leading-relaxed">{fc.back}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Exhaustive Dual-Language Explanation Output Container */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[560px] shadow-xl">
          {/* Top Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3 mb-3">
            <div className="flex items-center space-x-2 overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 truncate">
                {parsedData?.analysisTitle ||
                  (language === 'my'
                    ? 'သင်ခန်းစာ ရှင်းလင်းချက် & အနှစ်ချုပ်'
                    : 'Bilingual Academic Breakdown')}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {/* Highlight Toggle */}
              <button
                onClick={() => setHighlightEnabled(!highlightEnabled)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  highlightEnabled
                    ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Toggle AI Analysis Key Concept Highlighting"
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>{highlightEnabled ? 'Highlight: ON' : 'Highlight: OFF'}</span>
              </button>

              {/* Color Theme Selector */}
              {highlightEnabled && (
                <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <Palette className="w-3 h-3 text-slate-400 mr-1" />
                  {(Object.keys(COLOR_THEMES) as HighlightColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setHighlightColor(c)}
                      className={`w-4 h-4 rounded-full transition-transform ${COLOR_THEMES[c].bg} ${
                        highlightColor === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                      title={COLOR_THEMES[c].name}
                    />
                  ))}
                </div>
              )}

              {(parsedData || rawTextResult) && (
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-950 border border-slate-800 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t.common.copied : t.common.copy}</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Concept Tags Bar */}
          {parsedData && parsedData.keyConceptTags && parsedData.keyConceptTags.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center space-x-1.5 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {language === 'my'
                      ? 'AI စိစစ်ချက်အရ အဓိက အရေးကြီးသော Concept များ'
                      : 'Key Conceptual Tags Analyzed'}
                  </span>
                </span>
                {filterConcept && (
                  <button
                    onClick={() => setFilterConcept(null)}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {parsedData.keyConceptTags.map((tag, i) => {
                  const isSelected = filterConcept === tag;
                  return (
                    <button
                      key={i}
                      onClick={() => setFilterConcept(isSelected ? null : tag)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all border flex items-center space-x-1 cursor-pointer ${
                        isSelected
                          ? `${COLOR_THEMES[highlightColor].badge} ring-2 ring-white`
                          : 'bg-slate-900 text-slate-200 border-slate-700/80 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <Tag className="w-3 h-3 opacity-70" />
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary View Switcher Tabs: Burmese Breakdown vs English Pure Mode */}
          {parsedData && (
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs mb-4">
              <button
                type="button"
                onClick={() => setActiveOutputTab('burmese')}
                className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  activeOutputTab === 'burmese'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇲🇲 မြန်မာဘာသာဖြင့် အသေးစိတ် ရှင်းလင်းချက် (Burmese Breakdown)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveOutputTab('english')}
                className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  activeOutputTab === 'english'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇬🇧 Comprehensive Academic Synthesis (English Pure Mode)</span>
              </button>
            </div>
          )}

          {/* Content Render Area */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
              <div className="w-9 h-9 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-center max-w-xs">
                {language === 'my'
                  ? 'ဖိုင်ပါ အကြောင်းအရာများကို AI ဖြင့် အသေးစိတ် သုံးသပ်နေပါသည်...'
                  : 'Analyzing document contents with AI in deep synthesis...'}
              </p>
            </div>
          ) : parsedData ? (
            <div className="flex-1 overflow-y-auto max-h-[580px] pr-2 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans space-y-4">
              {/* TAB 1: BURMESE BREAKDOWN */}
              {activeOutputTab === 'burmese' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Card 1: Comprehensive Burmese Explanation */}
                  <div className="p-4.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center space-x-2">
                      <Bookmark className="w-4 h-4 text-emerald-400" />
                      <span>သဘောတရားနှင့် အသေးစိတ် ရှင်းလင်းချက် (Comprehensive Explanation)</span>
                    </h3>
                    <div className="text-slate-200 leading-relaxed font-sans space-y-2">
                      {renderMathAndText(parsedData.burmeseAnalysis.comprehensiveExplanation)}
                    </div>
                  </div>

                  {/* Card 2: Core Takeaways & Conceptual Findings */}
                  {parsedData.burmeseAnalysis.coreTakeaways &&
                    parsedData.burmeseAnalysis.coreTakeaways.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          <span>အဓိက သဘောတရားနှင့် တွေ့ရှိချက်များ (Core Concepts & Takeaways)</span>
                        </h4>

                        <div className="grid grid-cols-1 gap-2.5">
                          {parsedData.burmeseAnalysis.coreTakeaways.map((point, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5 shadow-sm"
                            >
                              <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
                                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-mono shrink-0">
                                  {idx + 1}
                                </span>
                                <span>{point.pointTitle}</span>
                              </div>
                              <div className="text-slate-300 text-xs pl-7 leading-relaxed">
                                {renderMathAndText(point.explanation)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Card 3: UoPeople Assignment & Academic Application */}
                  {parsedData.burmeseAnalysis.uopeopleAcademicApplication && (
                    <div className="p-4.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                      <h4 className="text-xs font-bold text-amber-300 flex items-center space-x-2">
                        <GraduationCap className="w-4 h-4 text-amber-400" />
                        <span>
                          UoPeople Assignment & Academic Application (ပညာရပ်ဆိုင်ရာ လက်တွေ့အသုံးချမှု)
                        </span>
                      </h4>
                      <div className="text-slate-200 leading-relaxed font-sans text-xs">
                        {renderMathAndText(parsedData.burmeseAnalysis.uopeopleAcademicApplication)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ENGLISH PURE SYNTHESIS */}
              {activeOutputTab === 'english' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Card 1: Executive Academic Synthesis */}
                  <div className="p-4.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <span>Executive Academic Synthesis</span>
                    </h3>
                    <div className="text-slate-200 leading-relaxed font-sans space-y-2">
                      {renderMathAndText(parsedData.englishAnalysis.executiveSynthesis)}
                    </div>
                  </div>

                  {/* Card 2: Thematic Pillars */}
                  {parsedData.englishAnalysis.thematicPillars &&
                    parsedData.englishAnalysis.thematicPillars.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-cyan-400" />
                          <span>Thematic Pillars & Theoretical Mechanisms</span>
                        </h4>

                        <div className="grid grid-cols-1 gap-2.5">
                          {parsedData.englishAnalysis.thematicPillars.map((pillar, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5 shadow-sm"
                            >
                              <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-mono shrink-0">
                                  {pIdx + 1}
                                </span>
                                <span>{pillar.title}</span>
                              </div>
                              <div className="text-slate-300 text-xs pl-7 leading-relaxed">
                                {renderMathAndText(pillar.explanation)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Card 3: Actionable Academic Takeaways */}
                  {parsedData.englishAnalysis.actionableTakeaways &&
                    parsedData.englishAnalysis.actionableTakeaways.length > 0 && (
                      <div className="p-4.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2.5">
                        <h4 className="text-xs font-bold text-violet-300 flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-violet-400" />
                          <span>Actionable Academic Takeaways</span>
                        </h4>
                        <ul className="space-y-2 text-xs text-slate-200">
                          {parsedData.englishAnalysis.actionableTakeaways.map((takeaway, tkIdx) => (
                            <li key={tkIdx} className="flex items-start space-x-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                              <span className="leading-relaxed">{takeaway}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
          ) : rawTextResult ? (
            <div className="flex-1 overflow-y-auto max-h-[580px] pr-2 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              {renderMathAndText(rawTextResult)}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <BookOpen className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-xs max-w-sm">
                {language === 'my'
                  ? 'သင်ခန်းစာ သို့မဟုတ် ဖိုင်မှတ်စုများကို ဘယ်ဘက်တွင် ထည့်၍ ခလုတ်နှိပ်ပါ'
                  : 'Paste lecture content, upload document, or drag & drop a file on the left to generate exhaustive Burmese & English academic synthesis.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Privacy & BYOK Settings Modal */}
      <PrivacySettingsModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};
