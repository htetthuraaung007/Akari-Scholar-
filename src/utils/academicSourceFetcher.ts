/**
 * Smart OpenStax Chapter & Section Auto-Crawler & Academic Link Resolver
 * - Parses OpenStax book & section links (`https://openstax.org/books/{slug}/pages/...` or `/details/books/{slug}`)
 * - Resolves full chapter requests (e.g., "Chapter 1" -> sections 1.1..1.8) or single section targets (e.g., "1.2", "3.4")
 * - Crawls and concatenates clean textbook prose via CORS-safe reader proxy (`https://r.jina.ai/...`)
 */

import { stripTextbookNoise } from './textbookStripper';

export interface OpenStaxSlugInfo {
  bookSlug: string; // e.g., "college-algebra-2e"
  baseUrl: string;  // e.g., "https://openstax.org/books/college-algebra-2e/pages"
}

export interface NormalizedAcademicUrl {
  originalUrl: string;
  normalizedUrl: string;
  bookSlug?: string;
  wasDetailLink: boolean;
}

export function parseOpenStaxUrl(url: string): OpenStaxSlugInfo | null {
  const trimmed = (url || '').trim();
  const match =
    trimmed.match(/openstax\.org\/books\/([^/?#]+)/i) ||
    trimmed.match(/openstax\.org\/details\/books\/([^/?#]+)/i);
  if (!match || !match[1]) return null;
  const slug = match[1].toLowerCase();
  return {
    bookSlug: slug,
    baseUrl: `https://openstax.org/books/${slug}/pages`,
  };
}

/**
 * Normalizes user input into targeted section numbers.
 * e.g., "Chapter 1" -> ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8"]
 * e.g., "1.2" or "Section 1.2" -> ["1-2"]
 * e.g., "3.4" -> ["3-4"]
 */
export function resolveTargetSections(input: string): string[] {
  const clean = (input || '').trim().toLowerCase();
  if (!clean) return [];

  // Specific single section matching: e.g., "1.2" or "3.4" or "section 1.2"
  const singleMatch = clean.match(/(\d+)[.-](\d+)/);
  if (singleMatch && !clean.includes('chapter')) {
    return [`${singleMatch[1]}-${singleMatch[2]}`];
  }

  // Full chapter matching: e.g., "chapter 1" or "ch 1" or "1"
  const chapterMatch = clean.match(/(?:chapter|ch|unit)\s*(\d+)/i) || clean.match(/^(\d+)$/);
  if (chapterMatch) {
    const chNum = chapterMatch[1];
    // Generate common section range for that chapter (up to 8 sections)
    return Array.from({ length: 8 }, (_, i) => `${chNum}-${i + 1}`);
  }

  return [];
}

/**
 * Normalizes OpenStax detail links or bare DOIs for UI display and ingestion
 */
export function normalizeAcademicSourceUrl(
  rawUrl: string,
  chapterFilter?: string
): NormalizedAcademicUrl {
  const trimmed = (rawUrl || '').trim();
  const isDetail = /openstax\.org\/details\/books\//i.test(trimmed);
  const bookInfo = parseOpenStaxUrl(trimmed);

  if (bookInfo && isDetail) {
    const targetSecs = chapterFilter ? resolveTargetSections(chapterFilter) : [];
    const firstPage = targetSecs.length > 0 ? targetSecs[0] : '1-introduction';
    return {
      originalUrl: trimmed,
      normalizedUrl: `${bookInfo.baseUrl}/${firstPage}`,
      bookSlug: bookInfo.bookSlug,
      wasDetailLink: true,
    };
  }

  if (/^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(trimmed)) {
    return {
      originalUrl: trimmed,
      normalizedUrl: `https://doi.org/${trimmed}`,
      wasDetailLink: false,
    };
  }

  return {
    originalUrl: trimmed,
    normalizedUrl: trimmed,
    bookSlug: bookInfo?.bookSlug,
    wasDetailLink: false,
  };
}

function cleanReaderMarkdown(rawText: string): string {
  let text = rawText || '';
  text = text
    .replace(/^Title:.*$/gim, '')
    .replace(/^URL Source:.*$/gim, '')
    .replace(/^Markdown Content:\s*/gim, '')
    .replace(/Navigation[\s\S]*?Table of contents/gi, '');
  return stripTextbookNoise(text).trim();
}

/**
 * Extracts full OpenStax section URLs from a fetched page's Table of Contents
 * when available (e.g. maps "1-2" -> "https://openstax.org/books/college-algebra-2e/pages/1-2-exponents-and-scientific-notation")
 */
function findMatchingTocUrls(
  rawMarkdown: string,
  bookSlug: string,
  sectionPrefixes: string[]
): Map<string, string> {
  const map = new Map<string, string>();
  const escapedSlug = bookSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(
    `https?:\\/\\/openstax\\.org\\/books\\/${escapedSlug}\\/pages\\/(([0-9]+-[0-9]+)[a-z0-9-]*)`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(rawMarkdown)) !== null) {
    const fullPageUrl = match[0];
    const secPrefix = match[2]; // e.g. "1-2"
    if (sectionPrefixes.includes(secPrefix) && !map.has(secPrefix)) {
      map.set(secPrefix, fullPageUrl);
    }
  }
  return map;
}

export async function fetchCleanOpenStaxContent(
  rawUrl: string,
  chapterFilter?: string
): Promise<string> {
  const trimmedUrl = (rawUrl || '').trim();
  const bookInfo = parseOpenStaxUrl(trimmedUrl);

  // If not an OpenStax book link or no chapter filter provided, fall back to single-page reader
  if (!bookInfo || !chapterFilter || !chapterFilter.trim()) {
    const target = bookInfo && /\/details\/books\//i.test(trimmedUrl)
      ? `${bookInfo.baseUrl}/1-introduction`
      : trimmedUrl;
    const directProxy = `https://r.jina.ai/${target}`;
    const res = await fetch(directProxy, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      throw new Error('Link ဖတ်မရပါ။ Reading Notes ထဲသို့ စာသား တိုက်ရိုက်ကူးထည့်ပေးပါ။');
    }
    return cleanReaderMarkdown(await res.text()).substring(0, 15000);
  }

  const sectionsToFetch = resolveTargetSections(chapterFilter);
  if (sectionsToFetch.length === 0) {
    // If input is a text/topic query (not a chapter/section number), fetch base link and filter
    const directProxy = `https://r.jina.ai/${trimmedUrl}`;
    const res = await fetch(directProxy, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      throw new Error('Link ဖတ်မရပါ။ Reading Notes ထဲသို့ စာသား တိုက်ရိုက်ကူးထည့်ပေးပါ။');
    }
    let text = cleanReaderMarkdown(await res.text());
    const escapedScope = chapterFilter.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const topicRegex = new RegExp(`(${escapedScope}[\\s\\S]*?)(?=Chapter\\s+\\d+|$)`, 'i');
    const topicMatch = text.match(topicRegex);
    if (topicMatch && topicMatch[1] && topicMatch[1].trim().length > 200) {
      text = topicMatch[1].trim();
    }
    return text.substring(0, 15000);
  }

  // First, check if we can discover exact section slugs from the seed URL's Table of Contents
  let tocUrlMap = new Map<string, string>();
  try {
    const seedUrl = /\/details\/books\//i.test(trimmedUrl)
      ? `${bookInfo.baseUrl}/1-introduction`
      : trimmedUrl;
    const seedRes = await fetch(`https://r.jina.ai/${seedUrl}`, {
      headers: { Accept: 'text/plain' },
    });
    if (seedRes.ok) {
      const seedRaw = await seedRes.text();
      tocUrlMap = findMatchingTocUrls(seedRaw, bookInfo.bookSlug, sectionsToFetch);
    }
  } catch {
    // Ignore seed discovery error and proceed to direct slug crawling
  }

  // Fetch sections sequentially (capped to avoid rate limits and protect free-tier quotas)
  let concatenatedText = '';
  for (const sec of sectionsToFetch) {
    const resolvedSectionUrl = tocUrlMap.get(sec) || `${bookInfo.baseUrl}/${sec}`;
    const targetUrl = `https://r.jina.ai/${resolvedSectionUrl}`;
    try {
      const res = await fetch(targetUrl, { headers: { Accept: 'text/plain' } });
      if (res.ok) {
        const rawSecText = await res.text();
        const cleanedSecText = cleanReaderMarkdown(rawSecText);
        // Check if page actually exists (not a 404 response inside jina)
        if (
          !rawSecText.includes('404: Not Found') &&
          !rawSecText.includes('Page Not Found') &&
          cleanedSecText.length > 500
        ) {
          concatenatedText +=
            `\n\n--- SECTION ${sec.replace('-', '.')} ---\n\n` + cleanedSecText;
        }
      }
    } catch {
      // Continue to next section if a subsection does not exist (e.g. chapter only has 5 sections)
      continue;
    }

    // Stop crawling if text reaches optimal token threshold
    if (concatenatedText.length > 20000) break;
  }

  if (!concatenatedText.trim()) {
    // Fallback: fetch original raw URL if subsection guessing yielded nothing
    const fallbackRes = await fetch(`https://r.jina.ai/${trimmedUrl}`, {
      headers: { Accept: 'text/plain' },
    });
    if (!fallbackRes.ok) {
      throw new Error('Link ဖတ်မရပါ။ Reading Notes ထဲသို့ စာသား တိုက်ရိုက်ကူးထည့်ပေးပါ။');
    }
    return cleanReaderMarkdown(await fallbackRes.text()).substring(0, 15000);
  }

  return concatenatedText.trim().substring(0, 20000);
}

/**
 * Universal wrapper used across Quiz & Flashcard generators
 */
export async function fetchAcademicUrlText(
  url: string,
  chapterFilter?: string
): Promise<string> {
  return fetchCleanOpenStaxContent(url, chapterFilter);
}
