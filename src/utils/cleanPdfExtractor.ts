/**
 * High-Performance Client-Side PDF Text & Table Extractor for Large Textbooks (100-1000 pages)
 * Features:
 * - Chapter & Outline Detection
 * - Page Range Extraction without full memory load
 * - Tabular Data Row Alignment
 * - Header/Footer Boilerplate Stripper
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

try {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker setup fallback:', e);
}

export interface ExtractedChapter {
  title: string;
  startPage: number;
  endPage: number;
}

export interface ExtractedPageResult {
  pageNum: number;
  content: string;
  hasTable: boolean;
}

export interface CleanExtractionResult {
  totalPages: number;
  chapters: ExtractedChapter[];
  extractedRange: { start: number; end: number };
  pages: ExtractedPageResult[];
  fullCleanText: string;
  totalWords: number;
  estimatedReadMins: number;
}

// Load a PDF document from File or ArrayBuffer
export async function loadPdfDoc(data: ArrayBuffer): Promise<any> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    useSystemFonts: true,
  } as any);
  return await loadingTask.promise;
}

// Scan outline bookmarks or scan first 30 pages for Chapter headings
export async function detectChaptersAndOutline(pdfDoc: any): Promise<ExtractedChapter[]> {
  const chapters: ExtractedChapter[] = [];
  const totalPages = pdfDoc.numPages;

  try {
    const outline = await pdfDoc.getOutline();
    if (outline && outline.length > 0) {
      for (let i = 0; i < outline.length; i++) {
        const item = outline[i];
        let pageIndex = 1;
        if (typeof item.dest === 'string') {
          const dest = await pdfDoc.getDestination(item.dest);
          if (dest && dest[0]) {
            const pageRef = dest[0];
            const pageIdx = await pdfDoc.getPageIndex(pageRef);
            pageIndex = pageIdx + 1;
          }
        } else if (Array.isArray(item.dest) && item.dest[0]) {
          const pageIdx = await pdfDoc.getPageIndex(item.dest[0]);
          pageIndex = pageIdx + 1;
        }

        chapters.push({
          title: item.title,
          startPage: pageIndex,
          endPage: totalPages,
        });
      }
    }
  } catch (err) {
    console.warn('PDF outline read skipped:', err);
  }

  // If no PDF outline bookmarks found, scan initial 60 pages for Chapter headings
  if (chapters.length === 0) {
    const scanLimit = Math.min(totalPages, 80);
    const chapterRegex = /^(?:chapter|unit|module|section|part)\s+([0-9ivxlc]+)[:.\s\-—]*(.*)/i;

    for (let p = 1; p <= scanLimit; p++) {
      try {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        for (const item of textContent.items as any[]) {
          const str = (item.str || '').trim();
          if (chapterRegex.test(str) && str.length < 80) {
            chapters.push({
              title: str,
              startPage: p,
              endPage: totalPages,
            });
            break;
          }
        }
      } catch {}
    }
  }

  // Set accurate end pages for chapters
  for (let i = 0; i < chapters.length; i++) {
    if (i < chapters.length - 1) {
      chapters[i].endPage = Math.max(chapters[i].startPage, chapters[i + 1].startPage - 1);
    } else {
      chapters[i].endPage = totalPages;
    }
  }

  return chapters;
}

// Extract a targeted range of pages with table reconstruction and boilerplate stripping
export async function extractTargetedPages(
  pdfDoc: any,
  startPage: number,
  endPage: number,
  onProgress?: (current: number, total: number) => void
): Promise<CleanExtractionResult> {
  const totalPages = pdfDoc.numPages;
  const safeStart = Math.max(1, Math.min(startPage, totalPages));
  const safeEnd = Math.max(safeStart, Math.min(endPage, totalPages));
  const totalToExtract = safeEnd - safeStart + 1;

  const chapters = await detectChaptersAndOutline(pdfDoc);
  const pages: ExtractedPageResult[] = [];
  let combinedCleanText = '';

  for (let pageNum = safeStart; pageNum <= safeEnd; pageNum++) {
    if (onProgress) {
      onProgress(pageNum - safeStart + 1, totalToExtract);
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      if (items.length === 0) continue;

      // Group text items by Y coordinate (rows)
      // Items within 4px Y difference belong to the same visual row
      const rowsMap = new Map<number, any[]>();
      for (const item of items) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 4) * 4; // Quantize Y
        if (!rowsMap.has(y)) rowsMap.set(y, []);
        rowsMap.get(y)!.push(item);
      }

      // Sort rows top-to-bottom (PDF Y goes bottom-to-top, so sort descending)
      const sortedYs = Array.from(rowsMap.keys()).sort((a, b) => b - a);

      const pageLines: string[] = [];
      let pageHasTable = false;

      // Filter out header (top 5% of page) and footer (bottom 5% of page) repetitive boilerplate
      const pageHeight = page.view ? page.view[3] : 800;
      const topCutoff = pageHeight * 0.95;
      const bottomCutoff = pageHeight * 0.05;

      for (const y of sortedYs) {
        // Skip header/footer noise on multi-page extraction
        if (sortedYs.length > 5 && (y > topCutoff || y < bottomCutoff)) {
          // If it looks like a lone page number or header, skip it
          const rowText = rowsMap.get(y)!.map((it) => it.str).join(' ').trim();
          if (/^\d+$/.test(rowText) || /^(openstax|principles|chapter|unit|page)\s+\d+$/i.test(rowText)) {
            continue;
          }
        }

        const rowItems = rowsMap.get(y)!;
        // Sort items left-to-right by X coordinate
        rowItems.sort((a, b) => a.transform[4] - b.transform[4]);

        // Detect if this row looks like a Table row (3+ items with substantial gaps)
        let isTableRow = false;
        if (rowItems.length >= 3) {
          let hasGaps = false;
          for (let i = 0; i < rowItems.length - 1; i++) {
            const gap = rowItems[i + 1].transform[4] - (rowItems[i].transform[4] + rowItems[i].width);
            if (gap > 25) {
              hasGaps = true;
              break;
            }
          }
          if (hasGaps) {
            isTableRow = true;
            pageHasTable = true;
          }
        }

        if (isTableRow) {
          // Format as Markdown table row: | Cell 1 | Cell 2 | Cell 3 |
          const tableCells = rowItems.map((it) => it.str.trim()).filter(Boolean);
          pageLines.push(`| ${tableCells.join(' | ')} |`);
        } else {
          // Normal sentence or heading
          const lineStr = rowItems.map((it) => it.str).join(' ').trim();
          if (lineStr) {
            // Check if font size indicates heading (font height > 14)
            const maxFontSize = Math.max(...rowItems.map((it) => Math.abs(it.transform[0]) || 12));
            if (maxFontSize >= 18) {
              pageLines.push(`\n## ${lineStr}\n`);
            } else if (maxFontSize >= 14) {
              pageLines.push(`\n### ${lineStr}\n`);
            } else {
              pageLines.push(lineStr);
            }
          }
        }
      }

      // Join lines with smart paragraph cohesion
      const pageText = pageLines.join('\n');
      pages.push({
        pageNum,
        content: pageText,
        hasTable: pageHasTable,
      });

      combinedCleanText += `\n\n--- 📖 Page ${pageNum} ---\n\n` + pageText;
    } catch (pageErr) {
      console.warn(`Error extracting page ${pageNum}:`, pageErr);
    }
  }

  // Calculate words and reading time
  const words = combinedCleanText.split(/\s+/).filter(Boolean).length;
  const estimatedReadMins = Math.max(1, Math.round(words / 230)); // 230 words per minute average reading speed

  return {
    totalPages,
    chapters,
    extractedRange: { start: safeStart, end: safeEnd },
    pages,
    fullCleanText: combinedCleanText.trim(),
    totalWords: words,
    estimatedReadMins,
  };
}
