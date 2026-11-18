import {
  cleanAcademicMarkdown,
  extractReadableArticleFromHtml,
  isSecurityChallengeText,
  stripTrackingParams,
} from '../utils/readerContentCleaner';

export interface TextbookLoadResult {
  type: 'pdf' | 'html';
  arrayBuffer?: ArrayBuffer;
  htmlContent?: string;
  title: string;
  sourceUrl: string;
}

async function fetchPdfArrayBuffer(url: string): Promise<ArrayBuffer> {
  try {
    const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength < 64) {
      throw new Error('Empty PDF response received.');
    }
    return arrayBuffer;
  } catch (e: any) {
    const fallbackRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!fallbackRes.ok) throw new Error(`Failed to load PDF via proxy: ${e?.message || 'Network error'}`);
    return await fallbackRes.arrayBuffer();
  }
}

export async function loadTextbookSource(inputUrl: string): Promise<TextbookLoadResult> {
  let url = stripTrackingParams((inputUrl || '').trim());
  if (!url) {
    throw new Error('Please enter a valid textbook PDF or Open Access article URL.');
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Smart OpenStax Resolver & Details Page Auto-Conversion
  if (url.includes('openstax.org/details/books/')) {
    const slugMatch = url.match(/\/books\/([^\/]+)/);
    if (slugMatch && slugMatch[1]) {
      const slug = slugMatch[1];
      if (slug === 'college-algebra-2e') {
        url = `https://openstax.org/books/college-algebra-2e/pages/1-introduction-to-prerequisites`;
      } else if (slug === 'principles-financial-accounting') {
        url = `https://openstax.org/books/principles-financial-accounting/pages/1-why-it-matters`;
      } else {
        url = `https://openstax.org/books/${slug}/pages/1-introduction-to-prerequisites`;
      }
    }
  }

  // Check if direct PDF
  const isPdfExtension = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');

  if (isPdfExtension) {
    const arrayBuffer = await fetchPdfArrayBuffer(url);
    return {
      type: 'pdf',
      arrayBuffer,
      title: url.split('/').pop() || 'Textbook PDF',
      sourceUrl: url,
    };
  }

  // 1. Primary: Server-Side Automated Security-Check Bypass & Clean Extraction (/api/reader/extract)
  try {
    const extractRes = await fetch(`/api/reader/extract?url=${encodeURIComponent(url)}`);
    if (extractRes.ok) {
      const data = await extractRes.json();
      if (data?.type === 'pdf') {
        const arrayBuffer = await fetchPdfArrayBuffer(data.sourceUrl || url);
        return {
          type: 'pdf',
          arrayBuffer,
          title: data.title || url.split('/').pop() || 'Textbook PDF',
          sourceUrl: data.sourceUrl || url,
        };
      }
      if (data?.content && !isSecurityChallengeText(data.content)) {
        const cleaned = cleanAcademicMarkdown(data.content, url);
        if (cleaned.body && cleaned.body.length > 80) {
          return {
            type: 'html',
            htmlContent: cleaned.body,
            title: cleaned.title || data.title || url.split('/').pop() || 'Academic Article',
            sourceUrl: data.sourceUrl || url,
          };
        }
      }
    }
  } catch {
    // Fall through gracefully to client-side extraction tiers
  }

  // 2. Client Fallback A: Automated Jina Reader Bypass (`https://r.jina.ai/...`)
  const jinaEndpoints = [
    `https://r.jina.ai/${encodeURIComponent(url)}`,
    `https://r.jina.ai/${url}`,
  ];
  for (const endpoint of jinaEndpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'text/plain' },
      });
      if (res.ok) {
        const rawText = await res.text();
        if (rawText && !isSecurityChallengeText(rawText)) {
          const cleaned = cleanAcademicMarkdown(rawText, url);
          if (cleaned.body && cleaned.body.length > 80) {
            return {
              type: 'html',
              htmlContent: cleaned.body,
              title: cleaned.title || url.split('/').pop() || 'Academic Article',
              sourceUrl: url,
            };
          }
        }
      }
    } catch {
      // Continue to next attempt
    }
  }

  // 3. Client Fallback B: CORS Proxy + Browser Readability DOM Extractor
  try {
    const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (proxyRes.ok) {
      const htmlText = await proxyRes.text();
      if (htmlText && !isSecurityChallengeText(htmlText)) {
        const extracted = extractReadableArticleFromHtml(htmlText, url);
        if (extracted.body && extracted.body.length > 80) {
          return {
            type: 'html',
            htmlContent: extracted.body,
            title: extracted.title || url.split('/').pop() || 'Academic Article',
            sourceUrl: url,
          };
        }
      }
    }
  } catch {
    // Throw clear error below
  }

  throw new Error(
    'Unable to bypass anti-bot verification or extract readable content from this URL. Try an Open Access link (NCBI/PMC, OpenStax) or upload the PDF directly.'
  );
}
