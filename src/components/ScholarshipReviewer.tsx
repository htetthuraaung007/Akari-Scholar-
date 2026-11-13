import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  buildContextAwareTemplates,
  buildContextSignature,
  enforceCompleteNarrativeArc,
  generateContextualOutline,
  generateAdvisoryNotes,
  ScholarshipTemplateItem,
  ScholarshipStoryAngle,
  ScholarshipContextInput,
  TemplateLens,
  TemplateOutlineSection,
} from '../utils/templateGenerator';
import { AdvisorEmailSuite } from './AdvisorEmailSuite';
import { AiDetectorAuditCard } from './AiDetectorAuditCard';
import {
  resolveDynamicModelCatalog,
  generateScholarshipStatement,
  generateScholarshipDynamicTemplates,
  evaluateScholarshipEssayWithRubric,
} from '../services/geminiService';
import { loadPersistedTabState, savePersistedTabState } from '../utils/researchPersistence';
import {
  Award,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  Target,
  Mail,
  RotateCcw,
  BookOpen,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const SOP_ACTIVE_TAB_KEY = 'sop_active_tab';
const SOP_TAB1_SESSION_KEY = 'sop_tab1_state';
const SOP_TAB2_SESSION_KEY = 'sop_tab2_state';
const SOP_TAB4_SESSION_KEY = 'sop_tab4_state';
const LEGACY_SCHOLARSHIP_PERSISTENCE_KEY = 'akari_scholarship_reviewer_state_v2';

type ScholarshipActiveTab = 'new_app' | 'renewal_app' | 'pa_email' | 'intl_evaluator';

export interface ScholarshipFormState {
  newPrompt: string;
  newAngle: ScholarshipStoryAngle;
  customStoryAngle: string;
  newDegree: string;
  newCareerGoals: string;
  newEssayResult: string;
  aiNewTemplates: ScholarshipTemplateItem[];
  aiNewTemplatesSignature: string;
}

export interface RenewalFormState {
  renewalPrompt: string;
  renewalAngle: ScholarshipStoryAngle;
  customStoryAngle: string;
  renewalCgpa: string;
  renewalCoursesDone: string;
  renewalDegree: string;
  renewalCareerGoals: string;
  renewalEssayResult: string;
  aiRenewalTemplates: ScholarshipTemplateItem[];
  aiRenewalTemplatesSignature: string;
}

export interface RubricScorecard {
  evalScholarshipTarget: string;
  evalEssayInput: string;
  evalResult: string;
  customStoryAngle?: string;
}

interface LegacyPersistedScholarshipState {
  activeTab?: ScholarshipActiveTab;
  newPrompt?: string;
  newAngle?: ScholarshipStoryAngle;
  newDegree?: string;
  newCareerGoals?: string;
  newEssayResult?: string;
  aiNewTemplates?: ScholarshipTemplateItem[];
  aiNewTemplatesSignature?: string;
  renewalPrompt?: string;
  renewalAngle?: ScholarshipStoryAngle;
  renewalCgpa?: string;
  renewalCoursesDone?: string;
  renewalDegree?: string;
  renewalCareerGoals?: string;
  renewalEssayResult?: string;
  aiRenewalTemplates?: ScholarshipTemplateItem[];
  aiRenewalTemplatesSignature?: string;
  evalScholarshipTarget?: string;
  evalEssayInput?: string;
  evalResult?: string;
}

const DEFAULT_TAB1_STATE: ScholarshipFormState = {
  newPrompt: '',
  newAngle: 'currency_inflation',
  customStoryAngle: '',
  newDegree: 'Bachelor of Science in Computer Science',
  newCareerGoals:
    'To work in technology and provide free digital literacy workshops to underserved youth in my community.',
  newEssayResult: '',
  aiNewTemplates: [],
  aiNewTemplatesSignature: '',
};

const DEFAULT_TAB2_STATE: RenewalFormState = {
  renewalPrompt: '',
  renewalAngle: 'academic_high_achiever',
  customStoryAngle: '',
  renewalCgpa: '3.65',
  renewalCoursesDone: '8 courses completed (24 credits earned)',
  renewalDegree: 'Bachelor of Science in Computer Science',
  renewalCareerGoals:
    'Maintain high GPA, complete degree without pause, and secure industry software internship.',
  renewalEssayResult: '',
  aiRenewalTemplates: [],
  aiRenewalTemplatesSignature: '',
};

const DEFAULT_TAB4_STATE: RubricScorecard = {
  evalScholarshipTarget: 'UoPeople Assessment Fee Scholarship & Global University Standards',
  evalEssayInput: '',
  evalResult: '',
  customStoryAngle: '',
};

/**
 * Lightweight structured Markdown renderer for Tab 4 Rubric Scorecard (tables, headings, bullets, bold)
 */
const RubricMarkdownView: React.FC<{ markdown: string }> = ({ markdown }) => {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={idx} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line || line === '---') {
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4
          key={`h-${i}`}
          className="text-xs sm:text-sm font-extrabold text-pink-300 pt-2 pb-1 border-b border-slate-800/80"
        >
          {renderInline(line.replace(/^###\s+/, ''))}
        </h4>
      );
      i++;
      continue;
    }

    // Markdown Table block
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const parseRow = (row: string) =>
        row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(tableLines[0]);
      const dataRows = tableLines
        .slice(1)
        .filter((r) => !/^\|?[\s:-]+\|/.test(r))
        .map(parseRow);

      elements.push(
        <div key={`tbl-${i}`} className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90">
          <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-indigo-300">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-bold">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-200 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bulleted or numbered list block
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (/^[-*]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))
      ) {
        listItems.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 pl-4 list-disc text-xs text-slate-200 leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-xs text-slate-200 leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-3">{elements}</div>;
};

export const ScholarshipReviewer: React.FC = () => {
  const { language } = useApp();

  const legacySnapshot = useRef<LegacyPersistedScholarshipState>(
    loadPersistedTabState<LegacyPersistedScholarshipState>(LEGACY_SCHOLARSHIP_PERSISTENCE_KEY, {})
  ).current;

  const initialActiveTab = useRef<ScholarshipActiveTab>(
    loadPersistedTabState<ScholarshipActiveTab>(
      SOP_ACTIVE_TAB_KEY,
      legacySnapshot.activeTab || 'new_app'
    )
  ).current;

  const initialTab1 = useRef<ScholarshipFormState>(
    loadPersistedTabState<ScholarshipFormState>(SOP_TAB1_SESSION_KEY, {
      newPrompt: legacySnapshot.newPrompt ?? DEFAULT_TAB1_STATE.newPrompt,
      newAngle: legacySnapshot.newAngle ?? DEFAULT_TAB1_STATE.newAngle,
      customStoryAngle: DEFAULT_TAB1_STATE.customStoryAngle,
      newDegree: legacySnapshot.newDegree ?? DEFAULT_TAB1_STATE.newDegree,
      newCareerGoals: legacySnapshot.newCareerGoals ?? DEFAULT_TAB1_STATE.newCareerGoals,
      newEssayResult: legacySnapshot.newEssayResult ?? DEFAULT_TAB1_STATE.newEssayResult,
      aiNewTemplates: legacySnapshot.aiNewTemplates ?? DEFAULT_TAB1_STATE.aiNewTemplates,
      aiNewTemplatesSignature:
        legacySnapshot.aiNewTemplatesSignature ?? DEFAULT_TAB1_STATE.aiNewTemplatesSignature,
    })
  ).current;

  const initialTab2 = useRef<RenewalFormState>(
    loadPersistedTabState<RenewalFormState>(SOP_TAB2_SESSION_KEY, {
      renewalPrompt: legacySnapshot.renewalPrompt ?? DEFAULT_TAB2_STATE.renewalPrompt,
      renewalAngle: legacySnapshot.renewalAngle ?? DEFAULT_TAB2_STATE.renewalAngle,
      customStoryAngle: DEFAULT_TAB2_STATE.customStoryAngle,
      renewalCgpa: legacySnapshot.renewalCgpa ?? DEFAULT_TAB2_STATE.renewalCgpa,
      renewalCoursesDone:
        legacySnapshot.renewalCoursesDone ?? DEFAULT_TAB2_STATE.renewalCoursesDone,
      renewalDegree: legacySnapshot.renewalDegree ?? DEFAULT_TAB2_STATE.renewalDegree,
      renewalCareerGoals:
        legacySnapshot.renewalCareerGoals ?? DEFAULT_TAB2_STATE.renewalCareerGoals,
      renewalEssayResult:
        legacySnapshot.renewalEssayResult ?? DEFAULT_TAB2_STATE.renewalEssayResult,
      aiRenewalTemplates:
        legacySnapshot.aiRenewalTemplates ?? DEFAULT_TAB2_STATE.aiRenewalTemplates,
      aiRenewalTemplatesSignature:
        legacySnapshot.aiRenewalTemplatesSignature ?? DEFAULT_TAB2_STATE.aiRenewalTemplatesSignature,
    })
  ).current;

  const initialTab4 = useRef<RubricScorecard>(
    loadPersistedTabState<RubricScorecard>(SOP_TAB4_SESSION_KEY, {
      evalScholarshipTarget:
        legacySnapshot.evalScholarshipTarget ?? DEFAULT_TAB4_STATE.evalScholarshipTarget,
      evalEssayInput: legacySnapshot.evalEssayInput ?? DEFAULT_TAB4_STATE.evalEssayInput,
      evalResult: legacySnapshot.evalResult ?? DEFAULT_TAB4_STATE.evalResult,
      customStoryAngle: '',
    })
  ).current;

  // 4 Dedicated Workspaces/Tabs
  const [activeTab, setActiveTab] = useState<ScholarshipActiveTab>(initialActiveTab);

  // ==========================================
  // TAB 1: NEW SCHOLARSHIP APPLICANT STATE (`sop_tab1_state`)
  // ==========================================
  const [newPrompt, setNewPrompt] = useState(initialTab1.newPrompt);
  const [newAngle, setNewAngle] = useState<ScholarshipStoryAngle>(initialTab1.newAngle);
  const [newCustomStoryAngle, setNewCustomStoryAngle] = useState(
    initialTab1.customStoryAngle || ''
  );
  const [newDegree, setNewDegree] = useState(initialTab1.newDegree);
  const [newCareerGoals, setNewCareerGoals] = useState(initialTab1.newCareerGoals);
  const [newEssayResult, setNewEssayResult] = useState(initialTab1.newEssayResult);
  const [newLoading, setNewLoading] = useState(false);
  const [newGenCount, setNewGenCount] = useState(0);
  const [newCopied, setNewCopied] = useState(false);
  const [confirmClearTab1, setConfirmClearTab1] = useState(false);
  const [aiNewTemplates, setAiNewTemplates] = useState<ScholarshipTemplateItem[]>(
    initialTab1.aiNewTemplates || []
  );
  const [aiNewTemplatesSignature, setAiNewTemplatesSignature] = useState<string>(
    initialTab1.aiNewTemplatesSignature || ''
  );
  const [loadingNewDynTemplates, setLoadingNewDynTemplates] = useState(false);

  // ==========================================
  // TAB 2: SCHOLARSHIP RENEWAL STATE (`sop_tab2_state`)
  // ==========================================
  const [renewalPrompt, setRenewalPrompt] = useState(initialTab2.renewalPrompt);
  const [renewalAngle, setRenewalAngle] = useState<ScholarshipStoryAngle>(initialTab2.renewalAngle);
  const [renewalCustomStoryAngle, setRenewalCustomStoryAngle] = useState(
    initialTab2.customStoryAngle || ''
  );
  const [renewalCgpa, setRenewalCgpa] = useState(initialTab2.renewalCgpa);
  const [renewalCoursesDone, setRenewalCoursesDone] = useState(initialTab2.renewalCoursesDone);
  const [renewalDegree, setRenewalDegree] = useState(initialTab2.renewalDegree);
  const [renewalCareerGoals, setRenewalCareerGoals] = useState(initialTab2.renewalCareerGoals);
  const [renewalEssayResult, setNewRenewalEssayResult] = useState(initialTab2.renewalEssayResult);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [renewalGenCount, setRenewalGenCount] = useState(0);
  const [renewalCopied, setRenewalCopied] = useState(false);
  const [confirmClearTab2, setConfirmClearTab2] = useState(false);
  const [aiRenewalTemplates, setAiRenewalTemplates] = useState<ScholarshipTemplateItem[]>(
    initialTab2.aiRenewalTemplates || []
  );
  const [aiRenewalTemplatesSignature, setAiRenewalTemplatesSignature] = useState<string>(
    initialTab2.aiRenewalTemplatesSignature || ''
  );
  const [loadingRenewalDynTemplates, setLoadingRenewalDynTemplates] = useState(false);

  // ==========================================
  // TAB 4: INTL RUBRIC EVALUATOR STATE (`sop_tab4_state`)
  // ==========================================
  const [evalScholarshipTarget, setEvalScholarshipTarget] = useState(
    initialTab4.evalScholarshipTarget
  );
  const [evalEssayInput, setEvalEssayInput] = useState(initialTab4.evalEssayInput);
  const [evalResult, setEvalResult] = useState(initialTab4.evalResult);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalCopied, setEvalCopied] = useState(false);
  const [confirmClearTab4, setConfirmClearTab4] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTemplateForNotes, setSelectedTemplateForNotes] =
    useState<ScholarshipTemplateItem | null>(null);

  // Warm up verified dynamic Gemini model catalog once on mount
  useEffect(() => {
    void resolveDynamicModelCatalog();
  }, []);

  // Sub-Tab Isolation & State Persistence in sessionStorage
  useEffect(() => {
    savePersistedTabState<ScholarshipActiveTab>(SOP_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    savePersistedTabState<ScholarshipFormState>(SOP_TAB1_SESSION_KEY, {
      newPrompt,
      newAngle,
      customStoryAngle: newCustomStoryAngle,
      newDegree,
      newCareerGoals,
      newEssayResult,
      aiNewTemplates,
      aiNewTemplatesSignature,
    });
  }, [
    newPrompt,
    newAngle,
    newCustomStoryAngle,
    newDegree,
    newCareerGoals,
    newEssayResult,
    aiNewTemplates,
    aiNewTemplatesSignature,
  ]);

  useEffect(() => {
    savePersistedTabState<RenewalFormState>(SOP_TAB2_SESSION_KEY, {
      renewalPrompt,
      renewalAngle,
      customStoryAngle: renewalCustomStoryAngle,
      renewalCgpa,
      renewalCoursesDone,
      renewalDegree,
      renewalCareerGoals,
      renewalEssayResult,
      aiRenewalTemplates,
      aiRenewalTemplatesSignature,
    });
  }, [
    renewalPrompt,
    renewalAngle,
    renewalCustomStoryAngle,
    renewalCgpa,
    renewalCoursesDone,
    renewalDegree,
    renewalCareerGoals,
    renewalEssayResult,
    aiRenewalTemplates,
    aiRenewalTemplatesSignature,
  ]);

  useEffect(() => {
    savePersistedTabState<RubricScorecard>(SOP_TAB4_SESSION_KEY, {
      evalScholarshipTarget,
      evalEssayInput,
      evalResult,
      customStoryAngle: '',
    });
  }, [evalScholarshipTarget, evalEssayInput, evalResult]);

  // Clear Handlers (with non-blocking inline confirmation dialog guards)
  const executeClearTab1 = () => {
    setNewPrompt('');
    setNewAngle('currency_inflation');
    setNewCustomStoryAngle('');
    setNewDegree('');
    setNewCareerGoals('');
    setNewEssayResult('');
    setAiNewTemplates([]);
    setAiNewTemplatesSignature('');
    setConfirmClearTab1(false);
    setErrorMessage(null);
  };

  const handleRequestClearTab1 = () => {
    const hasContent =
      Boolean(newPrompt.trim()) ||
      Boolean(newCustomStoryAngle.trim()) ||
      Boolean(newDegree.trim()) ||
      Boolean(newCareerGoals.trim()) ||
      Boolean(newEssayResult.trim());
    if (!hasContent) {
      executeClearTab1();
      return;
    }
    setConfirmClearTab1(true);
  };

  const executeClearTab2 = () => {
    setRenewalPrompt('');
    setRenewalAngle('academic_high_achiever');
    setRenewalCustomStoryAngle('');
    setRenewalCgpa('');
    setRenewalCoursesDone('');
    setRenewalDegree('');
    setRenewalCareerGoals('');
    setNewRenewalEssayResult('');
    setAiRenewalTemplates([]);
    setAiRenewalTemplatesSignature('');
    setConfirmClearTab2(false);
    setErrorMessage(null);
  };

  const handleRequestClearTab2 = () => {
    const hasContent =
      Boolean(renewalPrompt.trim()) ||
      Boolean(renewalCustomStoryAngle.trim()) ||
      Boolean(renewalCgpa.trim()) ||
      Boolean(renewalCoursesDone.trim()) ||
      Boolean(renewalDegree.trim()) ||
      Boolean(renewalCareerGoals.trim()) ||
      Boolean(renewalEssayResult.trim());
    if (!hasContent) {
      executeClearTab2();
      return;
    }
    setConfirmClearTab2(true);
  };

  const executeClearTab4 = () => {
    setEvalScholarshipTarget('');
    setEvalEssayInput('');
    setEvalResult('');
    setConfirmClearTab4(false);
    setErrorMessage(null);
  };

  const handleRequestClearTab4 = () => {
    const hasContent =
      Boolean(evalScholarshipTarget.trim()) ||
      Boolean(evalEssayInput.trim()) ||
      Boolean(evalResult.trim());
    if (!hasContent) {
      executeClearTab4();
      return;
    }
    setConfirmClearTab4(true);
  };

  const [newTemplateClickCount, setNewTemplateClickCount] = useState(1);
  const [renewalTemplateClickCount, setRenewalTemplateClickCount] = useState(1);

  // Live Context-Aware Input Objects & Signatures (auto-recompute whenever any field/badge/custom angle changes)
  const newContextInput: ScholarshipContextInput = useMemo(
    () => ({
      mode: 'new_app',
      hardshipDescription: newPrompt,
      storyAngle: newAngle,
      customStoryAngle: newCustomStoryAngle,
      degreeProgram: newDegree,
      careerGoal: newCareerGoals,
    }),
    [newPrompt, newAngle, newCustomStoryAngle, newDegree, newCareerGoals]
  );
  const currentNewSignature = useMemo(
    () => buildContextSignature(newContextInput),
    [newContextInput]
  );
  const liveNewTemplates = useMemo(
    () => buildContextAwareTemplates(newContextInput, newTemplateClickCount, 'live-new'),
    [newContextInput, newTemplateClickCount]
  );
  const displayedNewTemplates = useMemo(
    () =>
      aiNewTemplates.length > 0 && aiNewTemplatesSignature === currentNewSignature
        ? aiNewTemplates
        : liveNewTemplates,
    [aiNewTemplates, aiNewTemplatesSignature, currentNewSignature, liveNewTemplates]
  );

  const renewalContextInput: ScholarshipContextInput = useMemo(
    () => ({
      mode: 'renewal_app',
      hardshipDescription: renewalPrompt,
      storyAngle: renewalAngle,
      customStoryAngle: renewalCustomStoryAngle,
      degreeProgram: renewalDegree,
      careerGoal: renewalCareerGoals,
      cgpa: renewalCgpa,
      coursesDone: renewalCoursesDone,
    }),
    [
      renewalPrompt,
      renewalAngle,
      renewalCustomStoryAngle,
      renewalDegree,
      renewalCareerGoals,
      renewalCgpa,
      renewalCoursesDone,
    ]
  );
  const currentRenewalSignature = useMemo(
    () => buildContextSignature(renewalContextInput),
    [renewalContextInput]
  );
  const liveRenewalTemplates = useMemo(
    () =>
      buildContextAwareTemplates(
        renewalContextInput,
        renewalTemplateClickCount,
        'live-renewal'
      ),
    [renewalContextInput, renewalTemplateClickCount]
  );
  const displayedRenewalTemplates = useMemo(
    () =>
      aiRenewalTemplates.length > 0 &&
      aiRenewalTemplatesSignature === currentRenewalSignature
        ? aiRenewalTemplates
        : liveRenewalTemplates,
    [
      aiRenewalTemplates,
      aiRenewalTemplatesSignature,
      currentRenewalSignature,
      liveRenewalTemplates,
    ]
  );

  const lensLabelFromId = (lens?: TemplateLens): string | undefined => {
    if (lens === 'economic_inflation') {
      return 'Economic & Inflation Lens (currency volatility, cost of living, food/utility price spikes, breadwinner strain)';
    }
    if (lens === 'grit_infrastructure') {
      return 'Grit, Power & Infrastructure Lens (electricity load-shedding, connectivity hurdles, digital divide, academic commitment)';
    }
    if (lens === 'merit_pay_it_forward') {
      return 'Academic Merit & Pay-It-Forward Lens (GPA/academic resilience, career milestones, community uplift upon graduation)';
    }
    return undefined;
  };

  // Generate for Tab 1 (New Applicant) -> Verified 'light' (flash-lite first, 600 maxOutputTokens)
  const handleGenerateNew = async (
    _isRegen = false,
    lensOverride?: TemplateLens
  ) => {
    setErrorMessage(null);
    setNewLoading(true);
    const nextCount = newGenCount + 1;
    setNewGenCount(nextCount);
    const seed = Date.now() + Math.floor(Math.random() * 1000000) + nextCount * 31337;

    try {
      const res = await generateScholarshipStatement({
        mode: 'new_app',
        hardshipDescription: newPrompt,
        storyAngle: newAngle,
        customStoryAngle: newCustomStoryAngle,
        degreeProgram: newDegree,
        careerGoal: newCareerGoals,
        lensHint: lensLabelFromId(lensOverride),
        variationNumber: nextCount,
        seed,
      });

      const fitted = enforceCompleteNarrativeArc(
        res,
        newContextInput,
        lensOverride || 'economic_inflation'
      );
      if (fitted && fitted.length >= 400) {
        setNewEssayResult(fitted);
      } else {
        throw new Error('Incomplete response');
      }
    } catch {
      const synthesized = buildContextAwareTemplates(
        newContextInput,
        nextCount,
        `seed-${seed}`
      );
      const chosen =
        (lensOverride && synthesized.find((item) => item.lens === lensOverride)) ||
        synthesized[(nextCount - 1) % synthesized.length];
      setNewEssayResult(chosen.text);
    } finally {
      setNewLoading(false);
    }
  };

  // Generate for Tab 2 (Renewal Applicant) -> Verified 'light' (flash-lite first, 600 maxOutputTokens)
  const handleGenerateRenewal = async (
    _isRegen = false,
    lensOverride?: TemplateLens
  ) => {
    setErrorMessage(null);
    setRenewalLoading(true);
    const nextCount = renewalGenCount + 1;
    setRenewalGenCount(nextCount);
    const seed = Date.now() + Math.floor(Math.random() * 1000000) + nextCount * 41337;

    try {
      const res = await generateScholarshipStatement({
        mode: 'renewal_app',
        hardshipDescription: renewalPrompt,
        storyAngle: renewalAngle,
        customStoryAngle: renewalCustomStoryAngle,
        degreeProgram: renewalDegree,
        careerGoal: renewalCareerGoals,
        cgpa: renewalCgpa,
        coursesDone: renewalCoursesDone,
        lensHint: lensLabelFromId(lensOverride),
        variationNumber: nextCount,
        seed,
      });

      const fitted = enforceCompleteNarrativeArc(
        res,
        renewalContextInput,
        lensOverride || 'merit_pay_it_forward'
      );
      if (fitted && fitted.length >= 400) {
        setNewRenewalEssayResult(fitted);
      } else {
        throw new Error('Incomplete response');
      }
    } catch {
      const synthesized = buildContextAwareTemplates(
        renewalContextInput,
        nextCount,
        `ren-seed-${seed}`
      );
      const chosen =
        (lensOverride && synthesized.find((item) => item.lens === lensOverride)) ||
        synthesized[(nextCount - 1) % synthesized.length];
      setNewRenewalEssayResult(chosen.text);
    } finally {
      setRenewalLoading(false);
    }
  };

  // Context-Aware Dynamic Templates for New Applicants -> Verified 'light' (flash-lite first)
  const handleGenerateDynamicNewTemplates = async () => {
    setLoadingNewDynTemplates(true);
    const nextCount = newTemplateClickCount + 1;
    setNewTemplateClickCount(nextCount);
    const entropySeed = `entropy-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const snapshotSig = currentNewSignature;
    const snapshotCtx = { ...newContextInput };

    try {
      const aiRaw = await generateScholarshipDynamicTemplates({
        mode: 'new_app',
        hardshipDescription: snapshotCtx.hardshipDescription,
        storyAngle: snapshotCtx.storyAngle,
        customStoryAngle: snapshotCtx.customStoryAngle,
        degreeProgram: snapshotCtx.degreeProgram,
        careerGoal: snapshotCtx.careerGoal,
        variationNumber: nextCount,
        seed: Date.now(),
      });

      const fallbackTemplates = buildContextAwareTemplates(snapshotCtx, nextCount, entropySeed);
      const lenses: TemplateLens[] = [
        'economic_inflation',
        'grit_infrastructure',
        'merit_pay_it_forward',
      ];

      if (aiRaw.length > 0) {
        const merged: ScholarshipTemplateItem[] = lenses.map((lens, idx) => {
          const matched = aiRaw.find((item) => item.lens === lens) || aiRaw[idx];
          const fb = fallbackTemplates[idx];
          const safeText =
            matched && typeof matched.text === 'string' && matched.text.trim().length > 180
              ? enforceCompleteNarrativeArc(matched.text, snapshotCtx, lens)
              : fb.text;

          return {
            ...fb,
            id: `ai-new-${nextCount}-${idx}-${Date.now()}`,
            title: matched?.title || fb.title,
            titleMy: matched?.titleMy || fb.titleMy,
            promptHint: matched?.promptHint || fb.promptHint,
            text: safeText,
          };
        });
        setAiNewTemplates(merged);
        setAiNewTemplatesSignature(snapshotSig);
      } else {
        setAiNewTemplates(fallbackTemplates);
        setAiNewTemplatesSignature(snapshotSig);
      }
    } catch {
      const fallbackTemplates = buildContextAwareTemplates(snapshotCtx, nextCount, entropySeed);
      setAiNewTemplates(fallbackTemplates);
      setAiNewTemplatesSignature(snapshotSig);
    } finally {
      setLoadingNewDynTemplates(false);
    }
  };

  // Context-Aware Dynamic Templates for Renewal Applicants -> Verified 'light' (flash-lite first)
  const handleGenerateDynamicRenewalTemplates = async () => {
    setLoadingRenewalDynTemplates(true);
    const nextCount = renewalTemplateClickCount + 1;
    setRenewalTemplateClickCount(nextCount);
    const entropySeed = `renewal-entropy-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const snapshotSig = currentRenewalSignature;
    const snapshotCtx = { ...renewalContextInput };

    try {
      const aiRaw = await generateScholarshipDynamicTemplates({
        mode: 'renewal_app',
        hardshipDescription: snapshotCtx.hardshipDescription,
        storyAngle: snapshotCtx.storyAngle,
        customStoryAngle: snapshotCtx.customStoryAngle,
        degreeProgram: snapshotCtx.degreeProgram,
        careerGoal: snapshotCtx.careerGoal,
        cgpa: snapshotCtx.cgpa,
        coursesDone: snapshotCtx.coursesDone,
        variationNumber: nextCount,
        seed: Date.now(),
      });

      const fallbackTemplates = buildContextAwareTemplates(snapshotCtx, nextCount, entropySeed);
      const lenses: TemplateLens[] = [
        'economic_inflation',
        'grit_infrastructure',
        'merit_pay_it_forward',
      ];

      if (aiRaw.length > 0) {
        const merged: ScholarshipTemplateItem[] = lenses.map((lens, idx) => {
          const matched = aiRaw.find((item) => item.lens === lens) || aiRaw[idx];
          const fb = fallbackTemplates[idx];
          const safeText =
            matched && typeof matched.text === 'string' && matched.text.trim().length > 180
              ? enforceCompleteNarrativeArc(matched.text, snapshotCtx, lens)
              : fb.text;

          return {
            ...fb,
            id: `ai-ren-${nextCount}-${idx}-${Date.now()}`,
            title: matched?.title || fb.title,
            titleMy: matched?.titleMy || fb.titleMy,
            promptHint: matched?.promptHint || fb.promptHint,
            text: safeText,
          };
        });
        setAiRenewalTemplates(merged);
        setAiRenewalTemplatesSignature(snapshotSig);
      } else {
        setAiRenewalTemplates(fallbackTemplates);
        setAiRenewalTemplatesSignature(snapshotSig);
      }
    } catch {
      const fallbackTemplates = buildContextAwareTemplates(snapshotCtx, nextCount, entropySeed);
      setAiRenewalTemplates(fallbackTemplates);
      setAiRenewalTemplatesSignature(snapshotSig);
    } finally {
      setLoadingRenewalDynTemplates(false);
    }
  };

  // Generate for Tab 4 (Intl Evaluator) -> Verified 'light' (flash-lite first)
  const handleEvaluateEssay = async () => {
    const textToEval = evalEssayInput.trim();
    if (!textToEval) return;
    setErrorMessage(null);
    setEvalLoading(true);
    try {
      const res = await evaluateScholarshipEssayWithRubric({
        targetScholarship: evalScholarshipTarget,
        essayText: textToEval,
      });

      if (res && res.trim().length > 80) {
        setEvalResult(res.trim());
        return;
      }
      throw new Error('Fallback evaluation needed');
    } catch {
      const charCount = textToEval.length;
      const isSafeLength = charCount <= 1000 && charCount >= 750;
      const endsComplete = /[.!?]$/.test(textToEval);
      const hasFinancial =
        /(currency|inflation|economic|income|financial|expense|poverty|fees|hardship|survival|family|rice|food|rent|\$140|ငွေကြေး|ကုန်ဈေးနှုန်း|စားဝတ်နေရေး|အခက်အခဲ)/i.test(
          textToEval
        );
      const hasAcademic =
        /(degree|gpa|cgpa|courses|study|learn|academic|university|diligence|grades|education|uopeople|ပညာ|စာမေးပွဲ|တက္ကသိုလ်)/i.test(
          textToEval
        );
      const hasCommunity =
        /(community|youth|empower|literacy|digital|share|contribute|give back|impact|help|clinic|development|အကျိုးပြု|ရပ်ရွာ|လူငယ်)/i.test(
          textToEval
        );
      const hasAiCliché =
        /(beacon of hope|pivotal role|in today's world|tapestry|relentless passion|testament to)/i.test(
          textToEval
        );

      const scoreFinancial = hasFinancial ? 23 : 15;
      const scoreAcademic = hasAcademic ? 22 : 14;
      const scoreCommunity = hasCommunity ? 18 : 11;
      const scoreAuthentic = hasAiCliché ? 9 : 14;
      const scoreFlow = isSafeLength && endsComplete ? 14 : charCount <= 1000 && endsComplete ? 11 : 6;
      const totalScore =
        scoreFinancial + scoreAcademic + scoreCommunity + scoreAuthentic + scoreFlow;

      const probabilityLabel =
        totalScore >= 80
          ? 'High / Competitive (~80-90%)'
          : totalScore >= 65
          ? 'Moderate (~60-70%)'
          : 'Needs Strengthening (<60%)';

      const fallbackEvaluation = `### 📊 Rubric Scorecard
| Evaluation Criterion | Max Score | Estimated Score | Status |
| :--- | :---: | :---: | :--- |
| 💰 Financial Need Persuasiveness & Specificity | 25 | ${scoreFinancial} | ${hasFinancial ? '✅ Strong Context' : '⚠️ Needs Specifics'} |
| 📚 Academic Grit, Merit & Continuity | 25 | ${scoreAcademic} | ${hasAcademic ? '✅ Well Demonstrated' : '⚠️ Add Study Proof'} |
| 🌍 Career & Community Impact Alignment | 20 | ${scoreCommunity} | ${hasCommunity ? '✅ Clear Uplift Goal' : '⚠️ Expand Give-Back'} |
| ✍️ Authentic Human Voice & Anti-AI Naturalness | 15 | ${scoreAuthentic} | ${!hasAiCliché ? '✅ Authentic Voice' : '⚠️ AI Cliché Detected'} |
| 📏 Narrative Arc & Portal Limit (<= 1,000 Chars) | 15 | ${scoreFlow} | ${isSafeLength && endsComplete ? `✅ Complete (${charCount}/1,000)` : `⚠️ Adjust (${charCount}/1,000)`} |
| **Total Overall Score** | **100** | **${totalScore}** | **${probabilityLabel}** |

### 🌟 Key Strengths (အားသာချက်များ)
- ${hasFinancial ? '**Concrete Economic Need**: ငွေကြေးဖောင်းပွမှုနှင့် မိသားစု စားဝတ်နေရေး အကျပ်အတည်းကို ကော်မတီ စာနာနားလည်နိုင်အောင် ဖော်ပြထားပါသည်။' : '**Direct Statement Opening**: ဘာသာရပ်နှင့် လျှောက်ထားလိုသော ရည်ရွယ်ချက်ကို တိုက်ရိုက် တင်ပြနိုင်ပါသည်။'}
- ${hasAcademic ? '**Academic Commitment & Grit**: ပညာရေးအပေါ် စိတ်အားထက်သန်မှုနှင့် အခက်အခဲကြားမှ စာမပြတ် ကြိုးစားမှု ပေါ်လွင်ပါသည်။' : '**Focused Core Message**: အကြောင်းအရာ ရှုပ်ထွေးမှုမရှိဘဲ ကျစ်လျစ်စွာ ရေးသားထားပါသည်။'}
- ${!hasAiCliché ? '**Natural Human Cadence**: AI detector များ ဖမ်းမိလေ့ရှိသော စကားလုံးအတုများ ကင်းစင်ပြီး လူသားဆန်သော အသံ ပေါ်လွင်ပါသည်။' : '**Editable Structure**: အဓိက အပိုဒ်ဖွဲ့စည်းပုံ ရှင်းလင်းသဖြင့် စကားလုံးအနည်းငယ် ပြင်ဆင်ရုံဖြင့် အဆင့်မြှင့်နိုင်ပါသည်။'}

### ⚠️ Critical Weaknesses & Missing Gaps (အားနည်းချက်နှင့် ဖြည့်စွက်ရန်များ)
- **Financial Specificity (${scoreFinancial}/25)**: ${hasFinancial ? 'စီးပွားရေးအခက်အခဲကို ဖော်ပြထားသော်လည်း ဖြစ်နိုင်ပါက ကုန်ဈေးနှုန်း သို့မဟုတ် အိမ်ထောင်စု ဝင်ငွေ/ထွက်ငွေ အချိုးအစားကို တိကျစွာ ထည့်သွင်းပါက အမှတ်ပြည့်ရနိုင်ပါသည်။' : 'မိသားစု ဝင်ငွေအခြေအနေနှင့် $140 Assessment Fee မတတ်နိုင်ရခြင်း အကြောင်းရင်းကို တိတိကျကျ ထည့်သွင်းရန် လိုအပ်သဖြင့် အမှတ်လျော့ထားပါသည်။'}
- **Academic & Community Evidence (${scoreAcademic + scoreCommunity}/45)**: ${hasAcademic && hasCommunity ? 'CGPA/လေ့လာမှု ဇွဲလုံ့လနှင့် ဘွဲ့ရပြီးနောက် ရပ်ရွာပြန်လည်အကျိုးပြုမည့် အစီအစဉ်ကို ပိုမိုခိုင်မာစေရန် တိကျသော ဥပမာတစ်ခု ထည့်ပါ။' : 'မိမိ၏ လေ့လာမှု မှတ်တမ်း/CGPA နှင့် ဘွဲ့ရရှိပြီးပါက ရပ်ရွာလူထုကို မည်သို့ အကျိုးပြုမည်ကို ထပ်မံဖြည့်စွက်ပါ။'}
- **Narrative Arc & Length (${scoreFlow}/15)**: ${isSafeLength && endsComplete ? `စာလုံးရေ ${charCount} ဖြစ်ပြီး နိဂုံးဝါကျ အပြည့်အစုံဖြင့် ပြီးဆုံးသဖြင့် Portal စံနှုန်းနှင့် ကိုက်ညီပါသည်။` : `${!endsComplete ? 'နောက်ဆုံးဝါကျသည် အဆုံးမသတ်ဘဲ ပြတ်တောက်နေသဖြင့် ကျေးဇူးတင် နိဂုံးဝါကျ အပြည့်အစုံ ပြန်ဖြည့်ပါ။ ' : ''}UoPeople portal တွင် အကောင်းဆုံးစံနှုန်းဖြစ်သော 800–950 characters အတွင်း ချိန်ညှိပါ (လက်ရှိ ${charCount} chars)။`}

### 🎯 Acceptance Probability / Competitiveness (ပညာသင်ဆု ရနိုင်ခြေ ခန့်မှန်းချက်)
- **Rating**: **${probabilityLabel}**
- ${totalScore >= 80 ? 'သင်၏ စာမူသည် UoPeople နှင့် နိုင်ငံတကာ ပညာသင်ဆု စံနှုန်းများနှင့် အလွန်ကိုက်ညီနေပြီ ဖြစ်ပါသည်။ ကိုယ်ရေးအချက်အလက်များ မှန်ကန်ကြောင်း နောက်ဆုံးအကြိမ် စစ်ဆေးပြီး တင်သွင်းနိုင်ပါသည်။' : 'အထက်ပါ အားနည်းချက်နေရာများတွင် ကိုယ်ပိုင် အချက်အလက် အသေးစိတ်နှင့် Community Impact အပိုင်းကို ထပ်မံဖြည့်စွက်ပါက ရနိုင်ခြေ သိသိသာသာ မြင့်တက်လာမည် ဖြစ်ပါသည်။'}`;

      setEvalResult(fallbackEvaluation);
    } finally {
      setEvalLoading(false);
    }
  };

  // Copy helpers
  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // Download DOCX / Text file helper
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
      {/* Top Banner Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-pink-950/70 via-slate-900 to-indigo-950/50 border border-pink-500/30 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {language === 'my' ? '🎓 UoPeople Scholar: Scholarship & Renewal Hub' : '🎓 UoPeople Scholar: Scholarship & Renewal Hub'}
                </h1>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                  Strict 1,000 Chars Limit
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  100% Anti-AI Human Voice
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {language === 'my'
                  ? 'UoPeople အသစ်လျှောက်ထားသူများနှင့် သက်တမ်းတိုးသူများအတွက် နေရာခွဲ၍ Prompt ပေးရုံဖြင့် စံချိန်မီ ထုတ်ပေးသည့်သီးသန့်စနစ်၊ Program Advisor ဆီသို့ ခွင့်ပြုချက်တောင်း Email နှင့် စံနှုန်းစစ်ဆေးခြင်း။'
                  : 'Dedicated suite for UoPeople New & Renewal scholarship applicants with 1,000-char portal compliance, Program Advisor email generator, and rubric evaluations.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PROMINENT BILINGUAL ENTRY DISCLAIMER (100% NON-GUARANTEE NOTICE)
         ========================================================================= */}
      <div className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-200 shadow-xl space-y-2.5">
        <div className="flex items-center space-x-2.5 text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>⚠️ ပညာရေးအထောက်အကူပြု အသိပေးချက် (Educational Assistance Disclaimer)</span>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-amber-100/95 font-sans">
          <p>
            <strong>🇲🇲 မြန်မာဘာသာ:</strong> ဤစနစ်သည် University of the People (UoPeople) ကျောင်းသား/သူများအတွက် အက်ဆေးနှင့် email ရေးသားရာတွင် ကူညီထောက်ပံ့ပေးသော ပညာရေးအထောက်အကူပြု လမ်းပြစနစ်သာဖြစ်ပြီး <strong>ပညာသင်ဆု (Scholarship) ရရှိရန် ၁၀၀% အာမခံခြင်း မဟုတ်ပါ</strong>။ ပညာသင်ဆု အတည်ပြုရွေးချယ်ခြင်းနှင့် သက်တမ်းတိုးခြင်းသည် <strong>UoPeople Scholarship Committee</strong> ၏ ဆုံးဖြတ်ချက်ပေါ်တွင်သာ သီးသန့်တည်ရှိပါသည်။
          </p>
          <p className="text-[11px] text-amber-200/80 italic">
            <strong>🇬🇧 English:</strong> This suite is strictly an educational mentoring and drafting aid designed to assist students. It <strong>does NOT guarantee 100% scholarship approval or renewal</strong> from University of the People. Final scholarship awarding decisions rest solely and exclusively with the UoPeople Scholarship Committee.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline text-rose-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Dedicated Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setActiveTab('new_app')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'new_app'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{language === 'my' ? '🎓 ၁။ UoPeople အသစ် လျှောက်ထားခြင်း' : '🎓 1. New Scholarship (1,000 Chars)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('renewal_app')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'renewal_app'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>{language === 'my' ? '🔄 ၂။ UoPeople ပညာသင်ဆု သက်တမ်းတိုးခြင်း' : '🔄 2. Scholarship Renewal (1,000 Chars)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('pa_email')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'pa_email'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>{language === 'my' ? '📧 ၃။ Program Advisor ဆီသို့ Email' : '📧 3. Program Advisor Renewal Email'}</span>
        </button>

        <button
          onClick={() => setActiveTab('intl_evaluator')}
          className={`flex items-center space-x-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'intl_evaluator'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{language === 'my' ? '⚖️ ၄။ နိုင်ငံတကာ တက္ကသိုလ်များ စံနှုန်းဖြင့် စစ်ဆေးခြင်း' : '⚖️ 4. International Rubric Evaluator'}</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: NEW SCHOLARSHIP APPLICANT (UoPeople အသစ် လျှောက်ထားခြင်း)
         ========================================================================= */}
      {activeTab === 'new_app' && (
        <div className="space-y-6">
          {/* BILINGUAL PRE-PROMPT WARNING */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5 shadow-lg">
            <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>⚠️ PROMPT မပေးမီ သတိပြုရန် (Pre-Prompt Warning)</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong>မြန်မာဘာသာ:</strong> UoPeople Student Portal စနစ်သည် စာလုံးရေ <strong>၁,၀၀၀ Characters</strong> ထက် တစ်လုံးမျှ ပို၍ တင်သွင်းမရနိုင်ပါ (Hard Limit)။ AI စကားလုံးများ မပါစေဘဲ သင်၏ ဖြစ်ရပ်မှန် စီးပွားရေး/ငွေကြေး အခက်အခဲ (ဥပမာ- ကုန်ဈေးနှုန်း၊ ငွေကြေးဖောင်းပွမှု၊ မိသားစုအခြေအနေ) ကို ရိုးသားစွာ ထည့်သွင်းပေးပါ။
            </p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed italic">
              <strong>English:</strong> The UoPeople portal strictly rejects any submission over 1,000 characters. Please provide your genuine personal circumstances. Generic AI buzzwords are strictly filtered out to ensure an authentic human tone.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input & Templates */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <span>ပညာသင်ဆု အသစ် လျှောက်ထားသူ အချက်အလက်</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20 font-mono">
                      Dynamic Generator
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestClearTab1}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                    </button>
                  </div>
                </div>

                {confirmClearTab1 && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                    <p className="text-red-200 font-medium leading-relaxed">
                      ထည့်သွင်းထားသော အချက်အလက်များနှင့် ထွက်ရှိထားသော စာမူကြမ်းများကို အားလုံးရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmClearTab1(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="button"
                        onClick={executeClearTab1}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        သေချာသည် (Clear)
                      </button>
                    </div>
                  </div>
                )}

                {/* Freeform Prompt in MM or EN */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    မိမိ၏ ငွေကြေး/စီးပွားရေး အခက်အခဲနှင့် အခြေအနေ (မြန်မာဘာသာ သို့မဟုတ် English လို ကြိုက်သလို ရေးနိုင်ပါသည်):
                  </label>
                  <textarea
                    rows={4}
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="ဥပမာ— ဒေသတွင်း ကုန်ဈေးနှုန်းကြီးမြင့်မှု၊ ငွေကြေးဖောင်းပွမှုကြောင့် မိသားစုဝင်ငွေ အလွန်ကျဆင်းသွားခြင်း၊ အလုပ်အကိုင် အခွင့်အလမ်းရှားပါးပြီး မိသားစုတွင် တစ်ဦးတည်း ရှာဖွေကျွေးမွေးနေရခြင်း၊ မီးပျက်မှုကြားမှ စာကြိုးစားနေရခြင်း..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 leading-relaxed font-sans"
                  />
                </div>

                {/* Focus Angle */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      အလေးပေးလိုသည့် ရှုထောင့် (Story Angle):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                      {[
                        { id: 'currency_inflation', label: 'ငွေကြေးဖောင်းပွမှု & ကုန်ဈေးနှုန်း' },
                        { id: 'conflict_banking', label: 'ဒေသတွင်း မတည်ငြိမ်မှု & ဘဏ်စနစ်' },
                        { id: 'family_breadwinner', label: 'မိသားစုတာဝန် & တစ်ဦးတည်းဝင်ငွေ' },
                        { id: 'balanced', label: 'မျှတသော စီးပွားရေးအခက်အခဲ' },
                        { id: 'academic_high_achiever', label: 'ပညာရေး အလွန်ထူးချွန်ပြီး ချို့တဲ့သူ' },
                      ].map((ang) => (
                        <button
                          key={ang.id}
                          type="button"
                          onClick={() => setNewAngle(ang.id as ScholarshipStoryAngle)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            newAngle === ang.id
                              ? 'bg-pink-600/25 border-pink-500 text-white font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {ang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Story Angle Input */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-slate-300 leading-snug">
                        ✍️ မိမိစိတ်ကြိုက် အလေးပေးလိုသည့် ရှုထောင့် ထည့်သွင်းရန် (Custom Story Angle - စိတ်ကြိုက်ထည့်နိုင်သည်):
                      </label>
                      <span className="text-[10px] font-mono text-pink-300/90 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                        {newCustomStoryAngle.length} chars
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={newCustomStoryAngle}
                      onChange={(e) => setNewCustomStoryAngle(e.target.value)}
                      placeholder="ဥပမာ- မိသားစု ကျန်းမာရေးစရိတ်ကြောင့် အခက်အခဲဖြစ်ရပုံ၊ ဒေသတွင်း သဘာဝဘေးအန္တရာယ်နှင့် စာကျက်ရန် လျှပ်စစ်မီးလိုအပ်ချက် စသည်..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 leading-relaxed font-sans"
                    />
                  </div>
                </div>

                {/* Degree & Career Goals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 mb-1 block">လျှောက်ထားသည့် Degree Program</label>
                    <input
                      type="text"
                      value={newDegree}
                      onChange={(e) => setNewDegree(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 mb-1 block">ဘွဲ့ရရှိပြီးပါက ရည်မှန်းချက်</label>
                    <input
                      type="text"
                      value={newCareerGoals}
                      onChange={(e) => setNewCareerGoals(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateNew(false)}
                  disabled={newLoading}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {newLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>၁,၀၀၀ Chars အတွင်း အတိအကျ ရေးသားနေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{language === 'my' ? '၁,၀၀၀ Chars အတိအကျ Essay ရေးထုတ်မည်' : 'Generate 1,000-Char Scholarship Essay'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ready Selectable Templates for New Applicants */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>နမူနာ Templates (Dynamic)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateDynamicNewTemplates}
                    disabled={loadingNewDynTemplates}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-[11px] font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${loadingNewDynTemplates ? 'animate-spin' : ''}`} />
                    <span>{loadingNewDynTemplates ? 'Templates ထုတ်နေသည်...' : '✨ New Templates ထုတ်မည်'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'my'
                    ? 'အောက်ပါ Templates များကို ကလစ်တစ်ချက်နှိပ်ရုံဖြင့် တိုက်ရိုက်ယူသုံးနိုင်ပြီး "New Templates ထုတ်မည်" ကို နှိပ်ပါက လုံးဝမတူညီသော ပုံစံသစ်များကို ဆက်လက်ထုတ်ပေးပါမည်:'
                    : 'Select verified templates or generate 100% unique variations on the fly:'}
                </p>

                <div className="space-y-2.5">
                  {displayedNewTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-pink-300">{tmpl.titleMy || tmpl.title}</span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                          {tmpl.text.length} chars
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 italic font-sans">{tmpl.text}</p>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateForNotes(tmpl)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>📝 Note & Outline လမ်းညွှန်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateNew(false, tmpl.lens)}
                          disabled={newLoading}
                          className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>အသစ်ရေးမည်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEssayResult(enforceCompleteNarrativeArc(tmpl.text, newContextInput, tmpl.lens))}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>တိုက်ရိုက်သုံးမည်</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Output with Character Counter & Post-Prompt Warning */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[520px] shadow-xl">
                <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Portal-Ready Scholarship Essay
                    </span>
                  </div>

                  {newEssayResult && (
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateNew(true)}
                        disabled={newLoading}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-semibold border border-slate-700 hover:border-pink-500/50 shadow transition-all cursor-pointer disabled:opacity-50"
                        title="Generate another 100% unique essay variation"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${newLoading ? 'animate-spin' : ''}`} />
                        <span>အသစ်ပြန်ထုတ်မည်</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(newEssayResult, setNewCopied)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        {newCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{newCopied ? 'Copied!' : 'Copy Essay'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestClearTab1}
                        className="text-xs px-2.5 py-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Character Limit Gauge */}
                <div className="mb-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">UoPeople Portal Character Limit</div>
                    <div className="text-xs font-bold text-white">
                      Strict 1,000 Characters Ceiling (စာလုံးရေ ၁,၀၀၀ အတိအကျ)
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-mono text-sm font-extrabold px-3 py-1 rounded-lg border ${
                        newEssayResult.length === 0
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : newEssayResult.length <= 980
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                          : newEssayResult.length <= 1000
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                          : 'bg-red-500/15 text-red-400 border-red-500/40'
                      }`}
                    >
                      {newEssayResult.length} / 1,000
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {newEssayResult.length === 0
                        ? 'Waiting for generation'
                        : newEssayResult.length <= 980
                        ? 'Perfect Length (Portal Safe ✅)'
                        : newEssayResult.length <= 1000
                        ? 'Acceptable (Near Limit)'
                        : 'Exceeds 1,000 Chars ⚠️'}
                    </div>
                  </div>
                </div>

                {/* Essay Box */}
                {newEssayResult ? (
                  <div className="flex-1 space-y-4">
                    {/* BILINGUAL POST-PROMPT SUBMISSION WARNING */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>⚠️ PORTAL သို့ မတင်သွင်းမီ သေချာစစ်ဆေးပါ (Submission Warning)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>မြန်မာဘာသာ:</strong> အထက်ပါ ထွက်လာသော အက်ဆေးတွင် သင်၏ ပညာသင်ဆု အချက်အလက်များ တိကျမှုရှိမရှိနှင့် စာလုံးရေ (၁,၀၀၀ Chars အောက်) ကို သေချာ စစ်ဆေးပြီးမှ Portal တွင် တင်သွင်းပါ။
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        <strong>English:</strong> Verify that degree details and personal hardship descriptions accurately match your circumstances before submitting.
                      </p>
                    </div>

                    {/* Anti-AI & Humanized Verification Audit Card (Real-Time Live ZeroGPT / GPTZero Dual Calibration) */}
                    <AiDetectorAuditCard
                      text={newEssayResult}
                      onReplaceText={(newText) => setNewEssayResult(newText)}
                      language={language}
                    />

                    <textarea
                      rows={12}
                      value={newEssayResult}
                      onChange={(e) => setNewEssayResult(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-pink-500 font-sans resize-none"
                    />

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <span>💡 မကြိုက်မချင်း အပေါ်က "အသစ်ပြန်ထုတ်မည်" ခလုတ်ကို နှိပ်၍ ပြန်လည်ရေးခိုင်းနိုင်ပါသည်။</span>
                      <button
                        onClick={() => downloadTextFile('UoPeople_New_Scholarship_Essay.txt', newEssayResult)}
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
                      ဘယ်ဘက်တွင် အချက်အလက်များ သို့မဟုတ် Prompt ထည့်သွင်းပြီး "၁,၀၀၀ Chars အတိအကျ Essay ရေးထုတ်မည်" ကို နှိပ်ပါက စည်းမျဉ်းနှင့်ကိုက်ညီသော အက်ဆေး ထွက်ပေါ်လာပါမည်။
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SCHOLARSHIP RENEWAL (UoPeople ပညာသင်ဆု သက်တမ်းတိုးခြင်း)
         ========================================================================= */}
      {activeTab === 'renewal_app' && (
        <div className="space-y-6">
          {/* BILINGUAL PRE-PROMPT WARNING */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5 shadow-lg">
            <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>⚠️ သက်တမ်းတိုးသူများ မရေးမီ သတိပြုရန် (Renewal Pre-Prompt Notice)</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong>မြန်မာဘာသာ:</strong> Scholarship သက်တမ်းတိုးရာတွင် UoPeople ကော်မတီက သင်၏ ယခင် term များမှ <strong>CGPA အမှတ်</strong>၊ <strong>သင်ယူပြီးစီးသော Course အရေအတွက်</strong> နှင့် <strong>ငွေကြေးအခက်အခဲ ဆက်လက်ရှိနေမှု</strong> ကို စစ်ဆေးပါသည်။ အဆိုပါ အချက် ၃ ချက်ကို ထည့်သွင်းပေးပါက ပညာသင်ဆု ရရှိရန် အခွင့်အလမ်း အမြင့်ဆုံး ဖြစ်စေပါသည်။
            </p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed italic">
              <strong>English:</strong> Renewal decisions strictly weigh your demonstrated academic consistency (CGPA & course completions) against continuing financial hardship. Ensure all three metrics are present in your input.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input & Templates */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-pink-400" />
                    <span>ပညာသင်ဆု သက်တမ်းတိုးသူ အချက်အလက်</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                      Continuing Scholar
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestClearTab2}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                    </button>
                  </div>
                </div>

                {confirmClearTab2 && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                    <p className="text-red-200 font-medium leading-relaxed">
                      ထည့်သွင်းထားသော အချက်အလက်များနှင့် ထွက်ရှိထားသော စာမူကြမ်းများကို အားလုံးရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmClearTab2(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="button"
                        onClick={executeClearTab2}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        သေချာသည် (Clear)
                      </button>
                    </div>
                  </div>
                )}

                {/* Freeform Prompt for Renewal */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    ငွေကြေးအခက်အခဲ ဆက်လက်ဖြစ်ပေါ်နေမှု အခြေအနေ (မြန်မာ/English):
                  </label>
                  <textarea
                    rows={4}
                    value={renewalPrompt}
                    onChange={(e) => setRenewalPrompt(e.target.value)}
                    placeholder="ဥပမာ— ဒေသတွင်း စီးပွားရေးအခြေအနေ ဆက်လက်ဆိုးရွားနေခြင်း၊ စားဝတ်နေရေး ကုန်ကျစရိတ်များ မြင့်တက်နေဆဲဖြစ်ပြီး မိသားစုဝင်ငွေ အကန့်အသတ်ရှိနေခြင်း၊ scholarship ဆက်လက်မရရှိပါက ရှေ့ဆက်တက်ရောက်ရန် မဖြစ်နိုင်တော့ခြင်း..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 leading-relaxed font-sans"
                  />
                </div>

                {/* CGPA & Courses Done */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 mb-1 block">လက်ရှိ CGPA အမှတ်</label>
                    <input
                      type="text"
                      value={renewalCgpa}
                      onChange={(e) => setRenewalCgpa(e.target.value)}
                      placeholder="3.65"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 mb-1 block">ပြီးစီးခဲ့သော Course အရေအတွက်</label>
                    <input
                      type="text"
                      value={renewalCoursesDone}
                      onChange={(e) => setRenewalCoursesDone(e.target.value)}
                      placeholder="8 courses (24 credits)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Degree Program & Career Goal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 mb-1 block">Degree Program</label>
                    <input
                      type="text"
                      value={renewalDegree}
                      onChange={(e) => setRenewalDegree(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 mb-1 block">ရှေ့ဆက်လှမ်းမည့် ပညာရေး/အလုပ် ရည်မှန်းချက်</label>
                    <input
                      type="text"
                      value={renewalCareerGoals}
                      onChange={(e) => setRenewalCareerGoals(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Angle & Custom Story Angle */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      သက်တမ်းတိုးရာတွင် အဓိက ဦးစားပေးလိုသည့် ရှုထောင့်:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                      {[
                        { id: 'academic_high_achiever', label: 'CGPA ကောင်းသော်လည်း ချို့တဲ့သူ' },
                        { id: 'currency_inflation', label: 'ငွေကြေးဖောင်းပွမှု & ကုန်ဈေးနှုန်း' },
                        { id: 'family_breadwinner', label: 'မိသားစုတာဝန် & တစ်ဦးတည်းဝင်ငွေ' },
                        { id: 'balanced', label: 'မျှတသော စီးပွားရေးအခက်အခဲ' },
                        { id: 'conflict_banking', label: 'ဒေသတွင်း မတည်ငြိမ်မှု & ဘဏ်စနစ်' },
                      ].map((ang) => (
                        <button
                          key={ang.id}
                          type="button"
                          onClick={() => setRenewalAngle(ang.id as ScholarshipStoryAngle)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            renewalAngle === ang.id
                              ? 'bg-pink-600/25 border-pink-500 text-white font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {ang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-slate-300 leading-snug">
                        ✍️ မိမိစိတ်ကြိုက် အလေးပေးလိုသည့် ရှုထောင့် ထည့်သွင်းရန် (Custom Story Angle - စိတ်ကြိုက်ထည့်နိုင်သည်):
                      </label>
                      <span className="text-[10px] font-mono text-pink-300/90 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                        {renewalCustomStoryAngle.length} chars
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={renewalCustomStoryAngle}
                      onChange={(e) => setRenewalCustomStoryAngle(e.target.value)}
                      placeholder="ဥပမာ- မိသားစု ကျန်းမာရေးစရိတ်ကြောင့် အခက်အခဲဖြစ်ရပုံ၊ ဒေသတွင်း သဘာဝဘေးအန္တရာယ်နှင့် စာကျက်ရန် လျှပ်စစ်မီးလိုအပ်ချက် စသည်..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 leading-relaxed font-sans"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateRenewal(false)}
                  disabled={renewalLoading}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {renewalLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Renewal Essay ရေးသားနေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{language === 'my' ? 'သက်တမ်းတိုး Essay ထုတ်ယူမည် (၁,၀၀၀ Chars အောက်)' : 'Generate Renewal Essay (1,000 Chars)'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ready Renewal Templates */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>သက်တမ်းတိုး Templates (Dynamic)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateDynamicRenewalTemplates}
                    disabled={loadingRenewalDynTemplates}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-[11px] font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${loadingRenewalDynTemplates ? 'animate-spin' : ''}`} />
                    <span>{loadingRenewalDynTemplates ? 'Templates ထုတ်နေသည်...' : '✨ New Templates ထုတ်မည်'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'my'
                    ? 'သက်တမ်းတိုး အောင်မြင်ခဲ့သော နမူနာများကို တိုက်ရိုက်ယူသုံးနိုင်သည် သို့မဟုတ် "New Templates ထုတ်မည်" ကို နှိပ်၍ အသစ်စက်စက် ပုံစံများကို ထုတ်ယူနိုင်ပါသည်:'
                    : 'Select proven renewal templates or generate 100% unique variations on the fly:'}
                </p>

                <div className="space-y-2.5">
                  {displayedRenewalTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-pink-300">{tmpl.titleMy || tmpl.title}</span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                          {tmpl.text.length} chars
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 italic font-sans">{tmpl.text}</p>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateForNotes(tmpl)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>📝 Note & Outline လမ်းညွှန်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateRenewal(false, tmpl.lens)}
                          disabled={renewalLoading}
                          className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>အသစ်ထုတ်မည်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewRenewalEssayResult(
                              enforceCompleteNarrativeArc(tmpl.text, renewalContextInput, tmpl.lens)
                            )
                          }
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>တိုက်ရိုက်သုံးမည်</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Output with Character Counter & Post-Prompt Warning */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full min-h-[520px] shadow-xl">
                <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Renewal Scholarship Essay
                    </span>
                  </div>

                  {renewalEssayResult && (
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateRenewal(true)}
                        disabled={renewalLoading}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-semibold border border-slate-700 hover:border-pink-500/50 shadow transition-all cursor-pointer disabled:opacity-50"
                        title="Generate another 100% unique renewal essay variation"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${renewalLoading ? 'animate-spin' : ''}`} />
                        <span>အသစ်ပြန်ထုတ်မည်</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(renewalEssayResult, setRenewalCopied)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        {renewalCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{renewalCopied ? 'Copied!' : 'Copy Essay'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestClearTab2}
                        className="text-xs px-2.5 py-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Character Limit Gauge */}
                <div className="mb-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">UoPeople Portal Character Limit</div>
                    <div className="text-xs font-bold text-white">
                      Strict 1,000 Characters Ceiling (သက်တမ်းတိုး စာလုံးရေ ကန့်သတ်ချက်)
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-mono text-sm font-extrabold px-3 py-1 rounded-lg border ${
                        renewalEssayResult.length === 0
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : renewalEssayResult.length <= 980
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                          : renewalEssayResult.length <= 1000
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                          : 'bg-red-500/15 text-red-400 border-red-500/40'
                      }`}
                    >
                      {renewalEssayResult.length} / 1,000
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {renewalEssayResult.length === 0
                        ? 'Waiting for generation'
                        : renewalEssayResult.length <= 980
                        ? 'Optimal Renewal Length ✅'
                        : renewalEssayResult.length <= 1000
                        ? 'Acceptable (Near Limit)'
                        : 'Exceeds 1,000 Chars ⚠️'}
                    </div>
                  </div>
                </div>

                {/* Output Area */}
                {renewalEssayResult ? (
                  <div className="flex-1 space-y-4">
                    {/* BILINGUAL POST-PROMPT SUBMISSION WARNING */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>⚠️ PORTAL သို့ မတင်သွင်းမီ သေချာစစ်ဆေးပါ (Submission Warning)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>မြန်မာဘာသာ:</strong> ထွက်လာသော Renewal Essay တွင် သင်၏ CGPA အမှတ်၊ ဘာသာရပ်အမည်နှင့် စာလုံးရေ (၁,၀၀၀ Chars အောက်) ကို သေချာစစ်ဆေးပြီးမှ Portal တွင် တင်သွင်းပါ။
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        <strong>English:</strong> Verify that CGPA, courses completed, and continuing financial barriers are accurate before submitting.
                      </p>
                    </div>

                    {/* Anti-AI & Humanized Verification Audit Card (Real-Time Live ZeroGPT / GPTZero Dual Calibration) */}
                    <AiDetectorAuditCard
                      text={renewalEssayResult}
                      onReplaceText={(newText) => setNewRenewalEssayResult(newText)}
                      language={language}
                    />

                    <textarea
                      rows={12}
                      value={renewalEssayResult}
                      onChange={(e) => setNewRenewalEssayResult(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-pink-500 font-sans resize-none"
                    />

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <span>💡 မကြိုက်မချင်း "အသစ်ပြန်ထုတ်မည်" ခလုတ်ကို နှိပ်၍ ပြန်လည်ရေးခိုင်းနိုင်ပါသည်။</span>
                      <button
                        onClick={() => downloadTextFile('UoPeople_Renewal_Scholarship_Essay.txt', renewalEssayResult)}
                        className="text-pink-400 hover:text-pink-300 flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .txt</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                    <RotateCcw className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                    <p className="text-xs max-w-sm">
                      ဘယ်ဘက်တွင် CGPA၊ ပြီးစီးခဲ့သော Course များနှင့် အခက်အခဲများကို ထည့်သွင်းပြီး "သက်တမ်းတိုး Essay ထုတ်ယူမည်" ကို နှိပ်ပါ။
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PROGRAM ADVISOR EMAIL (Program Advisor ဆီသို့ ခွင့်ပြုချက်တောင်း Email)
         ========================================================================= */}
      {activeTab === 'pa_email' && (
        <AdvisorEmailSuite language={language} />
      )}

      {/* =========================================================================
          TAB 4: INTERNATIONAL RUBRIC EVALUATOR (နိုင်ငံတကာ တက္ကသိုလ်များ စံနှုန်းဖြင့် စစ်ဆေးခြင်း)
         ========================================================================= */}
      {activeTab === 'intl_evaluator' && (
        <div className="space-y-6">
          {/* Pre-Notice */}
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 space-y-1.5 shadow-lg">
            <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-purple-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-purple-400" />
              <span>⚖️ နိုင်ငံတကာ တက္ကသိုလ်များ ပညာသင်ဆု စံနှုန်းဖြင့် စစ်ဆေးခြင်း (International Scholarship Rubric)</span>
            </div>
            <p className="text-xs text-purple-200/90 leading-relaxed">
              <strong>စစ်ဆေးပေးမည့် စံနှုန်းများ:</strong> စုစုပေါင်းရမှတ် (Score out of 100)၊ ငွေကြေးအခက်အခဲ သက်သေပြနိုင်မှု (Financial Need Persuasiveness)၊ ပညာရေးကြိုးစားမှု (Academic Grit & Merit)၊ လူမှုအသိုက်အဝန်း အကျိုးပြုနိုင်မှု (Community Impact)၊ စစ်မှန်သော လူသားဟန်ပန် (Anti-AI Authenticity) နှင့် UoPeople စာလုံးရေ ၁,၀၀၀ ကန့်သတ်ချက် ပြည့်မီမှုတို့ကို ပြည့်စုံစွာ အကဲဖြတ်ပေးပါသည်။
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Scholarship Program (ရည်မှန်းထားသော ပညာသင်ဆု)
                  </label>
                  <input
                    type="text"
                    value={evalScholarshipTarget}
                    onChange={(e) => setEvalScholarshipTarget(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-pink-500 font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      စစ်ဆေးလိုသည့် အက်ဆေး စာမူကြမ်းကို ထည့်သွင်းပါ:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          evalEssayInput.length <= 1000
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                        }`}
                      >
                        {evalEssayInput.length} chars
                      </span>
                      <button
                        type="button"
                        onClick={handleRequestClearTab4}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️ ရှင်းထုတ်မည် (Clear)</span>
                      </button>
                    </div>
                  </div>

                  {confirmClearTab4 && (
                    <div className="mb-2.5 p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
                      <p className="text-red-200 font-medium leading-relaxed">
                        ထည့်သွင်းထားသော အချက်အလက်များနှင့် ထွက်ရှိထားသော စာမူကြမ်းများကို အားလုံးရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmClearTab4(false)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                        >
                          မလုပ်တော့ပါ
                        </button>
                        <button
                          type="button"
                          onClick={executeClearTab4}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          သေချာသည် (Clear)
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={12}
                    value={evalEssayInput}
                    onChange={(e) => setEvalEssayInput(e.target.value)}
                    placeholder="Paste your UoPeople scholarship essay, SOP, or scholarship statement here to get evaluated..."
                    className="w-full p-3.5 text-xs bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-sans leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleEvaluateEssay}
                  disabled={evalLoading || !evalEssayInput.trim()}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {evalLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>စံနှုန်းများဖြင့် အသေးစိတ် စစ်ဆေးနေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>နိုင်ငံတကာ စံနှုန်းများဖြင့် အမှတ်ပေးစစ်ဆေးမည်</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Detailed Rubric Scorecard & Non-Guarantee Advisory Banner */}
            <div className="lg:col-span-7 space-y-4">
              {/* High-Contrast Non-Guarantee Advisory Banner directly above Evaluation Output Card */}
              <div className="p-4 rounded-2xl bg-amber-950/40 border-2 border-amber-500/50 text-amber-100 shadow-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">
                  ⚠️ <strong className="text-amber-300">အသိပေးချက် (Educational Advisory):</strong> ဤစနစ်မှ ခွဲခြမ်းစိတ်ဖြာပေးသော အမှတ်နှင့် ရနိုင်ခြေ ခန့်မှန်းချက်များသည် တက္ကသိုလ်ဝင်ခွင့် စံနှုန်းများအပေါ် အခြေခံထားသော ပညာရေးအထောက်အကူပြု လမ်းညွှန်ချက်သာ ဖြစ်ပါသည်။ တက္ကသိုလ် Scholarship Committee ၏ အတည်ပြု ဆုံးဖြတ်ချက်ကို ၁၀၀% အာမခံခြင်း မဟုတ်ပါ။
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col min-h-[460px] shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Admissions Committee Evaluation & Rubric Scorecard
                    </span>
                  </div>
                  {evalResult && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(evalResult, setEvalCopied)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                    >
                      {evalCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{evalCopied ? 'Copied!' : 'Copy Scorecard'}</span>
                    </button>
                  )}
                </div>

                {evalLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold">Analyzing against international scholarship rubrics...</p>
                  </div>
                ) : evalResult ? (
                  <div className="flex-1 overflow-y-auto max-h-[580px] pr-2">
                    <RubricMarkdownView markdown={evalResult} />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                    <ShieldCheck className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
                    <p className="text-xs max-w-sm">
                      ဘယ်ဘက်တွင် မိမိ၏ အက်ဆေး စာမူကြမ်းကို ထည့်သွင်းပြီး စစ်ဆေးမှုပြုလုပ်ပါက အမှတ် ၁၀၀ တွင် ရရှိမည့် အဆင့်နှင့် အားနည်းချက်၊ အားသာချက်များကို အသေးစိတ် တွေ့မြင်ရပါမည်။
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Template Explorer & Note & Outline Guide Modal */}
      {selectedTemplateForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-pink-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    🧭 Template Explorer & Outline Guide
                  </h3>
                  <p className="text-[10px] text-slate-400">Contextual Step-by-Step Writing Blueprint</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplateForNotes(null)}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-xl bg-slate-800 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Error state if outline is missing */}
            {!selectedTemplateForNotes.outline || selectedTemplateForNotes.outline.length === 0 ? (
              <div className="p-6 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto animate-bounce" />
                <p className="font-bold">Outline အချက်အလက်များ ဖော်ပြရန် မတွေ့ရှိပါ။ Template အသစ် ပြန်လည်ရွေးချယ်ပါ သို့မဟုတ် Generate ပြုလုပ်ပါ။</p>
                <button
                  type="button"
                  onClick={() => {
                    const isRenewalModal = selectedTemplateForNotes.category === 'renewal';
                    const regeneratedOutline = generateContextualOutline(
                      selectedTemplateForNotes.title || 'Scholarship Essay',
                      selectedTemplateForNotes.coreTheme || 'financial hardship and academic goals',
                      selectedTemplateForNotes.category || 'new_applicant',
                      isRenewalModal ? renewalContextInput : newContextInput
                    );
                    const regeneratedAdvisory = generateAdvisoryNotes(
                      selectedTemplateForNotes.coreTheme || 'financial hardship and academic goals',
                      selectedTemplateForNotes.category || 'new_applicant',
                      isRenewalModal ? renewalContextInput : newContextInput
                    );
                    setSelectedTemplateForNotes({
                      ...selectedTemplateForNotes,
                      outline: regeneratedOutline,
                      advisoryNotes: regeneratedAdvisory,
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry / အချက်အလက်များ ပြန်လည်ထုတ်ယူမည်</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-200">
                {/* Header Banner with Title & Advisory Target */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-950/40 via-slate-950 to-indigo-950/40 border border-pink-500/30 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 uppercase">
                      {selectedTemplateForNotes.category || 'Scholarship Template'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      Target: {selectedTemplateForNotes.advisoryNotes?.wordCountTarget || '850-980 Chars'}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">{selectedTemplateForNotes.titleMy || selectedTemplateForNotes.title}</h4>
                  <p className="text-[11px] text-slate-300 italic">{selectedTemplateForNotes.promptHint || selectedTemplateForNotes.coreTheme}</p>
                </div>

                {/* Step-by-Step Accordion / Stepper */}
                <div className="space-y-3">
                  <h5 className="font-bold text-slate-100 flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>Step-by-Step Essay Structure & Recommended Topics:</span>
                  </h5>

                  {selectedTemplateForNotes.outline.map((sec: TemplateOutlineSection) => (
                    <div key={sec.step} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {sec.step}
                        </span>
                        <h6 className="font-bold text-pink-300 text-xs">{sec.sectionTitle}</h6>
                      </div>

                      <div className="pl-8 space-y-2">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recommended Topics:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {sec.recommendedTopics?.map((topic: string, tIdx: number) => (
                              <span key={tIdx} className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 text-[11px]">
                                • {topic}
                              </span>
                            ))}
                          </div>
                        </div>

                        {sec.suggestedAnecdotes && sec.suggestedAnecdotes.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-indigo-200 text-[11px]">
                            <strong className="text-indigo-300">💡 Suggested Anecdote:</strong> {sec.suggestedAnecdotes[0]}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 italic">
                          <strong>Structural Guidance:</strong> {sec.structuralGuidance}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Advisory Notes (Do's & Don'ts) */}
                {selectedTemplateForNotes.advisoryNotes && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                      <div className="text-xs font-bold text-emerald-300 flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Do's (ဆောင်ရန်):</span>
                      </div>
                      <ul className="text-[11px] text-slate-300 space-y-1 pl-4 list-disc">
                        {selectedTemplateForNotes.advisoryNotes.dos?.map((d: string, dIdx: number) => (
                          <li key={dIdx}>{d}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-1">
                      <div className="text-xs font-bold text-rose-300 flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Don'ts (ရှောင်ရန်):</span>
                      </div>
                      <ul className="text-[11px] text-slate-300 space-y-1 pl-4 list-disc">
                        {selectedTemplateForNotes.advisoryNotes.donts?.map((dn: string, dnIdx: number) => (
                          <li key={dnIdx}>{dn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300">
                  <strong>💡 Portal-Ready Reference Essay ({selectedTemplateForNotes.text.length} chars):</strong>
                  <div className="mt-1 text-slate-300 font-sans">{selectedTemplateForNotes.text}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const isRenewalModal = selectedTemplateForNotes.category === 'renewal';
                  const chosenLens = selectedTemplateForNotes.lens;
                  setSelectedTemplateForNotes(null);
                  if (isRenewalModal) {
                    handleGenerateRenewal(false, chosenLens);
                  } else {
                    handleGenerateNew(false, chosenLens);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
              >
                ✨ ဤအကြောင်းအရာဖြင့် အသစ်ထုတ်မည်
              </button>
              <button
                type="button"
                onClick={() => {
                  const isRenewalModal = selectedTemplateForNotes.category === 'renewal';
                  const fitted = enforceCompleteNarrativeArc(
                    selectedTemplateForNotes.text,
                    isRenewalModal ? renewalContextInput : newContextInput,
                    selectedTemplateForNotes.lens
                  );
                  if (isRenewalModal) {
                    setNewRenewalEssayResult(fitted);
                  } else {
                    setNewEssayResult(fitted);
                  }
                  setSelectedTemplateForNotes(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
              >
                ✅ တိုက်ရိုက် အသုံးပြုမည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
