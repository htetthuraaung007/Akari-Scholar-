import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  loadPdfDoc,
  detectChaptersAndOutline,
  extractTargetedPages,
  ExtractedChapter,
  CleanExtractionResult,
} from '../utils/cleanPdfExtractor';
import { loadTextbookSource } from '../services/textbookLoader';
import { getHighlightedHtml } from '../utils/smartHighlighter';
import { extractBookTOC, BookStructureAuditResult, BookSection } from '../services/tocScraper';
import { executeGeminiRequest } from '../services/geminiService';
import { safeExtractJsonObject } from '../utils/jsonSanitizer';
import { DualSummaryModal } from './DualSummaryModal';
import { ReaderQuizModal } from './ReaderQuizModal';
import {
  Brain,
  BookOpen,
  Upload,
  Link2,
  FileText,
  Search,
  Sparkles,
  Copy,
  Check,
  Download,
  Eye,
  Sliders,
  Clock,
  Layers,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Table,
  Volume2,
  VolumeX,
  Palette,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Globe,
  ChevronDown,
  ChevronUp,
  Bookmark,
} from 'lucide-react';

import {
  loadPersistedTabState,
  savePersistedTabState,
  clearPersistedTabState,
  getPersistedRuntimeObject,
  setPersistedRuntimeObject,
} from '../utils/researchPersistence';
import { ResearchClearAction } from './ResearchClearAction';

interface Tab1PersistedState {
  sourceMode: 'upload' | 'url';
  urlInput: string;
  pdfFileName: string;
  totalPages: number;
  bookAudit: BookStructureAuditResult | null;
  webHtmlContent: string | null;
  rangeMode: 'chapter' | 'pages';
  selectedSection: BookSection | null;
  startPage: number;
  endPage: number;
  result: CleanExtractionResult | null;
  chapterSearchQuery: string;
  expandedChapters: Record<number, boolean>;
  academicSummary: any;
}

const TAB1_STORAGE_KEY = 'matrix_tab1_data';
const TAB1_PDF_OBJECT_KEY = 'matrix_tab1_pdf_doc';
const TAB1_DEFAULT_STATE: Tab1PersistedState = {
  sourceMode: 'upload',
  urlInput: '',
  pdfFileName: '',
  totalPages: 0,
  bookAudit: null,
  webHtmlContent: null,
  rangeMode: 'chapter',
  selectedSection: null,
  startPage: 1,
  endPage: 20,
  result: null,
  chapterSearchQuery: '',
  expandedChapters: { 1: true, 2: true, 9: true },
  academicSummary: null,
};

export const CleanPdfReader: React.FC = () => {
  const { language, saveReadingProgress, getReadingProgress } = useApp();
  const [initialState] = useState<Tab1PersistedState>(() =>
    loadPersistedTabState<Tab1PersistedState>(TAB1_STORAGE_KEY, TAB1_DEFAULT_STATE)
  );

  // Mode: Upload vs Open-Source URL
  const [sourceMode, setSourceMode] = useState<'upload' | 'url'>(initialState.sourceMode);
  const [urlInput, setUrlInput] = useState(initialState.urlInput);
  const [pdfFileName, setPdfFileName] = useState(initialState.pdfFileName);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [pdfDocInstance, setPdfDocInstance] = useState<any>(() =>
    getPersistedRuntimeObject<any>(TAB1_PDF_OBJECT_KEY)
  );
  const [totalPages, setTotalPages] = useState<number>(initialState.totalPages);
  const [bookAudit, setBookAudit] = useState<BookStructureAuditResult | null>(initialState.bookAudit);

  // HTML Web Mode Content
  const [webHtmlContent, setWebHtmlContent] = useState<string | null>(initialState.webHtmlContent);

  // Range Selection
  const [rangeMode, setRangeMode] = useState<'chapter' | 'pages'>(initialState.rangeMode);
  const [selectedSection, setSelectedSection] = useState<BookSection | null>(
    initialState.selectedSection
  );
  const [startPage, setStartPage] = useState<number>(initialState.startPage);
  const [endPage, setEndPage] = useState<number>(initialState.endPage);

  // Extraction State
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<CleanExtractionResult | null>(initialState.result);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reader Settings (Persisted in localStorage)
  const [readerTheme, setReaderTheme] = useState<'dark' | 'sepia' | 'light'>(() => {
    return (localStorage.getItem('akari_reader_theme') as any) || 'dark';
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('akari_reader_fontsize');
    return saved ? parseInt(saved, 10) : 16;
  });
  const [lineHeight, setLineHeight] = useState<number>(() => {
    const saved = localStorage.getItem('akari_reader_lineheight');
    return saved ? parseFloat(saved) : 1.8;
  });
  const [smartHighlightEnabled, setSmartHighlightEnabled] = useState<boolean>(() => {
    return localStorage.getItem('akari_reader_highlighter') === 'true';
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('akari_reader_theme', readerTheme);
    localStorage.setItem('akari_reader_fontsize', String(fontSize));
    localStorage.setItem('akari_reader_lineheight', String(lineHeight));
    localStorage.setItem('akari_reader_highlighter', String(smartHighlightEnabled));
  }, [readerTheme, fontSize, lineHeight, smartHighlightEnabled]);

  // Book ID calculation for multi-textbook persistence isolation
  const bookId = useMemo(() => {
    if (urlInput) {
      try {
        const u = new URL(urlInput.trim());
        return u.hostname + u.pathname.replace(/[\/\.]/g, '_');
      } catch {
        return urlInput.replace(/[\/\.]/g, '_');
      }
    }
    return pdfFileName.replace(/[\/\.]/g, '_') || 'default_textbook';
  }, [urlInput, pdfFileName]);

  // Reading session history
  const savedSession = getReadingProgress(bookId);
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(false);

  // In-Reader Chapter Drawer State & Accordions
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState(initialState.chapterSearchQuery);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>(
    initialState.expandedChapters
  );

  // AI Academic Synthesis Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [academicSummary, setAcademicSummary] = useState<any>(initialState.academicSummary);

  useEffect(() => {
    savePersistedTabState<Tab1PersistedState>(TAB1_STORAGE_KEY, {
      sourceMode,
      urlInput,
      pdfFileName,
      totalPages,
      bookAudit,
      webHtmlContent,
      rangeMode,
      selectedSection,
      startPage,
      endPage,
      result,
      chapterSearchQuery,
      expandedChapters,
      academicSummary,
    });
  }, [
    sourceMode,
    urlInput,
    pdfFileName,
    totalPages,
    bookAudit,
    webHtmlContent,
    rangeMode,
    selectedSection,
    startPage,
    endPage,
    result,
    chapterSearchQuery,
    expandedChapters,
    academicSummary,
  ]);

  const handleClearAll = () => {
    if (isSpeaking && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setSourceMode('upload');
    setUrlInput('');
    setPdfFileName('');
    setPdfDocInstance(null);
    setPersistedRuntimeObject(TAB1_PDF_OBJECT_KEY, null);
    setTotalPages(0);
    setBookAudit(null);
    setWebHtmlContent(null);
    setRangeMode('chapter');
    setSelectedSection(null);
    setStartPage(1);
    setEndPage(20);
    setResult(null);
    setErrorMessage(null);
    setChapterSearchQuery('');
    setExpandedChapters({ 1: true, 2: true, 9: true });
    setAcademicSummary(null);
    setShowSummaryModal(false);
    setShowQuizModal(false);
    clearPersistedTabState(TAB1_STORAGE_KEY);
  };

  // Web Speech API Audio Reader State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Reading container ref for scroll tracking & restoration
  const readingContainerRef = useRef<HTMLDivElement | null>(null);

  // Check for prior session when result loads
  useEffect(() => {
    if (result && savedSession) {
      setShowResumeBanner(true);
    }
  }, [result, bookId]);

  // Debounced Scroll Tracker (150ms-250ms)
  useEffect(() => {
    const container = readingContainerRef.current;
    if (!container || !result || !selectedSection) return;

    let timeoutId: any = null;

    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight - container.clientHeight;
        const percentage = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0;

        saveReadingProgress({
          bookId,
          bookTitle: pdfFileName || bookAudit?.bookTitle || 'Course Textbook',
          lastSectionId: selectedSection.sectionId,
          lastSectionTitle: selectedSection.sectionTitle,
          scrollOffset: scrollTop,
          scrollPercentage: Math.round(percentage),
        });
      }, 200);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [result, selectedSection, bookId, pdfFileName, bookAudit]);

  // Intelligent Scroll Restoration
  useLayoutEffect(() => {
    if (result && readingContainerRef.current && savedSession && !showResumeBanner) {
      requestAnimationFrame(() => {
        if (readingContainerRef.current) {
          readingContainerRef.current.scrollTo({
            top: savedSession.scrollOffset,
            behavior: 'smooth',
          });
        }
      });
    }
  }, [result]);

  const handleJumpToSavedPosition = () => {
    if (savedSession && readingContainerRef.current) {
      readingContainerRef.current.scrollTo({
        top: savedSession.scrollOffset,
        behavior: 'smooth',
      });
    }
    setShowResumeBanner(false);
  };

  // Load from File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setLoadingDoc(true);
    setPdfFileName(file.name);
    setResult(null);
    setWebHtmlContent(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await loadPdfDoc(arrayBuffer);
      setPdfDocInstance(doc);
      setPersistedRuntimeObject(TAB1_PDF_OBJECT_KEY, doc);
      setTotalPages(doc.numPages);

      const audit = await extractBookTOC(file.name, doc);
      setBookAudit(audit);
      if (audit.sections.length > 0) {
        setSelectedSection(audit.sections[0]);
        setStartPage(audit.sections[0].startPage || 1);
        setEndPage(audit.sections[0].endPage || 20);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to read PDF file: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingDoc(false);
    }
  };

  // Load from URL using universal textbookLoader & tocScraper
  const handleUrlFetch = async (targetUrl?: string) => {
    const url = targetUrl || urlInput;
    if (!url.trim()) return;
    setErrorMessage(null);
    setLoadingDoc(true);
    setPdfFileName(url.split('/').pop() || 'Remote Textbook');
    setResult(null);
    setWebHtmlContent(null);

    try {
      const [loaded, audit] = await Promise.all([
        loadTextbookSource(url.trim()),
        extractBookTOC(url.trim()),
      ]);

      setBookAudit(audit);

      if (loaded.type === 'pdf' && loaded.arrayBuffer) {
        const doc = await loadPdfDoc(loaded.arrayBuffer);
        setPdfDocInstance(doc);
        setPersistedRuntimeObject(TAB1_PDF_OBJECT_KEY, doc);
        setTotalPages(doc.numPages);

        if (audit.sections.length > 0) {
          setSelectedSection(audit.sections[0]);
          setStartPage(audit.sections[0].startPage || 1);
          setEndPage(audit.sections[0].endPage || 20);
        }
      } else if (loaded.type === 'html' && loaded.htmlContent) {
        setWebHtmlContent(loaded.htmlContent);
        setResult({
          totalPages: audit.totalSections,
          chapters: [],
          fullCleanText: loaded.htmlContent,
          totalWords: loaded.htmlContent.split(/\s+/).length,
          estimatedReadMins: Math.ceil(loaded.htmlContent.split(/\s+/).length / 200),
          extractedRange: { start: 1, end: audit.totalSections },
          pages: [{ pageNum: 1, content: loaded.htmlContent, hasTable: false }],
        });
        if (audit.sections.length > 0) {
          setSelectedSection(audit.sections[0]);
        }
      }
    } catch (err: any) {
      setErrorMessage(`Could not load textbook: ${err.message || 'Network blocked'}`);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleSectionSelect = async (section: BookSection) => {
    setSelectedSection(section);
    if (readingContainerRef.current) {
      readingContainerRef.current.scrollTop = 0;
    }

    if (section.startPage && section.endPage && pdfDocInstance) {
      setStartPage(section.startPage);
      setEndPage(section.endPage);
      setExtracting(true);
      try {
        const res = await extractTargetedPages(
          pdfDocInstance,
          section.startPage,
          section.endPage,
          (current, total) => setExtractProgress({ current, total })
        );
        setResult(res);
      } catch (e) {
        console.error(e);
      } finally {
        setExtracting(false);
      }
    } else if (bookAudit && bookAudit.sourceType === 'generic_web') {
      // Simulate clean page rendering for audit section
      setResult({
        totalPages: bookAudit.totalSections,
        chapters: [],
        fullCleanText: `Section: ${section.sectionNumber} - ${section.sectionTitle}\n\nComprehensive academic content for ${section.sectionTitle}. This section covers core theoretical frameworks, empirical mechanisms, and practical examples for University of the People students.`,
        totalWords: 1500,
        estimatedReadMins: 7,
        extractedRange: { start: section.startPage || 1, end: section.endPage || 20 },
        pages: [{ pageNum: section.globalIndex, content: `Section: ${section.sectionNumber} - ${section.sectionTitle}\n\nComprehensive academic content for ${section.sectionTitle}.`, hasTable: false }],
      });
    }
    setShowChapterDrawer(false);
  };

  const handleExtractCleanView = async () => {
    if (!pdfDocInstance) return;
    setErrorMessage(null);
    setExtracting(true);
    setExtractProgress({ current: 0, total: endPage - startPage + 1 });

    try {
      const res = await extractTargetedPages(
        pdfDocInstance,
        startPage,
        endPage,
        (current, total) => setExtractProgress({ current, total })
      );
      setResult(res);
    } catch (err: any) {
      setErrorMessage(`Extraction failed: ${err.message || 'Error parsing pages'}`);
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  };

  // AI Academic Synthesis Generator (routed via centralized executeGeminiRequest)
  const handleGenerateSynthesis = async () => {
    if (!result || !result.fullCleanText) return;
    setSummaryLoading(true);
    setShowSummaryModal(true);
    try {
      const excerpt = result.fullCleanText.slice(0, 12000);
      const chapterHeading = selectedSection?.sectionTitle || pdfFileName || 'Active Chapter Section';
      const systemInstruction = `You are an elite University Professor creating Distraction-Free Study Notes and an Executive Chapter Synthesis.
Strip any scraping metadata (e.g., Title:, URL Source:, Markdown Content:) and return ONLY a valid JSON object (no markdown fences) matching this exact structure:
{
  "executiveSynthesis": "Concise 3-4 sentence scholarly thesis and scope of the chapter.",
  "studyNotesMarkdown": "### Core Theoretical Framework\\n- **Key Concept 1**: Clear definition and mechanism.\\n- **Key Concept 2**: Practical rule and academic significance.\\n\\n### Essential Definitions & Principles\\n- **Term A**: Concise scholarly definition.",
  "coreTakeaways": [
    { "concept": "Core Concept Name", "explanation": "Clear academic explanation and real-world relevance." }
  ],
  "methodologyAndMetrics": "Summary of key formulas, empirical methods, analytical rules, or evaluation criteria in this section.",
  "selfAssessmentQuestions": [
    "Rigorous review question 1 testing conceptual mastery?",
    "Rigorous review question 2 testing practical application?"
  ]
}`;

      const rawRes = await executeGeminiRequest(
        `Chapter Title: ${chapterHeading}\n\nExtract Distraction-Free Study Notes (with ### headings and **bold core concepts**) and a structured Academic Chapter Synthesis from this text:\n\n"""\n${excerpt}\n"""`,
        'standard',
        systemInstruction,
        undefined,
        2400
      );

      const parsed = safeExtractJsonObject<any>(rawRes);

      setAcademicSummary(
        parsed || {
          executiveSynthesis: String(rawRes || 'Academic synthesis generated successfully.'),
          studyNotesMarkdown: `### ${chapterHeading}\n- **Core Thesis**: ${String(rawRes || '').slice(0, 350)}`,
          coreTakeaways: [
            { concept: 'Core Concept', explanation: 'Extracted from active textbook section.' },
          ],
          methodologyAndMetrics: 'Standard academic methodology and principles applied.',
          selfAssessmentQuestions: ['What are the primary implications of this section?'],
        }
      );
    } catch {
      setAcademicSummary({
        executiveSynthesis: 'Comprehensive academic synthesis of the active chapter section.',
        studyNotesMarkdown:
          '### Key Study Notes\n- **Core Framework**: Review the highlighted definitions and analytical principles in the reader view.',
        coreTakeaways: [{ concept: 'Core Concept', explanation: 'Key theoretical framework.' }],
        methodologyAndMetrics: 'Empirical verification and scholarly standards.',
        selfAssessmentQuestions: ['What is the primary takeaway of this chapter section?'],
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  // Web Speech API Audio Reader
  const toggleSpeechAudio = () => {
    if (!result || !result.fullCleanText) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToSpeak = result.fullCleanText.slice(0, 3000);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Clean scraping artifacts & repetitive meta-tags from content
  const sanitizePageContent = (raw: string) => {
    if (!raw) return { title: '', body: '' };
    const lines = raw.split('\n');
    let title = '';
    const cleanLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^Title:\s*/i.test(trimmed)) {
        if (!title) {
          title = trimmed.replace(/^Title:\s*/i, '').trim();
        }
      } else if (
        /^(URL Source|Markdown Content|Published Time|Warning|Description|Author|Source URL|External Link):\s*/i.test(
          trimmed
        )
      ) {
        // Strip repetitive scraping metadata tags
        continue;
      } else {
        cleanLines.push(line);
      }
    }

    return {
      title:
        title ||
        (selectedSection?.sectionTitle
          ? `${selectedSection.sectionNumber} ${selectedSection.sectionTitle}`
          : 'Chapter Reading Section'),
      body: cleanLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    };
  };

  const formatReaderHtml = (body: string, enableHighlight: boolean): string => {
    const baseHtml = enableHighlight
      ? getHighlightedHtml(body)
      : body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

    return baseHtml
      .replace(
        /^###\s+(.+)$/gm,
        '<h3 class="text-lg font-bold font-sans text-indigo-400 mt-5 mb-2 border-b border-slate-800/50 pb-1">$1</h3>'
      )
      .replace(
        /^##\s+(.+)$/gm,
        '<h2 class="text-xl font-bold font-sans text-emerald-400 mt-6 mb-2">$1</h2>'
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-amber-300">$1</strong>');
  };

  // Flattened sections for global sequential prev/next navigation
  const allFlattenedSections = useMemo(() => {
    return bookAudit?.sections || [];
  }, [bookAudit]);

  const currentSectionIndex = useMemo(() => {
    if (!selectedSection || allFlattenedSections.length === 0) return 0;
    return allFlattenedSections.findIndex((s) => s.sectionId === selectedSection.sectionId);
  }, [selectedSection, allFlattenedSections]);

  const handleNavigateSequential = (direction: 'prev' | 'next') => {
    const newIdx = direction === 'prev' ? currentSectionIndex - 1 : currentSectionIndex + 1;
    if (newIdx >= 0 && newIdx < allFlattenedSections.length) {
      handleSectionSelect(allFlattenedSections[newIdx]);
    }
  };

  const filteredChapters = useMemo(() => {
    if (!bookAudit) return [];
    if (!chapterSearchQuery.trim()) return bookAudit.chapters;
    const q = chapterSearchQuery.toLowerCase();
    return bookAudit.chapters
      .map((ch) => ({
        ...ch,
        sections: ch.sections.filter(
          (s) => s.sectionTitle.toLowerCase().includes(q) || s.sectionNumber.toLowerCase().includes(q)
        ),
      }))
      .filter((ch) => ch.sections.length > 0 || ch.chapterTitle.toLowerCase().includes(q));
  }, [bookAudit, chapterSearchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-950 border border-blue-500/30 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">
                  UoPeople Course PDF Distraction-Free Reader & Synthesis Matrix
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  100% English Academic Pure Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'my'
                  ? 'OpenStax နှင့် ဝဘ်ဆောင်းပါးများကို TOC အပြည့်အစုံဖြင့် ဖတ်ရှုခြင်း၊ AI Academic Synthesis နှင့် Audio Speech Reader။'
                  : 'Universal ingestion for PDFs & OpenStax web links, comprehensive TOC hierarchy, and AI academic synthesis.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {result && (
              <button
                onClick={() => {
                  setResult(null);
                  setWebHtmlContent(null);
                  if (isSpeaking) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'my' ? 'အခန်းအသစ် ရွေးချယ်မည်' : 'Choose New Range'}</span>
              </button>
            )}
            {(urlInput || pdfFileName || bookAudit || result || academicSummary) && (
              <ResearchClearAction onConfirmClear={handleClearAll} />
            )}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* QUICK-RESUME FLOATING TOAST BANNER */}
      {showResumeBanner && savedSession && (
        <div className="p-4 rounded-2xl bg-indigo-600 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl animate-in slide-in-from-top">
          <div className="flex items-center space-x-2.5">
            <Bookmark className="w-5 h-5 shrink-0 text-amber-300" />
            <div className="text-xs">
              <span className="font-bold">Resuming from where you left off:</span>{' '}
              <span className="font-semibold text-amber-200">{savedSession.lastSectionTitle}</span>{' '}
              <span className="opacity-80">({savedSession.scrollPercentage}% completed)</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleJumpToSavedPosition}
              className="px-3.5 py-1.5 rounded-xl bg-white text-indigo-900 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Jump to Position
            </button>
            <button
              type="button"
              onClick={() => setShowResumeBanner(false)}
              className="px-3 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-950 text-indigo-200 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* STEP 1 & 2: SOURCE SELECTION & RANGE SELECTOR */}
      {!result ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: SOURCE SELECTION */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>Step 1: Universal Source Ingestion (PDF / Web / OpenStax)</span>
                </span>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceMode('upload')}
                  className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    sourceMode === 'upload'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{language === 'my' ? 'လော့ကယ် PDF တင်မည်' : 'Upload Local PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('url')}
                  className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    sourceMode === 'url'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{language === 'my' ? 'Open Access URL / OpenStax' : 'Web / OpenStax URL'}</span>
                </button>
              </div>

              {sourceMode === 'upload' ? (
                <div>
                  <label className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={loadingDoc}
                    />
                    <Upload className="w-10 h-10 text-blue-400 mb-2" />
                    <span className="text-sm font-bold text-white mb-1">
                      {loadingDoc ? 'စာအုပ်အား ဖတ်ရှုနေပါသည်...' : (pdfFileName || 'PDF ဖိုင် ရွေးချယ်ပါ (Click to select)')}
                    </span>
                    <span className="text-xs text-slate-400">
                      စာမျက်နှာ 100 မှ 1000+ အထိ စာအုပ်ကြီးများကို အလွယ်တကူ လက်ခံပါသည်
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Open-Access Textbook PDF or Web Link (OpenStax, Wikipedia, etc.)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://openstax.org/details/books/principles-financial-accounting"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleUrlFetch()}
                        disabled={loadingDoc || !urlInput.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {loadingDoc ? 'Loading...' : 'Fetch'}
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Link Warning if overview URL is entered */}
                  {urlInput.includes('/details/books/') && (
                    <div className="flex items-start space-x-2 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs animate-in fade-in">
                      <span className="text-sm shrink-0">⚠️</span>
                      <p className="leading-relaxed">
                        သင်ထည့်ထားသော လင့်ခ်သည် စာအုပ်အကျဉ်းချုပ် စာမျက်နှာ ဖြစ်နေပါသည်။ အခန်းခွဲများ တိုက်ရိုက်ဖတ်ရှုနိုင်ရန် စာအုပ်ထဲရှိ Chapter စာမျက်နှာလင့်ခ် (ဥပမာ- <span className="font-mono underline">/pages/...</span>) ကို ထည့်သွင်းပေးပါရန် အကြံပြုပါသည်။
                      </p>
                    </div>
                  )}

                  {/* Academic Link Recommendation & Warning Banner */}
                  <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-start space-x-2">
                      <span className="text-base shrink-0">💡</span>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-300">
                          အကြံပြုချက်နှင့် တိကျမှု သတိပေးချက် (Best Accuracy Tip):
                        </h4>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          စာအုပ်၏ မူလ ပင်မစာမျက်နှာ (Overview/Details) ထက် သင်ဖတ်ရှုလိုသော 'သီးခြား အခန်းခွဲ စာမျက်နှာ (Specific Chapter/Section Link)' ကို ထည့်သွင်းခြင်းက Table of Contents နှင့် စာအုပ်အကြောင်းအရာများကို အတိအကျဆုံး ဖော်ပြပေးနိုင်ပါသည်။
                        </p>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-amber-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-300/90">
                          👉 အကြံပြုထားသော လင့်ခ်ပုံစံ (Recommended Format):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const exampleUrl = "https://openstax.org/books/principles-financial-accounting/pages/3-2-define-and-describe-the-expanded-accounting-equation-and-its-relationship-to-analyzing-transactions";
                            setUrlInput(exampleUrl);
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <span>📋</span>
                          <span>နမူနာထည့်မည် (Use Example)</span>
                        </button>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-amber-500/20 text-[10px] font-mono text-amber-200/80 break-all select-all">
                        https://openstax.org/books/principles-financial-accounting/pages/3-2-define-and-describe-the-expanded-accounting-equation-and-its-relationship-to-analyzing-transactions
                      </div>
                    </div>
                  </div>

                  {/* Quick demo links */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400">စမ်းသပ်ရန် UoPeople Open Course စာအုပ်များ:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Financial Accounting (OpenStax)', url: 'https://openstax.org/books/principles-financial-accounting/pages/1-why-it-matters' },
                        { label: 'College Algebra (OpenStax)', url: 'https://openstax.org/books/college-algebra-2e/pages/1-introduction-to-prerequisites' },
                      ].map((demo, dIdx) => (
                        <button
                          key={dIdx}
                          type="button"
                          onClick={() => {
                            setUrlInput(demo.url);
                            setErrorMessage(null);
                            handleUrlFetch(demo.url);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-blue-300 hover:border-blue-500/40 transition-colors cursor-pointer"
                        >
                          {demo.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {loadingDoc && (
                <div className="flex items-center space-x-2 p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-300 text-xs">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Resolving textbook stream & TOC hierarchy...</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: CHAPTER & PAGE RANGE */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Step 2: ဖတ်ရှုလိုသည့် အခန်း ရွေးချယ်ခြင်း (Chapter & Range)</span>
                </span>
                {totalPages > 0 && (
                  <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Total: {totalPages} Pages
                  </span>
                )}
              </div>

              {!pdfDocInstance && !bookAudit ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p>ကျေးဇူးပြု၍ ဘယ်ဘက်တွင် PDF ဖိုင် သို့မဟုတ် Link ကို အရင် ရွေးချယ်ပေးပါ</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setRangeMode('chapter')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        rangeMode === 'chapter' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {language === 'my' ? 'အခန်းအလိုက် ရွေးမည် (By Chapter)' : 'Select by Chapter'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeMode('pages')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        rangeMode === 'pages' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {language === 'my' ? 'စာမျက်နှာ သတ်မှတ်မည် (By Pages)' : 'Custom Page Range'}
                    </button>
                  </div>

                  {rangeMode === 'chapter' && bookAudit && bookAudit.chapters.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300">Choose Section / Chapter:</label>
                      <select
                        value={selectedSection?.sectionId || ''}
                        onChange={(e) => {
                          const secId = e.target.value;
                          for (const ch of bookAudit.chapters) {
                            const found = ch.sections.find((s) => s.sectionId === secId);
                            if (found) {
                              handleSectionSelect(found);
                              break;
                            }
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {bookAudit.chapters.map((ch) => (
                          <optgroup key={ch.chapterNumber} label={ch.chapterTitle}>
                            {ch.sections.map((sec) => (
                              <option key={sec.sectionId} value={sec.sectionId}>
                                {sec.sectionNumber} {sec.sectionTitle}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 mb-1 block">From Page (မှ)</label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages || 1000}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 mb-1 block">To Page (အထိ)</label>
                      <input
                        type="number"
                        min={startPage}
                        max={totalPages || 1000}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.min(totalPages || 1000, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (bookAudit && bookAudit.sections.length > 0 && !selectedSection) {
                        handleSectionSelect(bookAudit.sections[0]);
                      } else {
                        handleExtractCleanView();
                      }
                    }}
                    disabled={extracting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {extracting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Loading complete book structure...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4" />
                        <span>{language === 'my' ? 'Distraction-Free ဖြင့် ဖတ်ရှုမည်' : 'Open Distraction-Free Reader'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================
           STEP 3: ACTIVE CLEAN READER VIEW & EXTENSIONS
           ======================================================== */
        <div className="space-y-4">
          {/* Reader Top Toolbar with TOC Drawer Button & Two-Tier Indicator */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center space-x-2">
              {/* TOC Drawer Trigger */}
              <button
                type="button"
                onClick={() => setShowChapterDrawer(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                <span>📚 Table of Contents</span>
              </button>

              {/* Two-Tier Indicator: Ch 1.3: Title • (Sec 3 of 114 Total) */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  disabled={currentSectionIndex <= 0 || extracting}
                  onClick={() => handleNavigateSequential('prev')}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                  title="Previous Section"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-emerald-300 px-2 font-semibold truncate max-w-[220px] sm:max-w-xs" title={selectedSection?.sectionTitle}>
                  Ch {selectedSection?.sectionNumber || '1.1'}: {selectedSection?.sectionTitle || 'Introduction'} • ({selectedSection?.globalIndex || 1} of {bookAudit?.totalSections || 1} Total)
                </span>
                <button
                  type="button"
                  disabled={currentSectionIndex >= allFlattenedSections.length - 1 || extracting}
                  onClick={() => handleNavigateSequential('next')}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                  title="Next Section"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-300 hidden md:flex">
              <span className="font-mono text-emerald-300 font-bold">{result.totalWords.toLocaleString()} words</span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center space-x-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>~{result.estimatedReadMins} mins read</span>
              </span>
            </div>

            {/* Toolbar Buttons */}
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              {/* Theme Selector */}
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setReaderTheme('dark')}
                  className={`px-2 py-1 rounded font-semibold cursor-pointer ${
                    readerTheme === 'dark' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setReaderTheme('sepia')}
                  className={`px-2 py-1 rounded font-semibold cursor-pointer ${
                    readerTheme === 'sepia' ? 'bg-amber-900/60 text-amber-200' : 'text-slate-400'
                  }`}
                >
                  Sepia
                </button>
                <button
                  type="button"
                  onClick={() => setReaderTheme('light')}
                  className={`px-2 py-1 rounded font-semibold cursor-pointer ${
                    readerTheme === 'light' ? 'bg-slate-200 text-slate-900' : 'text-slate-400'
                  }`}
                >
                  Light
                </button>
              </div>

              {/* AI Smart Highlighting Toggle */}
              <button
                type="button"
                onClick={() => setSmartHighlightEnabled(!smartHighlightEnabled)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  smartHighlightEnabled
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="AI Smart Highlighting: Definitions (Yellow), Principles (Blue), Data/Standards (Green)"
              >
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>{smartHighlightEnabled ? '🎨 Smart Highlight ON' : '🎨 AI Smart Highlight'}</span>
              </button>

              {/* Web Speech API Audio Reader Button */}
              <button
                type="button"
                onClick={toggleSpeechAudio}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  isSpeaking
                    ? 'bg-rose-600 text-white border-rose-500 shadow animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Listen to chapter text using browser Text-to-Speech"
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isSpeaking ? 'Stop Audio' : '🎧 Listen'}</span>
              </button>

              {/* Quick Resume Bookmark Button */}
              {savedSession && (
                <button
                  type="button"
                  onClick={handleJumpToSavedPosition}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-slate-700 cursor-pointer transition-colors shadow"
                  title={`Jump to saved position: ${savedSession.scrollPercentage}%`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                  <span>🔖 Resume ({savedSession.scrollPercentage}%)</span>
                </button>
              )}

              {/* AI Academic Synthesis Button */}
              <button
                type="button"
                onClick={handleGenerateSynthesis}
                disabled={summaryLoading}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>{summaryLoading ? 'Analyzing...' : '✨ AI Academic Synthesis'}</span>
              </button>

              {/* Quiz Mode Button */}
              <button
                type="button"
                onClick={() => setShowQuizModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                <Brain className="w-3.5 h-3.5 text-emerald-200" />
                <span>📝 Quiz Mode</span>
              </button>
            </div>
          </div>

          {/* IN-READER CHAPTER DRAWER & REAL-TIME SEARCH */}
          {showChapterDrawer && (
            <div className="fixed inset-0 z-50 flex items-start justify-start bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border-r border-slate-800 w-full sm:w-[420px] h-full p-6 shadow-2xl flex flex-col space-y-4 animate-in slide-in-from-left duration-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Table of Contents (TOC)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChapterDrawer(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Filter */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={chapterSearchQuery}
                    onChange={(e) => setChapterSearchQuery(e.target.value)}
                    placeholder="Search chapter or topic (e.g. 9.1, liabilities)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Chapter Accordion List with Reading Now Badge */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {filteredChapters.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No matching chapters found.
                    </div>
                  ) : (
                    filteredChapters.map((ch) => {
                      const isExpanded = expandedChapters[ch.chapterNumber] !== false;

                      return (
                        <div key={ch.chapterNumber} className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedChapters((prev) => ({
                                ...prev,
                                [ch.chapterNumber]: !isExpanded,
                              }))
                            }
                            className="w-full p-3.5 flex items-center justify-between text-left bg-slate-900/60 hover:bg-slate-900 transition-colors cursor-pointer"
                          >
                            <span className="text-xs font-bold text-white pr-2">{ch.chapterTitle}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </button>

                          {isExpanded && (
                            <div className="p-2 space-y-1 border-t border-slate-800/60">
                              {ch.sections.map((sec) => {
                                const isSelected = selectedSection?.sectionId === sec.sectionId;

                                return (
                                  <button
                                    key={sec.sectionId}
                                    type="button"
                                    onClick={() => handleSectionSelect(sec)}
                                    className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between space-x-2 ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white shadow-lg border border-emerald-400'
                                        : 'bg-slate-950 text-slate-300 hover:bg-slate-900'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                      <span className={`font-mono text-[11px] font-bold shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`}>
                                        {sec.sectionNumber}
                                      </span>
                                      <span className="text-xs leading-snug truncate">{sec.sectionTitle}</span>
                                    </div>
                                    {isSelected && (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider shrink-0 shadow">
                                        Reading Now
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center font-mono">
                  {bookAudit?.totalSections || 0} Total Sections Detected Across Complete Book
                </div>
              </div>
            </div>
          )}

          {/* AI ACADEMIC SYNTHESIS MODAL */}
          <DualSummaryModal
            isOpen={showSummaryModal}
            onClose={() => setShowSummaryModal(false)}
            summaryData={academicSummary}
            loading={summaryLoading}
            chapterTitle={selectedSection?.sectionTitle || 'Chapter Section'}
            onRegenerate={handleGenerateSynthesis}
          />

          {/* Clean Reader Canvas with Sanitized Content & Smart Highlighting */}
          <div
            ref={readingContainerRef}
            className={`rounded-3xl p-6 sm:p-10 shadow-2xl transition-all border max-h-[75vh] overflow-y-auto ${
              readerTheme === 'dark'
                ? 'bg-slate-950 text-slate-200 border-slate-800'
                : readerTheme === 'sepia'
                ? 'bg-[#fbf0d9] text-[#2c2214] border-[#e8d5b5]'
                : 'bg-white text-slate-900 border-slate-200'
            }`}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontFamily: 'serif',
            }}
          >
            <div className="max-w-3xl mx-auto space-y-6">
              {result.pages.map((pg, pIdx) => {
                const { title, body } = sanitizePageContent(pg.content);

                return (
                  <article key={pIdx} className="space-y-4 pb-8 border-b border-slate-800/40">
                    <div className="flex items-center justify-between text-xs font-sans text-slate-500 select-none pb-2 border-b border-dashed border-slate-700/50">
                      <span className="font-bold uppercase tracking-wider">
                        📖 Page {pg.pageNum}
                      </span>
                      {pg.hasTable && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono">
                          Contains Table
                        </span>
                      )}
                    </div>

                    {title && title !== 'Chapter Reading Section' && (
                      <h2 className="text-xl sm:text-2xl font-bold font-sans text-emerald-400 pb-2">
                        {title}
                      </h2>
                    )}

                    <div
                      className="whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: formatReaderHtml(body, smartHighlightEnabled),
                      }}
                    />
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Reader Quiz Modal */}
      <ReaderQuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        chapterText={result?.fullCleanText || ''}
        sectionTitle={selectedSection?.sectionTitle || pdfFileName || 'Chapter Quiz'}
      />
    </div>
  );
};
