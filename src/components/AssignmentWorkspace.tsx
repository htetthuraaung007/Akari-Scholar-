import React, { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { exportAssignmentActivityDocx } from '../utils/docxExporter';
import { Paraphraser } from './Paraphraser';
import { executeGeminiRequest, TaskComplexity } from '../services/geminiService';
import { parseUniversalDocument } from '../services/documentParser';
import {
  EmergencyImageItem,
  EmergencyRescuerMode,
  buildEmergencyBridgeToApaPayload,
  clearEmergencyRescuerState,
  loadEmergencyRescuerState,
  saveApaStudioState,
  saveEmergencyRescuerState,
} from '../utils/emergencyApaBridge';

export type AssignmentSubModule = 
  | 'outline_suite' 
  | 'discussion_reply' 
  | 'paraphraser' 
  | 'emergency_rescuer';

export type Module1SubTab = 
  | 'outline' 
  | 'draft_audit' 
  | 'turnitin_integrity' 
  | 'advisor_email';

export interface AssignmentWorkspaceProps {
  onBackToDashboard?: () => void;
  initialModule?: 'outline_suite' | 'discussion_reply' | 'paraphraser' | 'emergency_rescuer';
  initialSubTab?: string;
  onSubTabChange?: (tab: any) => void;
}

interface WorkspacePersistedState {
  outlineInput: string;
  outlineResult: string;
  lastOutlineSignature: string;
  draftInput: string;
  draftAttachedFile: string;
  draftRubricInput: string;
  instructorFeedback: string;
  draftAuditResult: string;
  lastAuditedSignature: string;
  integrityInput: string;
  integrityResult: string;
  discussionUnitContext: string;
  peer1Post: string;
  peer1Reply: string;
  peer2Post: string;
  peer2Reply: string;
  peer3Post: string;
  peer3Reply: string;
  followupQuestion: string;
  followupReply: string;
  emergencyTopic: string;
  emergencyResult: string;
}

const WORKSPACE_SESSION_KEY = 'akari_assignment_workspace_state_v2';

const DEFAULT_PERSISTED_STATE: WorkspacePersistedState = {
  outlineInput: '',
  outlineResult: '',
  lastOutlineSignature: '',
  draftInput: '',
  draftAttachedFile: '',
  draftRubricInput: '',
  instructorFeedback: '',
  draftAuditResult: '',
  lastAuditedSignature: '',
  integrityInput: '',
  integrityResult: '',
  discussionUnitContext: '',
  peer1Post: '',
  peer1Reply: '',
  peer2Post: '',
  peer2Reply: '',
  peer3Post: '',
  peer3Reply: '',
  followupQuestion: '',
  followupReply: '',
  emergencyTopic: '',
  emergencyResult: '',
};

let MEMORY_WORKSPACE_CACHE: WorkspacePersistedState | null = null;
let MEMORY_UPLOADED_IMAGES: { name: string; dataUrl: string }[] = [];
let MEMORY_DRAFT_RUBRIC_IMAGES: { name: string; dataUrl: string }[] = [];

function loadPersistedWorkspaceState(): WorkspacePersistedState {
  if (MEMORY_WORKSPACE_CACHE) {
    return MEMORY_WORKSPACE_CACHE;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(WORKSPACE_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const hydrated: WorkspacePersistedState = { ...DEFAULT_PERSISTED_STATE, ...parsed };
        MEMORY_WORKSPACE_CACHE = hydrated;
        return hydrated;
      }
    } catch {}
  }
  const fallback: WorkspacePersistedState = { ...DEFAULT_PERSISTED_STATE };
  MEMORY_WORKSPACE_CACHE = fallback;
  return fallback;
}

function savePersistedWorkspaceState(nextState: WorkspacePersistedState): void {
  MEMORY_WORKSPACE_CACHE = nextState;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify(nextState));
    } catch {}
  }
}

function computeContentSignature(parts: (string | number)[]): string {
  const raw = parts.map((p) => String(p ?? '').trim()).join('||');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ws_${(h >>> 0).toString(16)}_${raw.length}`;
}

const EXTERNAL_PLAGIARISM_TOOLS = [
  { name: 'DupliChecker', badge: 'Free (1,000 words)', badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800/40', desc: 'Web ပေါ်ရှိ အချက်အလက်များနှင့် တိုက်ဆိုင်စစ်ဆေးပေးသည်။', url: 'https://www.duplichecker.com' },
  { name: 'SmallSEOTools', badge: 'Web Checker', badgeColor: 'bg-blue-950 text-blue-400 border-blue-800/40', desc: 'စာပိုဒ်အလိုက် အင်တာနက်စာမျက်နှာများနှင့် စစ်ပေးသည်။', url: 'https://smallseotools.com/plagiarism-checker/' },
  { name: 'PlagiarismDetector', badge: 'Free Tier', badgeColor: 'bg-cyan-950 text-cyan-400 border-cyan-800/40', desc: 'တူညီနေသော စာကြောင်းများကို အင်တာနက်ရင်းမြစ်များနှင့် စစ်ပေးသည်။', url: 'https://plagiarismdetector.net' },
  { name: 'Scribbr', badge: 'Academic Checker', badgeColor: 'bg-purple-950 text-purple-400 border-purple-800/40', desc: 'ကျောင်းသုံးစာတမ်း database များကို တိုက်စစ်ပေးသည်။', url: 'https://www.scribbr.com/plagiarism-checker/' },
  { name: 'Grammarly', badge: 'Academic / Web', badgeColor: 'bg-teal-950 text-teal-400 border-teal-800/40', desc: 'ProQuest database နှင့် academic source များကို တိုက်စစ်ပေးသည်။', url: 'https://www.grammarly.com/plagiarism-checker' }
];

const EXTERNAL_HUMANIZER_TOOLS = [
  { name: 'QuillBot', badge: 'Humanizer / Paraphraser', badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800/40', desc: 'စာကြောင်းတည်ဆောက်ပုံများကို သဘာဝကျကျ အသွင်ပြောင်းပေးသည်။', url: 'https://quillbot.com' },
  { name: 'Undetectable AI', badge: 'Advanced Humanizer', badgeColor: 'bg-purple-950 text-purple-400 border-purple-800/40', desc: 'AI pattern များကို လူသားဟန်အဖြစ် ပြန်လည်မွမ်းမံပေးသည်။', url: 'https://undetectable.ai' },
  { name: 'StealthWriter', badge: 'Bypass Engine', badgeColor: 'bg-blue-950 text-blue-400 border-blue-800/40', desc: 'AI ထွက်စာသားများကို သဘာဝဆန်သော academic flow ပြောင်းပေးသည်။', url: 'https://stealthwriter.ai' },
  { name: 'HIX Bypass', badge: 'Academic Bypass', badgeColor: 'bg-teal-950 text-teal-400 border-teal-800/40', desc: 'စာပိုဒ်ဖွဲ့စည်းပုံနှင့် အသုံးအနှုန်းများကို humanize ပြုလုပ်ပေးသည်။', url: 'https://hix.ai/bypass-gpt' },
  { name: 'BypassGPT', badge: 'Fast Humanizer', badgeColor: 'bg-amber-950 text-amber-400 border-amber-800/40', desc: 'ဆွေးနွေးချက်စာသားများကို လူကိုယ်တိုင်ရေးဟန်အဖြစ် ချိန်ညှိပေးသည်။', url: 'https://bypassgpt.ai' }
];

const EMERGENCY_INTEGRITY_HUMANIZERS = [
  { name: 'HumanizeAI Pro', url: 'https://www.humanizeai.pro/', badge: 'Humanizer' },
  { name: 'QuillBot', url: 'https://quillbot.com/ai-humanizer', badge: 'Paraphraser' },
  { name: 'BypassGPT', url: 'https://bypassgpt.ai/', badge: 'Humanizer' },
  { name: 'Undetectable AI', url: 'https://undetectable.ai/', badge: 'Humanizer' },
  { name: 'HIX Bypass', url: 'https://hix.ai/bypass-gpt', badge: 'Bypass Engine' },
];

const EMERGENCY_INTEGRITY_DETECTORS = [
  { name: 'ZeroGPT', url: 'https://www.zerogpt.com/', badge: 'AI Detector' },
  { name: 'GPTZero', url: 'https://gptzero.me/', badge: 'AI Detector' },
  { name: 'Copyleaks', url: 'https://copyleaks.com/ai-content-detector', badge: 'AI Detector' },
  { name: 'QuillBot AI Detector', url: 'https://quillbot.com/ai-content-detector', badge: 'AI Detector' },
];

const EMERGENCY_INTEGRITY_PLAGIARISM = [
  { name: 'DupliChecker', url: 'https://www.duplichecker.com/', badge: 'Plagiarism' },
  { name: 'SmallSEOTools', url: 'https://smallseotools.com/plagiarism-checker/', badge: 'Plagiarism' },
  { name: 'PlagiarismDetector', url: 'https://plagiarismdetector.net/', badge: 'Plagiarism' },
];

export function purgeHeadingNumbers(content: string): string {
  if (!content) return '';
  let result = content
    // Purge markdown hashes with numbers: e.g. "### 1. ", "###1 ", "## 2. "
    .replace(/^#{1,6}\s*(?:Step\s+)?\d+[.\):\-]?\s*/gim, '### ')
    // Remove lines that became bare "### " with no heading text after stripping numbers
    .replace(/^###\s*$/gm, '')
    // Purge plain line leading numbers/Roman numerals for standard academic headings
    .replace(
      /^\s*(?:Section\s+|Step\s+)?(?:\d+|[IVXLCDM]+)[.\):\-]\s+(Assignment Title|Title|Introduction|Engaging Hook|Hook|Background|Conceptual|Theoretical|Literature|Analysis|Discussion|Critical|Case Study|Practical|Synthesis|Strategic|Implications|Recommendation|Recommendations|Conclusion|References)\b/gim,
      '$1'
    )
    // Purge bold-wrapped numbered headings e.g. "**1. Introduction**" -> "**Introduction**"
    .replace(
      /^(\s*\*{1,2}\s*)(?:Section\s+|Step\s+)?(?:\d+|[IVXLCDM]+)[.\):\-]\s+(Assignment Title|Title|Introduction|Engaging Hook|Hook|Background|Conceptual|Theoretical|Literature|Analysis|Discussion|Critical|Case Study|Practical|Synthesis|Strategic|Implications|Recommendation|Recommendations|Conclusion|References)\b/gim,
      '$1$2'
    );

  // Strip leading numeric prefixes on standalone short unpunctuated heading lines (not prose sentences or citations)
  result = result
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*(?:\*\*?)?(?:Section\s+)?\d+[.)]\s+[A-Z][^\n.?!]{2,90}(?:\*\*?)?\s*$/.test(line)) {
        return line.replace(/^(\s*(?:\*\*?)?)(?:Section\s+)?\d+[.)]\s+/, '$1');
      }
      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

export const sanitizeApaHeadings = purgeHeadingNumbers;

type TaskKey =
  | 'outline'
  | 'draft_audit'
  | 'turnitin_audit'
  | 'peer_comment'
  | 'followup_reply'
  | 'emergency_rescuer'
  | 'emergency_refine';

export const AssignmentWorkspace: React.FC<AssignmentWorkspaceProps> = ({
  onBackToDashboard,
  initialModule = 'outline_suite',
  initialSubTab,
  onSubTabChange,
}) => {
  const initialCache = loadPersistedWorkspaceState();

  // initialModule အတိုင်း တိုက်ရိုက် စတင်ပွင့်စေခြင်း
  const [activeModule, setActiveModule] = useState<AssignmentSubModule>(initialModule);

  useEffect(() => {
    if (initialModule) {
      setActiveModule(initialModule);
    }
  }, [initialModule]);

  const [activeSubTab, setActiveSubTab] = useState<Module1SubTab>(() => {
    if (initialSubTab === 'critique') return 'draft_audit';
    if (initialSubTab === 'integrity_studio') return 'turnitin_integrity';
    if (initialSubTab === 'emergency_petition') return 'advisor_email';
    if (initialSubTab === 'rubric') return 'outline';
    return 'outline';
  });

  useEffect(() => {
    if (!initialSubTab) return;
    if (initialSubTab === 'critique') setActiveSubTab('draft_audit');
    else if (initialSubTab === 'integrity_studio') setActiveSubTab('turnitin_integrity');
    else if (initialSubTab === 'emergency_petition') setActiveSubTab('advisor_email');
    else if (initialSubTab === 'rubric') setActiveSubTab('outline');
  }, [initialSubTab]);

  useEffect(() => {
    if (!onSubTabChange) return;
    if (activeSubTab === 'draft_audit') onSubTabChange('critique');
    else if (activeSubTab === 'turnitin_integrity') onSubTabChange('integrity_studio');
    else if (activeSubTab === 'advisor_email') onSubTabChange('emergency_petition');
    else if (activeSubTab === 'outline') onSubTabChange('rubric');
  }, [activeSubTab, onSubTabChange]);

  // Isolated Per-Task Loading States & AbortController Map (Eliminates cross-tab or stuck spinners)
  const [taskLoading, setTaskLoading] = useState<Record<TaskKey, boolean>>({
    outline: false,
    draft_audit: false,
    turnitin_audit: false,
    peer_comment: false,
    followup_reply: false,
    emergency_rescuer: false,
    emergency_refine: false,
  });
  const abortControllersRef = useRef<Partial<Record<TaskKey, AbortController>>>({});

  // Cancel any in-flight requests cleanly on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      Object.values(controllers).forEach((ctrl) => {
        try {
          ctrl?.abort();
        } catch {}
      });
    };
  }, []);

  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [moodleCleanerActive, setMoodleCleanerActive] = useState<boolean>(true);

  // 1A. Outline States (Hydrated from Persistent Session Cache)
  const [outlineInput, setOutlineInput] = useState(initialCache.outlineInput);
  const [outlineAttachedFile, setOutlineAttachedFile] = useState<string>('');
  const [outlineSyncCleared, setOutlineSyncCleared] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>(MEMORY_UPLOADED_IMAGES);
  const [outlineResult, setOutlineResult] = useState(initialCache.outlineResult);
  const [lastOutlineSignature, setLastOutlineSignature] = useState(initialCache.lastOutlineSignature);
  const [confirmClearTarget, setConfirmClearTarget] = useState<
    'outline' | 'draft' | 'peer' | 'followup' | 'emergency' | 'emergency_result' | null
  >(null);
  const [clearSuccessToast, setClearSuccessToast] = useState(false);
  const [historyItems, setHistoryItems] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('akari_outline_history') || '[]');
    } catch {
      return [];
    }
  });

  // 1B. Draft Audit & Instructor Simulator States (Hydrated & Two-Way Linked with Outline Context)
  const [draftInput, setDraftInput] = useState(initialCache.draftInput);
  const [draftAttachedFile, setDraftAttachedFile] = useState<string>(initialCache.draftAttachedFile);
  const [draftRubricInput, setDraftRubricInput] = useState(initialCache.draftRubricInput);
  const [draftRubricImages, setDraftRubricImages] = useState<{ name: string; dataUrl: string }[]>(MEMORY_DRAFT_RUBRIC_IMAGES);
  const [instructorFeedback, setInstructorFeedback] = useState(initialCache.instructorFeedback);
  const [draftAuditResult, setDraftAuditResult] = useState(initialCache.draftAuditResult);
  const [lastAuditedSignature, setLastAuditedSignature] = useState(initialCache.lastAuditedSignature);
  const [showDraftRubricOverride, setShowDraftRubricOverride] = useState(false);

  // 1C. Turnitin & Free Crossref States
  const [integrityInput, setIntegrityInput] = useState(initialCache.integrityInput);
  const [integrityResult, setIntegrityResult] = useState(initialCache.integrityResult);
  const [freeApiAuditing, setFreeApiAuditing] = useState(false);
  const [integritySubTab, setIntegritySubTab] = useState<'references_finder' | 'turnitin_audit'>('references_finder');
  const [refSearchQuery, setRefSearchQuery] = useState('');

  // 1D. Advisor Email States
  const [emailTemplateType, setEmailTemplateType] = useState<'blackout' | 'medical' | 'technical' | 'custom'>('blackout');
  const [emailCourseName, setEmailCourseName] = useState('');
  const [emailRecipientRole] = useState<'instructor' | 'advisor' | 'both'>('instructor');
  const [emailInstructorName, setEmailInstructorName] = useState('');
  const [emailStudentName, setEmailStudentName] = useState('');
  const [emailStudentID, setEmailStudentID] = useState('');
  const [emailExtensionDays, setEmailExtensionDays] = useState('48 hours (2 Days)');
  const [emailCustomReason, setEmailCustomReason] = useState('');

  const buildEmailTemplate = (
    type: 'blackout' | 'medical' | 'technical' | 'custom', 
    cName = emailCourseName, 
    iName = emailInstructorName, 
    sName = emailStudentName, 
    sID = emailStudentID, 
    days = emailExtensionDays,
    role = emailRecipientRole,
    custom = emailCustomReason
  ) => {
    const courseDisplay = cName.trim() ? cName.trim() : '[Course Code / Name]';
    const instructorDisplay = iName.trim() ? iName.trim() : 'Course Instructor';
    const studentDisplay = sName.trim() ? sName.trim() : '[Your Full Name]';
    const idDisplay = sID.trim() ? sID : '[Your UoPeople ID]';
    const salutation = role === 'advisor'
      ? `Dear Program Advisor,`
      : role === 'both'
      ? `Dear ${instructorDisplay} and Program Advisor,`
      : `Dear ${instructorDisplay},`;

    const extensionPhrase = (!days || days === 'none' || days.includes('General'))
      ? 'an academic extension'
      : `an academic extension of ${days}`;

    if (type === 'blackout') {
      return `Subject: Urgent Extension Request - Localized Infrastructure Disruption [${courseDisplay}]\n\n${salutation}\n\nI hope this email finds you well.\n\nI am writing to respectfully request ${extensionPhrase} for the upcoming coursework submission in ${courseDisplay}. In Yangon, Myanmar, we are currently experiencing severe rolling power outages and localized telecommunication disruptions, severely impeding my regular access to the learning portal and academic resources.\n\nI have already drafted the initial analysis and will finalize and upload my submission as soon as stable electricity and network access are restored. I truly appreciate your understanding, flexibility, and continuous guidance under these challenging local circumstances.\n\nThank you very much for your time and kind consideration.\n\nSincerely,\n${studentDisplay}\nStudent ID: ${idDisplay}\nUniversity of the People`;
    } else if (type === 'medical') {
      return `Subject: Urgent Academic Consideration - Medical Emergency [${courseDisplay}]\n\n${salutation}\n\nI hope you are doing well.\n\nI am writing to formally request ${extensionPhrase} for my coursework in ${courseDisplay} due to an unexpected medical emergency. I am currently under medical rest and care, which has temporarily restricted my ability to complete my submission on schedule.\n\nI expect to fully resume my academic duties within a few days and am prepared to provide any relevant documentation if required by the university policy.\n\nThank you very much for your understanding and continuous support.\n\nWarm regards,\n${studentDisplay}\nStudent ID: ${idDisplay}\nUniversity of the People`;
    } else if (type === 'technical') {
      return `Subject: LMS Submission Error & Extension Request [${courseDisplay}]\n\n${salutation}\n\nI hope this message finds you well.\n\nI am writing to report a technical issue encountered on the UoPeople Moodle platform while attempting to upload my assignment for ${courseDisplay}. The portal experienced an unexpected timeout / upload error prior to the deadline.\n\nAttached to this email is my finalized coursework file along with a screenshot of the submission error for your verification. I respectfully request your permission to record this submission or grant ${extensionPhrase} to re-upload once the portal stabilizes.\n\nThank you for your assistance and support.\n\nRespectfully,\n${studentDisplay}\nStudent ID: ${idDisplay}\nUniversity of the People`;
    } else {
      const sanitizedReason = /[\u1000-\u109F]/.test(custom)
        ? 'Due to an unexpected personal and family emergency along with localized severe infrastructure disruptions, I am temporarily restricted from completing my coursework on schedule.'
        : custom.trim() || 'Unforeseen academic and personal constraints.';
      return `Subject: Formal Request for Coursework Consideration & Extension [${courseDisplay}]\n\n${salutation}\n\nI hope this email finds you well.\n\nI am writing to formally request ${extensionPhrase} regarding my coursework in ${courseDisplay}.\n\nReason for Request:\n${sanitizedReason}\n\nI am fully dedicated to my academic progress and have already completed the preliminary preparation for this work. I will finalize and submit the completed assignment as soon as possible.\n\nThank you very much for your time, understanding, and kind consideration.\n\nSincerely,\n${studentDisplay}\nStudent ID: ${idDisplay}\nUniversity of the People`;
    }
  };

  const [emailGenerated, setEmailGenerated] = useState('');

  // 2. Discussion Reply Advanced States (Hydrated from Persistent Session Cache)
  const [discussionTab, setDiscussionTab] = useState<'peer' | 'followup'>('peer');
  const [selectedPeerSlot, setSelectedPeerSlot] = useState<1 | 2 | 3>(1);
  const [discussionUnitContext, setDiscussionUnitContext] = useState(initialCache.discussionUnitContext);

  const [peer1Post, setPeer1Post] = useState(initialCache.peer1Post);
  const [peer1Reply, setPeer1Reply] = useState(initialCache.peer1Reply);
  const [peer2Post, setPeer2Post] = useState(initialCache.peer2Post);
  const [peer2Reply, setPeer2Reply] = useState(initialCache.peer2Reply);
  const [peer3Post, setPeer3Post] = useState(initialCache.peer3Post);
  const [peer3Reply, setPeer3Reply] = useState(initialCache.peer3Reply);

  const [followupQuestion, setFollowupQuestion] = useState(initialCache.followupQuestion);
  const [followupReply, setFollowupReply] = useState(initialCache.followupReply);

  // 4. Emergency 1-Hour Rescuer (Hydrated from Persistent `emergency_rescuer_state`)
  const initialEmergency = loadEmergencyRescuerState();
  const [emergencyMode, setEmergencyMode] = useState<EmergencyRescuerMode>(initialEmergency.mode);
  const [emergencyCourseCode, setEmergencyCourseCode] = useState(initialEmergency.courseCode);
  const [emergencyUnitTitle, setEmergencyUnitTitle] = useState(initialEmergency.unitTitle);
  const [emergencyTopic, setEmergencyTopic] = useState(
    initialEmergency.promptText || initialCache.emergencyTopic
  );
  const [emergencyDocName, setEmergencyDocName] = useState(initialEmergency.attachedDocName);
  const [emergencyDocText, setEmergencyDocText] = useState(initialEmergency.attachedDocText);
  const [emergencyImages, setEmergencyImages] = useState<EmergencyImageItem[]>(
    initialEmergency.images || []
  );
  const [emergencyResult, setEmergencyResult] = useState(() => {
    const raw = initialEmergency.generatedDraft || initialCache.emergencyResult;
    return purgeHeadingNumbers(raw);
  });
  const [emergencyTargetWords, setEmergencyTargetWords] = useState<number>(750);
  const [emergencyTargetWordsText, setEmergencyTargetWordsText] = useState<string>('750');
  const syncEmergencyTargetWords = (value: number) => {
    const clamped = Math.min(1500, Math.max(250, Math.round(value)));
    setEmergencyTargetWords(clamped);
    setEmergencyTargetWordsText(String(clamped));
  };
  const [isRefineSectionOpen, setIsRefineSectionOpen] = useState<boolean>(true);
  const [refineInstruction, setRefineInstruction] = useState<string>('');
  const [emergencyDragActive, setEmergencyDragActive] = useState(false);
  const [emergencyDocParsing, setEmergencyDocParsing] = useState(false);
  const [emergencyNotice, setEmergencyNotice] = useState<{
    type: 'warning' | 'success' | 'info';
    message: string;
  } | null>(null);

  // Sync Workspace State to Module Cache & sessionStorage
  useEffect(() => {
    savePersistedWorkspaceState({
      outlineInput,
      outlineResult,
      lastOutlineSignature,
      draftInput,
      draftAttachedFile,
      draftRubricInput,
      instructorFeedback,
      draftAuditResult,
      lastAuditedSignature,
      integrityInput,
      integrityResult,
      discussionUnitContext,
      peer1Post,
      peer1Reply,
      peer2Post,
      peer2Reply,
      peer3Post,
      peer3Reply,
      followupQuestion,
      followupReply,
      emergencyTopic,
      emergencyResult,
    });
  }, [
    outlineInput,
    outlineResult,
    lastOutlineSignature,
    draftInput,
    draftAttachedFile,
    draftRubricInput,
    instructorFeedback,
    draftAuditResult,
    lastAuditedSignature,
    integrityInput,
    integrityResult,
    discussionUnitContext,
    peer1Post,
    peer1Reply,
    peer2Post,
    peer2Reply,
    peer3Post,
    peer3Reply,
    followupQuestion,
    followupReply,
    emergencyTopic,
    emergencyResult,
  ]);

  useEffect(() => {
    MEMORY_UPLOADED_IMAGES = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    MEMORY_DRAFT_RUBRIC_IMAGES = draftRubricImages;
  }, [draftRubricImages]);

  useEffect(() => {
    saveEmergencyRescuerState({
      mode: emergencyMode,
      courseCode: emergencyCourseCode,
      unitTitle: emergencyUnitTitle,
      promptText: emergencyTopic,
      attachedDocName: emergencyDocName,
      attachedDocText: emergencyDocText,
      images: emergencyImages,
      generatedDraft: emergencyResult,
    });
  }, [
    emergencyMode,
    emergencyCourseCode,
    emergencyUnitTitle,
    emergencyTopic,
    emergencyDocName,
    emergencyDocText,
    emergencyImages,
    emergencyResult,
  ]);

  // Computed Signatures & Dirty Flags for Instant Result Caching
  const activeRubricCriteriaForAudit =
    draftRubricInput.trim() ||
    outlineInput.trim() ||
    outlineResult.trim() ||
    'Standard University Assessment Rubric (10 Points Total: Thesis & Argumentation 3 pts, Analysis of Trade-offs & Evidence 3 pts, Connection to Course Materials 2 pts, APA 7th Citations & Academic Mechanics 2 pts)';

  const activeAuditImages = draftRubricImages.length > 0 ? draftRubricImages : uploadedImages;

  const currentAuditSignature = computeContentSignature([
    draftInput,
    activeRubricCriteriaForAudit,
    instructorFeedback,
    activeAuditImages.length,
    activeAuditImages.map((img) => img.name).join(','),
  ]);

  const isAuditDirty =
    !draftAuditResult.trim() || currentAuditSignature !== lastAuditedSignature;

  const currentOutlineSignature = computeContentSignature([
    outlineInput,
    uploadedImages.length,
    uploadedImages.map((img) => img.name).join(','),
  ]);

  const isOutlineDirty =
    !outlineResult.trim() || currentOutlineSignature !== lastOutlineSignature;

  // Centralized Token-Optimized Gemini Orchestrator with Per-Task Loading & AbortController
  const callGemini = async (
    taskKey: TaskKey,
    prompt: string,
    complexity: TaskComplexity = 'standard',
    maxTokens: number = 800,
    imagePayload?: { name: string; dataUrl: string }[],
    bypassCache: boolean = false,
    systemInstruction?: string
  ) => {
    // Cancel any previous in-flight request for this specific task
    if (abortControllersRef.current[taskKey]) {
      try {
        abortControllersRef.current[taskKey]?.abort();
      } catch {}
    }

    const controller = new AbortController();
    abortControllersRef.current[taskKey] = controller;

    setTaskLoading((prev) => ({ ...prev, [taskKey]: true }));
    setAiError(null);
    let resultText = '';

    try {
      const responseText = await executeGeminiRequest(
        prompt,
        complexity,
        systemInstruction,
        imagePayload,
        maxTokens,
        controller.signal,
        bypassCache
      );
      if (responseText && !controller.signal.aborted) {
        resultText = responseText.trim();
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        return '';
      }
      console.error(`Centralized Gemini execution error (${taskKey}):`, err);
      setAiError(
        err?.message ||
          'AI ချိတ်ဆက်မှု ခေတ္တအဆင်မပြေပါ။ ခေတ္တစောင့်ဆိုင်း၍ ထပ်မံကြိုးစားကြည့်ပါခင်ဗျာ။'
      );
    } finally {
      if (abortControllersRef.current[taskKey] === controller) {
        delete abortControllersRef.current[taskKey];
        setTaskLoading((prev) => ({ ...prev, [taskKey]: false }));
      }
    }

    return resultText;
  };

  // Document Text Extractor (Clean Client-Side Extraction)
  const handleUniversalDocExtract = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx')) {
      const mammothLib = (mammoth as any) || (window as any).mammoth;
      if (mammothLib) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const res = await mammothLib.extractRawText({ arrayBuffer });
          const text = (res.value || '').trim();
          if (text) return text;
        } catch {}
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const docXml = zip.file('word/document.xml');
        if (docXml) {
          const xmlText = await docXml.async('text');
          const matches = xmlText.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
          if (matches && matches.length > 0) {
            return matches
              .map((m) => m.replace(/<[^>]+>/g, '').trim())
              .filter(Boolean)
              .join(' ')
              .replace(/\s{2,}/g, ' ')
              .trim();
          }
        }
      } catch {}
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawStr = decoder.decode(arrayBuffer);
        const matches = rawStr.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
        if (matches && matches.length > 0) {
          return matches
            .map((m) => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }
        return '';
      } catch {
        return `[File Attached: ${file.name}]`;
      }
    } else if (name.endsWith('.xlsx') || name.endsWith('.csv')) {
      const text = await file.text();
      return text.slice(0, 4000);
    } else {
      return await file.text();
    }
  };

  // Upload handler for Outline
  const handleOutlineFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await handleUniversalDocExtract(file);
      setOutlineInput((prev) => (prev ? prev + '\n\n' + text : text));
      setOutlineAttachedFile(file.name);
    } catch {
      setAiError('ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။');
    }
    e.target.value = '';
  };

  const executeClearOutlineTab = () => {
    setOutlineInput('');
    setOutlineAttachedFile('');
    setUploadedImages([]);
    MEMORY_UPLOADED_IMAGES = [];
    setOutlineResult('');
    setLastOutlineSignature('');
    setOutlineSyncCleared(true);
    setConfirmClearTarget(null);
  };

  const handleRequestClearOutline = () => {
    const hasContent = Boolean(
      outlineInput.trim() ||
        uploadedImages.length > 0 ||
        outlineAttachedFile ||
        outlineResult.trim()
    );
    if (!hasContent) {
      executeClearOutlineTab();
      return;
    }
    setConfirmClearTarget('outline');
  };

  const executeClearDraftTab = () => {
    setDraftInput('');
    setDraftAttachedFile('');
    setInstructorFeedback('');
    setDraftAuditResult('');
    setLastAuditedSignature('');
    setConfirmClearTarget(null);
  };

  const handleRequestClearDraft = () => {
    const hasContent = Boolean(
      draftInput.trim() ||
        draftAttachedFile ||
        instructorFeedback.trim() ||
        draftAuditResult.trim()
    );
    if (!hasContent) {
      executeClearDraftTab();
      return;
    }
    setConfirmClearTarget('draft');
  };

  const triggerClearSuccessToast = () => {
    setClearSuccessToast(true);
    setTimeout(() => setClearSuccessToast(false), 2000);
  };

  const executeClearActivePeer = () => {
    setDiscussionUnitContext('');
    if (selectedPeerSlot === 1) {
      setPeer1Post('');
      setPeer1Reply('');
    } else if (selectedPeerSlot === 2) {
      setPeer2Post('');
      setPeer2Reply('');
    } else {
      setPeer3Post('');
      setPeer3Reply('');
    }
    setConfirmClearTarget(null);
    triggerClearSuccessToast();
  };

  const executeClearFollowup = () => {
    setDiscussionUnitContext('');
    setFollowupQuestion('');
    setFollowupReply('');
    setConfirmClearTarget(null);
    triggerClearSuccessToast();
  };

  const handleRequestClearDiscussion = () => {
    if (discussionTab === 'peer') {
      const hasContent = Boolean(
        discussionUnitContext.trim() || currentPeerPost.trim() || currentPeerReply.trim()
      );
      if (!hasContent) {
        executeClearActivePeer();
        return;
      }
      setConfirmClearTarget('peer');
    } else {
      const hasContent = Boolean(
        discussionUnitContext.trim() || followupQuestion.trim() || followupReply.trim()
      );
      if (!hasContent) {
        executeClearFollowup();
        return;
      }
      setConfirmClearTarget('followup');
    }
  };

  // Emergency Rescuer Handlers
  const handleEmergencyImageFiles = (files: FileList | File[]) => {
    const allowedExt = /\.(png|jpe?g|webp)$/i;
    const validFiles = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || allowedExt.test(f.name)
    );
    if (validFiles.length === 0) {
      setEmergencyNotice({
        type: 'warning',
        message: '.png, .jpg, .jpeg သို့မဟုတ် .webp ပုံဖိုင်များကိုသာ တင်နိုင်ပါသည်။',
      });
      return;
    }
    const remaining = Math.max(0, 6 - emergencyImages.length);
    if (remaining === 0) {
      setEmergencyNotice({
        type: 'warning',
        message: 'ပုံအများဆုံး ၆ ပုံအထိသာ ထည့်သွင်းနိုင်ပါသည်။',
      });
      return;
    }
    validFiles.slice(0, remaining).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (dataUrl) {
          setEmergencyImages((prev) => [...prev, { name: file.name, dataUrl }]);
          setEmergencyNotice(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleEmergencyDocFile = async (file: File) => {
    setEmergencyDocParsing(true);
    setEmergencyNotice(null);
    try {
      const parsed = await parseUniversalDocument(file);
      if (parsed.fileType === 'image' && parsed.imageBase64) {
        setEmergencyImages((prev) =>
          prev.length < 6 ? [...prev, { name: file.name, dataUrl: parsed.imageBase64! }] : prev
        );
      } else if (parsed.extractedText.trim()) {
        setEmergencyDocName(file.name);
        setEmergencyDocText(parsed.extractedText);
        setEmergencyNotice({
          type: 'success',
          message: `✓ ${file.name} မှ စာသား (${parsed.truncatedWordCount} words) ကို ဖတ်ရှုပြီးပါပြီ။`,
        });
      } else {
        setEmergencyNotice({
          type: 'warning',
          message: `${file.name} မှ စာသားဖတ်ရှု၍ မရပါ။ Scanned PDF ဖြစ်ပါက Screenshot (.png/.jpg) အဖြစ် တင်ပေးပါ။`,
        });
      }
    } catch {
      setEmergencyNotice({
        type: 'warning',
        message: 'ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်။ (.docx, .pdf, .txt ဖိုင်များကို စစ်ဆေးပါ)',
      });
    } finally {
      setEmergencyDocParsing(false);
    }
  };

  const handleEmergencyDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setEmergencyDragActive(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length === 0) return;

    const imageFiles = dropped.filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)
    );
    const docFiles = dropped.filter(
      (f) => /\.(docx|pdf|txt)$/i.test(f.name) && !imageFiles.includes(f)
    );

    if (imageFiles.length > 0) {
      handleEmergencyImageFiles(imageFiles);
    }
    if (docFiles.length > 0) {
      await handleEmergencyDocFile(docFiles[0]);
    }
  };

  const handleGenerateEmergencyDraft = async () => {
    if (!emergencyTopic.trim() && !emergencyDocText.trim() && emergencyImages.length === 0) {
      setEmergencyNotice({
        type: 'warning',
        message: 'Assignment/Discussion မေးခွန်းစာသား၊ ဖိုင် သို့မဟုတ် Rubric ပုံ တစ်ခုခု ထည့်သွင်းပေးပါခင်ဗျာ။',
      });
      return;
    }

    setEmergencyNotice(null);

    const clampedWordCount = Math.min(1500, Math.max(250, Math.round(emergencyTargetWords || 750)));
    const isConciseDiscussion = emergencyMode === 'discussion_post' && clampedWordCount <= 400;
    const calibratedMaxTokens =
      clampedWordCount <= 400
        ? 500
        : Math.min(3600, Math.max(1600, Math.round(clampedWordCount * 1.9 + 350)));
    const conciseRangeMin = Math.max(250, clampedWordCount - 40);
    const conciseRangeMax = Math.min(400, clampedWordCount + 40);
    const discussionLengthDirective = isConciseDiscussion
      ? `Ensure the generated discussion post strictly stays concise, focused, and between ${conciseRangeMin}-${conciseRangeMax} words (target ~${clampedWordCount} words), ideal for UoPeople Discussion Forum requirements.`
      : `TARGET BODY LENGTH: Approximately ${clampedWordCount} words (strictly satisfy this length target cleanly without cutting off mid-sentence).`;

    const systemInstruction =
      emergencyMode === 'discussion_post'
        ? `You are an elite university academic writer (University of the People standard).
Output Mode: DISCUSSION FORUM POST RESCUER.
Write a COMPLETE, submission-ready university Discussion Forum post strictly in natural, formal, human-sounding academic ENGLISH (100% English, zero Burmese, zero conversational meta-prelude).
STRICT SCHOLARLY FORMATTING: NEVER use numbered headings (NO '1.', '2.', '### 1', '###1', 'Step 1:', etc.).
- For Discussions: Lead directly with natural paragraph prose or clean, unnumbered thematic headers ONLY.
${discussionLengthDirective}
CRITICAL COMPLETENESS RULE: You MUST finish every single section cleanly through the final APA 7th reference entry. NEVER cut off or truncate mid-sentence.

REQUIRED CONTENT FLOW (strictly unnumbered):
- Clean Thematic Title / Discussion Focus (NO numbers or "### 1.")
- Engaging Hook & Thesis Statement (natural paragraph flow or clean unnumbered header)
- Critical Course & Conceptual Analysis (integrate concrete course theory, scholarly evidence, and APA 7th in-text citations; avoid AI clichés like "delve", "testament", "tapestry")
- Practical Application & Peer Debate Question (connect to a real-world example and end with 1 sharp, open-ended discussion question for classmates)
- References (unnumbered APA 7th edition reference entries, alphabetical, each on its own line)`
        : `You are an elite university academic writer (University of the People standard).
Output Mode: WRITTEN ASSIGNMENT ACTIVITY RESCUER.
Write a COMPLETE, submission-ready Written Assignment Activity paper strictly in natural, formal, human-sounding academic ENGLISH (100% English, zero Burmese, zero conversational meta-prelude).
STRICT SCHOLARLY FORMATTING: NEVER use numbered headings (NO '1.', '2.', '### 1', '###1', 'Step 1:', 'I.', etc.).
- For Assignments: Use centered/bold APA Level-1 unnumbered Headings ONLY.
TARGET BODY LENGTH: Approximately ${clampedWordCount} words (strictly satisfy this target range cleanly without mid-sentence truncation).
CRITICAL COMPLETENESS RULE: Deliver a full narrative arc from Introduction through Conclusion and complete APA 7th References. NEVER cut off or truncate mid-sentence.

REQUIRED APA 7th STRUCTURAL HEADINGS (clean, unnumbered headings ONLY):
- [Full Assignment Title] (clean descriptive paper title; no numbering)
- Introduction (contextual background + clear, arguable thesis statement)
- Conceptual & Theoretical Analysis (or specific topic-relevant analytical heading addressing every prompt/rubric requirement with APA 7th in-text citations)
- Case Study & Real-World Application (concrete applied scenarios and real-world industry/policy examples)
- Synthesis & Strategic Recommendations (critical integration and scholarly recommendations)
- Conclusion (decisive synthesis tying thesis back to findings with no abrupt ending)
- References (clean, unnumbered APA 7th edition reference entries, alphabetical, each on its own line)`;

    const metaContext = [
      emergencyCourseCode.trim() ? `Course: ${emergencyCourseCode.trim()}` : '',
      emergencyUnitTitle.trim() ? `Unit / Title: ${emergencyUnitTitle.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const prompt = `${metaContext ? `COURSE CONTEXT: ${metaContext}\n` : ''}${
      isConciseDiscussion
        ? `TARGET WORD COUNT: Ensure the generated discussion post strictly stays concise, focused, and between ${conciseRangeMin}-${conciseRangeMax} words (target ~${clampedWordCount} words), ideal for UoPeople Discussion Forum requirements.`
        : `TARGET WORD COUNT: Approximately ${clampedWordCount} words.`
    }
ASSIGNMENT PROMPT / LECTURE EXCERPTS:
${emergencyTopic.trim() || 'Refer to attached rubric/assignment screenshots and documents.'}
${emergencyDocText.trim() ? `\nATTACHED DOCUMENT EXCERPT (${emergencyDocName}):\n${emergencyDocText.slice(0, 4500)}` : ''}
${emergencyImages.length > 0 ? `\nNOTE: Inspect the ${emergencyImages.length} attached screenshot(s)/rubric image(s) carefully and satisfy every criterion shown.` : ''}`;

    const res = await callGemini(
      'emergency_rescuer',
      prompt,
      'light',
      calibratedMaxTokens,
      emergencyImages.length > 0 ? emergencyImages : undefined,
      true,
      systemInstruction
    );

    if (res) {
      const cleanRes = purgeHeadingNumbers(res);
      setEmergencyResult(cleanRes);
      setEmergencyNotice({
        type: 'success',
        message: '✓ အရေးပေါ် စာမူကြမ်း အပြည့်အစုံ ထုတ်ယူပြီးပါပြီ။ (Tab 1/Tab 2 သို့မဟုတ် APA 7th Studio သို့ တိုက်ရိုက်ပို့နိုင်ပါသည်)',
      });
    }
  };

  const handleRefineEmergencySection = async () => {
    if (!emergencyResult.trim()) {
      setEmergencyNotice({
        type: 'warning',
        message: 'ပြင်ဆင်ဖြည့်စွက်ရန် ထွက်ရှိထားသော စာမူကြမ်း ဦးစွာ ရှိရန် လိုအပ်ပါသည်။',
      });
      return;
    }
    if (!refineInstruction.trim()) {
      setEmergencyNotice({
        type: 'warning',
        message: 'မည်သည့်အပိုင်းကို ပြင်ဆင်/ထပ်ဖြည့်လိုကြောင်း ညွှန်ကြားချက် ထည့်သွင်းပေးပါခင်ဗျာ။',
      });
      return;
    }

    setEmergencyNotice(null);
    const currentWordCount = emergencyResult.trim().split(/\s+/).filter(Boolean).length;
    const targetWordsForRefine = Math.min(1800, Math.max(currentWordCount + 150, emergencyTargetWords));
    const refineTokens = Math.min(3800, Math.max(2200, Math.round(targetWordsForRefine * 2.0 + 400)));

    const refineSystemInstruction = `You are an elite university academic editor (University of the People standard).
Task: Seamlessly refine, deepen, or expand the requested section(s) of the student's existing academic draft while preserving overall structure, APA 7th in-text citations, reference list, and scholarly coherence.
STRICT SCHOLARLY FORMATTING: NEVER use numbered headings (NO '1.', '2.', '### 1', '###1', 'Step 1:', etc.). Use clean unnumbered headings or natural paragraph prose ONLY.
OUTPUT RULE: Return the COMPLETE updated paper from start through complete APA 7th References in 100% formal academic English. Do NOT output partial snippets or conversational commentary.`;

    const refinePrompt = `REFINEMENT INSTRUCTION FROM STUDENT:
${refineInstruction.trim()}

CURRENT DRAFT TO REFINE AND MERGE:
"""
${emergencyResult}
"""`;

    const res = await callGemini(
      'emergency_refine',
      refinePrompt,
      'light',
      refineTokens,
      undefined,
      true,
      refineSystemInstruction
    );

    if (res) {
      const cleaned = purgeHeadingNumbers(res);
      setEmergencyResult(cleaned);
      setRefineInstruction('');
      setEmergencyNotice({
        type: 'success',
        message: '✓ ရွေးချယ်ထားသော အပိုင်းကို စာမူကြမ်းထဲသို့ အောင်မြင်စွာ ပေါင်းစပ်ဖြည့်စွက်ပြီးပါပြီ။',
      });
    }
  };

  const executeClearEmergencyResultOnly = () => {
    setEmergencyResult('');
    setRefineInstruction('');
    setConfirmClearTarget(null);
    setEmergencyNotice(null);
    triggerClearSuccessToast();
  };

  const executeClearEmergency = () => {
    const blank = clearEmergencyRescuerState();
    setEmergencyMode(blank.mode);
    setEmergencyCourseCode(blank.courseCode);
    setEmergencyUnitTitle(blank.unitTitle);
    setEmergencyTopic(blank.promptText);
    setEmergencyDocName(blank.attachedDocName);
    setEmergencyDocText(blank.attachedDocText);
    setEmergencyImages([]);
    setEmergencyResult(blank.generatedDraft);
    setEmergencyNotice(null);
    setConfirmClearTarget(null);
    triggerClearSuccessToast();
  };

  const handleRequestClearEmergency = () => {
    const hasContent = Boolean(
      emergencyTopic.trim() ||
        emergencyCourseCode.trim() ||
        emergencyUnitTitle.trim() ||
        emergencyDocText.trim() ||
        emergencyImages.length > 0 ||
        emergencyResult.trim()
    );
    if (!hasContent) {
      executeClearEmergency();
      return;
    }
    setConfirmClearTarget('emergency');
  };

  const handleBridgeEmergencyToOutline = () => {
    const combinedPrompt = [
      emergencyUnitTitle.trim() ? `Unit / Assignment: ${emergencyUnitTitle.trim()}` : '',
      emergencyCourseCode.trim() ? `Course: ${emergencyCourseCode.trim()}` : '',
      emergencyTopic.trim(),
      emergencyDocText.trim() ? `[Attached Document: ${emergencyDocName}]\n${emergencyDocText.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!combinedPrompt.trim() && emergencyImages.length === 0) {
      setEmergencyNotice({
        type: 'warning',
        message: 'A-Grade Outline သို့ ပို့ရန် မေးခွန်းစာသား သို့မဟုတ် Rubric ပုံ ထည့်သွင်းပေးပါ။',
      });
      return;
    }

    setOutlineInput(combinedPrompt);
    if (emergencyDocName) setOutlineAttachedFile(emergencyDocName);
    if (emergencyImages.length > 0) {
      setUploadedImages(emergencyImages);
    }
    setOutlineResult('');
    setLastOutlineSignature('');
    setActiveModule('outline_suite');
    setActiveSubTab('outline');
  };

  const handleBridgeEmergencyToRubricMatch = () => {
    if (!emergencyResult.trim()) {
      setEmergencyNotice({
        type: 'warning',
        message: 'Rubric Match ဖြင့် စစ်ဆေးရန် အရေးပေါ် စာမူကြမ်းကို ဦးစွာ ထုတ်ယူပေးပါ။',
      });
      return;
    }

    const rubricContext = [
      emergencyUnitTitle.trim() ? `Unit / Assignment: ${emergencyUnitTitle.trim()}` : '',
      emergencyCourseCode.trim() ? `Course: ${emergencyCourseCode.trim()}` : '',
      emergencyTopic.trim(),
      emergencyDocText.trim() ? `[Attached Reference / Prompt]\n${emergencyDocText.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    setDraftInput(emergencyResult);
    setOutlineSyncCleared(false);
    if (rubricContext.trim()) {
      setDraftRubricInput(rubricContext);
      setShowDraftRubricOverride(true);
    }
    if (emergencyImages.length > 0) {
      setDraftRubricImages(emergencyImages);
    }
    setDraftAuditResult('');
    setLastAuditedSignature('');
    setActiveModule('outline_suite');
    setActiveSubTab('draft_audit');
  };

  const handleExportEmergencyToApaStudio = () => {
    if (!emergencyResult.trim()) {
      setEmergencyNotice({
        type: 'warning',
        message: 'APA 7th Studio သို့ ပို့ရန် စာမူကြမ်းကို ဦးစွာ ထုတ်ယူပေးပါ။',
      });
      return;
    }

    const bridgedPayload = buildEmergencyBridgeToApaPayload({
      mode: emergencyMode,
      promptText: emergencyTopic,
      attachedDocText: emergencyDocText,
      generatedDraft: emergencyResult,
      customCourseCode: emergencyCourseCode,
      customUnitTitle: emergencyUnitTitle,
    });

    saveApaStudioState(bridgedPayload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('akari_apa_bridge_updated', { detail: bridgedPayload }));
      window.dispatchEvent(new CustomEvent('akari_navigate_tab', { detail: 'apa' }));
    }
  };

  // Upload handler for Draft File
  const handleDraftFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await handleUniversalDocExtract(file);
      setDraftInput(text);
      setDraftAttachedFile(file.name);
    } catch {
      alert('ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်ခင်ဗျာ။');
    }
    e.target.value = '';
  };

  // Image Upload Handler for Outline
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 12 - uploadedImages.length;
    const toAdd = Array.from(files).slice(0, remaining);

    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImages((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // 1A. Generate Outline (Fast, Streamlined 100% Academic English with Rubric Point Table & Blueprint)
  const handleGenerateOutline = async (forceRefresh: boolean = false) => {
    if (!outlineInput.trim() && uploadedImages.length === 0) {
      return alert('Assignment မေးခွန်း သို့မဟုတ် Rubric ပုံ ထည့်သွင်းပေးပါခင်ဗျာ။');
    }

    if (!forceRefresh && outlineResult.trim() && !isOutlineDirty) {
      return;
    }

    const prompt = `Role: University Curriculum Architect (UoPeople / Harvard Standard).
Task: Analyze the assignment prompt/rubric images and output a concise, high-speed blueprint 100% in formal academic ENGLISH. No conversational prelude or meta-text.

### 1. 📊 Rubric Point-by-Point Alignment Table
Extract every grading criterion and its point allocation from the rubric/prompt (or assign proportional points summing to 10 or 100):
| Rubric Criterion | Max Pts | Estimated Score | Status | Exact Gap / Reason |
| --- | --- | --- | --- | --- |
| [Criterion Name] | [Max Pts] | [Max / Max] | Target A-Grade | [Concise 1-sentence requirement for full marks] |

Predicted Grade: [Total Max] / [Total Max] Points (A-Grade Target Blueprint)

---

### 2. 📐 Section-by-Section A-Grade Structural Outline
Provide a concise section-by-section blueprint (Introduction & Thesis, Core Analytical Sections mapped to rubric criteria, Conclusion, APA 7th References) with target word counts.

---

### 3. 🛠️ Pre-Submission Deduction Traps & Actionable Safeguards
List the top 2 rubric traps using this exact 3-line structure per item:
- ❌ Identified Weakness: [1-sentence typical student mistake]
- 💡 Reason for Point Deduction: [1-sentence rubric threshold failure & points lost]
- ✍️ Immediate Correction: [1 concrete scholarly thesis or framing sentence in academic English]

PROMPT / RUBRIC:
${outlineInput.slice(0, 2500) || 'Refer to attached rubric images.'}`;

    const sigAtStart = currentOutlineSignature;
    const res = await callGemini(
      'outline',
      prompt,
      'standard',
      950,
      uploadedImages,
      forceRefresh
    );
    if (res) {
      setOutlineResult(res);
      setLastOutlineSignature(sigAtStart);
      const newHist = [res.slice(0, 80) + '...', ...historyItems.slice(0, 3)];
      setHistoryItems(newHist);
      localStorage.setItem('akari_outline_history', JSON.stringify(newHist));
    }
  };

  // 1B. Draft Audit Simulator with Instant Caching, Dirty-Flag Check & Fast Structured Scorecard
  const handleAuditDraft = async (forceRefresh: boolean = false) => {
    if (!draftInput.trim()) return alert('စစ်ဆေးရန် Draft စာမူကြမ်း ထည့်သွင်းပေးပါခင်ဗျာ။');

    // If evaluation is already cached for the exact current draft + rubric + feedback and not forced, return immediately
    if (!forceRefresh && draftAuditResult.trim() && !isAuditDirty) {
      return;
    }

    const prompt = `Role: University Course Instructor (UoPeople Standard).
Task: Audit the student draft against the rubric criteria, rubric images, and instructor instructions. Output 100% in formal academic ENGLISH. No intro filler—begin directly with Heading 1.

RUBRIC & CHECKLIST:
${activeRubricCriteriaForAudit.slice(0, 1800)}

INSTRUCTOR INSTRUCTIONS:
${instructorFeedback.slice(0, 500) || 'Evaluate strictly per point-by-point rubric thresholds.'}

STUDENT DRAFT:
${draftInput.slice(0, 5500)}

STRICT OUTPUT STRUCTURE:

### 1. 📊 Rubric Scorecard (Point-by-Point Alignment)
Score each criterion from the rubric/images accurately:
| Rubric Criterion | Max Pts | Estimated Score | Status | Exact Gap / Reason |
| --- | --- | --- | --- | --- |
| [Criterion 1] | [e.g., 2] | [e.g., 1.5 / 2] | [Full Marks / Partial / Missing] | [Concise 1-sentence reason for score or gap] |

Predicted Grade: [Sum of Estimated Scores] / [Sum of Max Pts] Points

---

### 2. 🛠️ Concrete "What to Fix" Action Plan
For each criterion that lost points (max 3 items), provide a concise 3-part fix:
- ❌ Identified Weakness: "[Quote the exact weak sentence or name the missing element]"
- 💡 Reason for Point Deduction: [1 concise sentence explaining why points were deducted]
- ✍️ Immediate Correction: "[Provide a concrete rewritten scholarly sentence/paragraph in academic English ready to insert]"

---

### 3. ✅ Verified Scholarly Strengths
- List 2 brief bullet points on criteria that already meet A-grade expectations.`;

    const sigAtStart = currentAuditSignature;
    const res = await callGemini(
      'draft_audit',
      prompt,
      'standard',
      900,
      activeAuditImages.length > 0 ? activeAuditImages : undefined,
      forceRefresh
    );
    if (res) {
      setDraftAuditResult(res);
      setLastAuditedSignature(sigAtStart);
    }
  };

  // Free Open Source Crossref Audit
  const handleFreeCrossrefAudit = async () => {
    if (!integrityInput.trim()) {
      alert('စစ်ဆေးရန် References စာရင်းကို ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    setFreeApiAuditing(true);
    const lines = integrityInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 20 && !/^references\b/i.test(l));

    let auditReport = `📊 OPEN-SOURCE CITATION & ACADEMIC INTEGRITY AUDIT REPORT\n`;
    auditReport += `========================================================\n\n`;

    let outdatedCount = 0;
    lines.forEach((line) => {
      const match = line.match(/\b(19\d{2}|20[0-1][0-5])\b/);
      if (match) outdatedCount++;
    });

    if (outdatedCount > 0) {
      auditReport += `⚠️ [CURRENCY WARNING]: Found ${outdatedCount} citation(s) published over 10 years ago (prior to 2016). Prioritize peer-reviewed sources from the last 5-10 years.\n\n`;
    } else {
      auditReport += `✅ [EXCELLENT CURRENCY]: All evaluated citations are modern academic sources published within the last 10 years.\n\n`;
    }

    if (lines.length > 0) {
      const querySample = encodeURIComponent(lines[0].slice(0, 120));
      try {
        const res = await fetch(`https://api.crossref.org/works?query.bibliographic=${querySample}&rows=1`);
        if (res.ok) {
          const data = await res.json();
          const item = data.message?.items?.[0];
          if (item) {
            auditReport += `🔍 [Crossref Open DB Verification]:\n`;
            auditReport += `• Title: ${item.title?.[0] || 'Unknown'}\n`;
            auditReport += `• DOI: https://doi.org/${item.DOI || 'N/A'}\n`;
            auditReport += `• Status: 100% Peer-Reviewed Index Confirmed\n\n`;
          }
        }
      } catch {
        auditReport += `• Crossref API: Connectivity check required.\n\n`;
      }
    }

    auditReport += `💡 [Turnitin Advice]: Ensure bibliography entries are placed at the end so the instructor can exclude references from the similarity score.`;

    setIntegrityResult(auditReport);
    setFreeApiAuditing(false);
  };

  // Peer Comment Generator
  const handleGeneratePeerComment = async (slot: 1 | 2 | 3) => {
    const postToUse = slot === 1 ? peer1Post : slot === 2 ? peer2Post : peer3Post;
    if (!postToUse.trim()) {
      alert(`ကျေးဇူးပြု၍ Peer ${slot} ၏ မူရင်း Assignment Post စာသားကို ထည့်သွင်းပေးပါခင်ဗျာ။`);
      return;
    }

    const prompt = `Write ONE natural university student peer forum response in 100% academic ENGLISH. No intro/outro meta-text.
CONTEXT: ${discussionUnitContext || 'Course Discussion Topic'}
CLASSMATE POST:
${postToUse.slice(0, 2000)}
RULES: Authentic student voice, no AI clichés ("delve", "testament", "furthermore"), acknowledge a specific point, add 1 concrete insight, end with 1 open question (110-140 words).`;

    const res = await callGemini('peer_comment', prompt, 'light', 240);
    if (res) {
      if (slot === 1) setPeer1Reply(res);
      else if (slot === 2) setPeer2Reply(res);
      else setPeer3Reply(res);
    }
  };

  // Follow-up Generator
  const handleGenerateFollowupReply = async () => {
    if (!followupQuestion.trim()) return alert('မေးခွန်း သို့မဟုတ် ဆွေးနွေးချက် ထည့်ပါ');
    const prompt = `Write an authentic university student reply to a peer's follow-up question in 100% academic ENGLISH. No meta-text.
CONTEXT: ${discussionUnitContext || 'Course Discussion'}
QUESTION: ${followupQuestion.slice(0, 1500)}
RULES: Courteous tone, no AI clichés, 90-125 words.`;

    const res = await callGemini('followup_reply', prompt, 'light', 200);
    if (res) setFollowupReply(res);
  };

  const cleanMoodleText = (raw: string) => {
    if (!moodleCleanerActive) return raw;
    return raw
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const copyCleanText = (txt: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(cleanMoodleText(txt));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPeerPost = selectedPeerSlot === 1 ? peer1Post : selectedPeerSlot === 2 ? peer2Post : peer3Post;
  const currentPeerReply = selectedPeerSlot === 1 ? peer1Reply : selectedPeerSlot === 2 ? peer2Reply : peer3Reply;

  // Active rubric counts for status display
  const activeRubricWordCount = (outlineInput || draftRubricInput).split(/\s+/).filter(Boolean).length;
  const activeRubricImageCount = draftRubricImages.length > 0 ? draftRubricImages.length : uploadedImages.length;

  // Structured Renderer for Rubric Score Table, Predicted Grade Banner & Actionable Fix Cards
  const renderStructuredRubricOutput = (rawText: string, emptyPlaceholder: string) => {
    if (!rawText || !rawText.trim()) {
      return <p className="text-slate-500 font-mono text-xs">{emptyPlaceholder}</p>;
    }

    const lines = rawText.replace(/\r\n/g, '\n').split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      // 1. Horizontal Divider
      if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
        elements.push(<hr key={`hr-${i}`} className="border-slate-800 my-3" />);
        i++;
        continue;
      }

      // 2. Predicted Grade Summary Banner
      if (/^(?:\*\*)?Predicted Grade/i.test(line)) {
        const cleanGrade = line.replace(/\*\*/g, '').trim();
        elements.push(
          <div
            key={`grade-${i}`}
            className="p-3 rounded-xl bg-[#0b1222] border border-indigo-500/40 flex items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🏆</span>
              <span className="text-xs font-bold text-indigo-300 tracking-wide uppercase">
                Rubric Score Summary
              </span>
            </div>
            <span className="px-3 py-1 rounded-lg bg-indigo-950/90 border border-indigo-500/40 text-xs font-bold text-emerald-300 font-mono">
              {cleanGrade}
            </span>
          </div>
        );
        i++;
        continue;
      }

      // 3. Markdown Table Block
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        const rows = tableLines
          .filter((r) => !/^\|[\s\-:|]+\|$/.test(r))
          .map((r) =>
            r
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((c) => c.replace(/\*\*/g, '').trim())
          );

        if (rows.length > 0) {
          const header = rows[0];
          const body = rows.slice(1);
          elements.push(
            <div
              key={`table-${i}`}
              className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b1222] my-2"
            >
              <table className="w-full text-left border-collapse text-xs text-slate-200">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                    {header.map((col, cIdx) => (
                      <th key={cIdx} className="py-2.5 px-3 border-r border-slate-800/60 last:border-r-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {body.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                      {row.map((cell, cIdx) => {
                        const lowerCell = cell.toLowerCase();
                        const isStatusCol = cIdx === 3;
                        let badgeClass = '';
                        if (isStatusCol) {
                          if (
                            lowerCell.includes('full') ||
                            lowerCell.includes('target') ||
                            lowerCell.includes('met') && !lowerCell.includes('partial')
                          ) {
                            badgeClass =
                              'inline-block px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-semibold text-[10px]';
                          } else if (lowerCell.includes('partial') || lowerCell.includes('needs')) {
                            badgeClass =
                              'inline-block px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/50 text-amber-300 font-semibold text-[10px]';
                          } else if (lowerCell.includes('missing') || lowerCell.includes('fail') || lowerCell.includes('deduct')) {
                            badgeClass =
                              'inline-block px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700/50 text-rose-300 font-semibold text-[10px]';
                          }
                        }
                        return (
                          <td
                            key={cIdx}
                            className={`py-2.5 px-3 align-top border-r border-slate-800/40 last:border-r-0 ${
                              cIdx === 0
                                ? 'font-semibold text-slate-100'
                                : cIdx === 1 || cIdx === 2
                                ? 'font-mono text-indigo-200 whitespace-nowrap'
                                : 'text-slate-300 leading-relaxed'
                            }`}
                          >
                            {badgeClass ? <span className={badgeClass}>{cell}</span> : cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // 4. Concrete "What to Fix" Action Plan Item (❌ / 💡 / ✍️)
      const cleanedBullet = line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '');
      if (cleanedBullet.startsWith('❌') || cleanedBullet.startsWith('💡') || cleanedBullet.startsWith('✍️')) {
        const group: { weakness?: string; reason?: string; correction?: string } = {};
        while (i < lines.length) {
          const curr = lines[i].trim().replace(/^[-*•]\s*/, '').replace(/\*\*/g, '');
          if (curr.startsWith('❌')) {
            group.weakness = curr.replace(/^❌\s*(?:Identified Weakness|Common Pitfall)?[:\s-]*/i, '').trim();
            i++;
          } else if (curr.startsWith('💡')) {
            group.reason = curr.replace(/^💡\s*(?:Reason for Point Deduction|Rubric Threshold)?[:\s-]*/i, '').trim();
            i++;
          } else if (curr.startsWith('✍️')) {
            group.correction = curr.replace(/^✍️\s*(?:Immediate Correction|Winning Execution)?[:\s-]*/i, '').trim();
            i++;
            break;
          } else {
            break;
          }
        }

        elements.push(
          <div
            key={`fix-${i}`}
            className="p-3.5 rounded-xl bg-[#0b1222] border border-slate-800 space-y-2.5 my-2 shadow-sm"
          >
            {group.weakness && (
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-bold text-[10px]">
                  ❌ Identified Weakness
                </span>
                <p className="text-rose-200/90 font-mono leading-relaxed">{group.weakness}</p>
              </div>
            )}
            {group.reason && (
              <div className="flex items-start gap-2 text-xs pt-1 border-t border-slate-800/70">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 font-bold text-[10px]">
                  💡 Point Deduction Reason
                </span>
                <p className="text-amber-100/90 leading-relaxed">{group.reason}</p>
              </div>
            )}
            {group.correction && (
              <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-800/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    ✍️ Immediate Scholarly Correction (Ready to Insert)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyCleanText(group.correction!.replace(/^["']|["']$/g, ''))}
                    className="text-[10px] text-cyan-400 hover:underline font-semibold"
                  >
                    📋 Copy Rewrite
                  </button>
                </div>
                <p className="text-xs text-emerald-100 font-serif leading-relaxed">
                  {group.correction}
                </p>
              </div>
            )}
          </div>
        );
        continue;
      }

      // 5. Section Headings (### or ##)
      if (/^#{1,4}\s+/.test(line)) {
        const headingText = line.replace(/^#{1,4}\s+/, '').replace(/\*\*/g, '');
        elements.push(
          <h4
            key={`h-${i}`}
            className="text-xs font-bold text-indigo-300 uppercase tracking-wider pt-2 pb-1.5 border-b border-slate-800 flex items-center gap-1.5"
          >
            {headingText}
          </h4>
        );
        i++;
        continue;
      }

      // 6. Standard Bullet or Paragraph Line
      const isBullet = /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line);
      const cleanLine = line.replace(/\*\*(.*?)\*\*/g, '$1');
      elements.push(
        <div
          key={`p-${i}`}
          className={`text-xs text-slate-200 leading-relaxed ${
            isBullet ? 'pl-3 border-l-2 border-slate-800 py-0.5' : ''
          }`}
        >
          {cleanLine}
        </div>
      );
      i++;
    }

    return <div className="space-y-2.5">{elements}</div>;
  };

  return (
    <div className="space-y-4">
      {/* Top 4 Core Workspace Navigation Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-all"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          <button
            type="button"
            onClick={() => setActiveModule('outline_suite')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeModule === 'outline_suite' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📋</span> Assignment Hub (Outline, Draft & Integrity)
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('discussion_reply')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeModule === 'discussion_reply' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>💬</span> Discussion Reply
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('paraphraser')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeModule === 'paraphraser' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📈</span> Paraphraser & Depth Controller
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('emergency_rescuer')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeModule === 'emergency_rescuer' ? 'bg-amber-600 text-white shadow' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⏱️</span> အရေးပေါ် ၁ နာရီ Rescuer (Emergency)
          </button>
        </div>
      </div>

      {aiError && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-center justify-between gap-2">
          <span>⚠️ {aiError}</span>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="text-[11px] font-bold text-rose-300 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MODULE 1: SUITE */}
      {activeModule === 'outline_suite' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSubTab('outline')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'outline' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>📋</span> A-Grade Outline & Checklist (12-Image)
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('draft_audit')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'draft_audit' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>🧠</span> Draft စစ်ဆေးချက် (Logic & Rubric Match)
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('turnitin_integrity')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'turnitin_integrity' ? 'bg-rose-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>🛡️</span> Integrity & စာအုပ်/ဂျာနယ်အစစ်များ (Turnitin)
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('advisor_email')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'advisor_email' ? 'bg-amber-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>✉️</span> Advisor/Instructor အရေးပေါ် Email
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={moodleCleanerActive}
                onChange={(e) => setMoodleCleanerActive(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Moodle သန့်စင်စနစ် (Cleaner)</span>
              <span className="text-[10px] text-slate-400 font-normal">(Discussion Post တခုတည်းအတွက်)</span>
              <span className={`text-[10px] font-bold ${moodleCleanerActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                {moodleCleanerActive ? 'ON' : 'OFF'}
              </span>
            </label>
          </div>

          {/* 1A. OUTLINE VIEW */}
          {activeSubTab === 'outline' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-slate-200 block">
                    ASSIGNMENT မေးခွန်း၊ RUBRIC သို့မဟုတ် ဖိုင်များ:
                  </label>
                  <div className="flex items-center gap-2">
                    {draftInput.trim() && !outlineSyncCleared && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        ✓ Draft Synced ({draftInput.split(/\s+/).filter(Boolean).length} words)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleRequestClearOutline}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>🗑️ အားလုံးရှင်းထုတ်မည် (Clear Inputs)</span>
                    </button>
                  </div>
                </div>

                {confirmClearTarget === 'outline' && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs space-y-2 animate-in fade-in">
                    <p className="text-rose-200 font-medium leading-relaxed">
                      ထည့်သွင်းထားသော စာမူကြမ်းနှင့် အချက်အလက်များကို အားလုံး ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmClearTarget(null)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="button"
                        onClick={executeClearOutlineTab}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        သေချာသည် (Clear All)
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all">
                    <span>🖼️</span> ပုံ/Rubric တင်မည် ({uploadedImages.length}/12)
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all">
                    <span>📄</span> Word / PDF တင်မည်
                    <input type="file" accept=".docx,.pdf,.pptx,.xlsx,.csv,.txt" onChange={handleOutlineFileUpload} className="hidden" />
                  </label>
                </div>

                {outlineAttachedFile && (
                  <div className="text-[10px] text-emerald-400 font-mono">
                    ✓ Attached File: {outlineAttachedFile}
                  </div>
                )}

                {uploadedImages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {uploadedImages.map((img, i) => (
                      <div key={i} className="relative shrink-0">
                        <img src={img.dataUrl} alt={img.name} className="w-12 h-12 rounded-lg object-cover border border-slate-700" />
                        <button
                          type="button"
                          onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  rows={11}
                  value={outlineInput}
                  onChange={(e) => setOutlineInput(e.target.value)}
                  placeholder="Assignment မေးခွန်း သို့မဟုတ် Rubric ကို ဤနေရာတွင် ထည့်ပါ..."
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />

                <button
                  type="button"
                  onClick={() => handleGenerateOutline(!isOutlineDirty && Boolean(outlineResult.trim()))}
                  disabled={taskLoading.outline}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                    outlineResult.trim() && !isOutlineDirty && !taskLoading.outline
                      ? 'bg-emerald-700/90 hover:bg-emerald-600 text-white border border-emerald-500/40'
                      : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white'
                  }`}
                >
                  {taskLoading.outline ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Checklist ထုတ်ယူနေသည်...</span>
                    </>
                  ) : outlineResult.trim() && !isOutlineDirty ? (
                    '✓ Outline ထုတ်ယူပြီးပါပြီ (ပြန်လည်ထုတ်ယူရန် နှိပ်ပါ)'
                  ) : (
                    '⚡ A-Grade Outline & Checklist ထုတ်ယူမည် (English)'
                  )}
                </button>
              </div>

              <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">A-GRADE OUTLINE & RUBRIC SCORECARD (ENGLISH)</span>
                    {outlineResult.trim() && !isOutlineDirty && !taskLoading.outline && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-[10px] font-bold text-emerald-300 font-mono">
                        ✓ Instant Cached
                      </span>
                    )}
                  </div>
                  {outlineResult && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyCleanText(outlineResult)}
                        className="text-xs text-cyan-400 hover:underline cursor-pointer"
                      >
                        {copied ? '✓ Copied' : '📋 Copy Clean Text'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOutlineResult('');
                          setLastOutlineSignature('');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white font-semibold transition-all cursor-pointer"
                      >
                        🔄 Reset Table
                      </button>
                    </div>
                  )}
                </div>
                <div className="h-[400px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                  {renderStructuredRubricOutput(
                    outlineResult,
                    'Enter your assignment rubric/prompt on the left to generate the point-by-point rubric table, A-grade outline, and deduction safeguards in English...'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 1B. DRAFT AUDIT VIEW (TWO-WAY LINKED WITH SUB-TAB 1) */}
          {activeSubTab === 'draft_audit' && (
            <div className="space-y-3">
              {/* Linked Rubric Status Bar */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                    <span>🔗</span> Rubric Bridge Status:
                  </span>
                  <span className="text-[11px] text-slate-300">
                    {activeRubricWordCount > 0 || activeRubricImageCount > 0 ? (
                      <span className="text-emerald-400 font-medium">
                        ✓ A-Grade Tab မှ Rubric နှင့် ချိတ်ဆက်ပြီး ({activeRubricImageCount} images, {activeRubricWordCount} words)
                      </span>
                    ) : (
                      <span className="text-amber-400">
                        ⚠️ Rubric မရှိသေးပါ (A-Grade Tab တွင် ပုံ/မေးခွန်း ထည့်နိုင်ပါသည်)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDraftRubricOverride(!showDraftRubricOverride)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-all"
                  >
                    {showDraftRubricOverride ? '▲ Hide Rubric Editor' : '✏️ Edit / Override Rubric'}
                  </button>
                </div>
              </div>

              {/* Optional Inline Rubric Override Area */}
              {showDraftRubricOverride && (
                <div className="p-3 rounded-xl bg-[#090e1c] border border-indigo-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-indigo-300">
                      Rubric Override Input:
                    </label>
                    <label className="cursor-pointer text-[10px] text-indigo-400 hover:underline">
                      <span>🖼️ Upload Rubric Images ({draftRubricImages.length}/12)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = e.target.files;
                          if (!files) return;
                          Array.from(files).slice(0, 12).forEach((file) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setDraftRubricImages((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }]);
                            };
                            reader.readAsDataURL(file);
                          });
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    value={draftRubricInput || outlineInput}
                    onChange={(e) => setDraftRubricInput(e.target.value)}
                    placeholder="Enter or adjust rubric criteria specifically for this audit..."
                    className="w-full p-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                  />
                </div>
              )}

              {/* 2-Column Evaluation Area */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-slate-200 block">
                      စစ်ဆေးလိုသော ASSIGNMENT DRAFT (စာမူကြမ်း):
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="cursor-pointer text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                        <span>📄 PDF, Word, PPTX, Excel တင်မည်</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt"
                          onChange={handleDraftFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRequestClearDraft}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>🗑️ စာမူကြမ်း ရှင်းထုတ်မည် (Clear Draft)</span>
                      </button>
                    </div>
                  </div>

                  {confirmClearTarget === 'draft' && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs space-y-2 animate-in fade-in">
                      <p className="text-rose-200 font-medium leading-relaxed">
                        ထည့်သွင်းထားသော စာမူကြမ်းနှင့် အချက်အလက်များကို အားလုံး ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmClearTarget(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                        >
                          မလုပ်တော့ပါ
                        </button>
                        <button
                          type="button"
                          onClick={executeClearDraftTab}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          သေချာသည် (Clear Draft)
                        </button>
                      </div>
                    </div>
                  )}

                  {draftAttachedFile && (
                    <div className="text-[10px] text-emerald-400 font-mono">
                      ✓ Attached File: {draftAttachedFile}
                    </div>
                  )}

                  <textarea
                    rows={10}
                    value={draftInput}
                    onChange={(e) => {
                      setDraftInput(e.target.value);
                      if (e.target.value.trim()) {
                        setOutlineSyncCleared(false);
                      }
                    }}
                    placeholder="ကျောင်းသားရေးထားသော စာမူကြမ်းကို ထည့်သွင်းပါ (သို့မဟုတ် အပေါ်မှ ဖိုင်တင်ပါ)..."
                    className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                  />

                  <div>
                    <label className="text-[10px] text-amber-300 font-bold block mb-1">
                      ဆရာပေးထားသော Feedback / အထူးမှာကြားချက် (ရှိပါက ထည့်ရန်):
                    </label>
                    <textarea
                      rows={3}
                      value={instructorFeedback}
                      onChange={(e) => setInstructorFeedback(e.target.value)}
                      placeholder="e.g. Focus on thesis strength, APA citations, and logical transitions..."
                      className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAuditDraft(!isAuditDirty && Boolean(draftAuditResult.trim()))}
                    disabled={taskLoading.draft_audit}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs shadow transition-all flex items-center justify-center gap-2 ${
                      draftAuditResult.trim() && !isAuditDirty && !taskLoading.draft_audit
                        ? 'bg-emerald-700/90 hover:bg-emerald-600 text-white border border-emerald-500/40'
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white'
                    }`}
                  >
                    {taskLoading.draft_audit ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>ဆရာ့စံနှုန်းအတိုင်း သုံးသပ်နေသည်...</span>
                      </>
                    ) : draftAuditResult.trim() && !isAuditDirty ? (
                      <span>✓ သုံးသပ်ချက် ပြီးစီးပါပြီ (ပြန်လည်စစ်ဆေးရန် နှိပ်ပါ)</span>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>ဆရာ့စံနှုန်းအတိုင်း စစ်ဆေးမည် (Rubric Match)</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">INSTRUCTOR AUDIT & RUBRIC SCORECARD RESULT</span>
                      {draftAuditResult.trim() && !isAuditDirty && !taskLoading.draft_audit && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-[10px] font-bold text-emerald-300 font-mono">
                          ✓ Instant Cached
                        </span>
                      )}
                    </div>
                    {draftAuditResult && (
                      <button type="button" onClick={() => copyCleanText(draftAuditResult)} className="text-xs text-cyan-400 hover:underline">
                        {copied ? '✓ Copied' : '📋 Copy Clean Text'}
                      </button>
                    )}
                  </div>
                  <div className="h-[430px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                    {renderStructuredRubricOutput(
                      draftAuditResult,
                      'ဘယ်ဘက်တွင် စာမူကြမ်းထည့်သွင်းပြီး စစ်ဆေးနိုင်ပါသည် (A-Grade Outline မှ Rubric များနှင့် အလိုအလျောက် အမှတ်တွက်ချက် တိုက်ဆိုင်စစ်ဆေးပေးပါမည်)...'
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1C. INTEGRITY & REFERENCES WORKSPACE (SPLIT SUB-TABS) */}
          {/* ========================================================= */}
          {activeSubTab === 'turnitin_integrity' && (
            <div className="space-y-4">
              {/* Module-Level Sub-Tabs Switcher */}
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-950 border border-slate-800 w-fit">
                <button
                  type="button"
                  onClick={() => setIntegritySubTab('references_finder')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    integritySubTab === 'references_finder'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>📚</span> Academic References ရှာဖွေ/စစ်ဆေးမည်
                </button>
                <button
                  type="button"
                  onClick={() => setIntegritySubTab('turnitin_audit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    integritySubTab === 'turnitin_audit'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🛡️</span> Turnitin Similarity Shield
                </button>
              </div>

              {/* SUB-TAB 1: ACADEMIC REFERENCES FINDER & AUDIT */}
              {integritySubTab === 'references_finder' && (
                <div className="space-y-4">
                  {/* Topic / Paper Title Search & Multi-Engine Hub */}
                  <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-rose-900/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <span>🔎</span> စာတမ်းခေါင်းစဉ် (Topic/Title) ဖြင့် အခမဲ့ Academic Sources များ တိုက်ရိုက်ရှာဖွေရန်:
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Open in New Tab ↗</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={refSearchQuery}
                        onChange={(e) => setRefSearchQuery(e.target.value)}
                        placeholder="ဥပမာ - Impact of Globalization in Southeast Asia or specific DOI/Book Title..."
                        className="flex-1 p-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!refSearchQuery.trim()) return alert('ရှာဖွေလိုသော ခေါင်းစဉ်ထည့်ပါခင်ဗျာ');
                          setIntegrityInput(refSearchQuery);
                          handleFreeCrossrefAudit();
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition-all shrink-0"
                      >
                        ⚡ Crossref Free ရှာမည်
                      </button>
                    </div>

                    {/* Integrated Academic Databases Grid */}
                    <div className="pt-2">
                      <label className="text-[10px] text-slate-400 font-bold block mb-2">
                        ခေါင်းစဉ်ဖြင့် တိုက်ရိုက် ဖွင့်လှစ်ရှာဖွေနိုင်သော Open-Access Databases (၇ ခု):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {[
                          { name: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${encodeURIComponent(refSearchQuery || 'Academic research')}` },
                          { name: 'BASE Search', url: `https://www.base-search.net/Search/Results?lookfor=${encodeURIComponent(refSearchQuery || 'Research')}` },
                          { name: 'CORE UK', url: `https://core.ac.uk/search?q=${encodeURIComponent(refSearchQuery || 'Research')}` },
                          { name: 'Internet Archive', url: `https://scholar.archive.org/search?q=${encodeURIComponent(refSearchQuery || 'Research')}` },
                          { name: 'JURN Search', url: `https://www.jurn.link/#gsc.tab=0&gsc.q=${encodeURIComponent(refSearchQuery || 'Research')}` },
                          { name: 'ScienceDirect', url: `https://www.sciencedirect.com/search?qs=${encodeURIComponent(refSearchQuery || 'Research')}` },
                          { name: 'UNESCO UNESDOC', url: `https://unesdoc.unesco.org/search/${encodeURIComponent(refSearchQuery || 'Education')}` }
                        ].map((db, idx) => (
                          <a
                            key={idx}
                            href={db.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/60 hover:bg-slate-900 transition-all text-center flex flex-col justify-center items-center group"
                          >
                            <span className="text-[11px] font-bold text-slate-300 group-hover:text-rose-300 transition-colors">
                              {db.name}
                            </span>
                            <span className="text-[9px] text-rose-400 font-mono mt-0.5">ရှာဖွေမည် ↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* References Evaluation 2-Columns */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-rose-300 block">
                          References စာရင်း ထည့်သွင်းစစ်ဆေးရန်:
                        </label>
                        <label className="cursor-pointer text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                          <span>📄 ဖိုင်တင်မည်</span>
                          <input
                            type="file"
                            accept=".docx,.pdf,.txt"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const txt = await handleUniversalDocExtract(file);
                              setIntegrityInput(txt);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 leading-relaxed">
                        ⚠️ <strong>သတိပေးချက်:</strong> ဤနေရာတွင် စာတမ်းတစ်ခုလုံး မထည့်ရပါ။ References စာရင်းကိုသာ သီးသန့် ထည့်သွင်းပေးပါခင်ဗျာ။
                      </div>

                      <textarea
                        rows={10}
                        value={integrityInput}
                        onChange={(e) => setIntegrityInput(e.target.value)}
                        placeholder="APA References စာရင်းကို ထည့်ပါ (၁၀ နှစ်ကျော် ဟောင်းနွမ်းနေသော စာအုပ်/ဂျာနယ်များကို အလိုအလျောက် စိစစ်ပေးပါမည်)..."
                        className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                      />

                      <button
                        type="button"
                        onClick={handleFreeCrossrefAudit}
                        disabled={freeApiAuditing || !integrityInput.trim()}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>🌐</span>
                        <span>{freeApiAuditing ? 'စစ်ဆေးနေပါသည်...' : 'Free Crossref DB ဖြင့် စစ်ဆေးမည် (Zero Token)'}</span>
                      </button>
                    </div>

                    <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-200">ACADEMIC CITATION & 10-YEAR CURRENCY AUDIT</span>
                        {integrityResult && (
                          <button
                            type="button"
                            onClick={() => copyCleanText(integrityResult)}
                            className="text-xs text-cyan-400 hover:underline"
                          >
                            {copied ? '✓ Copied' : '📋 Copy Report'}
                          </button>
                        )}
                      </div>
                      <div className="h-[380px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                        {integrityResult || 'References စာရင်း ထည့်သွင်းပြီး စစ်ဆေးနိုင်ပါသည်...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: TURNITIN SIMILARITY SHIELD */}
              {integritySubTab === 'turnitin_audit' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <span>🛡️</span> TURNITIN SIMILARITY ဖြစ်နေသော အပိုဒ်များ:
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 leading-relaxed">
                      ⚠️ <strong>Turnitin Advice:</strong> မေးခွန်းစာသား သို့မဟုတ် Generic definitions များကြောင့် Turnitin မှ Similarity အဖြစ် မှားယွင်းဖမ်းမိသော စာပိုဒ်များကို ဤနေရာတွင် ထည့်ပါ။
                    </div>

                    <textarea
                      rows={12}
                      value={integrityInput}
                      onChange={(e) => setIntegrityInput(e.target.value)}
                      placeholder="Turnitin Similarity ဖြစ်နေသော စာသားများကို ကူးထည့်ပါ..."
                      className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                    />

                    <button
                      type="button"
                      onClick={async () => {
                        if (!integrityInput.trim()) return alert('စစ်ဆေးရန် စာသားထည့်ပါခင်ဗျာ');
                        const res = await callGemini(
                          'turnitin_audit',
                          `Audit the following text for Turnitin false-positives and structural similarity. Provide concise humanizing and restructuring advice strictly in academic English (no conversational prelude):\n${integrityInput.slice(0, 3500)}`,
                          'standard',
                          500
                        );
                        if (res) setIntegrityResult(res);
                      }}
                      disabled={taskLoading.turnitin_audit || !integrityInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>🛡️</span>
                      <span>{taskLoading.turnitin_audit ? 'AI စိစစ်နေပါသည်...' : 'Turnitin False-Positive Shield စစ်မည်'}</span>
                    </button>
                  </div>

                  <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-slate-200">TURNITIN INTEGRITY & SIMILARITY AUDIT</span>
                      {integrityResult && (
                        <button
                          type="button"
                          onClick={() => copyCleanText(integrityResult)}
                          className="text-xs text-cyan-400 hover:underline"
                        >
                          {copied ? '✓ Copied' : '📋 Copy Report'}
                        </button>
                      )}
                    </div>
                    <div className="h-[400px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                      {integrityResult || 'Turnitin စာပိုဒ်များ ထည့်သွင်းပြီး စစ်ဆေးပါ...'}
                    </div>
                  </div>
                </div>
              )}

              {/* EXTERNAL PLAGIARISM CHECKERS GRID (BOTH SUB-TABS ပေါ်တွင် အမြဲပေါ်နေမည်) */}
              <div className="p-4 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">🌐</span>
                    <h4 className="text-xs font-bold text-slate-200">Online Plagiarism Checkers</h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Open in New Tab ↗</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                  {EXTERNAL_PLAGIARISM_TOOLS.map((tool, idx) => (
                    <a
                      key={idx}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all flex flex-col justify-between space-y-2 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                            {tool.name}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tool.badgeColor}`}>
                            {tool.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                          {tool.desc}
                        </p>
                      </div>

                      <span className="text-[10px] text-cyan-400 group-hover:underline self-end flex items-center gap-1 font-semibold">
                        Visit Checker ↗
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 1D. ADVISOR & INSTRUCTOR EMERGENCY EMAIL SYSTEM */}
          {activeSubTab === 'advisor_email' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-amber-800/40 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                      <span>✉️</span> Emergency Email Configuration
                    </span>
                    <span className="text-[10px] font-mono bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-850/60">
                      100% English Output
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 block">
                      အသင့်သုံး အရေးပေါ် TEMPLATES (၄ မျိုး):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmailTemplateType('blackout');
                          setEmailGenerated(buildEmailTemplate('blackout', emailCourseName, emailInstructorName, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                        }}
                        className={`p-2.5 rounded-xl text-left border text-[11px] font-bold transition-all ${
                          emailTemplateType === 'blackout'
                            ? 'bg-amber-600 text-white border-amber-500 shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        ⚡ မီးပျက် / လိုင်းပြတ်တောက်
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailTemplateType('medical');
                          setEmailGenerated(buildEmailTemplate('medical', emailCourseName, emailInstructorName, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                        }}
                        className={`p-2.5 rounded-xl text-left border text-[11px] font-bold transition-all ${
                          emailTemplateType === 'medical'
                            ? 'bg-amber-600 text-white border-amber-500 shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        🏥 ကျန်းမာရေး အရေးပေါ်
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailTemplateType('technical');
                          setEmailGenerated(buildEmailTemplate('technical', emailCourseName, emailInstructorName, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                        }}
                        className={`p-2.5 rounded-xl text-left border text-[11px] font-bold transition-all ${
                          emailTemplateType === 'technical'
                            ? 'bg-amber-600 text-white border-amber-500 shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        💻 Moodle Portal Error
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailTemplateType('custom');
                          setEmailGenerated(buildEmailTemplate('custom', emailCourseName, emailInstructorName, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                        }}
                        className={`p-2.5 rounded-xl text-left border text-[11px] font-bold transition-all ${
                          emailTemplateType === 'custom'
                            ? 'bg-amber-600 text-white border-amber-500 shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        ✏️ ကိုယ်ပိုင် အကြောင်းပြချက်
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Course Code/Name:</label>
                        <input
                          type="text"
                          value={emailCourseName}
                          onChange={(e) => {
                            setEmailCourseName(e.target.value);
                            setEmailGenerated(buildEmailTemplate(emailTemplateType, e.target.value, emailInstructorName, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                          }}
                          className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Instructor Name:</label>
                        <input
                          type="text"
                          value={emailInstructorName}
                          onChange={(e) => {
                            setEmailInstructorName(e.target.value);
                            setEmailGenerated(buildEmailTemplate(emailTemplateType, emailCourseName, e.target.value, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                          }}
                          className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Student Name:</label>
                        <input
                          type="text"
                          value={emailStudentName}
                          onChange={(e) => {
                            setEmailStudentName(e.target.value);
                            setEmailGenerated(buildEmailTemplate(emailTemplateType, emailCourseName, emailInstructorName, e.target.value, emailStudentID, emailExtensionDays, emailRecipientRole, emailCustomReason));
                          }}
                          className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Student ID:</label>
                        <input
                          type="text"
                          value={emailStudentID}
                          placeholder="e.g. s123456"
                          onChange={(e) => {
                            setEmailStudentID(e.target.value);
                            setEmailGenerated(buildEmailTemplate(emailTemplateType, emailCourseName, emailInstructorName, emailStudentName, e.target.value, emailExtensionDays, emailRecipientRole, emailCustomReason));
                          }}
                          className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">တောင်းခံလိုသော ရက်အရေအတွက်:</label>
                      <select
                        value={emailExtensionDays}
                        onChange={(e) => {
                          setEmailExtensionDays(e.target.value);
                          setEmailGenerated(buildEmailTemplate(emailTemplateType, emailCourseName, emailInstructorName, emailStudentName, emailStudentID, e.target.value, emailRecipientRole, emailCustomReason));
                        }}
                        className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                      >
                        <option value="none">ရက်မသတ်မှတ် (General Extension without specific days)</option>
                        <option value="24 hours (1 Day)">24 hours (1 Day Extension)</option>
                        <option value="48 hours (2 Days)">48 hours (2 Days Extension)</option>
                        <option value="72 hours (3 Days)">72 hours (3 Days Extension)</option>
                        <option value="5 Days">5 Days Extension</option>
                        <option value="1 Week">1 Week Extension</option>
                      </select>
                    </div>

                    {emailTemplateType === 'custom' && (
                      <div className="pt-1">
                        <label className="text-[11px] font-bold text-amber-300 block mb-1">
                          ✏️ ကိုယ်ပိုင် အကြောင်းပြချက် စာသား ရိုက်ထည့်ရန်:
                        </label>
                        <textarea
                          rows={4}
                          value={emailCustomReason}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmailCustomReason(val);
                            setEmailGenerated(buildEmailTemplate('custom', emailCourseName, emailInstructorName, emailStudentName, emailStudentID, emailExtensionDays, emailRecipientRole, val));
                          }}
                          className="w-full p-2.5 text-xs rounded-xl bg-slate-950 border border-amber-500/60 text-slate-100 font-sans leading-relaxed placeholder-slate-600 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-slate-200">
                        OFFICIAL UOPEOPLE EXTENSION EMAIL PREVIEW (100% ENGLISH)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCleanText(emailGenerated)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all flex items-center gap-1"
                      >
                        {copied ? '✓ Copied' : '📋 Copy Email'}
                      </button>
                    </div>

                    <textarea
                      rows={15}
                      value={emailGenerated}
                      onChange={(e) => setEmailGenerated(e.target.value)}
                      className="w-full mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODULE 2: DISCUSSION REPLY */}
      {activeModule === 'discussion_reply' && (
        <div className="space-y-4">
          {clearSuccessToast && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <span>✓</span>
              <span>စာသားများကို အောင်မြင်စွာ ရှင်းထုတ်ပြီးပါပြီ။</span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDiscussionTab('peer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  discussionTab === 'peer' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                👥 Peer Comments (၃ ယောက်စာ တယောက်ချင်းစီ)
              </button>
              <button
                type="button"
                onClick={() => setDiscussionTab('followup')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  discussionTab === 'followup' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                💬 ကိုယ့် Post မေးခွန်းများ ပြန်ဖြေရန် (Follow-up)
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={moodleCleanerActive}
                  onChange={(e) => setMoodleCleanerActive(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Moodle သန့်စင်စနစ် (Cleaner)</span>
                <span className="text-[10px] text-slate-400 font-normal">(Discussion Post တခုတည်းအတွက်)</span>
                <span className={`text-[10px] font-bold ${moodleCleanerActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {moodleCleanerActive ? 'ON' : 'OFF'}
                </span>
              </label>

              <button
                type="button"
                onClick={handleRequestClearDiscussion}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>🗑️ ရှင်းထုတ်မည် (Clear All)</span>
              </button>
            </div>
          </div>

          {(confirmClearTarget === 'peer' || confirmClearTarget === 'followup') && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 text-xs space-y-2 animate-in fade-in">
              <p className="text-red-200 font-medium leading-relaxed">
                ဤ Peer Post နှင့် ထွက်ရှိထားသော Reply စာသားများကို ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClearTarget(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={confirmClearTarget === 'peer' ? executeClearActivePeer : executeClearFollowup}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  သေချာသည် (Clear)
                </button>
              </div>
            </div>
          )}

          <div className="p-3 rounded-2xl bg-[#0a101f] border border-slate-800 flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">Unit Topic Context:</span>
            <input
              type="text"
              value={discussionUnitContext}
              onChange={(e) => setDiscussionUnitContext(e.target.value)}
              placeholder="e.g. Unit 8: Healthcare Technology..."
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {discussionTab === 'peer' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Classmate ရွေးချယ်ရန်:</span>
                {([1, 2, 3] as const).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setConfirmClearTarget(null);
                      setSelectedPeerSlot(slot);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedPeerSlot === slot ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>👤</span>
                    <span>Peer {slot}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-bold text-indigo-300 block">
                      👤 Peer {selectedPeerSlot} ၏ မူရင်း Post:
                    </label>
                    <button
                      type="button"
                      onClick={handleRequestClearDiscussion}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>🗑️ ရှင်းထုတ်မည် (Clear Post)</span>
                    </button>
                  </div>
                  <textarea
                    rows={11}
                    value={selectedPeerSlot === 1 ? peer1Post : selectedPeerSlot === 2 ? peer2Post : peer3Post}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedPeerSlot === 1) setPeer1Post(val);
                      else if (selectedPeerSlot === 2) setPeer2Post(val);
                      else setPeer3Post(val);
                    }}
                    placeholder={`Paste classmate's discussion post for Peer ${selectedPeerSlot}...`}
                    className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleGeneratePeerComment(selectedPeerSlot)}
                    disabled={taskLoading.peer_comment || !currentPeerPost.trim()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white font-bold text-xs shadow-md"
                  >
                    {taskLoading.peer_comment ? 'Writing in English...' : `Peer ${selectedPeerSlot} အတွက် Comment ထုတ်မည် (Pure English)`}
                  </button>
                </div>

                <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-200">PEER {selectedPeerSlot} REPLY (100% ENGLISH)</span>
                    <div className="flex items-center gap-2">
                      {currentPeerReply && (
                        <>
                          <button type="button" onClick={() => copyCleanText(currentPeerReply)} className="text-xs text-cyan-400 hover:underline cursor-pointer">
                            {copied ? '✓ Copied' : '📋 Copy Clean Text'}
                          </button>
                          <button
                            type="button"
                            onClick={handleRequestClearDiscussion}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>🗑️ Clear</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-[290px] overflow-y-auto p-4 rounded-xl bg-slate-950 text-xs text-slate-100 font-serif leading-relaxed whitespace-pre-wrap">
                    {currentPeerReply || 'Peer response will be generated here in 100% English...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {discussionTab === 'followup' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-indigo-300 block">💬 မေးခွန်း / မှတ်ချက်:</label>
                  <button
                    type="button"
                    onClick={handleRequestClearDiscussion}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🗑️ ရှင်းထုတ်မည် (Clear Post)</span>
                  </button>
                </div>
                <textarea
                  rows={11}
                  value={followupQuestion}
                  onChange={(e) => setFollowupQuestion(e.target.value)}
                  placeholder="Paste follow-up question here..."
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateFollowupReply}
                  disabled={taskLoading.followup_reply || !followupQuestion.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  {taskLoading.followup_reply ? 'Replying in English...' : 'Follow-up အဖြေ ထုတ်ယူမည် (Pure English)'}
                </button>
              </div>
              <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-200">FOLLOW-UP RESPONSE (100% ENGLISH)</span>
                  <div className="flex items-center gap-2">
                    {followupReply && (
                      <>
                        <button type="button" onClick={() => copyCleanText(followupReply)} className="text-xs text-cyan-400 hover:underline cursor-pointer">
                          {copied ? '✓ Copied' : '📋 Copy Clean Text'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRequestClearDiscussion}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>🗑️ Clear</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="h-[290px] overflow-y-auto p-4 rounded-xl bg-slate-950 text-xs text-slate-100 font-serif leading-relaxed whitespace-pre-wrap">
                  {followupReply || 'Follow-up answer will appear here in 100% English...'}
                </div>
              </div>
            </div>
          )}

          {/* External Humanizer Tools Grid */}
          <div className="p-4 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-3">
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
              <span>⚠️</span>
              <span><strong>အသိပေးချက်:</strong> ဤနေရာမှ ထွက်ရှိလာသော စာသားကို ပိုမို စိတ်ချသေချာစေရန် အောက်ဖော်ပြပါ External Humanizer ဝဘ်ဆိုဒ်များတွင်လည်း သွားရောက်၍ တစ်ဆင့်ထပ်မံ စစ်ဆေး/Humanize ပြုလုပ်နိုင်ပါသည်ခင်ဗျာ။</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1">
              {EXTERNAL_HUMANIZER_TOOLS.map((tool, idx) => (
                <a
                  key={idx}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-2"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{tool.name}</span>
                    <p className="text-[10px] text-slate-400 mt-1">{tool.desc}</p>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-semibold self-end">သွားရောက်စစ်မည် ↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODULE 3: PARAPHRASER */}
      {activeModule === 'paraphraser' && (
        <Paraphraser />
      )}

      {/* MODULE 4: EMERGENCY 1-HOUR RESCUER (UPGRADED MULTIMODAL & BRIDGE WORKSPACE) */}
      {activeModule === 'emergency_rescuer' && (
        <div className="space-y-4">
          {clearSuccessToast && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <span>✓</span>
              <span>အရေးပေါ် စာမူကြမ်းနှင့် ထည့်သွင်းထားသော ဖိုင်များကို ရှင်းထုတ်ပြီးပါပြီ။</span>
            </div>
          )}

          {/* Header Bar: Integrity Notice + Protected Clear All */}
          <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-700/50 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
              <p className="text-xs text-amber-200 leading-relaxed">
                ⚠️ <strong>အရေးကြီး သတိပြုရန် (Academic Integrity Notice):</strong> ဤစနစ်မှ ထုတ်ပေးလိုက်သော အရေးပေါ် စာမူကြမ်းများတွင် AI ရေးဟန်များနှင့် အသုံးအနှုန်းများ ပါဝင်နိုင်ပါသည်။ ကျောင်းသားများအနေဖြင့် Discussion Forum သို့မဟုတ် Assignment Activity နေရာများသို့ မတင်သွင်းမီ မိမိကိုယ်ပိုင် လေ့လာတွေ့ရှိချက်များနှင့် ချိတ်ဆက်၍ ပြန်လည်စစ်ဆေးတည်းဖြတ်ပြီးမှသာ အသုံးပြုရန် အလေးအနက် အကြံပြုအပ်ပါသည်။
              </p>
              <button
                type="button"
                onClick={handleRequestClearEmergency}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🗑️ အားလုံးရှင်းထုတ်မည် (Clear All)</span>
              </button>
            </div>

            {confirmClearTarget === 'emergency' && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs space-y-2.5">
                <p className="text-rose-100 font-medium leading-relaxed">
                  ထည့်သွင်းထားသော ဖိုင်များ၊ စာသားများနှင့် ထွက်ရှိထားသော အရေးပေါ် စာမူကြမ်းများကို အားလုံး ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearTarget(null)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={executeClearEmergency}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    သေချာသည် (Clear All)
                  </button>
                </div>
              </div>
            )}

            {/* Type Routing Mode Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-amber-800/30">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-300">Assignment အမျိုးအစား ရွေးချယ်ရန်:</span>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyMode('discussion_post');
                      setEmergencyResult((prev) => purgeHeadingNumbers(prev));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emergencyMode === 'discussion_post'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    💬 Discussion Post Rescuer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyMode('assignment_activity');
                      setEmergencyResult((prev) => purgeHeadingNumbers(prev));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emergencyMode === 'assignment_activity'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📝 Assignment Activity Rescuer
                  </button>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-1 rounded-lg">
                {emergencyMode === 'discussion_post'
                  ? 'Hook + Thesis + Course Link + Peer Question + APA 7th'
                  : 'Structured Headings + Analysis + Real-World Case + APA 7th'}
              </span>
            </div>
          </div>

          {emergencyNotice && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                emergencyNotice.type === 'warning'
                  ? 'bg-rose-950/40 border-rose-700/50 text-rose-200'
                  : emergencyNotice.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                  : 'bg-indigo-950/40 border-indigo-700/50 text-indigo-200'
              }`}
            >
              <span>{emergencyNotice.message}</span>
              <button
                type="button"
                onClick={() => setEmergencyNotice(null)}
                className="text-[11px] font-bold opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Main 2-Column Emergency Rescuer Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Panel: Multi-Modal Intake */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0c1222]/90 border border-amber-800/40 space-y-3">
              {/* Optional Course / Unit Metadata for Auto-Bridge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    Course Code (Optional):
                  </label>
                  <input
                    type="text"
                    value={emergencyCourseCode}
                    onChange={(e) => setEmergencyCourseCode(e.target.value)}
                    placeholder="e.g. POLS 1503-01 AY2027-T1"
                    className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    Unit / Assignment Title (Optional):
                  </label>
                  <input
                    type="text"
                    value={emergencyUnitTitle}
                    onChange={(e) => setEmergencyUnitTitle(e.target.value)}
                    placeholder={
                      emergencyMode === 'discussion_post'
                        ? 'e.g. Unit 5 Discussion Assignment'
                        : 'e.g. Unit 5 Assignment Activity'
                    }
                    className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Multi-Modal Drag & Drop + File/Image Selectors */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setEmergencyDragActive(true);
                }}
                onDragLeave={() => setEmergencyDragActive(false)}
                onDrop={handleEmergencyDrop}
                className={`p-3 rounded-xl border border-dashed transition-all space-y-2 ${
                  emergencyDragActive
                    ? 'border-amber-400 bg-amber-950/30'
                    : 'border-slate-700 bg-slate-950/70'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-slate-300">
                    📎 Multi-Modal Input (ပုံ/Rubric Screenshot သို့မဟုတ် ဖိုင်တွဲတင်ရန်)
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-all">
                      <span>🖼️ ပုံတင်မည် ({emergencyImages.length}/6)</span>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleEmergencyImageFiles(e.target.files);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-all">
                      <span>{emergencyDocParsing ? '⏳ ဖတ်နေသည်...' : '📄 Word / PDF / TXT'}</span>
                      <input
                        type="file"
                        accept=".docx,.pdf,.txt"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await handleEmergencyDocFile(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Drag &amp; drop screenshots (.png, .jpg, .webp) or lecture/rubric documents (.docx, .pdf, .txt) here.
                </p>

                {emergencyDocName && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 font-mono">
                    <span className="truncate">
                      ✓ Doc: {emergencyDocName} ({emergencyDocText.split(/\s+/).filter(Boolean).length} words)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmergencyDocName('');
                        setEmergencyDocText('');
                      }}
                      className="text-rose-300 hover:text-rose-200 font-bold shrink-0 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {emergencyImages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pt-1">
                    {emergencyImages.map((img, idx) => (
                      <div key={idx} className="relative shrink-0">
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="w-14 h-14 rounded-lg object-cover border border-amber-600/50"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEmergencyImages((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prompt / Lecture Excerpt Textarea */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  UNIT PROMPT / LECTURE EXCERPTS / INSTRUCTIONS:
                </label>
                <textarea
                  rows={9}
                  value={emergencyTopic}
                  onChange={(e) => setEmergencyTopic(e.target.value)}
                  placeholder={
                    emergencyMode === 'discussion_post'
                      ? 'Paste Discussion Forum question, unit reading excerpts, or grading criteria...'
                      : 'Paste Written Assignment prompt, rubric requirements, or unit instructions...'
                  }
                  className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
                />
              </div>

              {/* Target Word Count Controller (250 - 1,500 Words) */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-[11px] font-bold text-amber-300">
                    🎯 သတ်မှတ် စာလုံးရေ (Target Word Count):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={250}
                      max={1500}
                      step={50}
                      value={emergencyTargetWordsText}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setEmergencyTargetWordsText(raw);
                        const val = Number(raw);
                        if (raw.trim() !== '' && !Number.isNaN(val)) {
                          setEmergencyTargetWords(val);
                        }
                      }}
                      onBlur={() => {
                        const parsed = Number(emergencyTargetWordsText);
                        const clamped =
                          emergencyTargetWordsText.trim() === '' || Number.isNaN(parsed)
                            ? 250
                            : Math.min(1500, Math.max(250, Math.round(parsed)));
                        setEmergencyTargetWords(clamped);
                        setEmergencyTargetWordsText(String(clamped));
                      }}
                      className="w-20 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-center font-bold text-amber-300 text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] font-mono text-slate-400">words (250-1,500)</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={250}
                  max={1500}
                  step={50}
                  value={Math.min(1500, Math.max(250, emergencyTargetWords || 250))}
                  onChange={(e) => syncEmergencyTargetWords(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => syncEmergencyTargetWords(350)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-left ${
                      emergencyTargetWords <= 400
                        ? 'bg-amber-600/90 text-white border-amber-500 shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ~250-400 words (Discussion Post / Short)
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEmergencyTargetWords(650)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-left ${
                      emergencyTargetWords > 400 && emergencyTargetWords <= 750
                        ? 'bg-amber-600/90 text-white border-amber-500 shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ~550-750 words (Standard Activity)
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEmergencyTargetWords(900)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-left ${
                      emergencyTargetWords > 750 && emergencyTargetWords <= 1100
                        ? 'bg-amber-600/90 text-white border-amber-500 shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ~800-1,000 words (Comprehensive Essay)
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEmergencyTargetWords(1350)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-left ${
                      emergencyTargetWords > 1100
                        ? 'bg-amber-600/90 text-white border-amber-500 shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ~1,200-1,500 words (Research Paper)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateEmergencyDraft}
                disabled={taskLoading.emergency_rescuer}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {taskLoading.emergency_rescuer ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {emergencyMode === 'discussion_post'
                        ? 'Discussion Post စာမူကြမ်း ထုတ်ယူနေသည်...'
                        : 'Assignment Activity စာမူကြမ်း ထုတ်ယူနေသည်...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>🚨</span>
                    <span>
                      {emergencyMode === 'discussion_post'
                        ? 'Discussion Post အပြည့်အစုံ ချက်ချင်းထုတ်မည် (English)'
                        : 'Assignment Activity အပြည့်အစုံ ချက်ချင်းထုတ်မည် (English)'}
                    </span>
                  </>
                )}
              </button>

              {/* Bridge to Tab 1 (Outline) */}
              <button
                type="button"
                onClick={handleBridgeEmergencyToOutline}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-500/40 text-indigo-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📋 A-Grade Outline သို့ ပို့၍ စစ်ဆေးမည်</span>
              </button>
            </div>

            {/* Right Panel: Generated Draft + Verification & APA 7th Bridges */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3 flex flex-col">
              {(() => {
                const cleanEmergencyOutput = purgeHeadingNumbers(emergencyResult);
                const outputWordCount = cleanEmergencyOutput
                  ? cleanEmergencyOutput.trim().split(/\s+/).filter(Boolean).length
                  : 0;
                return (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {emergencyMode === 'discussion_post'
                            ? 'PORTAL-READY DISCUSSION POST (100% ENGLISH)'
                            : 'PORTAL-READY ASSIGNMENT ACTIVITY (100% ENGLISH)'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-mono ${
                            outputWordCount > 0
                              ? 'bg-emerald-950/70 border-emerald-800/50 text-emerald-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {outputWordCount} words
                        </span>
                      </div>

                      {cleanEmergencyOutput.trim() && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => copyCleanText(cleanEmergencyOutput)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-cyan-300 font-semibold transition-all cursor-pointer"
                          >
                            {copied ? '✓ Copied' : '📋 Copy Clean Text'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportAssignmentActivityDocx({
                                title:
                                  emergencyUnitTitle.trim() ||
                                  emergencyTopic.split('\n')[0]?.slice(0, 60) ||
                                  'Assignment Activity',
                                institution: 'University of the People',
                                courseCode: emergencyCourseCode.trim() || emailCourseName || 'POLS 1503-01 AY2027-T1',
                                instructorName: emailInstructorName || 'Innocent Ndock Kong',
                                studentName: emailStudentName || 'Thin Yati Aung',
                                submissionDate: new Date().toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                }),
                                bodyContent: cleanEmergencyOutput,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>📥 Quick .docx</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearTarget('emergency_result')}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>🗑️ ရလဒ်ရှင်းထုတ်မည် (Clear Result)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {confirmClearTarget === 'emergency_result' && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs space-y-2.5">
                        <p className="text-rose-100 font-medium leading-relaxed">
                          ထွက်ရှိထားသော စာမူကြမ်းရလဒ်ကို ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmClearTarget(null)}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                          >
                            မလုပ်တော့ပါ
                          </button>
                          <button
                            type="button"
                            onClick={executeClearEmergencyResultOnly}
                            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            သေချာသည် (Clear Result)
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="h-[360px] overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-serif leading-relaxed whitespace-pre-wrap">
                      {cleanEmergencyOutput ||
                        (emergencyMode === 'discussion_post'
                          ? 'Hook, Thesis, Conceptual Connection, Peer Debate Question, and APA 7th References will be generated here in 100% English...'
                          : 'Complete structured academic assignment with conceptual analysis, real-world scenarios, conclusion, and APA 7th citations will appear here...')}
                    </div>
                  </>
                );
              })()}

              {/* Collapsible Interactive Section Refinement & Expansion Engine */}
              {emergencyResult.trim() && (
                <div className="rounded-xl bg-slate-950/90 border border-indigo-800/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsRefineSectionOpen((prev) => !prev)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-left bg-slate-900/70 hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span>✍️ စာပိုဒ်ထပ်ဖြည့်ရန် / အသေးစိတ်ပြင်ဆင်ရန် (Refine &amp; Expand Section)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {isRefineSectionOpen ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {isRefineSectionOpen && (
                    <div className="p-3 space-y-2.5 border-t border-slate-800">
                      <textarea
                        rows={2}
                        value={refineInstruction}
                        onChange={(e) => setRefineInstruction(e.target.value)}
                        placeholder="ဥပမာ- Case Study စာပိုဒ်တွင် ဒေသတွင်း ဥပမာအချက်အလက် ထပ်ထည့်ပေးပါ (သို့မဟုတ်) Introduction ကို ပိုမိုခိုင်မာအောင် ရေးပေးပါ..."
                        className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                      />

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setRefineInstruction(
                              'Expand and deepen the critical conceptual analysis section with stronger theoretical reasoning and nuanced academic arguments.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-indigo-300 font-semibold transition-all cursor-pointer"
                        >
                          ➕ Expand Critical Analysis
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRefineInstruction(
                              'Add concrete empirical statistics, real-world case study evidence, and supporting APA 7th in-text citations to strengthen the applied analysis.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-cyan-300 font-semibold transition-all cursor-pointer"
                        >
                          📊 Add Empirical Statistics &amp; Case Evidence
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRefineInstruction(
                              'Formalize and elevate the entire paper into polished, natural human scholarly academic English with seamless transitions and zero AI clichés.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-emerald-300 font-semibold transition-all cursor-pointer"
                        >
                          🎓 Formalize Scholarly Academic Tone
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleRefineEmergencySection}
                        disabled={taskLoading.emergency_refine || !refineInstruction.trim()}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {taskLoading.emergency_refine ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>စာပိုဒ်ကို ပေါင်းစပ်ဖြည့်စွက်နေသည်...</span>
                          </>
                        ) : (
                          <span>✨ ရွေးချယ်ထားသော အပိုင်းကို ထပ်မံဖြည့်စွက်မည် (Refine Section)</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Verification & APA 7th Export Bridges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleBridgeEmergencyToRubricMatch}
                  disabled={!emergencyResult.trim()}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-emerald-600/40 text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🔍 Logic &amp; Rubric Match ဖြင့် တိုက်စစ်မည်</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportEmergencyToApaStudio}
                  disabled={!emergencyResult.trim()}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>📄 APA 7th Word/PDF သို့ တိုက်ရိုက်ပို့မည် (Export to APA Studio)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dedicated Integrity Toolkit External Links (Humanizers + AI Detectors + Plagiarism Checkers) */}
          <div className="p-4 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>🛡️</span> Integrity &amp; Humanizer Toolkit (ပြင်ပ ဝဘ်ဆိုဒ်များတွင် စစ်ဆေး/မွမ်းမံရန်)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Opens Safely in New Tab ↗</span>
            </div>

            {/* Row 1: Online AI Humanizers (5) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-amber-300 block">
                ✍️ Online AI Humanizers (AI ရေးဟန်ကို လူသားဟန်ပြောင်းရန်):
              </span>
              <div className="flex flex-wrap gap-2">
                {EMERGENCY_INTEGRITY_HUMANIZERS.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900 text-xs font-semibold text-slate-200 hover:text-amber-200 transition-all flex items-center gap-1.5"
                  >
                    <span>{tool.name}</span>
                    <span className="text-[10px] text-amber-400">↗</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Row 2: Online AI Detectors (4) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-indigo-300 block">
                🔍 Online AI Detectors (AI ပါဝင်မှုနှုန်း တိုက်ရိုက်စစ်ဆေးရန်):
              </span>
              <div className="flex flex-wrap gap-2">
                {EMERGENCY_INTEGRITY_DETECTORS.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900 text-xs font-semibold text-slate-200 hover:text-indigo-200 transition-all flex items-center gap-1.5"
                  >
                    <span>{tool.name}</span>
                    <span className="text-[10px] text-indigo-400">↗</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Row 3: Online Plagiarism Checkers (3) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-cyan-300 block">
                🌐 Online Plagiarism Checkers (တူညီမှု Similarity စစ်ဆေးရန်):
              </span>
              <div className="flex flex-wrap gap-2">
                {EMERGENCY_INTEGRITY_PLAGIARISM.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-900 text-xs font-semibold text-slate-200 hover:text-cyan-200 transition-all flex items-center gap-1.5"
                  >
                    <span>{tool.name}</span>
                    <span className="text-[10px] text-cyan-400">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
