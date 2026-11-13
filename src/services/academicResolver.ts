/**
 * Universal Open-Web & 3-Tier Academic Paper Ingestion Engine (`/src/services/academicResolver.ts`)
 * - Eliminates false-positive Paywall alerts on public health, government, and open repositories
 *   (CDC, WHO, NIH, FDA, UNICEF, World Bank, OpenStax, NCBI/PMC, .gov, .edu).
 * - Multi-proxy web content ingestion cascade (r.jina.ai -> allorigins DOM extractor -> server fallback).
 * - 3-Tier DOI resolution (Unpaywall -> Semantic Scholar -> Paywall Guard for closed journals only).
 */

import { fetchCleanOpenStaxContent } from '../utils/academicSourceFetcher';
import { stripTextbookNoise } from '../utils/textbookStripper';

export interface ResolvedAcademicPaper {
  title: string;
  fullText: string;
  sourceType: 'open_access_pdf' | 'open_access_html' | 'paywalled';
  landingUrl?: string;
  isTruncated: boolean;
}

export function cleanDoiString(input: string): string {
  const trimmed = input.trim();
  const doiMatch = trimmed.match(/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i);
  if (doiMatch && doiMatch[1]) {
    return doiMatch[1].replace(/[.,;)]+$/, '');
  }
  return trimmed
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
}

/**
 * PART 1: Public Domain & Open Repository Whitelist
 * URLs from government, global NGO, and institutional repositories are 100% public access
 * and must NEVER trigger a paywall alert.
 */
export function isPublicOpenAccessDomain(url: string): boolean {
  try {
    const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    const hostname = new URL(normalized).hostname.toLowerCase();
    const openPatterns = [
      'cdc.gov',
      'who.int',
      'nih.gov',
      'fda.gov',
      'unicef.org',
      'worldbank.org',
      'openstax.org',
      'ncbi.nlm.nih.gov',
      '.gov',
      '.edu',
    ];
    return openPatterns.some(
      (pattern) => hostname.endsWith(pattern) || hostname.includes(pattern)
    );
  } catch {
    return false;
  }
}

export function sanitizeWebNoise(raw: string): string {
  return stripTextbookNoise(raw)
    .replace(/Share\s+Page[\s\S]*?Print/gi, '')
    .replace(/Facebook\s+Twitter\s+LinkedIn/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .substring(0, 25000)
    .trim();
}

/**
 * Extract PubMed Central ID (e.g. PMC1234567) from URL or raw string
 */
export function extractPmcId(input: string): string | null {
  const match = input.trim().match(/\b(PMC\d{4,12})\b/i);
  return match && match[1] ? match[1].toUpperCase() : null;
}

/**
 * Fetch full text for PubMed Central (PMC) open-access articles
 */
export async function fetchPmcFullText(pmcId: string): Promise<string | null> {
  try {
    // 1. NCBI BioC JSON API for PMC Open Access
    const biocUrl = `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/${encodeURIComponent(
      pmcId
    )}/unicode`;
    const biocRes = await fetch(biocUrl);
    if (biocRes.ok) {
      const data = await biocRes.json();
      const documents = Array.isArray(data) ? data[0]?.documents : data?.documents;
      if (Array.isArray(documents) && documents[0]?.passages) {
        const textBlocks = documents[0].passages
          .map((p: any) => p?.text || '')
          .filter((t: string) => t.trim().length > 0);
        const joined = textBlocks.join('\n\n');
        if (joined.length > 1000) {
          return sanitizeWebNoise(joined);
        }
      }
    }
  } catch {
    // Fall through to PMC reader fetch
  }

  try {
    const pmcArticleUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${pmcId}/`;
    const readerRes = await fetch(`https://r.jina.ai/${pmcArticleUrl}`, {
      headers: { Accept: 'text/plain', 'X-No-Cache': 'true' },
    });
    if (readerRes.ok) {
      const text = await readerRes.text();
      if (text.length > 800 && !text.includes('Cloudflare') && !text.includes('Access Denied')) {
        return sanitizeWebNoise(text);
      }
    }
  } catch {
    // Ignore and return null
  }

  return null;
}

/**
 * PART 2: Resilient Multi-Fallback Text Fetcher for Web & CDC/WHO/.gov
 */
export async function fetchUniversalWebContent(url: string): Promise<string> {
  const cleanUrl = url.trim();

  // Tier A: Fast Markdown Reader Proxy (r.jina.ai)
  try {
    const resA = await fetch(`https://r.jina.ai/${cleanUrl}`, {
      headers: {
        Accept: 'text/plain',
        'X-No-Cache': 'true',
      },
    });
    if (resA.ok) {
      const text = await resA.text();
      if (
        text.length > 800 &&
        !text.includes('Cloudflare') &&
        !text.includes('Access Denied')
      ) {
        return sanitizeWebNoise(text);
      }
    }
  } catch (err) {
    console.warn('Reader proxy A failed, switching to fallback:', err);
  }

  // Tier B: High-resilience CORS Proxy + DOM Text Extractor
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
    const resB = await fetch(proxyUrl);
    if (resB.ok) {
      const htmlText = await resB.text();
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // Strip unwanted UI elements (menus, footers, scripts, sidebars)
        const selectorsToRemove = [
          'script',
          'style',
          'nav',
          'header',
          'footer',
          'aside',
          '.menu',
          '.nav',
          '#footer',
          '.cdc-footer',
          '.who-footer',
        ];
        selectorsToRemove.forEach((sel) => {
          doc.querySelectorAll(sel).forEach((el) => el.remove());
        });

        // Extract main article body (standard across CDC / WHO / .gov)
        const mainContent = doc.querySelector(
          'main, article, #main-content, .syndicate, body'
        );
        const text = mainContent ? mainContent.textContent || '' : '';
        const cleaned = text.replace(/\s+/g, ' ').trim();

        if (cleaned.length > 800) {
          return sanitizeWebNoise(cleaned);
        }
      } else {
        const stripped = htmlText
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (stripped.length > 800) {
          return sanitizeWebNoise(stripped);
        }
      }
    }
  } catch (err) {
    console.warn('Proxy B fallback failed:', err);
  }

  throw new Error(
    'ဝက်ဘ်ဆိုက်စာမျက်နှာကို ဖတ်မရပါ။ ကျေးဇူးပြု၍ စာသားကို ကူးယူပြီး Reading Notes ထဲသို့ တိုက်ရိုက် ထည့်သွင်းပေးပါ။'
  );
}

/**
 * Tier 1 DOI: Unpaywall Open-Access Locator (Zero-Auth)
 */
async function fetchFromUnpaywall(doi: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=scholar@uopeople.internal`
    );
    if (!res.ok) return null;
    const data = await res.json();

    if (data.is_oa && data.best_oa_location) {
      const targetUrl =
        data.best_oa_location.url_for_pdf ||
        data.best_oa_location.url_for_landing_page ||
        data.best_oa_location.url;
      if (targetUrl) {
        const textRes = await fetch(`https://r.jina.ai/${targetUrl}`, {
          headers: { Accept: 'text/plain' },
        });
        if (textRes.ok) {
          const content = sanitizeWebNoise(await textRes.text());
          if (content.length > 1500) return content;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tier 2 DOI: Semantic Scholar Academic Graph Fallback
 */
async function fetchFromSemanticScholar(doi: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(
        doi
      )}?fields=title,abstract,openAccessPdf`
    );
    if (!res.ok) return null;
    const data = await res.json();

    if (data.openAccessPdf?.url) {
      const textRes = await fetch(`https://r.jina.ai/${data.openAccessPdf.url}`, {
        headers: { Accept: 'text/plain' },
      });
      if (textRes.ok) {
        const content = sanitizeWebNoise(await textRes.text());
        if (content.length > 1500) return content;
      }
    }

    if (data.abstract && data.abstract.length > 300) {
      return `TITLE: ${data.title}\n\nABSTRACT:\n${data.abstract}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * PART 3: Restructured Master Academic Source Resolver
 * Public websites (CDC, WHO, NIH, FDA, .gov, .edu, OpenStax, PMC) never fall through to the paywall guard.
 */
export async function resolveAcademicPayload(
  sourceUrlOrDoi: string,
  chapterOrSectionFilter?: string
): Promise<ResolvedAcademicPaper> {
  const trimmed = sourceUrlOrDoi.trim();

  // 1. PubMed Central (PMC) direct API
  const pmcId = extractPmcId(trimmed);
  if (pmcId) {
    const pmcText = await fetchPmcFullText(pmcId);
    if (pmcText) {
      return {
        title: pmcId,
        fullText: pmcText.substring(0, 25000),
        sourceType: 'open_access_html',
        isTruncated: pmcText.length > 25000,
      };
    }
  }

  // 2. Open Public Domain (CDC, WHO, NIH, .gov, .edu, OpenStax) or general web URLs
  const isDoiPattern = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i.test(trimmed);
  const isUrl = /^https?:\/\//i.test(trimmed);

  if (isUrl && !isDoiPattern) {
    // OpenStax multi-section chapter crawler support
    if (/openstax\.org/i.test(trimmed)) {
      try {
        const openStaxText = await fetchCleanOpenStaxContent(trimmed, chapterOrSectionFilter);
        if (openStaxText && openStaxText.length > 100) {
          return {
            title: trimmed,
            fullText: openStaxText.substring(0, 25000),
            sourceType: 'open_access_html',
            isTruncated: openStaxText.length > 25000,
          };
        }
      } catch {
        // Fall through to universal web fetcher below
      }
    }

    try {
      const webText = await fetchUniversalWebContent(trimmed);
      return {
        title: trimmed,
        fullText: webText,
        sourceType: 'open_access_html',
        isTruncated: webText.length > 25000,
      };
    } catch (err: any) {
      // If it is a known open domain, NEVER mark as paywalled
      if (isPublicOpenAccessDomain(trimmed)) {
        throw new Error(
          `အဆိုပါ Link (${trimmed}) မှ စာသားများကို လုံခြုံရေးအရ တိုက်ရိုက်ဆွဲယူမရပါ။ စာသားကို ကူးယူပြီး အောက်ပါ Drop-zone တွင် paste လုပ်ပေးပါ။`
        );
      }
      throw err;
    }
  }

  // 3. Academic DOI Resolution (Unpaywall -> Semantic Scholar -> Paywall Guard)
  if (isDoiPattern) {
    const cleanDoi = cleanDoiString(trimmed);
    const tier1 = await fetchFromUnpaywall(cleanDoi);
    if (tier1) {
      return {
        title: cleanDoi,
        fullText: tier1.substring(0, 25000),
        sourceType: 'open_access_pdf',
        isTruncated: tier1.length > 25000,
      };
    }

    const tier2 = await fetchFromSemanticScholar(cleanDoi);
    if (tier2 && tier2.length > 1500) {
      return {
        title: cleanDoi,
        fullText: tier2.substring(0, 25000),
        sourceType: 'open_access_html',
        isTruncated: tier2.length > 25000,
      };
    }

    // Strict Paywall Guard applies ONLY to genuine academic closed journals
    return {
      title: cleanDoi,
      fullText: tier2 || '',
      sourceType: 'paywalled',
      landingUrl: `https://doi.org/${cleanDoi}`,
      isTruncated: false,
    };
  }

  throw new Error('မှန်ကန်သော DOI သို့မဟုတ် Web Link ထည့်သွင်းပေးပါ။');
}

export interface IngestedPaper {
  id: string;
  doiOrUrl: string;
  title: string;
  authors: string;
  year: string;
  abstract: string;
  source: 'crossref' | 'semanticscholar' | 'europepmc' | 'openalex' | 'manual';
  isFallbackNeeded: boolean;
}

export function extractDoi(input: string): string | null {
  const match = input.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i);
  return match ? match[0] : null;
}

export async function fetchPaperMetadata(doiOrUrl: string): Promise<IngestedPaper> {
  const doi = extractDoi(doiOrUrl);

  if (doi) {
    // 1. Primary: Semantic Scholar Public API
    try {
      const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/${doi}?fields=title,authors,year,abstract`);
      if (res.ok) {
        const data = await res.json();
        if (data.abstract && data.abstract.trim().length > 50) {
          return {
            id: `paper-${Date.now()}`,
            doiOrUrl,
            title: data.title || 'Untitled Academic Paper',
            authors: (data.authors || []).map((a: any) => a.name).join(', ') || 'Unknown Author',
            year: data.year ? data.year.toString() : 'n.d.',
            abstract: data.abstract,
            source: 'semanticscholar',
            isFallbackNeeded: false
          };
        }
      }
    } catch (e) {}

    // 2. Secondary: OpenAlex API
    try {
      const res = await fetch(`https://api.openalex.org/works/https://doi.org/${doi}`);
      if (res.ok) {
        const data = await res.json();
        let reconstructedAbstract = '';
        if (data.abstract_inverted_index) {
          const index = data.abstract_inverted_index;
          const wordsWithPositions: [string, number][] = [];
          Object.keys(index).forEach(word => {
            index[word].forEach((pos: number) => wordsWithPositions.push([word, pos]));
          });
          wordsWithPositions.sort((a, b) => a[1] - b[1]);
          reconstructedAbstract = wordsWithPositions.map(w => w[0]).join(' ');
        }

        if (reconstructedAbstract.length > 50) {
          return {
            id: `paper-${Date.now()}`,
            doiOrUrl,
            title: data.title || 'Untitled Research Study',
            authors: (data.authorships || []).map((a: any) => a.author?.display_name).slice(0, 3).join(', ') || 'Authors',
            year: data.publication_year ? data.publication_year.toString() : 'n.d.',
            abstract: reconstructedAbstract,
            source: 'openalex',
            isFallbackNeeded: false
          };
        }
      }
    } catch (e) {}

    // 3. Tertiary: Crossref Works API
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (res.ok) {
        const data = await res.json();
        const msg = data.message;
        const cleanAbstract = (msg.abstract || '').replace(/<[^>]*>?/gm, '');
        if (cleanAbstract.length > 50) {
          return {
            id: `paper-${Date.now()}`,
            doiOrUrl,
            title: Array.isArray(msg.title) ? msg.title[0] : (msg.title || doi),
            authors: (msg.author || []).map((a: any) => `${a.family || ''} ${a.given || ''}`.trim()).join(', ') || 'Scholarly Authors',
            year: msg.created?.['date-parts']?.[0]?.[0]?.toString() || 'n.d.',
            abstract: cleanAbstract,
            source: 'crossref',
            isFallbackNeeded: false
          };
        }
      }
    } catch (e) {}
  }

  return {
    id: `paper-${Date.now()}`,
    doiOrUrl,
    title: doi ? `DOI: ${doi}` : doiOrUrl,
    authors: 'Target Authors',
    year: '2025/2026',
    abstract: '',
    source: 'manual',
    isFallbackNeeded: true
  };
}
