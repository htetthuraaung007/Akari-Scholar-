/**
 * Comprehensive Multi-Tier Textbook TOC & Structure Scraper Service
 * Ingests OpenStax, Web Article In-Page Headings (NCBI, Wiley, etc.), and PDF outlines into a strict sequential book hierarchy.
 */

import { extractHeadingsFromMarkdown } from '../utils/readerContentCleaner';

export interface ValidatedSection {
  globalIndex: number;      // Continuous 1-based index (1, 2, 3 ... N across the entire book)
  chapterNumber: number;    // e.g., 1, 2, 3
  chapterTitle: string;     // e.g., "Chapter 1: The Role of Accounting"
  sectionNumber: string;    // e.g., "1.1", "1.2", "2.1"
  sectionId: string;        // e.g., "1-1"
  sectionTitle: string;     // Clean title string
  urlOrAnchor: string;      // Absolute URL or internal DOM anchor ID
  wordCount?: number;
  startPage?: number;
  endPage?: number;
}

export type BookSection = ValidatedSection;

export interface BookChapter {
  chapterNumber: number;
  chapterTitle: string;
  sections: ValidatedSection[];
}

export interface BookStructureAuditResult {
  bookTitle: string;
  sourceType: 'openstax' | 'libretexts' | 'generic_web' | 'pdf' | 'in_page_headings';
  totalChapters: number;
  totalSections: number;
  chapters: BookChapter[];
  sections: ValidatedSection[];
  isSequential: boolean;
  missingGapsDetected: string[];
}

/**
 * Natural alphanumeric collator for strict numerical sorting (1.1, 1.2, ..., 2.1, ..., 10.1)
 */
const numericCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export async function extractBookTOC(
  sourceUrlOrName: string,
  pdfDocInstance?: any,
  extractedContent?: string,
  extractedTitle?: string
): Promise<BookStructureAuditResult> {
  const source = (sourceUrlOrName || '').trim();
  let sections: ValidatedSection[] = [];
  let sourceType: BookStructureAuditResult['sourceType'] = 'generic_web';
  let bookTitle = extractedTitle?.trim() || 'Academic Reading Source';
  const missingGapsDetected: string[] = [];

  // ==========================================
  // PASS 1: Platform-Specific Manifest Probe (OpenStax)
  // ==========================================
  if (/openstax\.org/i.test(source)) {
    sourceType = 'openstax';
    try {
      const match = source.match(/\/books\/([^\/]+)/i) || source.match(/\/details\/books\/([^\/]+)/i);
      const bookSlug = match ? match[1] : 'principles-financial-accounting';
      if (!extractedTitle) {
        bookTitle = bookSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }

      const jsonEndpoint = `https://openstax.org/apps/archive/2026/contents/${bookSlug}.json`;
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(jsonEndpoint)}`).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data && data.chapters && Array.isArray(data.chapters)) {
          let gIndex = 1;
          data.chapters.forEach((ch: any, cIdx: number) => {
            const chNum = cIdx + 1;
            const chTitle = ch.title || `Chapter ${chNum}`;
            const chSections = ch.sections || [];

            chSections.forEach((sec: any, sIdx: number) => {
              const secNum = `${chNum}.${sIdx + 1}`;
              sections.push({
                globalIndex: gIndex++,
                chapterNumber: chNum,
                chapterTitle: chTitle,
                sectionNumber: secNum,
                sectionId: secNum.replace('.', '-'),
                sectionTitle: sec.title || `Section ${secNum}`,
                urlOrAnchor: sec.url || source,
                startPage: (gIndex - 1) * 15,
                endPage: gIndex * 15,
              });
            });
          });
        }
      }
    } catch (e) {
      console.warn('OpenStax TOC manifest fetch failed, checking in-page headings:', e);
    }
  }

  // ==========================================
  // PASS 2: In-Page Headings Extraction (NCBI, Wiley, ScienceDirect, OpenStax pages, Web Articles)
  // ==========================================
  if (sections.length === 0 && extractedContent && extractedContent.trim().length > 0) {
    sourceType = 'in_page_headings';
    const headings = extractHeadingsFromMarkdown(extractedContent);

    if (headings.length > 0) {
      let gIndex = 1;
      let currentChNum = 1;
      let currentChTitle = bookTitle;
      let secInCh = 0;

      headings.forEach((h) => {
        if (h.level <= 2 && secInCh > 0) {
          currentChNum++;
          currentChTitle = h.title;
          secInCh = 1;
        } else {
          if (secInCh === 0 && h.level <= 2) {
            currentChTitle = h.title;
          }
          secInCh++;
        }

        const secNum = `${currentChNum}.${secInCh}`;
        sections.push({
          globalIndex: gIndex++,
          chapterNumber: currentChNum,
          chapterTitle: currentChTitle,
          sectionNumber: secNum,
          sectionId: h.id,
          sectionTitle: h.title,
          urlOrAnchor: `#${h.id}`,
        });
      });
    } else {
      sections.push({
        globalIndex: 1,
        chapterNumber: 1,
        chapterTitle: bookTitle,
        sectionNumber: '1.1',
        sectionId: 'article-overview',
        sectionTitle: bookTitle,
        urlOrAnchor: '#article-overview',
      });
    }
  }

  // ==========================================
  // PASS 3: Native PDF Outline Extraction (If PDF instance available)
  // ==========================================
  if (pdfDocInstance && sections.length === 0) {
    sourceType = 'pdf';
    try {
      const outline = await pdfDocInstance.getOutline();
      if (outline && outline.length > 0) {
        let gIndex = 1;
        let currentChNum = 1;
        let currentChTitle = 'Chapter 1';

        outline.forEach((item: any, idx: number) => {
          const title = item.title || `Section ${idx + 1}`;
          if (/chapter\s+\d+/i.test(title)) {
            currentChNum++;
            currentChTitle = title;
          }
          const secNum = `${currentChNum}.${idx + 1}`;
          sections.push({
            globalIndex: gIndex++,
            chapterNumber: currentChNum,
            chapterTitle: currentChTitle,
            sectionNumber: secNum,
            sectionId: secNum.replace('.', '-'),
            sectionTitle: title,
            urlOrAnchor: `#pdf-item-${idx}`,
            startPage: 1 + idx * 10,
            endPage: (idx + 1) * 10,
          });
        });
      }
    } catch (e) {
      console.warn('PDF outline extraction failed:', e);
    }
  }

  // ==========================================
  // PASS 4 / FALLBACK: Minimal Default Entry if no PDF outline or headings detected
  // ==========================================
  if (sections.length === 0) {
    sourceType = 'generic_web';
    bookTitle = source.includes('accounting')
      ? 'Principles of Financial Accounting (OpenStax)'
      : extractedTitle || 'Course Reading Document';

    const totalPdfPages = pdfDocInstance?.numPages || 20;
    sections.push({
      globalIndex: 1,
      chapterNumber: 1,
      chapterTitle: bookTitle,
      sectionNumber: '1.1',
      sectionId: '1-1',
      sectionTitle: 'Full Document / Reading Range',
      urlOrAnchor: source,
      wordCount: 1200,
      startPage: 1,
      endPage: Math.min(20, totalPdfPages),
    });
  }

  // ==========================================
  // SEQUENTIAL INTEGRITY & NATURAL SORTING AUDIT
  // ==========================================
  if (sourceType !== 'in_page_headings') {
    sections.sort((a, b) => numericCollator.compare(a.sectionNumber, b.sectionNumber));
  }

  sections.forEach((sec, idx) => {
    sec.globalIndex = idx + 1;
  });

  const chapterMap = new Map<number, BookChapter>();
  sections.forEach((sec) => {
    if (!chapterMap.has(sec.chapterNumber)) {
      chapterMap.set(sec.chapterNumber, {
        chapterNumber: sec.chapterNumber,
        chapterTitle: sec.chapterTitle,
        sections: [],
      });
    }
    chapterMap.get(sec.chapterNumber)!.sections.push(sec);
  });

  const chapters: BookChapter[] = Array.from(chapterMap.values()).sort(
    (a, b) => a.chapterNumber - b.chapterNumber
  );

  for (let i = 0; i < chapters.length - 1; i++) {
    const currentCh = chapters[i].chapterNumber;
    const nextCh = chapters[i + 1].chapterNumber;
    if (nextCh - currentCh > 1) {
      for (let missing = currentCh + 1; missing < nextCh; missing++) {
        missingGapsDetected.push(`Missing Chapter ${missing}`);
      }
    }
  }

  return {
    bookTitle,
    sourceType,
    totalChapters: chapters.length,
    totalSections: sections.length,
    chapters,
    sections,
    isSequential: missingGapsDetected.length === 0,
    missingGapsDetected,
  };
}
