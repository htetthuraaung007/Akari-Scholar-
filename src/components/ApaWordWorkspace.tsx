import React, { useState, useMemo, useEffect } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
  Header,
  PageNumber,
  ExternalHyperlink
} from 'docx';
import { saveAs } from 'file-saver';
import {
  ApaStudioPersistedState,
  clearApaStudioSessionStorage,
  createBlankApaStudioState,
  loadApaStudioState,
  saveApaStudioState,
} from '../utils/emergencyApaBridge';

function parseApaReferenceEntries(raw: string): string[] {
  const normalized = (raw || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const looksLikeNewRef = (line: string) =>
    /^[A-Z0-9"“(\[]/.test(line) &&
    (/\(\s*(?:19|20)\d{2}[a-z]?(?:,\s*[^)]+)?\s*\)|\(\s*n\.d\.\s*\)/i.test(line) ||
      /https?:\/\/|doi\.org/i.test(line));

  const entries: string[] = [];
  for (const block of blocks) {
    const subLines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (subLines.length === 0) continue;

    if (subLines.length === 1) {
      if (!/^#*\s*references\s*$/i.test(subLines[0])) {
        entries.push(subLines[0]);
      }
    } else {
      const independentCount = subLines.filter(looksLikeNewRef).length;
      if (independentCount >= 2) {
        for (const sl of subLines) {
          if (!/^#*\s*references\s*$/i.test(sl)) {
            entries.push(sl);
          }
        }
      } else {
        const joined = subLines.join(' ').replace(/\s{2,}/g, ' ').trim();
        if (joined && !/^#*\s*references\s*$/i.test(joined)) {
          entries.push(joined);
        }
      }
    }
  }
  return entries;
}

function getApaSortKey(entry: string): { authorKey: string; yearKey: number } {
  const cleaned = entry
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[-•*]\s*/, '')
    .replace(/^["“'‘]+/, '')
    .trim();

  // Extract publication year for chronological tie-breaking (same author)
  const yearMatch = cleaned.match(/\(\s*((?:19|20)\d{2})[a-z]?(?:,\s*[^)]+)?\s*\)/);
  const yearKey = yearMatch ? parseInt(yearMatch[1], 10) : 9999;

  // Author/title lead before publication year
  const beforeYear = yearMatch && typeof yearMatch.index === 'number'
    ? cleaned.slice(0, yearMatch.index).trim()
    : cleaned;

  // Ignore leading articles if no author (title-first entry)
  const authorKey = (beforeYear || cleaned)
    .replace(/^(?:A|An|The)\s+/i, '')
    .replace(/[.,;:]+$/g, '')
    .toLowerCase();

  return { authorKey, yearKey };
}

function sortApaReferencesAlphabetically(entries: string[]): string[] {
  return [...entries].sort((a, b) => {
    const keyA = getApaSortKey(a);
    const keyB = getApaSortKey(b);
    const cmp = keyA.authorKey.localeCompare(keyB.authorKey, 'en', { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    if (keyA.yearKey !== keyB.yearKey) return keyA.yearKey - keyB.yearKey;
    return a.localeCompare(b, 'en', { sensitivity: 'base' });
  });
}

const SAMPLE_APA_REFERENCES = [
  'World Health Organization. (2018, May 24). The top 10 causes of death. https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death',
  'Grady, J. S., Her, M., Moreno, G., Perez, C., & Yelinek, J. (2019). Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States. Psychology of Popular Media Culture, 8(3), 207–217. https://doi.org/10.1037/ppm0000185',
  'Jackson, L. M. (2019). The psychology of prejudice: From attitudes to social action (2nd ed.). American Psychological Association. https://doi.org/10.1037/0000168-000',
].join('\n\n');

export interface ApaWordWorkspaceProps {
  onBackToDashboard?: () => void;
}

export const ApaWordWorkspace: React.FC<ApaWordWorkspaceProps> = ({ onBackToDashboard }) => {
  const initialApaState = loadApaStudioState();

  // 1. Template Selector (Assignment Activity vs Discussion Assignment)
  const [templateType, setTemplateType] = useState<'assignment_activity' | 'discussion_assignment'>(
    initialApaState.templateType
  );

  // 2. Custom File Name & Document Metadata
  const [customFileName, setCustomFileName] = useState(initialApaState.customFileName);
  const [assignmentTitle, setAssignmentTitle] = useState(initialApaState.assignmentTitle);
  const [paperTopicTitle, setPaperTopicTitle] = useState(initialApaState.paperTopicTitle);
  const [institution, setInstitution] = useState(initialApaState.institution);
  const [courseCode, setCourseCode] = useState(initialApaState.courseCode);
  const [instructorName, setInstructorName] = useState(initialApaState.instructorName);
  const [studentName, setStudentName] = useState(initialApaState.studentName);
  const [submissionDate, setSubmissionDate] = useState(initialApaState.submissionDate);

  // 3. Body Content & References
  const [bodyContent, setBodyContent] = useState(initialApaState.bodyContent);
  const [referencesContent, setReferencesContent] = useState(initialApaState.referencesContent);

  // 4. Citation Engine & Search Sub-Tabs (Pic 6)
  const [activeSubTab, setActiveSubTab] = useState<'references_finder' | 'turnitin_audit'>(
    initialApaState.activeSubTab
  );
  const [refSearchQuery, setRefSearchQuery] = useState(initialApaState.refSearchQuery);
  const [integrityInput, setIntegrityInput] = useState(initialApaState.integrityInput);
  const [integrityResult, setIntegrityResult] = useState(initialApaState.integrityResult);
  const [freeApiAuditing, setFreeApiAuditing] = useState(false);

  // 5. Scribbr Style Source Types Generator (Pics 7, 8, 9)
  const [showCitationBuilder, setShowCitationBuilder] = useState(false);
  const [sourceType, setSourceType] = useState<'journal' | 'book' | 'webpage' | 'report' | 'video' | 'news'>('journal');
  const [citeAuthor, setCiteAuthor] = useState('');
  const [citeYear, setCiteYear] = useState('');
  const [citeTitle, setCiteTitle] = useState('');
  const [citeSource, setCiteSource] = useState('');
  const [citeUrl, setCiteUrl] = useState('');
  const [citationError, setCitationError] = useState<string | null>(null);
  const [savedReferences, setSavedReferences] = useState<string[]>(initialApaState.savedReferences);
  const [showCheatSheetModal, setShowCheatSheetModal] = useState(false);
  const [copiedCheatId, setCopiedCheatId] = useState<string | null>(null);
  const [showRefClearConfirm, setShowRefClearConfirm] = useState(false);
  const [confirmClearScope, setConfirmClearScope] = useState<'body' | 'all' | null>(null);
  const [apaClearSuccess, setApaClearSuccess] = useState(false);

  // Persist APA 7th Word Studio State in sessionStorage (`apa7_word_studio_state`)
  useEffect(() => {
    saveApaStudioState({
      templateType,
      customFileName,
      assignmentTitle,
      paperTopicTitle,
      institution,
      courseCode,
      instructorName,
      studentName,
      submissionDate,
      bodyContent,
      referencesContent,
      savedReferences,
      activeSubTab,
      refSearchQuery,
      integrityInput,
      integrityResult,
    });
  }, [
    templateType,
    customFileName,
    assignmentTitle,
    paperTopicTitle,
    institution,
    courseCode,
    instructorName,
    studentName,
    submissionDate,
    bodyContent,
    referencesContent,
    savedReferences,
    activeSubTab,
    refSearchQuery,
    integrityInput,
    integrityResult,
  ]);

  // Listen for live Emergency Rescuer -> APA Studio bridge events
  useEffect(() => {
    const handleBridgeUpdate = (e: Event) => {
      const detail = (e as CustomEvent<ApaStudioPersistedState>).detail;
      if (!detail) return;
      setTemplateType(detail.templateType);
      setCustomFileName(detail.customFileName);
      setAssignmentTitle(detail.assignmentTitle);
      setPaperTopicTitle(detail.paperTopicTitle);
      setInstitution(detail.institution);
      setCourseCode(detail.courseCode);
      setInstructorName(detail.instructorName);
      setStudentName(detail.studentName);
      setSubmissionDate(detail.submissionDate);
      setBodyContent(detail.bodyContent);
      setReferencesContent(detail.referencesContent);
      setSavedReferences(detail.savedReferences || []);
      setIntegrityInput(detail.integrityInput || '');
    };
    window.addEventListener('akari_apa_bridge_updated', handleBridgeUpdate);
    return () => window.removeEventListener('akari_apa_bridge_updated', handleBridgeUpdate);
  }, []);

  const parsedIntegrityEntries = useMemo(
    () => parseApaReferenceEntries(integrityInput),
    [integrityInput]
  );

  const handlePasteSampleReferences = () => {
    setIntegrityInput((prev) =>
      prev.trim() ? `${prev.trim()}\n\n${SAMPLE_APA_REFERENCES}` : SAMPLE_APA_REFERENCES
    );
  };

  const handleAlphabetizeReferences = () => {
    if (parsedIntegrityEntries.length < 2) return;
    const sorted = sortApaReferencesAlphabetically(parsedIntegrityEntries);
    setIntegrityInput(sorted.join('\n\n'));
  };

  const handleConfirmClearReferences = () => {
    setIntegrityInput('');
    setIntegrityResult('');
    setShowRefClearConfirm(false);
  };

  // Word Count Logic (Introduction to Conclusion only, Excludes Title, Word Count line & References)
  const calculateBodyWordCount = (text: string): number => {
    if (!text.trim()) return 0;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let count = 0;

    for (const line of lines) {
      if (/^references\b/i.test(line)) break; // Stop at References
      if (/^word count\b/i.test(line)) continue; // Ignore word count lines

      const isHeading = line.startsWith('#') || (line.length < 80 && !line.endsWith('.') && !line.includes('('));
      if (!isHeading) {
        count += line.split(/\s+/).filter(Boolean).length;
      }
    }
    return count;
  };

  // Protected Clear Handlers (Zero window.confirm / zero window.alert)
  const handleRequestClearBody = () => {
    setConfirmClearScope('body');
  };

  const handleRequestClearAll = () => {
    setConfirmClearScope('all');
  };

  const handleExecuteConfirmedClear = () => {
    if (confirmClearScope === 'all') {
      const blank = createBlankApaStudioState();
      clearApaStudioSessionStorage();
      setTemplateType(blank.templateType);
      setCustomFileName(blank.customFileName);
      setAssignmentTitle(blank.assignmentTitle);
      setPaperTopicTitle(blank.paperTopicTitle);
      setInstitution(blank.institution);
      setCourseCode(blank.courseCode);
      setInstructorName(blank.instructorName);
      setStudentName(blank.studentName);
      setSubmissionDate(blank.submissionDate);
      setBodyContent('');
      setReferencesContent('');
      setSavedReferences([]);
      setIntegrityInput('');
      setIntegrityResult('');
    } else if (confirmClearScope === 'body') {
      setBodyContent('');
      setReferencesContent('');
      setSavedReferences([]);
    }
    setConfirmClearScope(null);
    setApaClearSuccess(true);
    setTimeout(() => setApaClearSuccess(false), 2000);
  };

  // Add Citation (APA Style Guide Rules)
  const handleAddCitation = () => {
    if (!citeAuthor.trim() || !citeTitle.trim()) {
      setCitationError('ရေးသားသူ (Author) နှင့် စာတမ်းခေါင်းစဉ် (Title) ကို ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }
    setCitationError(null);
    const author = citeAuthor.trim().endsWith('.') ? citeAuthor.trim() : `${citeAuthor.trim()}.`;
    const year = citeYear.trim() ? `(${citeYear.trim()}).` : '(n.d.).';
    const title = citeTitle.trim().endsWith('.') ? citeTitle.trim() : `${citeTitle.trim()}.`;
    const source = citeSource.trim() ? `${citeSource.trim()}.` : '';
    const url = citeUrl.trim();

    const formatted = `${author} ${year} ${title} ${source} ${url}`.trim();
    setSavedReferences(prev => [...prev, formatted]);
    setReferencesContent(prev => (prev ? prev + '\n' + formatted : formatted));
    setIntegrityInput(prev => (prev ? prev + '\n' + formatted : formatted));
    
    // Reset Form
    setCiteAuthor('');
    setCiteYear('');
    setCiteTitle('');
    setCiteSource('');
    setCiteUrl('');
  };

  // Crossref Free Open API Citation Audit (Supports Single Query & Batch APA 7th Reference Lists)
  const handleFreeCrossrefAudit = async (forceBatchInput = false) => {
    const searchTopic = forceBatchInput ? '' : refSearchQuery.trim();
    const bulkSource = integrityInput.trim() || referencesContent.trim();

    if (!searchTopic && !bulkSource) {
      setIntegrityResult('⚠️ ရှာဖွေစစ်ဆေးလိုသော ခေါင်းစဉ် သို့မဟုတ် APA References စာရင်းကို ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    setFreeApiAuditing(true);
    let auditReport = `📊 OPEN-ACCESS CITATION & APA 7TH ACCURACY REPORT\n`;
    auditReport += `========================================================\n\n`;

    // Mode A: Single Topic / DOI Search from Academic Search Bar
    if (searchTopic) {
      const sample = encodeURIComponent(searchTopic.slice(0, 140));
      try {
        const res = await fetch(`https://api.crossref.org/works?query.bibliographic=${sample}&rows=1`);
        if (res.ok) {
          const data = await res.json();
          const item = data.message?.items?.[0];
          if (item) {
            auditReport += `✅ [Crossref Database မှ အတည်ပြုပြီး]:\n`;
            auditReport += `• Title: ${item.title?.[0] || 'Unknown'}\n`;
            auditReport += `• Author(s): ${item.author ? item.author.map((a: any) => `${a.family}, ${a.given?.[0] || ''}.`).join(', ') : 'N/A'}\n`;
            auditReport += `• DOI Link: https://doi.org/${item.DOI || 'N/A'}\n`;
            auditReport += `• Published Year: ${item.created?.['date-parts']?.[0]?.[0] || 'N/A'}\n\n`;
            auditReport += `💡 APA 7th Standard Suggested Format:\n`;
            const authorText = item.author ? `${item.author[0]?.family || 'Author'}, ${item.author[0]?.given?.[0] || 'A'}.` : 'Author, A.';
            const yearText = item.created?.['date-parts']?.[0]?.[0] ? `(${item.created['date-parts'][0][0]}).` : '(n.d.).';
            auditReport += `${authorText} ${yearText} ${item.title?.[0] || 'Title'}. https://doi.org/${item.DOI || ''}\n`;
          } else {
            auditReport += `⚠️ Crossref တွင် စာတမ်းအချက်အလက် တိုက်ရိုက် မတွေ့ရှိပါ။ ရင်းမြစ် URL ကို ပြန်လည်စစ်ဆေးပါ။\n`;
          }
        }
      } catch {
        auditReport += `⚠️ Crossref API ချိတ်ဆက်မှု မအောင်မြင်ပါ။ အင်တာနက် လိုင်းစစ်ဆေးပေးပါခင်ဗျာ။\n`;
      }

      setIntegrityResult(auditReport);
      setFreeApiAuditing(false);
      return;
    }

    // Mode B: Batch APA 7th Structural + Crossref Verification Audit
    const entries = parseApaReferenceEntries(bulkSource);
    const sortedExpected = sortApaReferencesAlphabetically(entries);
    const isAlphabetical = entries.every((entry, idx) => entry === sortedExpected[idx]);

    auditReport += `📚 Total References Analyzed: ${entries.length}\n`;
    auditReport += `🔤 Alphabetical Order (A–Z): ${
      entries.length < 2
        ? 'N/A (Single entry)'
        : isAlphabetical
        ? '✅ Properly Alphabetized (APA 7th Standard)'
        : '⚠️ Out of Alphabetical Order — Click "A-Z စီမည် (Alphabetize)" to auto-sort.'
    }\n\n`;

    const MAX_CROSSREF_LOOKUPS = 15;
    const crossrefResults: Map<number, string> = new Map();

    // Verify up to 15 entries against Crossref API in batches of 3
    const targets = entries.slice(0, MAX_CROSSREF_LOOKUPS);
    for (let i = 0; i < targets.length; i += 3) {
      const batch = targets.slice(i, i + 3);
      await Promise.all(
        batch.map(async (entry, offset) => {
          const idx = i + offset;
          const doiMatch = entry.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
          try {
            if (doiMatch) {
              const doi = doiMatch[0].replace(/[.,;)]+$/, '');
              const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
              if (res.ok) {
                const data = await res.json();
                const item = data.message;
                if (item) {
                  crossrefResults.set(
                    idx,
                    `✅ Crossref Verified DOI: https://doi.org/${item.DOI} (${item.title?.[0]?.slice(0, 80) || 'Matched'})`
                  );
                  return;
                }
              }
            }
            const cleanQuery = entry
              .replace(/https?:\/\/\S+/g, '')
              .replace(/\(\s*(?:19|20)\d{2}[a-z]?\s*\)\.?/, '')
              .trim()
              .slice(0, 120);
            if (cleanQuery.length > 10) {
              const res = await fetch(
                `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(cleanQuery)}&rows=1`
              );
              if (res.ok) {
                const data = await res.json();
                const item = data.message?.items?.[0];
                if (item?.DOI) {
                  crossrefResults.set(
                    idx,
                    `🔎 Crossref Closest Match: ${item.title?.[0]?.slice(0, 75) || 'Found'} (https://doi.org/${item.DOI})`
                  );
                  return;
                }
              }
            }
            crossrefResults.set(idx, 'ℹ️ Web/Book or Non-Crossref Source (verify source URL manually)');
          } catch {
            crossrefResults.set(idx, '⚠️ Crossref lookup timed out or offline');
          }
        })
      );
    }

    entries.forEach((entry, idx) => {
      const hasYear = /\(\s*(?:19|20)\d{2}[a-z]?(?:,\s*[^)]+)?\s*\)|\(\s*n\.d\.\s*\)/i.test(entry);
      const hasAuthorLead = /^[A-Z][A-Za-z'’\-]+/.test(entry);
      const hasDoiOrUrl = /https?:\/\/\S+/i.test(entry);
      const hasHttpNotHttps = /\bhttp:\/\/\S+/i.test(entry);
      const hasRetrievedFrom = /retrieved\s+from\s+https?:\/\//i.test(entry);

      const issues: string[] = [];
      if (!hasAuthorLead) issues.push('Check author/organization capitalization');
      if (!hasYear) issues.push('Missing standard (YYYY) or (n.d.) date');
      if (hasHttpNotHttps) issues.push('Use https:// instead of http://');
      if (hasRetrievedFrom) issues.push('APA 7th omits "Retrieved from" before stable URLs');

      const preview = entry.length > 110 ? `${entry.slice(0, 110)}...` : entry;
      auditReport += `[${idx + 1}] ${preview}\n`;
      auditReport += `    • APA 7th Check: ${
        issues.length === 0
          ? '✅ Valid Author/Year/Punctuation structure'
          : `⚠️ ${issues.join(' • ')}`
      }${hasDoiOrUrl ? ' • Link detected' : ''}\n`;
      if (crossrefResults.has(idx)) {
        auditReport += `    • Crossref Status: ${crossrefResults.get(idx)}\n`;
      } else if (idx >= MAX_CROSSREF_LOOKUPS) {
        auditReport += `    • Crossref Status: Structural audit completed (Crossref lookup capped at first ${MAX_CROSSREF_LOOKUPS} entries)\n`;
      }
      auditReport += `\n`;
    });

    setIntegrityResult(auditReport);
    setFreeApiAuditing(false);
  };

  // Strict DOCX Generator (Zero-API Token, Pixel-Perfect Layout)
  const handleExportDocx = async () => {
    const rawBody = bodyContent || '';
    const allLines = rawBody.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Extract References if entered in Body Textarea
    let refStartIndex = -1;
    for (let i = 0; i < allLines.length; i++) {
      if (/^references\b/i.test(allLines[i])) {
        refStartIndex = i;
        break;
      }
    }

    const bodyLines = refStartIndex !== -1 ? allLines.slice(0, refStartIndex) : allLines;
    const extractedRefLines = refStartIndex !== -1 ? allLines.slice(refStartIndex + 1) : [];

    // Combine All References
    const finalRefLines = extractedRefLines.length > 0
      ? extractedRefLines
      : (referencesContent.trim() ? referencesContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : savedReferences);

    const calculatedCount = calculateBodyWordCount(bodyContent);
    const docElements: Paragraph[] = [];

    // ==========================================
    // 1. COVER / HEADER METADATA SECTION
    // ==========================================
    if (templateType === 'assignment_activity') {
      // ASSIGNMENT ACTIVITY: Clean 3-double-spaces top padding, All Bold, Center Aligned, Tight 2.0 (No gaps)
      for (let i = 0; i < 3; i++) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 480, before: 0, after: 0 },
            children: [new TextRun({ text: '', font: 'Times New Roman', size: 24 })],
          })
        );
      }

      const coverMeta = [
        assignmentTitle || 'Unit 5 Assignment Activity',
        institution || 'University of the People',
        courseCode || 'POLS 1503-01 AY2027-T1',
        instructorName ? `Instructor: ${instructorName}` : 'Instructor: Innocent Ndock Kong',
        studentName || 'Htet Thura Aung',
        submissionDate || 'November 5, 2026',
      ];

      coverMeta.forEach(lineText => {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 480, before: 0, after: 0 }, // Strict double spacing, NO gap
            children: [
              new TextRun({
                text: lineText,
                bold: true, // All Bold as requested
                font: 'Times New Roman',
                size: 24, // 12pt
              }),
            ],
          })
        );
      });

      // Page Break to Page 2
      docElements.push(new Paragraph({ children: [new PageBreak()] }));

      // Repeat Title on Page 2 (Bold + Center)
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: 480, before: 0, after: 0 },
          children: [
            new TextRun({
              text: assignmentTitle || 'Unit 5 Assignment Activity',
              bold: true,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    } else {
      // DISCUSSION ASSIGNMENT: Continuous First Page, No Page Break, All Bold, Centered
      const discussionMeta = [
        assignmentTitle || 'Unit 8 Discussion Assignment',
        institution || 'University of the People',
        courseCode || 'POLS 1503-01 - AY2027-T1',
        instructorName ? `Instructor name: ${instructorName}` : 'Instructor name: Innocent Ndock Kong',
        studentName ? `Student: ${studentName}` : 'Student: Thin Yati Aung',
        submissionDate ? `Date: ${submissionDate}` : 'Date: October 25, 2026',
      ];

      discussionMeta.forEach(lineText => {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 480, before: 0, after: 0 },
            children: [
              new TextRun({
                text: lineText,
                bold: true,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          })
        );
      });

      // Paper Topic Title (Bold + Center)
      if (paperTopicTitle.trim()) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 480, before: 0, after: 0 },
            children: [
              new TextRun({
                text: paperTopicTitle.trim(),
                bold: true,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          })
        );
      }
    }

    // ==========================================
    // 2. BODY CONTENT (SUBHEADINGS CENTER+BOLD, INDENT 0.5")
    // ==========================================
    let hasRenderedWordCount = false;

    bodyLines.forEach(line => {
      // Manual Word Count Check
      if (/^word count\b/i.test(line)) {
        hasRenderedWordCount = true;
        // User's Word Count: Align Left, ALL BOLD, NOT ITALICIZED
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: 480, before: 240, after: 0 },
            children: [
              new TextRun({
                text: line,
                bold: true, // Entire line bold
                italics: false, // NOT italicized
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          })
        );
        return;
      }

      const isHeading = line.startsWith('#') || (line.length < 80 && !line.endsWith('.') && !line.includes('('));
      const cleanLine = line.replace(/^#+\s*/, '').trim();

      if (isHeading) {
        // ALL HEADINGS & SUBHEADINGS: BOLD + ALIGN CENTER
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 480, before: 0, after: 0 },
            children: [
              new TextRun({
                text: cleanLine,
                bold: true, // Bold
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          })
        );
      } else {
        // Normal Paragraph: First-line indent 0.5" (720 twips), Double Spacing
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { firstLine: 720 },
            spacing: { line: 480, before: 0, after: 0 },
            children: [
              new TextRun({
                text: line,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          })
        );
      }
    });

    // Auto-insert Word Count if not manually typed in text
    if (!hasRenderedWordCount && calculatedCount > 0) {
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 480, before: 240, after: 0 },
          children: [
            new TextRun({
              text: `Word Count – ${calculatedCount} (not including title & references)`,
              bold: true,
              italics: false,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    }

    // ==========================================
    // 3. REFERENCES SECTION (0.5" HANGING INDENT & CLICKABLE BLUE LINKS)
    // ==========================================
    // Clean and deduplicate: Remove redundant "References" lines from user input
    const cleanedRefLines = finalRefLines
      .map(l => l.trim())
      .filter(line => {
        if (!line) return false;
        // User ထည့်လိုက်သော စာသားထဲတွင် References ခေါင်းစဉ် ပါလာခဲ့ပါက 
        // Align Left ဖြစ်ပြီး ထပ်နေသော စာလုံးအဖြစ် မထွက်လာစေရန် ဖယ်ထုတ်ခြင်း
        return !/^#*\s*references\s*$/i.test(line);
      });

    if (cleanedRefLines.length > 0) {
      // Assignment Activity breaks to new page; Discussion Assignment continues seamlessly
      if (templateType === 'assignment_activity') {
        docElements.push(new Paragraph({ children: [new PageBreak()] }));
      }

      // References Title (Always Bold + Center Aligned for both Assignment Activity & Discussion Assignment)
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { 
            line: 480, 
            before: templateType === 'discussion_assignment' ? 240 : 0, 
            after: 0 
          },
          children: [
            new TextRun({
              text: 'References',
              bold: true, // Always Bold
              font: 'Times New Roman',
              size: 24, // 12pt
            }),
          ],
        })
      );

      // Render Each Reference: 0.5" Hanging Indent + Clickable Blue Hyperlinks
      cleanedRefLines.forEach(refText => {
        const urlMatch = refText.match(/(https?:\/\/[^\s]+)/g);

        if (urlMatch && urlMatch[0]) {
          const url = urlMatch[0];
          const parts = refText.split(url);
          const beforeText = parts[0] || '';
          const afterText = parts[1] || '';

          docElements.push(
            new Paragraph({
              alignment: AlignmentType.LEFT,
              indent: { left: 720, hanging: 720 }, // 0.5" Hanging Indent (720 twips)
              spacing: { line: 480, before: 0, after: 0 },
              children: [
                new TextRun({
                  text: beforeText,
                  font: 'Times New Roman',
                  size: 24,
                }),
                new ExternalHyperlink({
                  children: [
                    new TextRun({
                      text: url,
                      underline: {},
                      color: '0563C1', // Standard Word Blue
                      font: 'Times New Roman',
                      size: 24,
                    }),
                  ],
                  link: url,
                }),
                new TextRun({
                  text: afterText,
                  font: 'Times New Roman',
                  size: 24,
                }),
              ],
            })
          );
        } else {
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.LEFT,
              indent: { left: 720, hanging: 720 }, // 0.5" Hanging Indent
              spacing: { line: 480, before: 0, after: 0 },
              children: [
                new TextRun({
                  text: refText,
                  font: 'Times New Roman',
                  size: 24,
                }),
              ],
            })
          );
        }
      });
    }

    // ==========================================
    // 4. DOCUMENT PACKAGING
    // ==========================================
    const sectionHeaders = templateType === 'assignment_activity' ? {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                children: [PageNumber.CURRENT],
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          }),
        ],
      }),
    } : undefined;

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 inch
                bottom: 1440, // 1 inch
                left: 1440,   // 1 inch
                right: 1440,  // 1 inch
              },
            },
          },
          headers: sectionHeaders,
          children: docElements,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = (customFileName.trim() || 'Assignment_Paper')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .concat('.docx');
    saveAs(blob, fileName);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const currentWordCount = calculateBodyWordCount(bodyContent);

  return (
    <div className="space-y-4">
      {/* Top Header Bar, Custom File Name & Protected Clear All */}
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
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <span>📄</span> APA 7th Reference & Word (.docx / PDF) စနစ်တကျ ထုတ်ယူမှု
          </span>
        </div>

        {/* Custom File Name Input & Clear All */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] font-bold text-slate-400">File Name:</label>
          <input
            type="text"
            value={customFileName}
            onChange={(e) => setCustomFileName(e.target.value)}
            placeholder="Unit_5_Assignment_Activity"
            className="p-1.5 px-3 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono w-64 sm:w-72 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleRequestClearAll}
            className="px-2.5 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>🗑️ အားလုံးရှင်းထုတ်မည် (Clear All)</span>
          </button>
        </div>
      </div>

      {apaClearSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <span>✓</span>
          <span>APA 7th စာတမ်းအချက်အလက်များကို အောင်မြင်စွာ ရှင်းထုတ်ပြီးပါပြီ။</span>
        </div>
      )}

      {confirmClearScope !== null && (
        <div className="p-3.5 rounded-2xl bg-rose-950/55 border border-rose-500/60 text-xs space-y-2.5">
          <p className="text-rose-100 font-medium leading-relaxed">
            ထည့်သွင်းထားသော Title Page အချက်အလက်များနှင့် စာတမ်းစာကိုယ်များကို အားလုံး ရှင်းထုတ်ပစ်ရန် သေချာပါသလား?
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClearScope(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="button"
              onClick={handleExecuteConfirmedClear}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
            >
              {confirmClearScope === 'all' ? 'သေချာသည် (Clear All)' : 'သေချာသည် (Clear Body)'}
            </button>
          </div>
        </div>
      )}

      {/* Warning Alert Banner (Conversational Tone) */}
      <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2.5 leading-relaxed">
        <span className="text-base shrink-0">⚠️</span>
        <div>
          <strong>အရေးကြီး သတိပေးချက်:</strong> စနစ်က APA 7th စံနှုန်းအတိုင်း တိကျစွာ ထုတ်ပေးထားသော်လည်း ဤ template တစ်ခုတည်းကို ၁၀၀% မယုံကြည်ဘဲ စာတမ်းမတင်မီ Title Page, Indentation, Double Spacing နှင့် References Link များကို သင့် Microsoft Word တွင် ကိုယ်တိုင် နောက်ဆုံးအကြိမ် ပြန်လည်စစ်ဆေးပေးပါခင်ဗျာ။
        </div>
      </div>

      {/* Template Mode Switcher (Pill Selector) */}
      <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Template စနစ် ရွေးချယ်ရန်:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTemplateType('assignment_activity');
                if (!customFileName.trim() || customFileName === 'Unit_8_globalization_discussion_assignment') {
                  setCustomFileName('Unit_5_Assignment_Activity');
                }
                if (!assignmentTitle.trim() || assignmentTitle === 'Unit 8 Discussion Assignment') {
                  setAssignmentTitle('Unit 5 Assignment Activity');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                templateType === 'assignment_activity'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>📋</span> 1. Assignment Activity Template
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplateType('discussion_assignment');
                if (!customFileName.trim() || customFileName === 'Unit_5_Assignment_Activity') {
                  setCustomFileName('Unit_8_globalization_discussion_assignment');
                }
                if (!assignmentTitle.trim() || assignmentTitle === 'Unit 5 Assignment Activity') {
                  setAssignmentTitle('Unit 8 Discussion Assignment');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                templateType === 'discussion_assignment'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>💬</span> 2. Discussion Assignment Template
            </button>
          </div>
        </div>

        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-800/40">
          {templateType === 'assignment_activity' ? 'Cover Page Centered + Page Numbers' : 'No Page Numbers + Seamless Ref'}
        </span>
      </div>

      {/* Metadata Configuration Bar */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
        <span className="text-xs font-bold text-indigo-300 block">
          {templateType === 'assignment_activity' ? 'Title Page အချက်အလက်များ (All Bold & Center Aligned):' : 'Header Metadata အချက်အလက်များ (All Bold & Center Aligned):'}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Assignment Title:</label>
            <input
              type="text"
              value={assignmentTitle}
              onChange={(e) => setAssignmentTitle(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
            />
          </div>
          {templateType === 'discussion_assignment' && (
            <div>
              <label className="text-[10px] text-amber-300 font-semibold block mb-0.5">Paper Topic Title (ခေါင်းစဉ်အပြည့်အစုံ):</label>
              <input
                type="text"
                value={paperTopicTitle}
                onChange={(e) => setPaperTopicTitle(e.target.value)}
                placeholder="The Impact of GMOs, Globalization..."
                className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-amber-600/50 text-slate-200 font-mono"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Institution:</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Course Code & Term:</label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Instructor Name:</label>
            <input
              type="text"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Student Name:</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Submission Date:</label>
            <input
              type="text"
              value={submissionDate}
              onChange={(e) => setSubmissionDate(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Main Body Editor Area */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">စာတမ်း စာကိုယ် (Introduction to Conclusion):</span>
            <span className="px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 font-mono text-[11px] font-bold border border-indigo-800/40">
              Word Count: {currentWordCount} words
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRequestClearBody}
              className="px-2.5 py-1 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>🗑️</span> စာကိုယ် Clear လုပ်မည်
            </button>
            <button
              type="button"
              onClick={handleRequestClearAll}
              className="px-2.5 py-1 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-600/50 text-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>🗑️</span> အားလုံးရှင်းထုတ်မည် (Clear All)
            </button>
          </div>
        </div>

        <textarea
          rows={12}
          value={bodyContent}
          onChange={(e) => setBodyContent(e.target.value)}
          placeholder="Introduction မှစတင်၍ စာကိုယ်တစ်ခုလုံးကို ဤနေရာတွင် ထည့်ပါ (နံပါတ်စဉ်တပ်ထားသော ခေါင်းစဉ်ခွဲများသည် Word တွင် Bold + Center အလိုအလျောက် ဖြစ်သွားပါမည်)..."
          className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
        />

        {/* References Input Box */}
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
            <label className="text-[11px] font-bold text-indigo-300 block">
              References စာရင်း (0.5" Hanging Indent နှင့် Clickable Underlined Blue Link များ အလိုအလျောက် ဖွဲ့စည်းပေးပါမည်):
            </label>
            <button
              type="button"
              onClick={() => setShowCheatSheetModal(true)}
              className="px-2.5 py-1 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>📖</span> Quick APA 7th Reference Cheat Sheet
            </button>
          </div>
          <textarea
            rows={5}
            value={referencesContent}
            onChange={(e) => setReferencesContent(e.target.value)}
            placeholder="Council on Foreign Relations. (2018, March 16). What is global health? https://education.cfr.org/..."
            className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
          />
        </div>

        {/* DOCX & PDF Export Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportDocx}
            className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>📥</span>
            <span>{customFileName}.docx ဒေါင်းလုဒ်ရယူမည် ({templateType === 'discussion_assignment' ? 'Discussion Format' : 'Assignment Activity Format'})</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs shadow transition-all flex items-center justify-center gap-2"
          >
            <span>🖨️</span>
            <span>PDF File အနေဖြင့် ထုတ်ယူ/Print ပြုလုပ်မည်</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ACADEMIC REFERENCES & CITATION ENGINE (PICS 5, 6, 7, 8, 9) */}
      {/* ========================================================= */}
      <div className="space-y-4">
        {/* External Citation Generator Hub Links */}
        <div className="p-4 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>🌐</span> Online APA 7th Citation Generators (New Tab ဖြင့် ဖွင့်နိုင်သည်):
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Verified APA Tools</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <a
              href="https://www.scribbr.com/citation/generator/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 transition-all flex justify-between items-center group"
            >
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">Scribbr Citation Generator</span>
                <p className="text-[10px] text-slate-400 mt-0.5">APA 7th official engine</p>
              </div>
              <span className="text-[11px] text-indigo-400">ဖွင့်မည် ↗</span>
            </a>

            <a
              href="https://www.citationmachine.net/apa"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 transition-all flex justify-between items-center group"
            >
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">Citation Machine APA</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Fast bibliography builder</p>
              </div>
              <span className="text-[11px] text-indigo-400">ဖွင့်မည် ↗</span>
            </a>

            <a
              href="https://www.mybib.com/#/projects/S5hvRM/citations"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 transition-all flex justify-between items-center group"
            >
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">MyBib Citation Maker</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Free, accurate reference lists</p>
              </div>
              <span className="text-[11px] text-indigo-400">ဖွင့်မည် ↗</span>
            </a>
          </div>
        </div>

        {/* References Sub-Tabs Switcher (From Pic 6) */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-950 border border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveSubTab('references_finder')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'references_finder'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📚</span> Academic References ရှာဖွေ/စစ်ဆေးမည်
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('turnitin_audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'turnitin_audit'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛡️</span> Turnitin Similarity Shield
          </button>
        </div>

        {/* SUB-TAB 1: ACADEMIC REFERENCES FINDER */}
        {activeSubTab === 'references_finder' && (
          <div className="space-y-4">
            {/* Open-Access Databases (7 Hubs) */}
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
                  placeholder="ဥပမာ - Womenomics or Sustainable Development or specific DOI..."
                  className="flex-1 p-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={() => handleFreeCrossrefAudit(false)}
                  disabled={freeApiAuditing}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition-all shrink-0"
                >
                  {freeApiAuditing ? 'စစ်ဆေးနေပါသည်...' : '⚡ Crossref Free ရှာမည်'}
                </button>
              </div>

              <div className="pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
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
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/60 transition-all text-center group"
                    >
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-rose-300 block">{db.name}</span>
                      <span className="text-[9px] text-rose-400 font-mono">ရှာဖွေမည် ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Toggle Citation Builder (Scribbr Style Source Types - Pics 7, 8, 9) */}
            <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-indigo-300">
                  ✏️ APA 7th Citation Generator (Scribbr Style Source Selector)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCheatSheetModal(true)}
                    className="px-2.5 py-1 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>📖</span> Quick APA 7th Reference Cheat Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCitationBuilder(!showCitationBuilder)}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold"
                  >
                    {showCitationBuilder ? '▲ ပိတ်မည်' : '▼ Citation တည်ဆောက်မည်'}
                  </button>
                </div>
              </div>

              {showCitationBuilder && (
                <div className="space-y-3 pt-2">
                  {/* Source Type Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(['journal', 'book', 'webpage', 'report', 'video', 'news'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSourceType(type)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                          sourceType === type ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {type === 'journal' ? '📄 Journal Article' : type === 'book' ? '📚 Book' : type === 'webpage' ? '🌐 Webpage' : type === 'report' ? '📑 Report' : type === 'video' ? '🎥 Video' : '📰 News'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Author(s):</label>
                      <input
                        type="text"
                        value={citeAuthor}
                        onChange={(e) => setCiteAuthor(e.target.value)}
                        placeholder="e.g. Elysia, J., & Devi, N. L. P. C."
                        className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Year:</label>
                      <input
                        type="text"
                        value={citeYear}
                        onChange={(e) => setCiteYear(e.target.value)}
                        placeholder="e.g. 2023"
                        className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Title:</label>
                      <input
                        type="text"
                        value={citeTitle}
                        onChange={(e) => setCiteTitle(e.target.value)}
                        placeholder="Article or page title..."
                        className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Journal / Publisher:</label>
                      <input
                        type="text"
                        value={citeSource}
                        onChange={(e) => setCiteSource(e.target.value)}
                        placeholder="Journal name or publisher..."
                        className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">DOI or URL:</label>
                      <input
                        type="text"
                        value={citeUrl}
                        onChange={(e) => setCiteUrl(e.target.value)}
                        placeholder="https://doi.org/10.1080/... or website link"
                        className="w-full p-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  {citationError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-700/50 text-xs text-rose-200 flex items-center justify-between gap-2">
                      <span>⚠️ {citationError}</span>
                      <button
                        type="button"
                        onClick={() => setCitationError(null)}
                        className="text-[11px] font-bold hover:underline cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddCitation}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all"
                  >
                    + Reference စာရင်းထဲသို့ ထည့်သွင်းမည်
                  </button>
                </div>
              )}
            </div>

            {/* Saved References Box & Audit Output */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-200 block">
                    သိမ်းဆည်းထားသော APA 7th References စာရင်း ({parsedIntegrityEntries.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFreeCrossrefAudit(true)}
                    disabled={freeApiAuditing || parsedIntegrityEntries.length === 0}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-bold transition-all cursor-pointer"
                  >
                    {freeApiAuditing ? 'Auditing...' : `⚡ Audit All (${parsedIntegrityEntries.length})`}
                  </button>
                </div>

                {/* Compact Bulk Action Utility Bar */}
                <div className="flex items-center flex-wrap gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
                  <button
                    type="button"
                    onClick={handlePasteSampleReferences}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    📋 နမူနာ စာရင်းထည့်မည် (Paste Sample)
                  </button>
                  <button
                    type="button"
                    onClick={handleAlphabetizeReferences}
                    disabled={parsedIntegrityEntries.length < 2}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-emerald-300 border border-slate-700 text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    🔤 A-Z စီမည် (Alphabetize)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRefClearConfirm(true)}
                    disabled={!integrityInput.trim()}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 text-rose-300 border border-rose-800/50 text-[11px] font-semibold transition-all cursor-pointer ml-auto"
                  >
                    🗑️ ရှင်းထုတ်မည် (Clear)
                  </button>
                </div>

                {showRefClearConfirm && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="text-rose-200 font-medium">
                      References စာရင်းအားလုံးကို ရှင်းထုတ်မည်လား?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRefClearConfirm(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmClearReferences}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  value={integrityInput}
                  onChange={(e) => setIntegrityInput(e.target.value)}
                  placeholder="APA 7th References များကို ဤနေရာတွင် တစ်ခုချင်း သို့မဟုတ် အများအပြား (Bulk Paste) ထည့်သွင်း စစ်ဆေးနိုင်ပါသည်..."
                  className="w-full min-h-[200px] max-h-[450px] overflow-y-auto p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
                />
              </div>

              <div className="lg:col-span-6 p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 block">
                    APA FORMAT တိကျမှု &amp; CROSSREF AUDIT ရလဒ်
                  </span>
                  {parsedIntegrityEntries.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-700/40">
                      {parsedIntegrityEntries.length} {parsedIntegrityEntries.length === 1 ? 'Entry' : 'Entries'} Ready
                    </span>
                  )}
                </div>
                <div className="min-h-[248px] max-h-[450px] overflow-y-auto p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                  {integrityResult || 'References စာရင်းထည့်သွင်းပြီး "Audit All" သို့မဟုတ် "Crossref Free ရှာမည်" ကို နှိပ်ပါ...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: TURNITIN SIMILARITY SHIELD + ONLINE PLAGIARISM CHECKERS */}
        {activeSubTab === 'turnitin_audit' && (
          <div className="space-y-4">
            {/* Info Box */}
            <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-rose-300 block">🛡️ Turnitin Similarity Shield</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                References စာရင်းများတွင် ပါဝင်သော စံသတ်မှတ်ချက် bibliographic entries များကို Turnitin တွင် similarity အဖြစ် မဖမ်းမိစေရန် Word စာတမ်းအဆုံးတွင် သီးခြားစာမျက်နှာဖြင့် ခွဲထုတ်ထားပြီး ဖြစ်ပါသည်။ Assignment မတင်မီ ဆရာ့ထံတွင် <em>"Exclude Bibliography"</em> filter ဖွင့်ထားပေးရန် ကြိုတင် အသိပေးနိုင်ပါသည်ခင်ဗျာ။
              </p>
            </div>

            {/* Online Plagiarism Checkers Grid */}
            <div className="p-4 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">🌐</span>
                  <h4 className="text-xs font-bold text-slate-200">Online Plagiarism Checkers</h4>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Open in New Tab ↗</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                {[
                  {
                    name: 'DupliChecker',
                    badge: 'Free (1,000 words)',
                    badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800/40',
                    desc: 'Web ပေါ်ရှိ အချက်အလက်များနှင့် တိုက်ဆိုင်စစ်ဆေးပေးသည်။',
                    url: 'https://www.duplichecker.com'
                  },
                  {
                    name: 'SmallSEOTools',
                    badge: 'Web Checker',
                    badgeColor: 'bg-blue-950 text-blue-400 border-blue-800/40',
                    desc: 'စာပိုဒ်အလိုက် အင်တာနက်စာမျက်နှာများနှင့် စစ်ပေးသည်။',
                    url: 'https://smallseotools.com/plagiarism-checker/'
                  },
                  {
                    name: 'PlagiarismDetector',
                    badge: 'Free Tier',
                    badgeColor: 'bg-cyan-950 text-cyan-400 border-cyan-800/40',
                    desc: 'တူညီနေသော စာကြောင်းများကို အင်တာနက်ရင်းမြစ်များနှင့် စစ်ပေးသည်။',
                    url: 'https://plagiarismdetector.net'
                  },
                  {
                    name: 'Scribbr',
                    badge: 'Academic Checker',
                    badgeColor: 'bg-purple-950 text-purple-400 border-purple-800/40',
                    desc: 'ကျောင်းသုံးစာတမ်း database များကို တိုက်စစ်ပေးသည်။',
                    url: 'https://www.scribbr.com/plagiarism-checker/'
                  },
                  {
                    name: 'Grammarly',
                    badge: 'Academic / Web',
                    badgeColor: 'bg-teal-950 text-teal-400 border-teal-800/40',
                    desc: 'ProQuest database နှင့် academic source များကို တိုက်စစ်ပေးသည်။',
                    url: 'https://www.grammarly.com/plagiarism-checker'
                  }
                ].map((tool, idx) => (
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
      </div>

      {/* QUICK APA 7TH REFERENCE CHEAT SHEET MODAL (Official apastyle.apa.org Examples) */}
      {showCheatSheetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowCheatSheetModal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-[#0b1120] border border-indigo-500/40 shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📖</span> Quick APA 7th Reference Cheat Sheet (Official APA Style Examples)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Manual references များ ထည့်သွင်းရာတွင် မှန်ကန်စွာ ရေးသားနိုင်ရန် တရားဝင် APA 7th Edition စံနမူနာများ (Journal, Book, Website)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheatSheetModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700 text-slate-300 hover:text-rose-200 text-xs font-bold transition-all"
              >
                ✕ ပိတ်မည်
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Official APA Style Link Banner */}
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] text-indigo-200 leading-relaxed">
                  <span className="font-bold text-indigo-300">Official Standard Source:</span> အောက်ပါ နမူနာပုံစံများသည် တရားဝင် <strong>APA Style Reference Examples</strong> လမ်းညွှန်အတိုင်း အတိအကျ ဖော်ပြထားခြင်း ဖြစ်ပါသည်။
                </div>
                <a
                  href="https://apastyle.apa.org/style-grammar-guidelines/references/examples"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all shrink-0 flex items-center gap-1"
                >
                  <span>🌐</span> apastyle.apa.org တွင် ကြည့်ရန် ↗
                </a>
              </div>

              {/* 1. JOURNAL ARTICLE */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <span>📄</span> 1. Journal Article (ဂျာနယ် ဆောင်းပါး စာတမ်း)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    Textual Works → Periodicals
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0c1426] border border-slate-800/80 text-[11px] text-slate-300 font-mono">
                  <span className="text-slate-400 block text-[10px] mb-1">Standard Format Formula:</span>
                  Author, A. A., &amp; Author, B. B. (Year). Title of article. <em>Title of Periodical</em>, <em>volume</em>(issue), page–page. https://doi.org/xxxx
                </div>

                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Official APA 7th Example (Journal Article with DOI):</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const ex = 'Grady, J. S., Her, M., Moreno, G., Perez, C., & Yelinek, J. (2019). Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States. Psychology of Popular Media Culture, 8(3), 207–217. https://doi.org/10.1037/ppm0000185';
                          navigator.clipboard.writeText(ex);
                          setCopiedCheatId('journal');
                          setTimeout(() => setCopiedCheatId(null), 1800);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-semibold"
                      >
                        {copiedCheatId === 'journal' ? '✓ Copied' : '📋 Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ex = 'Grady, J. S., Her, M., Moreno, G., Perez, C., & Yelinek, J. (2019). Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States. Psychology of Popular Media Culture, 8(3), 207–217. https://doi.org/10.1037/ppm0000185';
                          setReferencesContent(prev => prev.trim() ? `${prev.trim()}\n${ex}` : ex);
                          setShowCheatSheetModal(false);
                        }}
                        className="px-2 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-[10px] text-indigo-200 font-semibold"
                      >
                        + Paste to References
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-100 font-serif leading-relaxed pl-6 -indent-6">
                    Grady, J. S., Her, M., Moreno, G., Perez, C., &amp; Yelinek, J. (2019). Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States. <em>Psychology of Popular Media Culture</em>, <em>8</em>(3), 207–217. <span className="text-blue-400 underline">https://doi.org/10.1037/ppm0000185</span>
                  </p>
                  <div className="pt-1 flex flex-wrap gap-4 text-[11px] text-slate-400 font-mono">
                    <span>• <strong>Parenthetical citation:</strong> (Grady et al., 2019)</span>
                    <span>• <strong>Narrative citation:</strong> Grady et al. (2019)</span>
                  </div>
                </div>
              </div>

              {/* 2. BOOK / EBOOK */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>📚</span> 2. Book / Whole Authored Book (စာအုပ် ကိုးကားချက်)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50">
                    Textual Works → Books &amp; Reference Works
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0c1426] border border-slate-800/80 text-[11px] text-slate-300 font-mono">
                  <span className="text-slate-400 block text-[10px] mb-1">Standard Format Formula:</span>
                  Author, A. A. (Year). <em>Title of work: Capital letter also for subtitle</em> (Edition if applicable). Publisher Name. https://doi.org/xxxx
                </div>

                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Official APA 7th Examples (Authored Book with DOI &amp; Print Book):</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const ex = 'Jackson, L. M. (2019). The psychology of prejudice: From attitudes to social action (2nd ed.). American Psychological Association. https://doi.org/10.1037/0000168-000';
                          navigator.clipboard.writeText(ex);
                          setCopiedCheatId('book');
                          setTimeout(() => setCopiedCheatId(null), 1800);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-semibold"
                      >
                        {copiedCheatId === 'book' ? '✓ Copied' : '📋 Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ex = 'Jackson, L. M. (2019). The psychology of prejudice: From attitudes to social action (2nd ed.). American Psychological Association. https://doi.org/10.1037/0000168-000';
                          setReferencesContent(prev => prev.trim() ? `${prev.trim()}\n${ex}` : ex);
                          setShowCheatSheetModal(false);
                        }}
                        className="px-2 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-[10px] text-indigo-200 font-semibold"
                      >
                        + Paste to References
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-100 font-serif leading-relaxed pl-6 -indent-6">
                    Jackson, L. M. (2019). <em>The psychology of prejudice: From attitudes to social action</em> (2nd ed.). American Psychological Association. <span className="text-blue-400 underline">https://doi.org/10.1037/0000168-000</span>
                  </p>
                  <p className="text-xs text-slate-100 font-serif leading-relaxed pl-6 -indent-6 border-t border-slate-800/80 pt-1.5">
                    Burgess, R. (2019). <em>Rethinking global health: Frameworks of power</em>. Routledge.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-4 text-[11px] text-slate-400 font-mono">
                    <span>• <strong>Parenthetical citation:</strong> (Jackson, 2019; Burgess, 2019)</span>
                    <span>• <strong>Narrative citation:</strong> Jackson (2019) and Burgess (2019)</span>
                  </div>
                </div>
              </div>

              {/* 3. WEBSITE / WEBPAGE ON A WEBSITE */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>🌐</span> 3. Webpage on a Website (ဝက်ဘ်ဆိုဒ် နှင့် အဖွဲ့အစည်း ဆောင်းပါး)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                    Online Media → Webpages and Websites
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0c1426] border border-slate-800/80 text-[11px] text-slate-300 font-mono">
                  <span className="text-slate-400 block text-[10px] mb-1">Standard Format Formula:</span>
                  Author, A. A. / Group Name. (Year, Month Day). <em>Title of work on webpage</em>. Site Name. https://xxxxxx
                </div>

                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Official APA 7th Examples (Individual Author &amp; Group/Org Author):</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const ex = 'World Health Organization. (2018, May 24). The top 10 causes of death. https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death';
                          navigator.clipboard.writeText(ex);
                          setCopiedCheatId('website');
                          setTimeout(() => setCopiedCheatId(null), 1800);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-semibold"
                      >
                        {copiedCheatId === 'website' ? '✓ Copied' : '📋 Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ex = 'World Health Organization. (2018, May 24). The top 10 causes of death. https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death';
                          setReferencesContent(prev => prev.trim() ? `${prev.trim()}\n${ex}` : ex);
                          setShowCheatSheetModal(false);
                        }}
                        className="px-2 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-[10px] text-indigo-200 font-semibold"
                      >
                        + Paste to References
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-100 font-serif leading-relaxed pl-6 -indent-6">
                    Bologna, C. (2019, October 31). <em>Why some people with anxiety love watching horror movies</em>. HuffPost. <span className="text-blue-400 underline">https://www.huffpost.com/entry/anxiety-love-watching-horror-movies_l_5d277587e4b02a5a5d57b59e</span>
                  </p>
                  <p className="text-xs text-slate-100 font-serif leading-relaxed pl-6 -indent-6 border-t border-slate-800/80 pt-1.5">
                    World Health Organization. (2018, May 24). <em>The top 10 causes of death</em>. <span className="text-blue-400 underline">https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death</span>
                  </p>
                  <div className="pt-1 flex flex-wrap gap-4 text-[11px] text-slate-400 font-mono">
                    <span>• <strong>Parenthetical citation:</strong> (Bologna, 2019; World Health Organization, 2018)</span>
                    <span>• <strong>Narrative citation:</strong> Bologna (2019) and World Health Organization (2018)</span>
                  </div>
                </div>
              </div>

              {/* Formatting Reminder Footer */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200 leading-relaxed">
                💡 <strong>APA 7th Formatting Tips:</strong> Reference တစ်ခုချင်းစီကို လိုင်းသစ် (New Line) တစ်ကြောင်းစီဖြင့် ထည့်သွင်းပါ။ Word (.docx) ထုတ်ယူသည့်အခါ အက္ခရာစဉ် (A–Z)၊ <strong>0.5" Hanging Indent</strong> နှင့် <strong>Clickable Blue Hyperlink</strong> များကို စနစ်မှ အလိုအလျောက် ပြုလုပ်ပေးပါမည်။
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
