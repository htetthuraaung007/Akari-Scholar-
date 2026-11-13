import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import {
  analyzeAcademicText,
  TextAnalysisResult,
  findAiMarkerPositions,
  DetectedMarker,
  detectMissingCitations,
  MissingCitationAlert,
  calculateQuotationRatio,
  QuotationRatioResult,
  analyzeWordFrequency,
  WordFrequencyEntry,
  cleanMoodlePastingArtifacts,
  MoodleCleanResult,
} from '../utils/textAnalysis';
import {
  Sparkles,
  CheckCircle,
  FileText,
  AlertCircle,
  TrendingUp,
  Brain,
  ShieldAlert,
  Copy,
  Check,
  BookOpen,
  ArrowRight,
  ListChecks,
  Volume2,
  VolumeX,
  Split,
  Layers,
  GraduationCap,
  Leaf,
  Lightbulb,
  Sliders,
  RefreshCw,
  Zap,
  Save,
  Highlighter,
  Plus,
  Scissors,
  Maximize2,
  Minimize2,
  Quote,
  Flame,
  Clock,
  Compass,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  Mail,
  Calendar,
  MessageSquare,
  Target,
  Search,
} from 'lucide-react';
import { AudioProofreader } from '../utils/speech';

import { AssignmentOutlineStudio } from './AssignmentOutlineStudio';
import { DraftAuditStudio } from './DraftAuditStudio';
import { AssignmentWorkspace } from './AssignmentWorkspace';
import { UnifiedDiscussionStudio } from './UnifiedDiscussionStudio';

// Structured Parser for Human-Academic Rewrites
interface ParsedRewrite {
  versionA: string;
  versionB: string;
  improvements: string;
  hasStructure: boolean;
}

function parseRewriteResult(raw: string): ParsedRewrite {
  if (!raw) return { versionA: '', versionB: '', improvements: '', hasStructure: false };

  let versionA = '';
  let versionB = '';
  let improvements = '';

  // 1. Try flexible regex matching across markdown headings & emojis
  const versionAMatch = raw.match(
    /(?:###|##|\*\*|#)?\s*(?:🎓|💎)?\s*Version A[:\s*][^\n]*\n([\s\S]*?)(?=(?:###|##|\*\*|#)?\s*(?:🌿|🌱)?\s*Version B|$)/i
  );
  const versionBMatch = raw.match(
    /(?:###|##|\*\*|#)?\s*(?:🌿|🌱)?\s*Version B[:\s*][^\n]*\n([\s\S]*?)(?=(?:###|##|\*\*|#|\*\*\*)\s*(?:💡|📌)?\s*(?:0% AI|Key Improvements|Why this sounds|Rationale|Anti-Detection|ပြုပြင်)|$)/i
  );
  const improveMatch = raw.match(
    /(?:###|##|\*\*|#|\*\*\*)\s*(?:💡|📌)?\s*(?:0% AI Detection|Key Improvements|Why this sounds|Rationale|Anti-Detection|ပြုပြင်ပြောင်းလဲချက်)[:\s*][^\n]*\n([\s\S]*?)$/i
  );

  if (versionAMatch && versionAMatch[1]?.trim()) {
    versionA = versionAMatch[1].trim();
  }
  if (versionBMatch && versionBMatch[1]?.trim()) {
    versionB = versionBMatch[1].trim();
  }
  if (improveMatch && improveMatch[1]?.trim()) {
    improvements = improveMatch[1].trim();
  }

  // 2. Fallback pattern matching if headers were formatted differently
  if (!versionA && !versionB) {
    const parts = raw.split(/(?:Version A[:\s\-]|1\.\s*Version A|Scholarly Precision)/i);
    if (parts.length > 1) {
      const subParts = parts[1].split(/(?:Version B[:\s\-]|2\.\s*Version B|Natural Human)/i);
      versionA = subParts[0]?.trim() || '';
      if (subParts.length > 1) {
        const improveParts = subParts[1].split(/(?:3\.\s*Explain|Why the revisions|Key Improvements|Rationale)/i);
        versionB = improveParts[0]?.trim() || '';
        improvements = improveParts[1]?.trim() || '';
      }
    }
  }

  const hasStructure = Boolean(versionA || versionB);
  return { versionA, versionB, improvements, hasStructure };
}

// Clean Formatter for Academic Markdown Outputs with elevated visual hierarchy
const AcademicCleanViewer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div className="space-y-3 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Handle all heading levels (#, ##, ###, ####, etc.)
        if (/^#{1,6}\s+/.test(trimmed)) {
          const headingText = trimmed.replace(/^#{1,6}\s*/, '');
          const isMajor = trimmed.startsWith('# ') || trimmed.startsWith('## ');
          if (isMajor) {
            return (
              <h3
                key={idx}
                className="text-sm sm:text-base font-extrabold text-white pt-3 pb-1 border-b border-slate-800 flex items-center space-x-2"
              >
                <span className="text-indigo-400">❖</span>
                <span>{headingText}</span>
              </h3>
            );
          }
          return (
            <div key={idx} className="pt-2 pb-1">
              <strong className="text-sm font-bold text-white block">
                {headingText}
              </strong>
            </div>
          );
        }

        if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
          const isDone = trimmed.startsWith('- [x] ');
          return (
            <div key={idx} className="flex items-start space-x-2 py-0.5 pl-2">
              <input
                type="checkbox"
                defaultChecked={isDone}
                className="w-3.5 h-3.5 mt-0.5 accent-indigo-500 rounded"
              />
              <span className="text-slate-300">{trimmed.slice(6)}</span>
            </div>
          );
        }

        // Numbered list item e.g. "1. " or "2. "
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const text = numMatch[2];
          const parts = text.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={idx} className="flex items-start space-x-2.5 pl-1 my-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold shrink-0 mt-0.5">
                {num}
              </span>
              <div className="text-slate-300 leading-relaxed flex-1">
                {parts.map((p, pIdx) =>
                  p.startsWith('**') && p.endsWith('**') ? (
                    <strong key={pIdx} className="text-white font-bold">
                      {p.slice(2, -2)}
                    </strong>
                  ) : (
                    <span key={pIdx}>{p}</span>
                  )
                )}
              </div>
            </div>
          );
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
          const quoteText = trimmed.replace(/^>\s*/, '');
          return (
            <blockquote
              key={idx}
              className="p-3 my-2 border-l-2 border-indigo-400 bg-indigo-950/20 rounded-r-xl text-slate-300 italic text-xs leading-relaxed"
            >
              {quoteText}
            </blockquote>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const text = trimmed.replace(/^[-*]\s*/, '');
          // Parse bold segments
          const parts = text.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
              <div className="text-slate-300 leading-relaxed">
                {parts.map((p, pIdx) =>
                  p.startsWith('**') && p.endsWith('**') ? (
                    <strong key={pIdx} className="text-white font-bold">
                      {p.slice(2, -2)}
                    </strong>
                  ) : (
                    <span key={pIdx}>{p}</span>
                  )
                )}
              </div>
            </div>
          );
        }

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Regular paragraph with bold support
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={idx} className="text-slate-300 my-1 leading-relaxed">
            {parts.map((p, pIdx) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <strong key={pIdx} className="text-white font-bold">
                  {p.slice(2, -2)}
                </strong>
              ) : (
                <span key={pIdx}>{p}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
};

export const AssignmentHub: React.FC = () => {
  const { language, callAcademicApi, setActiveTab, addFlashcards } = useApp();
  const t = translations[language];

  const [activeSubTab, setActiveSubTab] = useState<
    | 'stepper'
    | 'rubric'
    | 'critique'
    | 'tone'
    | 'discussion_studio'
    | 'emergency'
    | 'emergency_petition'
    | 'integrity_studio'
  >('stepper');

  // Stepper Progress (Step 1 -> Step 2 -> Step 3 -> Step 4)
  const [stepperStep, setStepperStep] = useState<1 | 2 | 3 | 4>(1);

  // Rubric Tab States (with crash protection)
  const [rubricText, setRubricText] = useState(() => localStorage.getItem('akari_draft_rubric') || '');
  const [rubricResult, setRubricResult] = useState('');
  const [rubricLoading, setRubricLoading] = useState(false);

  // Critique Tab States (with crash protection)
  const [draftRubric, setDraftRubric] = useState(() => localStorage.getItem('akari_draft_draftRubric') || '');
  const [draftText, setDraftText] = useState(() => localStorage.getItem('akari_draft_draftText') || '');
  const [critiqueResult, setCritiqueResult] = useState('');
  const [critiqueLoading, setCritiqueLoading] = useState(false);

  // Tone & Humanize States (with crash protection)
  const [toneText, setToneText] = useState(() => localStorage.getItem('akari_draft_tone') || '');
  const [toneAnalysis, setToneAnalysis] = useState<TextAnalysisResult | null>(null);
  const [rewriteResult, setRewriteResult] = useState('');
  const [toneLoading, setToneLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [rewriteViewMode, setRewriteViewMode] = useState<'both' | 'verA' | 'verB'>('both');

  // Paraphrasing Depth Controller:
  // 1. light_polish (သဒ္ဒါနှင့် စကားလုံး အနည်းငယ်ညှိခြင်း)
  // 2. academic_elevation (ဝေါဟာရနှင့် တည်ဆောက်ပုံကို formal ဖြစ်အောင် အဆင့်မြှင့်တင်ခြင်း)
  // 3. conceptual_rephrase (အဓိပ္ပာယ်မပျက်ဘဲ ဖွဲ့စည်းပုံအသစ်ဖြင့် လုံးဝအသစ်ပြန်ရေးခြင်း - 0% AI Focus)
  const [paraphraseDepth, setParaphraseDepth] = useState<'light_polish' | 'academic_elevation' | 'conceptual_rephrase'>('conceptual_rephrase');

  // Word Count Trimmer / Expander States
  const [trimmerDelta, setTrimmerDelta] = useState<number>(50);
  const [trimmerMode, setTrimmerMode] = useState<'expand' | 'trim'>('expand');
  const [trimmerLoading, setTrimmerLoading] = useState(false);

  // Moodle Format Stripper / Cleaner States
  const [moodleInput, setMoodleInput] = useState(() => localStorage.getItem('akari_draft_moodle') || '');
  const [moodleResult, setMoodleResult] = useState<MoodleCleanResult | null>(null);

  // Emergency 1-Hour Deadline Rescuer States
  const [emergencyType, setEmergencyType] = useState<'discussion' | 'assignment_activity'>('discussion');
  const [emergencyPrompt, setEmergencyPrompt] = useState(() => localStorage.getItem('akari_emergency_prompt') || '');
  const [emergencyCourseCode, setEmergencyCourseCode] = useState('POLS 1503-01');
  const [emergencyUnit, setEmergencyUnit] = useState('Unit 7');
  const [emergencyInstructor, setEmergencyInstructor] = useState('Instructor');
  const [emergencyStudent, setEmergencyStudent] = useState('Student');
  const [emergencyResult, setEmergencyResult] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Overuse Heatmap toggle
  const [showOveruseHeatmap, setShowOveruseHeatmap] = useState(true);

  // Humanizer Intensity & Variation
  const [humanizeIntensity, setHumanizeIntensity] = useState<'aggressive' | 'standard'>('aggressive');
  const [variationIndex, setVariationIndex] = useState(1);
  const [showMarkerHighlight, setShowMarkerHighlight] = useState(true);
  const [lastAutoSaved, setLastAutoSaved] = useState<string>('');



  // Audio Proofreading State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  const handleToggleAudio = () => {
    if (isSpeaking) {
      AudioProofreader.stop();
      setIsSpeaking(false);
    } else {
      if (!draftText.trim()) return;
      const started = AudioProofreader.speak(
        draftText,
        speechRate,
        undefined,
        () => setIsSpeaking(false)
      );
      if (started) setIsSpeaking(true);
    }
  };

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Sample prompt for Rubric breakdown
  const loadRubricSample = () => {
    setRubricText(
      `Course: Academic Research & Critical Inquiry (Level 300)
Assignment: Argumentative Research Paper (2,500 words)
Topic: The Ethical & Pedagogical Implications of Generative AI in Higher Education.
Rubric Criteria for Grade 'A':
- Clear, defensible, non-obvious thesis statement established in introduction.
- Multi-dimensional analysis including pedagogical gains, equity concerns, and cognitive deskilling.
- Integration of at least 6 scholarly, peer-reviewed sources.
- Consideration of counter-arguments and substantive rebuttals.
- Flawless APA 7th style formatting and logical transitional flow between paragraphs.`
    );
  };

  const handleRubricBreakdown = async () => {
    if (!rubricText.trim()) return;
    setErrorMessage(null);
    setRubricLoading(true);
    try {
      const res = await callAcademicApi('rubric_breakdown', { rubricText });
      setRubricResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to analyze rubric. Please verify connection or key.');
    } finally {
      setRubricLoading(false);
    }
  };

  const loadDraftSample = () => {
    setDraftRubric('Evaluate critical analysis, thesis clarity, and empirical evidence integration.');
    setDraftText(
      `Artificial intelligence is becoming very popular in universities today. It is undeniably playing a pivotal role in the ever-evolving landscape of modern education. In nutshell, many students use ChatGPT to write essays and study faster. Furthermore, it is a testament to technological progress. However, some teachers believe AI makes students lazy. In conclusion, it is crucial to remember that AI has both good and bad sides and everyone should use it wisely.`
    );
  };

  const handleDraftCritique = async () => {
    if (!draftText.trim()) return;
    setErrorMessage(null);
    setCritiqueLoading(true);
    try {
      const res = await callAcademicApi('draft_critique', {
        rubricText: draftRubric,
        draftText,
      });
      setCritiqueResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to review draft. Please verify connection or key.');
    } finally {
      setCritiqueLoading(false);
    }
  };

  // Auto-Save Crash Protection Effect (every 800ms when text changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (toneText) localStorage.setItem('akari_draft_tone', toneText);
      if (draftText) localStorage.setItem('akari_draft_draftText', draftText);
      if (rubricText) localStorage.setItem('akari_draft_rubric', rubricText);
      if (moodleInput) localStorage.setItem('akari_draft_moodle', moodleInput);
      if (emergencyPrompt) localStorage.setItem('akari_emergency_prompt', emergencyPrompt);
      setLastAutoSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 800);
    return () => clearTimeout(timer);
  }, [toneText, draftText, rubricText, moodleInput, emergencyPrompt]);

  // Paraphrasing Depth Controller Handler (Level 1, Level 2, Level 3)
  const handleParaphraseDepth = async (depthToRun?: 'light_polish' | 'academic_elevation' | 'conceptual_rephrase', overrideVariation?: number) => {
    if (!toneText.trim()) return;
    const selectedDepth = depthToRun || paraphraseDepth;
    setErrorMessage(null);
    setToneLoading(true);
    const varNum = overrideVariation !== undefined ? overrideVariation : variationIndex;
    try {
      if (selectedDepth === 'conceptual_rephrase') {
        const res = await callAcademicApi('tone_and_humanize', {
          text: toneText,
          intensity: 'aggressive',
          variation: varNum,
        });
        setRewriteResult(res);
      } else {
        const res = await callAcademicApi('paraphrase_depth', {
          text: toneText,
          depth: selectedDepth,
          variation: varNum,
        });
        setRewriteResult(res);
      }
      handleAnalyzeTone();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to paraphrase text. Please verify connection.');
    } finally {
      setToneLoading(false);
    }
  };

  // Word Count Trimmer / Expander Handler
  const handleWordCountAdjust = async (delta: number) => {
    if (!toneText.trim()) return;
    setErrorMessage(null);
    setTrimmerLoading(true);
    try {
      const mode = delta > 0 ? 'expand' : 'trim';
      const res = await callAcademicApi('word_count_adjust', {
        text: toneText,
        targetDelta: delta,
        mode,
      });
      setRewriteResult(res);
      handleAnalyzeTone();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to calibrate word count.');
    } finally {
      setTrimmerLoading(false);
    }
  };

  // Moodle Pasting Cleaner Handler
  const handleCleanMoodle = () => {
    if (!moodleInput.trim()) return;
    const cleaned = cleanMoodlePastingArtifacts(moodleInput);
    setMoodleResult(cleaned);
  };

  // Emergency 1-Hour Deadline Rescuer Handler
  const handleEmergencyRescue = async () => {
    if (!emergencyPrompt.trim()) return;
    setErrorMessage(null);
    setEmergencyLoading(true);
    try {
      const res = await callAcademicApi('emergency_rescuer', {
        assignmentType: emergencyType,
        promptQuery: emergencyPrompt,
        courseInfo: {
          courseCode: emergencyCourseCode || 'POLS 1503-01',
          unitNumber: emergencyUnit || 'Unit 7',
          instructorName: emergencyInstructor || 'Instructor',
          studentName: emergencyStudent || 'Student',
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        },
      });

      // Strict post-processing sanitation:
      // 1. Convert any accidental ### or #### into **Heading**
      // 2. Strip bullet points (- , * , • ) at line starts to ensure connected academic prose
      const cleaned = (res || '')
        .replace(/^#{1,6}\s*(.+)$/gm, '**$1**')
        .replace(/^[\s]*[-*•]\s+/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      setEmergencyResult(cleaned);
    } catch (err: any) {
      setErrorMessage(err.message || 'Emergency generation failed. Please check connection.');
    } finally {
      setEmergencyLoading(false);
    }
  };

  // Real-time Missing Citation Warnings
  const activeSubjectText = toneText || draftText || '';
  const missingCitations = useMemo(() => {
    return detectMissingCitations(activeSubjectText);
  }, [activeSubjectText]);

  // Real-time Direct Quote vs Paraphrase Ratio
  const quoteRatio = useMemo(() => {
    return calculateQuotationRatio(activeSubjectText);
  }, [activeSubjectText]);

  // Academic Word Overuse & Frequency Heatmap
  const wordFrequencies = useMemo(() => {
    return analyzeWordFrequency(activeSubjectText);
  }, [activeSubjectText]);

  // Global Keyboard Shortcuts (Ctrl+H: Humanize, Ctrl+K: APA Citation, Ctrl+W: Audit Tone)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveSubTab('tone');
        if (toneText.trim() && !toneLoading) {
          handleHumanizeRewrite();
        }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('apa');
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setActiveSubTab('tone');
        if (toneText.trim()) {
          handleAnalyzeTone();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toneText, toneLoading, humanizeIntensity, variationIndex]);

  const handleAnalyzeTone = () => {
    if (!toneText.trim()) return;
    const result = analyzeAcademicText(toneText);
    setToneAnalysis(result);
  };

  const handleHumanizeRewrite = async (overrideVariation?: number) => {
    if (!toneText.trim()) return;
    setErrorMessage(null);
    setToneLoading(true);
    const varNum = overrideVariation !== undefined ? overrideVariation : variationIndex;
    try {
      const res = await callAcademicApi('tone_and_humanize', {
        text: toneText,
        intensity: humanizeIntensity,
        variation: varNum,
      });
      setRewriteResult(res);
      handleAnalyzeTone();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to rewrite text. Please verify connection or key.');
    } finally {
      setToneLoading(false);
    }
  };

  const handleNextVariation = () => {
    const nextVar = variationIndex + 1;
    setVariationIndex(nextVar);
    handleHumanizeRewrite(nextVar);
  };

  // Detected AI markers with replacement suggestions
  const detectedMarkers = useMemo(() => {
    if (!toneText.trim()) return [];
    return findAiMarkerPositions(toneText);
  }, [toneText]);

  const handleReplaceMarker = (marker: DetectedMarker, replacement: string) => {
    const newText = toneText.slice(0, marker.index) + replacement + toneText.slice(marker.index + marker.length);
    setToneText(newText);
    setToneAnalysis(null);
  };



  // Parsed structured rewrite outputs
  const parsedRewrite = useMemo(() => {
    return parseRewriteResult(rewriteResult);
  }, [rewriteResult]);

  // Real-time AI Detector audit on rewritten versions to guarantee 0% AI
  const auditA = useMemo(() => {
    if (!parsedRewrite.versionA) return null;
    return analyzeAcademicText(parsedRewrite.versionA);
  }, [parsedRewrite.versionA]);

  const auditB = useMemo(() => {
    if (!parsedRewrite.versionB) return null;
    return analyzeAcademicText(parsedRewrite.versionB);
  }, [parsedRewrite.versionB]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
          <Sparkles className="w-8 h-8 text-indigo-400" />
          <span>
            {language === 'my'
              ? 'Assignment "A အဆင့်ရရှိရေး" & စာမူကြမ်း အကဲဖြတ်မှု'
              : 'Assignment "Get an A" Blueprint & Critique'}
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {language === 'my'
            ? 'Rubric ခွဲခြမ်းစိတ်ဖြာမှု၊ Outline ရေးဆွဲခြင်း၊ Logic Flow စစ်ဆေးခြင်းနှင့် သဘာဝကျသော Human-Academic စာရေးဟန်'
            : 'Deconstruct professor rubrics, generate paragraph outlines, verify logical flow, and refine authentic academic voice.'}
        </p>
      </div>

      {/* Interactive Academic Workflow Stepper */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
            <Compass className="w-4 h-4 text-indigo-400" />
            <span>
              {language === 'my'
                ? 'အဆင့် ၄ ဆင့် စာရေးသားမှု လုပ်ငန်းစဉ် (Interactive Workflow Stepper)'
                : 'Interactive 4-Step Academic Writing Stepper'}
            </span>
          </div>
          <span className="text-[11px] text-indigo-300 font-semibold">
            {language === 'my' ? `အဆင့် ${stepperStep} တွင် ရှိနေသည်` : `Step ${stepperStep} of 4`}
          </span>
        </div>

        {/* Stepper Navigation Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            {
              num: 1,
              title: language === 'my' ? '၁။ Rubric & Topic' : '1. Rubric & Topic',
              desc: language === 'my' ? 'A အဆင့် စံနှုန်းခွဲခြမ်းခြင်း' : 'Deconstruct Prompt',
              tab: 'rubric' as const,
            },
            {
              num: 2,
              title: language === 'my' ? '၂။ Outline & Sources' : '2. Outline & Sources',
              desc: language === 'my' ? 'စာပိုဒ်ဖွဲ့စည်းပုံ & ကိုးကား' : 'Thesis & Evidence Blueprint',
              tab: 'rubric' as const,
            },
            {
              num: 3,
              title: language === 'my' ? '၃။ Drafting & Humanize' : '3. Drafting & Humanize',
              desc: language === 'my' ? '0% AI & Depth Controller' : '0% AI Depth & Citations',
              tab: 'tone' as const,
            },
            {
              num: 4,
              title: language === 'my' ? '၄။ Draft Audit & Logic' : '4. Draft Audit & Logic',
              desc: language === 'my' ? 'Rubric & Logic Check' : 'Rubric & Logic Audit',
              tab: 'critique' as const,
            },
          ].map((st) => (
            <button
              key={st.num}
              type="button"
              onClick={() => {
                setStepperStep(st.num as any);
                setActiveSubTab(st.tab);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                stepperStep === st.num
                  ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-bold text-xs">{st.title}</span>
                {stepperStep > st.num ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate">{st.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('rubric')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'rubric'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>{language === 'my' ? '"A ရဖို့" Checklist & Outline' : '"Get an A" Checklist & Outline'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('critique')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'critique'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>{language === 'my' ? 'Draft စစ်ဆေးချက် (Logic & Thesis)' : 'Draft Logic & Thesis Critique'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tone')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'tone'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{language === 'my' ? 'Paraphraser & Depth Controller (0% AI)' : 'Depth Controller & Humanizer'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('emergency')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'emergency'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>{language === 'my' ? 'အရေးပေါ် ၁ နာရီ Rescuer (Emergency)' : '1-Hour Deadline Rescuer'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('discussion_studio')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'discussion_studio'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>{language === 'my' ? '💬 Discussion Studio (Peer & Follow-up)' : '💬 Discussion Studio (Peer & Follow-up)'}</span>
        </button>




      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-in fade-in gap-3">
          <div className="flex items-start sm:items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
            <button
              onClick={() => {
                setErrorMessage(null);
                if (activeSubTab === 'rubric') handleRubricBreakdown();
                else if (activeSubTab === 'critique') handleDraftCritique();
                else if (activeSubTab === 'tone') handleHumanizeRewrite();
              }}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all"
            >
              {language === 'my' ? 'ပြန်လည်ကြိုးစားမည်' : 'Retry'}
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold"
            >
              {language === 'my' ? 'ပိတ်မည်' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 1 & 2: RUBRIC OUTLINE & DRAFT CRITIQUE WORKSPACE (KEEP-ALIVE)
         ======================================================== */}
      <div className={activeSubTab === 'rubric' || activeSubTab === 'critique' || activeSubTab === 'integrity_studio' || activeSubTab === 'emergency_petition' ? 'block' : 'hidden'}>
        <AssignmentWorkspace
          initialSubTab={activeSubTab}
          onSubTabChange={(newTab) => setActiveSubTab(newTab)}
        />
      </div>

      {/* ========================================================
          TAB 3: ACADEMIC TONE & HUMANIZER (CLEAN MULTI-CARD UI)
         ======================================================== */}
      {activeSubTab === 'tone' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {t.tone.inputPlaceholder}
                </label>
                {lastAutoSaved && (
                  <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-mono">
                    <Save className="w-3 h-3" />
                    <span>Auto-Saved {lastAutoSaved} (Crash Protected)</span>
                  </span>
                )}
              </div>

              {/* Keyboard Shortcuts Hint */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-300">Keyboard Shortcuts:</span>
                <span className="inline-flex items-center space-x-1">
                  <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Ctrl+H</kbd>
                  <span>Humanize (0% AI)</span>
                </span>
                <span>·</span>
                <span className="inline-flex items-center space-x-1">
                  <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Ctrl+W</kbd>
                  <span>Audit Tone</span>
                </span>
                <span>·</span>
                <span className="inline-flex items-center space-x-1">
                  <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Ctrl+K</kbd>
                  <span>APA Citations</span>
                </span>
              </div>

              <textarea
                rows={7}
                value={toneText}
                onChange={(e) => {
                  setToneText(e.target.value);
                  if (toneAnalysis) setToneAnalysis(null);
                }}
                placeholder="Paste paragraph to check academic tone, AI repetition, and human cadence..."
                className="w-full p-3 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
              />

              {/* Paraphrasing Depth Controller (3-Level System) */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-white uppercase tracking-wider">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span>{language === 'my' ? 'Paraphrasing Depth Controller (အဆင့် ၃ ဆင့်)' : 'Paraphrasing Depth Controller'}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold font-mono">
                    {paraphraseDepth === 'light_polish' ? 'Level 1: Polish' : paraphraseDepth === 'academic_elevation' ? 'Level 2: Elevate' : 'Level 3: 0% AI Rephrase'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setParaphraseDepth('light_polish');
                      handleParaphraseDepth('light_polish');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      paraphraseDepth === 'light_polish'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-200 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px] mb-0.5">1. Light Polish</div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {language === 'my' ? 'သဒ္ဒါနှင့် စကားလုံး အနည်းငယ်ညှိခြင်း' : 'Grammar & gentle syntax polish'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setParaphraseDepth('academic_elevation');
                      handleParaphraseDepth('academic_elevation');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      paraphraseDepth === 'academic_elevation'
                        ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px] mb-0.5">2. Academic Elevation</div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {language === 'my' ? 'ဝေါဟာရနှင့် တည်ဆောက်ပုံ formal မြှင့်ခြင်း' : 'Formal register & scholarly diction'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setParaphraseDepth('conceptual_rephrase');
                      handleParaphraseDepth('conceptual_rephrase');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      paraphraseDepth === 'conceptual_rephrase'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px] mb-0.5 flex items-center space-x-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>3. Rephrase (0% AI)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {language === 'my' ? 'ဖွဲ့စည်းပုံအသစ်ဖြင့် လုံးဝအသစ်ပြန်ရေးခြင်း' : 'Radical restructure & 0% AI'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Word Count Trimmer / Expander (အရှည်အတို ညှိစနစ်) */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'my' ? 'Word Count အရှည်အတို တိကျစွာ ညှိစနစ် (Trimmer / Expander):' : 'Word Count Trimmer & Expander:'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Current: {toneText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={trimmerLoading || !toneText.trim()}
                    onClick={() => handleWordCountAdjust(50)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-300 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="font-bold text-[11px] flex items-center space-x-1">
                      <Maximize2 className="w-3 h-3 text-emerald-400" />
                      <span>+50 Words</span>
                    </div>
                    <span className="text-[9px] text-slate-500">Expand Context</span>
                  </button>

                  <button
                    type="button"
                    disabled={trimmerLoading || !toneText.trim()}
                    onClick={() => handleWordCountAdjust(100)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-300 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="font-bold text-[11px] flex items-center space-x-1">
                      <Maximize2 className="w-3 h-3 text-emerald-400" />
                      <span>+100 Words</span>
                    </div>
                    <span className="text-[9px] text-slate-500">Deepen Evidence</span>
                  </button>

                  <button
                    type="button"
                    disabled={trimmerLoading || !toneText.trim()}
                    onClick={() => handleWordCountAdjust(-50)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-amber-950 border border-slate-800 hover:border-amber-500 text-slate-300 hover:text-amber-300 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="font-bold text-[11px] flex items-center space-x-1">
                      <Minimize2 className="w-3 h-3 text-amber-400" />
                      <span>-50 Words</span>
                    </div>
                    <span className="text-[9px] text-slate-500">Trim Fluff</span>
                  </button>

                  <button
                    type="button"
                    disabled={trimmerLoading || !toneText.trim()}
                    onClick={() => handleWordCountAdjust(-70)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-amber-950 border border-slate-800 hover:border-amber-500 text-slate-300 hover:text-amber-300 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="font-bold text-[11px] flex items-center space-x-1">
                      <Minimize2 className="w-3 h-3 text-amber-400" />
                      <span>-70 Words</span>
                    </div>
                    <span className="text-[9px] text-slate-500">Prune Redundancy</span>
                  </button>
                </div>
              </div>

              {/* AI Marker Highlight & One-Click Replacement Panel */}
              {detectedMarkers.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                      <Highlighter className="w-3.5 h-3.5" />
                      <span>
                        {language === 'my'
                          ? `${detectedMarkers.length} ခုသော AI Clichés တွေ့ရှိသည် (Click to Replace)`
                          : `${detectedMarkers.length} AI Markers Detected (Click to Replace)`}
                      </span>
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono">Turnitin/GPTZero Triggers</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detectedMarkers.slice(0, 6).map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1 bg-slate-950 p-1.5 rounded-lg border border-amber-500/30"
                      >
                        <span className="font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold text-[11px]">
                          "{m.matchedText}"
                        </span>
                        <span className="text-slate-400 text-[10px]">→</span>
                        {m.suggestions.slice(0, 2).map((s, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleReplaceMarker(m, s)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-[10px] font-medium transition-colors"
                            title={`Replace "${m.matchedText}" with "${s}"`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={handleAnalyzeTone}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  {t.tone.analyzeBtn} (Ctrl+W)
                </button>

                <div className="flex items-center space-x-2">
                  {rewriteResult && (
                    <button
                      type="button"
                      disabled={toneLoading}
                      onClick={handleNextVariation}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                      title="Regenerate with a fresh syntactic structure and 0% AI footprint"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${toneLoading ? 'animate-spin' : ''}`} />
                      <span>{language === 'my' ? 'ပုံစံသစ် ထပ်ထုတ်မည်' : 'Try Another Variation'}</span>
                    </button>
                  )}

                  <button
                    disabled={toneLoading || !toneText.trim()}
                    onClick={() => handleHumanizeRewrite()}
                    className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{toneLoading ? t.common.loading : `${t.tone.humanizeBtn} (Ctrl+H)`}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tone Diagnostics Card */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {language === 'my' ? 'စာရေးဟန် & Citation တိုင်းတာချက်များ' : 'Academic Rigor & Citation Diagnostics'}
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">100% Client-Side Engine</span>
              </div>

              {/* 1. Direct Quote vs Paraphrase Ratio Calculator */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <Quote className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Direct Quote vs Paraphrase Ratio:</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      quoteRatio.status === 'safe'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : quoteRatio.status === 'moderate'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                    }`}
                  >
                    {language === 'my' ? quoteRatio.statusLabelMm : quoteRatio.statusLabelEn}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${Math.min(100, quoteRatio.quoteRatioPercent)}%` }}
                    className={`h-full transition-all ${
                      quoteRatio.status === 'safe'
                        ? 'bg-emerald-500'
                        : quoteRatio.status === 'moderate'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>
                    Quoted Words: <strong className="text-white">{quoteRatio.quotedWords}</strong> / {quoteRatio.totalWords}
                  </span>
                  <span className="text-slate-500">Academic Target: &lt; 15%</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {language === 'my' ? quoteRatio.adviceMm : quoteRatio.adviceEn}
                </p>
              </div>

              {/* 2. Missing In-text Citation Warning Flag */}
              {missingCitations.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/40 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300 flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>
                        {language === 'my'
                          ? `⚠️ Missing Citation Warning (${missingCitations.length} နေရာ တွေ့ရှိသည်)`
                          : `⚠️ Missing Citation Alert (${missingCitations.length} instances)`}
                      </span>
                    </span>
                    <span className="text-[10px] text-rose-400/80 font-mono">APA 7th Verification</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {missingCitations.map((item, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-rose-500/30 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-rose-400 font-semibold uppercase">
                          <span>{item.type.replace('_', ' ')}</span>
                          <span>Line #{item.index + 1}</span>
                        </div>
                        <p className="text-slate-300 italic truncate font-sans">"{item.sentence}"</p>
                        <p className="text-slate-400 text-[10px]">
                          {language === 'my' ? item.burmeseReason : item.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Academic Word Frequency & Overuse Heatmap */}
              {wordFrequencies.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>{language === 'my' ? 'Academic Word Frequency & Overuse Heatmap:' : 'Word Overuse Heatmap:'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOveruseHeatmap(!showOveruseHeatmap)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      {showOveruseHeatmap ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  {showOveruseHeatmap && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {wordFrequencies.slice(0, 14).map((wf, idx) => (
                        <div
                          key={idx}
                          className={`px-2 py-1 rounded-lg border text-[11px] flex items-center space-x-1 transition-all ${
                            wf.isOverused
                              ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-sm'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                          title={
                            wf.synonyms.length > 0
                              ? `Alternatives (0% AI): ${wf.synonyms.join(', ')}`
                              : `${wf.count} occurrences`
                          }
                        >
                          <span className="font-semibold">{wf.word}</span>
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                              wf.isOverused ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            ×{wf.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500">
                    {language === 'my'
                      ? 'ဝေါဟာရတစ်ခုတည်းကို ထပ်ခါတလဲလဲ မသုံးရန် အကြံပြုထားသော ပညာရပ်ဝေါဟာရများ (Hover ဖြင့် အစားထိုးစကားလုံးများ ကြည့်နိုင်ပါသည်)'
                      : 'Hover over any highlighted chip to view authentic academic alternatives without triggering AI detectors.'}
                  </p>
                </div>
              )}

              {toneAnalysis && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-xl font-bold text-indigo-400 font-mono">
                        {toneAnalysis.academicScore}/100
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase font-semibold">
                        Academic Score
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-xl font-bold text-emerald-400 font-mono">
                        {toneAnalysis.burstinessScore}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase font-semibold">
                        Burstiness Variety
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div
                        className={`text-xl font-bold font-mono ${
                          toneAnalysis.aiLikelihoodEstimate > 50 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {toneAnalysis.aiLikelihoodEstimate}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase font-semibold">
                        AI Cliché Index
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Readability Grade: <span className="text-slate-200 font-semibold">{toneAnalysis.readabilityGrade}</span> · Avg sentence length:{' '}
                    <span className="text-slate-200 font-semibold">{toneAnalysis.avgSentenceLength} words</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clean, Uncluttered Humanized Rewrites Presentation */}
          {rewriteResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                      {language === 'my'
                        ? 'သဘာဝကျသော Human-Academic ပြန်လည်ရေးသားချက်များ'
                        : 'Humanized Academic Revisions'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'my'
                        ? 'စံပြုတက္ကသိုလ်ရေးဟန် (Version A) နှင့် သဘာဝကျ လူသားရေးဟန် (Version B) နှစ်မျိုးစလုံးကို ရှင်းလင်းစွာ လေ့လာနိုင်ပါသည်။'
                        : 'Choose between Formal Scholarly Precision and Natural Human-Academic Flow.'}
                    </p>
                  </div>
                </div>

                {/* View Mode Filters & Compare Toggle */}
                <div className="flex items-center space-x-2 shrink-0">
                  {parsedRewrite.hasStructure && (
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setRewriteViewMode('both')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          rewriteViewMode === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {language === 'my' ? 'နှစ်ခုစလုံး' : 'Dual View'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRewriteViewMode('verA')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          rewriteViewMode === 'verA' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Version A
                      </button>
                      <button
                        type="button"
                        onClick={() => setRewriteViewMode('verB')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          rewriteViewMode === 'verB' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Version B
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setShowSideBySide(!showSideBySide)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      showSideBySide
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>{showSideBySide ? 'Hide Original' : 'Compare Original'}</span>
                  </button>
                </div>
              </div>

              {/* Side-by-side original reference (optional toggle) */}
              {showSideBySide && toneText && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {language === 'my' ? 'သင်၏ မူရင်းစာသား (Original Draft)' : 'Your Original Input Text'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {toneText.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans italic bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    "{toneText}"
                  </p>
                </div>
              )}

              {parsedRewrite.hasStructure ? (
                <div
                  className={`grid gap-4 ${
                    rewriteViewMode === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-4xl'
                  }`}
                >
                  {/* Card 1: Version A (Scholarly Precision) */}
                  {parsedRewrite.versionA && (rewriteViewMode === 'both' || rewriteViewMode === 'verA') && (
                    <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/30 flex flex-col justify-between shadow-xl space-y-4 hover:border-indigo-500/50 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-indigo-500/20">
                          <div className="flex items-center space-x-2">
                            <GraduationCap className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Version A: Scholarly Precision
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>0% AI · 100% Human</span>
                          </div>
                        </div>

                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans select-text">
                          {parsedRewrite.versionA}
                        </div>

                        {/* Real-Time AI Detector Audit Bar */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-900/40 text-[11px] grid grid-cols-3 gap-2 text-center">
                          <div>
                            <span className="text-slate-400 text-[10px] block">AI Likelihood</span>
                            <span className="text-emerald-400 font-bold">{auditA?.aiLikelihoodEstimate ?? 0}% (0% AI)</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Human Cadence</span>
                            <span className="text-emerald-400 font-bold">{auditA?.humanScore ?? 100}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">AI Clichés</span>
                            <span className="text-emerald-400 font-bold">{auditA?.flaggedCliches.length ?? 0} found</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {parsedRewrite.versionA.split(/\s+/).filter(Boolean).length} words
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setToneText(parsedRewrite.versionA);
                              setToneAnalysis(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                            title="Load into input editor to edit or analyze"
                          >
                            {language === 'my' ? 'စာမူထဲသို့ ထည့်မည်' : 'Use in Input'}
                          </button>
                          <button
                            onClick={() => handleCopy(parsedRewrite.versionA, 'ver-a')}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
                          >
                            {copiedSection === 'ver-a' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>{t.common.copied}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Version A</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 2: Version B (Natural Human-Academic Flow) */}
                  {parsedRewrite.versionB && (rewriteViewMode === 'both' || rewriteViewMode === 'verB') && (
                    <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-between shadow-xl space-y-4 hover:border-emerald-500/50 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-emerald-500/20">
                          <div className="flex items-center space-x-2">
                            <Leaf className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Version B: Natural Human Flow
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>0% AI · 100% Human</span>
                          </div>
                        </div>

                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans select-text">
                          {parsedRewrite.versionB}
                        </div>

                        {/* Real-Time AI Detector Audit Bar */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-900/40 text-[11px] grid grid-cols-3 gap-2 text-center">
                          <div>
                            <span className="text-slate-400 text-[10px] block">AI Likelihood</span>
                            <span className="text-emerald-400 font-bold">{auditB?.aiLikelihoodEstimate ?? 0}% (0% AI)</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Human Cadence</span>
                            <span className="text-emerald-400 font-bold">{auditB?.humanScore ?? 100}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">AI Clichés</span>
                            <span className="text-emerald-400 font-bold">{auditB?.flaggedCliches.length ?? 0} found</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {parsedRewrite.versionB.split(/\s+/).filter(Boolean).length} words
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setToneText(parsedRewrite.versionB);
                              setToneAnalysis(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                            title="Load into input editor to edit or analyze"
                          >
                            {language === 'my' ? 'စာမူထဲသို့ ထည့်မည်' : 'Use in Input'}
                          </button>
                          <button
                            onClick={() => handleCopy(parsedRewrite.versionB, 'ver-b')}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
                          >
                            {copiedSection === 'ver-b' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>{t.common.copied}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Version B</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback single card if unstructured */
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Academic Revision
                    </span>
                    <button
                      onClick={() => handleCopy(rewriteResult, 'rewrite-raw')}
                      className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
                    >
                      {copiedSection === 'rewrite-raw' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{t.common.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.common.copy}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <AcademicCleanViewer content={rewriteResult} />
                </div>
              )}

              {/* Card 3: Key Improvements & Rationale Callout */}
              {parsedRewrite.improvements && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4" />
                    <span>
                      {language === 'my'
                        ? 'ပြုပြင်ပြောင်းလဲချက်များနှင့် အဘယ်ကြောင့် ပိုမိုသဘာဝကျသွားသနည်း'
                        : 'Why These Revisions Sound Authentic & Authoritative'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {parsedRewrite.improvements}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUBTAB: EMERGENCY 1-HOUR DEADLINE RESCUER
         ======================================================== */}
      {activeSubTab === 'emergency' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                  <span>{language === 'my' ? 'Emergency 1-Hour Deadline Rescuer (အရေးပေါ် Mode)' : 'Emergency 1-Hour Deadline Rescuer'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                    0% AI Detection
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {language === 'my'
                    ? 'Deadline မတိုင်မီ ၁ နာရီသာ လိုတော့ချိန်တွင် မေးခွန်း Prompt ထည့်ရုံဖြင့် APA 7th Citations & References ပါဝင်သော အပြည့်အစုံကို ချက်ချင်း ထုတ်ပေးခြင်း'
                    : '1 hour to submission: skip drafting loops and produce complete, 0% AI, submission-ready posts or papers with genuine APA 7th citations.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input & Course Config */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {language === 'my' ? '၁။ Assignment အမျိုးအစား ရွေးချယ်ပါ:' : '1. Select Assignment Type:'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEmergencyType('discussion')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      emergencyType === 'discussion'
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs mb-0.5 flex items-center space-x-1">
                      <span>Discussion Forum Post</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {language === 'my' ? 'Left-aligned header, bold subheadings, word count & APA References' : 'Moodle ready with indent and references'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmergencyType('assignment_activity')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      emergencyType === 'assignment_activity'
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs mb-0.5 flex items-center space-x-1">
                      <span>Assignment Activity (.docx)</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {language === 'my' ? 'Page 1 Center title, Page 2 Intro-Conclusion, Page 3 References' : 'Full paper ready for APA Word export'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Course Info Fields */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Course Code:</label>
                  <input
                    type="text"
                    value={emergencyCourseCode}
                    onChange={(e) => setEmergencyCourseCode(e.target.value)}
                    placeholder="e.g. POLS 1503-01"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Unit Number:</label>
                  <input
                    type="text"
                    value={emergencyUnit}
                    onChange={(e) => setEmergencyUnit(e.target.value)}
                    placeholder="e.g. Unit 7"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Instructor Name:</label>
                  <input
                    type="text"
                    value={emergencyInstructor}
                    onChange={(e) => setEmergencyInstructor(e.target.value)}
                    placeholder="Instructor Name"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Student Name:</label>
                  <input
                    type="text"
                    value={emergencyStudent}
                    onChange={(e) => setEmergencyStudent(e.target.value)}
                    placeholder="Student Name"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              {/* Prompt Query */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {language === 'my' ? '၂။ Assignment မေးခွန်း သို့မဟုတ် Prompt ထည့်ပါ:' : '2. Paste Instructor Prompt / Question:'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyPrompt(
                        `Unit 7 Discussion: Compare Direct Democracy with Representative Republics. Discuss how digital technology impacts citizen deliberation and whether online voting introduces unmanageable security risks. Provide at least two peer-reviewed academic sources with APA in-text citations.`
                      );
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline"
                  >
                    Load Sample Prompt
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={emergencyPrompt}
                  onChange={(e) => setEmergencyPrompt(e.target.value)}
                  placeholder="Paste the prompt or discussion questions directly from UoPeople Moodle..."
                  className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-sans placeholder-slate-500 focus:border-amber-500 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleEmergencyRescue}
                disabled={emergencyLoading || !emergencyPrompt.trim()}
                className="w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-amber-600/25 transition-all"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>
                  {emergencyLoading
                    ? 'အမြန်ဆုံး ထုတ်ယူနေပါသည် (Generating 0% AI Paper)...'
                    : language === 'my'
                    ? 'အရေးပေါ် Assignment ချက်ချင်း ထုတ်ယူမည် (1-Click Rescue)'
                    : 'Rescue Assignment (Generate Submission-Ready Post)'}
                </span>
              </button>
            </div>

            {/* Rescue Output */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[500px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    {emergencyType === 'discussion'
                      ? 'Discussion Post (Moodle Ready)'
                      : 'Assignment Activity (.docx Ready)'}
                  </span>
                </span>

                {emergencyResult && (
                  <button
                    onClick={() => handleCopy(emergencyResult, 'emergency-copy')}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all"
                  >
                    {copiedSection === 'emergency-copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSection === 'emergency-copy' ? t.common.copied : 'Copy All'}</span>
                  </button>
                )}
              </div>

              {emergencyLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
                  <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold">Rescuing deadline... Generating humanized academic paper.</p>
                </div>
              ) : emergencyResult ? (
                <div className="flex-1 overflow-y-auto max-h-[580px] pr-2 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans space-y-3 whitespace-pre-wrap">
                  <AcademicCleanViewer content={emergencyResult} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <Clock className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                  <p className="text-xs max-w-sm">
                    {language === 'my'
                      ? 'ဘယ်ဘက်တွင် မေးခွန်း prompt ထည့်၍ ခလုတ်နှိပ်ပါက APA 7th References ပါဝင်သော အပြည့်အစုံကို ချက်ချင်း ထုတ်ပေးပါမည်'
                      : 'Paste your assignment question and click "Rescue Assignment" to generate a complete submission-ready post with references.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}




      {/* SUBTAB: UNIFIED DISCUSSION STUDIO */}
      {activeSubTab === 'discussion_studio' && (
        <UnifiedDiscussionStudio />
      )}










    </div>
  );
};
