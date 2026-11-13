// Shared Persistence & Auto-Bridge Helpers for:
// 1. Emergency 1-Hour Rescuer (`emergency_rescuer_state`)
// 2. APA 7th Reference & Word Studio (`apa7_word_studio_state`)

export type EmergencyRescuerMode = 'discussion_post' | 'assignment_activity';

export interface EmergencyImageItem {
  name: string;
  dataUrl: string;
}

export interface EmergencyRescuerPersistedState {
  mode: EmergencyRescuerMode;
  courseCode: string;
  unitTitle: string;
  promptText: string;
  attachedDocName: string;
  attachedDocText: string;
  images: EmergencyImageItem[];
  generatedDraft: string;
}

export const EMERGENCY_RESCUER_SESSION_KEY = 'emergency_rescuer_state_v2';
export const APA_STUDIO_SESSION_KEY = 'apa7_word_studio_state_v2';

export const DEFAULT_EMERGENCY_RESCUER_STATE: EmergencyRescuerPersistedState = {
  mode: 'assignment_activity',
  courseCode: '',
  unitTitle: '',
  promptText: '',
  attachedDocName: '',
  attachedDocText: '',
  images: [],
  generatedDraft: '',
};

let memoryEmergencyState: EmergencyRescuerPersistedState | null = null;

export function loadEmergencyRescuerState(): EmergencyRescuerPersistedState {
  if (memoryEmergencyState) {
    return memoryEmergencyState;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(EMERGENCY_RESCUER_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EmergencyRescuerPersistedState>;
        const hydrated: EmergencyRescuerPersistedState = {
          ...DEFAULT_EMERGENCY_RESCUER_STATE,
          ...parsed,
          images: Array.isArray(parsed?.images) ? parsed.images : [],
        };
        memoryEmergencyState = hydrated;
        return hydrated;
      }
    } catch {
      // Ignore storage read/parse error
    }
  }
  const fallback = { ...DEFAULT_EMERGENCY_RESCUER_STATE, images: [] };
  memoryEmergencyState = fallback;
  return fallback;
}

export function saveEmergencyRescuerState(nextState: EmergencyRescuerPersistedState): void {
  memoryEmergencyState = nextState;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(EMERGENCY_RESCUER_SESSION_KEY, JSON.stringify(nextState));
  } catch {
    // Quota safeguard when large base64 screenshots are attached: persist text fields without heavy images
    try {
      const leanCopy: EmergencyRescuerPersistedState = {
        ...nextState,
        images: [],
      };
      window.sessionStorage.setItem(EMERGENCY_RESCUER_SESSION_KEY, JSON.stringify(leanCopy));
    } catch {
      // Memory fallback retains full images + text for active SPA session
    }
  }
}

export function clearEmergencyRescuerState(): EmergencyRescuerPersistedState {
  const emptyState: EmergencyRescuerPersistedState = {
    ...DEFAULT_EMERGENCY_RESCUER_STATE,
    images: [],
  };
  memoryEmergencyState = emptyState;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(EMERGENCY_RESCUER_SESSION_KEY);
    } catch {
      // Ignore storage removal errors
    }
  }
  return emptyState;
}

export interface ApaStudioPersistedState {
  templateType: 'assignment_activity' | 'discussion_assignment';
  customFileName: string;
  assignmentTitle: string;
  paperTopicTitle: string;
  institution: string;
  courseCode: string;
  instructorName: string;
  studentName: string;
  submissionDate: string;
  bodyContent: string;
  referencesContent: string;
  savedReferences: string[];
  activeSubTab: 'references_finder' | 'turnitin_audit';
  refSearchQuery: string;
  integrityInput: string;
  integrityResult: string;
}

export function formatCurrentSubmissionDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function createDefaultApaStudioState(): ApaStudioPersistedState {
  return {
    templateType: 'assignment_activity',
    customFileName: '',
    assignmentTitle: '',
    paperTopicTitle: '',
    institution: '',
    courseCode: '',
    instructorName: '',
    studentName: '',
    submissionDate: '',
    bodyContent: '',
    referencesContent: '',
    savedReferences: [],
    activeSubTab: 'references_finder',
    refSearchQuery: '',
    integrityInput: '',
    integrityResult: '',
  };
}

export function createBlankApaStudioState(): ApaStudioPersistedState {
  return {
    templateType: 'assignment_activity',
    customFileName: '',
    assignmentTitle: '',
    paperTopicTitle: '',
    institution: '',
    courseCode: '',
    instructorName: '',
    studentName: '',
    submissionDate: '',
    bodyContent: '',
    referencesContent: '',
    savedReferences: [],
    activeSubTab: 'references_finder',
    refSearchQuery: '',
    integrityInput: '',
    integrityResult: '',
  };
}

let memoryApaStudioState: ApaStudioPersistedState | null = null;

export function loadApaStudioState(): ApaStudioPersistedState {
  if (memoryApaStudioState) {
    return memoryApaStudioState;
  }
  const defaults = createBlankApaStudioState();
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(APA_STUDIO_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ApaStudioPersistedState>;
        const hydrated: ApaStudioPersistedState = {
          ...defaults,
          ...parsed,
          savedReferences: Array.isArray(parsed?.savedReferences) ? parsed.savedReferences : [],
        };
        memoryApaStudioState = hydrated;
        return hydrated;
      }
    } catch {
      // Ignore storage error
    }
  }
  memoryApaStudioState = defaults;
  return defaults;
}

export function saveApaStudioState(nextState: ApaStudioPersistedState): void {
  memoryApaStudioState = nextState;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(APA_STUDIO_SESSION_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage errors
  }
}

export function clearApaStudioSessionStorage(): void {
  memoryApaStudioState = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(APA_STUDIO_SESSION_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

export function toSnakeCaseFileName(
  title: string,
  fallback: string = 'Unit_5_Assignment_Activity'
): string {
  const cleaned = (title || '')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return fallback;
  return cleaned.slice(0, 64);
}

/**
 * Splits a generated academic draft into:
 * - bodyContent (Intro through Conclusion / Debate Question, ready for Word/PDF body)
 * - referencesContent (Clean APA 7th Reference entries, one block per reference)
 */
export function splitDraftAndApaReferences(rawDraft: string): {
  bodyContent: string;
  referencesContent: string;
  referenceEntries: string[];
} {
  const normalized = (rawDraft || '')
    .replace(/\r\n/g, '\n')
    .replace(/^```(?:markdown|text)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  if (!normalized) {
    return { bodyContent: '', referencesContent: '', referenceEntries: [] };
  }

  const lines = normalized.split('\n');
  let refHeadingIndex = -1;

  // Locate dedicated References section heading (handles Markdown #, numbered "5. References", bold "**References**")
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]
      .trim()
      .replace(/^#+\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/:$/, '')
      .trim();

    if (/^(?:references|reference list|apa 7th references|bibliography|works cited)$/i.test(trimmed)) {
      refHeadingIndex = i;
      break;
    }
  }

  let rawBodyLines: string[] = [];
  let rawRefLines: string[] = [];

  if (refHeadingIndex !== -1) {
    rawBodyLines = lines.slice(0, refHeadingIndex);
    rawRefLines = lines.slice(refHeadingIndex + 1);
  } else {
    // Fallback heuristic: detect trailing consecutive APA-7th styled citation lines
    const looksLikeApaEntry = (line: string) =>
      /^(?:[-•*]|\d+[.)])?\s*[A-Z][A-Za-z'’\-&,.\s]+\(\s*(?:19|20)\d{2}[a-z]?(?:,\s*[^)]+)?\s*\)\./.test(
        line.trim()
      ) ||
      (/^(?:[-•*]|\d+[.)])?\s*[A-Z]/.test(line.trim()) &&
        /\(\s*(?:19|20)\d{2}\s*\)/.test(line.trim()) &&
        /(https?:\/\/|doi\.org)/i.test(line.trim()));

    let tailStart = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (!l) continue;
      if (looksLikeApaEntry(l)) {
        tailStart = i;
      } else {
        break;
      }
    }

    if (tailStart < lines.length) {
      rawBodyLines = lines.slice(0, tailStart);
      rawRefLines = lines.slice(tailStart);
    } else {
      rawBodyLines = lines;
    }
  }

  // Clean leading/trailing blank lines & strip any stray "Word Count" summary inside body so ApaWordWorkspace computes it accurately
  const bodyContent = rawBodyLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Clean each reference entry (strip leading bullet/number prefixes, bold wrappers around titles)
  const referenceEntries = rawRefLines
    .map((line) =>
      line
        .trim()
        .replace(/^[-•*]\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .replace(/^\*\*(.*?)\*\*$/, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .trim()
    )
    .filter(
      (line) =>
        line.length > 10 &&
        !/^(?:references|note:|disclaimer:|academic integrity)/i.test(line)
    );

  const referencesContent = referenceEntries.join('\n\n');

  return {
    bodyContent,
    referencesContent,
    referenceEntries,
  };
}

export function extractAssignmentMetadataFromPrompt(params: {
  mode: EmergencyRescuerMode;
  promptText: string;
  attachedDocText?: string;
  customCourseCode?: string;
  customUnitTitle?: string;
}): {
  assignmentTitle: string;
  paperTopicTitle: string;
  courseCode: string;
  customFileName: string;
} {
  const combinedSource = `${params.customUnitTitle || ''}\n${params.promptText || ''}\n${params.attachedDocText || ''}`;

  // Detect Unit Number (e.g. "Unit 5", "Unit 8")
  const unitMatch = combinedSource.match(/\bUnit\s*(\d{1,2})\b/i);
  const unitLabel = unitMatch ? `Unit ${unitMatch[1]}` : 'Unit 5';

  // Detect Course Code (e.g. "POLS 1503", "CS 1101", "BUS 2201")
  const courseMatch = combinedSource.match(/\b([A-Z]{2,5}\s*\d{4}(?:-\d{2})?(?:\s*AY\d{4}-T\d)?)\b/);
  const detectedCourse = params.customCourseCode?.trim()
    || (courseMatch ? courseMatch[1].replace(/\s+/g, ' ').trim() : 'POLS 1503-01 AY2027-T1');

  const defaultTaskLabel =
    params.mode === 'discussion_post' ? 'Discussion Assignment' : 'Assignment Activity';

  const assignmentTitle =
    params.customUnitTitle?.trim() || `${unitLabel} ${defaultTaskLabel}`;

  // Extract concise Paper Topic Title from first meaningful prompt line
  const firstMeaningfulLine = (params.promptText || '')
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
    .find((l) => l.length > 8);

  const paperTopicTitle = firstMeaningfulLine
    ? firstMeaningfulLine.slice(0, 110)
    : assignmentTitle;

  const customFileName = toSnakeCaseFileName(
    assignmentTitle,
    params.mode === 'discussion_post'
      ? `${unitLabel.replace(/\s+/g, '_')}_Discussion_Assignment`
      : `${unitLabel.replace(/\s+/g, '_')}_Assignment_Activity`
  );

  return {
    assignmentTitle,
    paperTopicTitle,
    courseCode: detectedCourse,
    customFileName,
  };
}

export function buildEmergencyBridgeToApaPayload(params: {
  mode: EmergencyRescuerMode;
  promptText: string;
  attachedDocText?: string;
  generatedDraft: string;
  customCourseCode?: string;
  customUnitTitle?: string;
  submissionDate?: string;
}): ApaStudioPersistedState {
  const existing = loadApaStudioState();
  const meta = extractAssignmentMetadataFromPrompt({
    mode: params.mode,
    promptText: params.promptText,
    attachedDocText: params.attachedDocText,
    customCourseCode: params.customCourseCode,
    customUnitTitle: params.customUnitTitle,
  });

  const { bodyContent, referencesContent, referenceEntries } = splitDraftAndApaReferences(
    params.generatedDraft
  );

  return {
    ...existing,
    templateType:
      params.mode === 'discussion_post'
        ? 'discussion_assignment'
        : 'assignment_activity',
    customFileName: meta.customFileName,
    assignmentTitle: meta.assignmentTitle,
    paperTopicTitle: meta.paperTopicTitle,
    institution: 'University of the People',
    courseCode: meta.courseCode || existing.courseCode || 'POLS 1503-01 AY2027-T1',
    submissionDate: params.submissionDate || formatCurrentSubmissionDate(),
    bodyContent,
    referencesContent,
    savedReferences: referenceEntries,
    integrityInput: referencesContent || existing.integrityInput,
  };
}
