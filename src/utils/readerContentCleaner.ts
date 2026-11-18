/**
 * Clean Academic Content Extractor, Anti-Bot Detector & Safe Reader HTML Renderer
 * - Strips redundant tracking URL parameters
 * - Detects Cloudflare / anti-bot challenge responses
 * - Preserves article titles, headings, core paragraphs, educational diagrams/images, and structured data tables
 * - Strips navigation menus, sidebars, header/footer boilerplate, cookie banners, and raw TOC link clusters
 */

import { getHighlightedHtml } from './smartHighlighter';

export interface ReaderHeadingItem {
  level: number;
  title: string;
  id: string;
}

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'igshid',
  'ref',
  'ref_src',
  'ref_url',
  'via',
  'cmpid',
  's_kwcid',
]);

/**
 * Removes redundant tracking/session parameters from a URL while preserving core academic identifiers.
 */
export function stripTrackingParams(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_val, key) => {
      if (TRACKING_QUERY_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((k) => parsed.searchParams.delete(k));
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Detects Cloudflare / Turnstile / Anti-Bot verification pages so they are never shown as article text.
 */
export function isSecurityChallengeText(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000).toLowerCase();
  const challengeMarkers = [
    'performing security verification',
    'verifying you are human',
    'just a moment...',
    'checking your browser before accessing',
    'attention required! | cloudflare',
    'enable javascript and cookies to continue',
    'cf-browser-verification',
    'challenge-platform',
    'cloudflare ray id',
    'why do i have to complete a captcha',
    'ddos protection by cloudflare',
    'verify you are human by completing the action',
    'security check to access',
  ];

  const hasMarker = challengeMarkers.some((marker) => sample.includes(marker));
  if (!hasMarker) return false;

  // If the whole payload is short or dominated by challenge copy, it's definitely a bot wall
  return text.trim().length < 5000 || sample.includes('cloudflare') || sample.includes('performing security verification');
}

const BOILERPLATE_LINE_PATTERNS: RegExp[] = [
  /^(skip to main content|skip to content|skip to navigation|skip to footer|back to top|jump to content)$/i,
  /^(accept all cookies|accept cookies|reject all|manage cookies|cookie preferences|cookie policy|we use cookies|privacy preference center)/i,
  /^(sign in|log in|register|subscribe|create account|my account|institutional login|access by|get access|purchase pdf|buy article)/i,
  /^(share this article|share|tweet|email|print|cite|export citation|metrics|altmetric|permissions|reprints and permissions|request permissions)/i,
  /^(menu|search|close|open menu|navigation|breadcrumbs?|table of contents|contents|related articles|recommended articles|you may also like|further reading|advertisements?)$/i,
  /^(copyright\s*©|©\s*\d{4}|all rights reserved|terms of use|terms and conditions|privacy policy|accessibility statement)/i,
  /^(previous article|next article|previous section|next section|previous|next)$/i,
  /^ncbi\s+logo$/i,
  /^openstax\s+rice\s+university/i,
  /^(loading|please wait)\.{0,3}$/i,
];

const NON_EDUCATIONAL_IMAGE_PATTERNS: RegExp[] = [
  /logo/i,
  /icon/i,
  /favicon/i,
  /avatar/i,
  /badge/i,
  /spinner/i,
  /pixel/i,
  /tracker/i,
  /analytics/i,
  /doubleclick/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /linkedin\.com/i,
  /instagram\.com/i,
  /youtube\.com/i,
  /creativecommons\.org\/images/i,
  /orcid/i,
  /crossref/i,
  /altmetric/i,
  /sprite/i,
  /1x1\./i,
  /spacer\./i,
];

function isPureLinkNavLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Bullet or plain line that is ONLY a short markdown link e.g. "* [Home](https://...)" or "[Skip](https://...)"
  const strippedBullet = trimmed.replace(/^[-*•]\s+/, '').trim();
  if (/^\[([^\]]{1,80})\]\([^)]+\)$/.test(strippedBullet)) {
    return true;
  }
  // Line consisting of multiple nav links separated by | or /
  if (/^(\[[^\]]+\]\([^)]+\)\s*[|/•·]\s*){2,}/.test(strippedBullet)) {
    return true;
  }
  return false;
}

/**
 * Cleans extracted markdown/text to preserve titles, headings, prose, educational diagrams/images,
 * and markdown tables while stripping navigation menus, raw TOC link lists, cookie banners, and boilerplate.
 */
export function cleanAcademicMarkdown(rawText: string, sourceUrl?: string): { title: string; body: string } {
  if (!rawText || typeof rawText !== 'string') {
    return { title: '', body: '' };
  }

  let working = rawText.replace(/\r\n/g, '\n');

  // Extract Jina metadata title if present, then strip Jina wrapper lines
  let extractedTitle = '';
  const titleMatch = working.match(/^Title:\s*(.+)$/im);
  if (titleMatch && titleMatch[1]) {
    extractedTitle = titleMatch[1].trim();
  }

  working = working
    .replace(/^Title:\s*.*$/gim, '')
    .replace(/^URL Source:\s*.*$/gim, '')
    .replace(/^Published Time:\s*.*$/gim, '')
    .replace(/^Markdown Content:\s*$/gim, '')
    .replace(/^Warning:\s*.*$/gim, '');

  // Clean tracking query params in markdown links & images
  working = working.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (_m, prefix, url, suffix) => {
    const clean = stripTrackingParams(url);
    return `${prefix}${clean}${suffix}`;
  });

  const rawLines = working.split('\n');
  const filteredLines: string[] = [];

  // Track consecutive pure-link lines to remove raw TOC/navigation link clusters (3+ consecutive link lines)
  let linkClusterBuffer: string[] = [];

  const flushLinkCluster = () => {
    if (linkClusterBuffer.length > 0 && linkClusterBuffer.length <= 2) {
      // Short inline reference links can remain if not nav boilerplate
      for (const l of linkClusterBuffer) {
        if (!BOILERPLATE_LINE_PATTERNS.some((p) => p.test(l.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()))) {
          filteredLines.push(l);
        }
      }
    }
    // Clusters of 3+ bare link lines are navigation menus / raw TOCs -> drop them
    linkClusterBuffer = [];
  };

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushLinkCluster();
      filteredLines.push('');
      continue;
    }

    // Filter non-educational images (logos, social icons, tracking pixels) while keeping diagrams/figures
    const imgOnlyMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (imgOnlyMatch) {
      const alt = imgOnlyMatch[1] || '';
      const imgUrl = imgOnlyMatch[2] || '';
      if (
        !/^https?:\/\//i.test(imgUrl) ||
        NON_EDUCATIONAL_IMAGE_PATTERNS.some((rx) => rx.test(imgUrl) || rx.test(alt))
      ) {
        continue;
      }
      flushLinkCluster();
      filteredLines.push(`![${alt || 'Academic Figure'}](${stripTrackingParams(imgUrl)})`);
      continue;
    }

    // Remove inline markdown images that are icons/logos inside text lines
    let line = rawLine.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (full, alt, imgUrl) => {
      if (
        !/^https?:\/\//i.test(imgUrl) ||
        NON_EDUCATIONAL_IMAGE_PATTERNS.some((rx) => rx.test(imgUrl) || rx.test(alt))
      ) {
        return '';
      }
      return full;
    });

    const cleanCheck = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`#]/g, '').trim();
    if (!cleanCheck && !trimmed.startsWith('![')) {
      continue;
    }

    if (BOILERPLATE_LINE_PATTERNS.some((rx) => rx.test(cleanCheck))) {
      continue;
    }

    // Keep markdown tables intact
    if (/^\|.*\|$/.test(trimmed)) {
      flushLinkCluster();
      filteredLines.push(line);
      continue;
    }

    // Buffer pure link lines to detect and strip nav menus / raw TOC link blocks
    if (isPureLinkNavLine(trimmed)) {
      linkClusterBuffer.push(line);
      continue;
    }

    flushLinkCluster();

    // Strip redundant inline markdown links to just readable text for distraction-free reading
    // (preserving image syntax ![...](...) and headings)
    const proseLine = line.replace(/(?<!!)\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
    filteredLines.push(proseLine);
  }
  flushLinkCluster();

  let cleanedBody = filteredLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If title wasn't in metadata, try first H1 heading
  if (!extractedTitle) {
    const h1Match = cleanedBody.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      extractedTitle = h1Match[1].trim();
    } else if (sourceUrl) {
      try {
        const u = new URL(sourceUrl);
        extractedTitle = u.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || u.hostname;
      } catch {
        extractedTitle = 'Academic Article';
      }
    }
  }

  return {
    title: extractedTitle.replace(/\s+/g, ' ').trim(),
    body: cleanedBody,
  };
}

/**
 * Extracts real headings (#, ##, ###) from cleaned academic markdown to build an accurate TOC.
 */
export function extractHeadingsFromMarkdown(markdown: string): ReaderHeadingItem[] {
  if (!markdown) return [];
  const headings: ReaderHeadingItem[] = [];
  const seenIds = new Set<string>();
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.trim().match(/^(#{1,3})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const rawTitle = match[2].replace(/[*_`]/g, '').trim();
    if (!rawTitle || rawTitle.length < 3 || rawTitle.length > 140) continue;
    if (BOILERPLATE_LINE_PATTERNS.some((rx) => rx.test(rawTitle))) continue;

    let baseId =
      'reader-sec-' +
      rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
    if (!baseId || baseId === 'reader-sec-') baseId = `reader-sec-${headings.length + 1}`;
    let finalId = baseId;
    let suffix = 2;
    while (seenIds.has(finalId)) {
      finalId = `${baseId}-${suffix++}`;
    }
    seenIds.add(finalId);
    headings.push({ level, title: rawTitle, id: finalId });
  }

  return headings;
}

/**
 * Browser Readability-style HTML -> Clean Academic Markdown converter (defensive DOMParser fallback).
 */
export function extractReadableArticleFromHtml(html: string, baseUrl?: string): { title: string; body: string } {
  if (!html || typeof html !== 'string') return { title: '', body: '' };

  if (typeof DOMParser === 'undefined') {
    const stripped = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleanAcademicMarkdown(stripped, baseUrl);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const title =
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.querySelector('title')?.textContent?.trim() ||
      '';

    const removeSelectors = [
      'script',
      'style',
      'noscript',
      'iframe',
      'svg',
      'nav',
      'header',
      'footer',
      'aside',
      '.nav',
      '.navbar',
      '.menu',
      '.sidebar',
      '.toc',
      '.table-of-contents',
      '.cookie-banner',
      '.cookies',
      '#cookie-banner',
      '.advertisement',
      '.ads',
      '.social-share',
      '.breadcrumbs',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[aria-hidden="true"]',
    ];
    removeSelectors.forEach((sel) => {
      try {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {
        // Ignore invalid selector
      }
    });

    const root =
      doc.querySelector('article') ||
      doc.querySelector('main') ||
      doc.querySelector('[role="main"]') ||
      doc.querySelector('#main-content') ||
      doc.querySelector('.article-body') ||
      doc.body;

    if (!root) return { title, body: '' };

    const resolveUrl = (src: string): string => {
      try {
        return baseUrl ? new URL(src, baseUrl).toString() : src;
      } catch {
        return src;
      }
    };

    const chunks: string[] = [];
    const walk = (node: Element) => {
      const tag = node.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) {
          const hashes = tag === 'h1' ? '#' : tag === 'h2' ? '##' : '###';
          chunks.push(`\n${hashes} ${text}\n`);
        }
        return;
      }
      if (tag === 'p' || tag === 'blockquote') {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) {
          chunks.push(tag === 'blockquote' ? `> ${text}\n` : `${text}\n`);
        }
        return;
      }
      if (tag === 'li') {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) chunks.push(`- ${text}`);
        return;
      }
      if (tag === 'img') {
        const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
        const alt = (node.getAttribute('alt') || 'Educational Figure').replace(/\s+/g, ' ').trim();
        if (src) {
          const abs = stripTrackingParams(resolveUrl(src));
          if (/^https?:\/\//i.test(abs) && !NON_EDUCATIONAL_IMAGE_PATTERNS.some((rx) => rx.test(abs) || rx.test(alt))) {
            chunks.push(`\n![${alt}](${abs})\n`);
          }
        }
        return;
      }
      if (tag === 'table') {
        const rows: string[][] = [];
        node.querySelectorAll('tr').forEach((tr) => {
          const cells: string[] = [];
          tr.querySelectorAll('th, td').forEach((cell) => {
            cells.push((cell.textContent || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim());
          });
          if (cells.length > 0 && cells.some(Boolean)) rows.push(cells);
        });
        if (rows.length > 0) {
          const colCount = Math.max(...rows.map((r) => r.length));
          const normalized = rows.map((r) => {
            const padded = [...r];
            while (padded.length < colCount) padded.push('');
            return `| ${padded.join(' | ')} |`;
          });
          const sep = `| ${Array(colCount).fill('---').join(' | ')} |`;
          chunks.push('\n' + [normalized[0], sep, ...normalized.slice(1)].join('\n') + '\n');
        }
        return;
      }
      Array.from(node.children).forEach((child) => walk(child));
    };

    walk(root);
    const rawMd = chunks.join('\n');
    const cleaned = cleanAcademicMarkdown(rawMd, baseUrl);
    return {
      title: cleaned.title || title,
      body: cleaned.body,
    };
  } catch {
    return { title: '', body: '' };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyInlineFormatting(escapedLine: string, enableHighlight: boolean, theme: 'dark' | 'sepia' | 'light'): string {
  const boldClass =
    theme === 'dark'
      ? 'font-bold text-amber-300'
      : theme === 'sepia'
      ? 'font-bold text-[#6b3e12]'
      : 'font-bold text-slate-900';

  const applyHighlight = (text: string) => {
    if (!enableHighlight) return text;
    // Highlight text safely without touching already-escaped HTML tags
    return getHighlightedHtml(text);
  };

  // Format **bold** and `code` cleanly
  const segments = escapedLine.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return segments
    .map((seg) => {
      if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
        return `<strong class="${boldClass}">${seg.slice(2, -2)}</strong>`;
      }
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
        return `<code class="px-1.5 py-0.5 rounded bg-slate-800/40 font-mono text-[0.9em]">${seg.slice(1, -1)}</code>`;
      }
      return applyHighlight(seg);
    })
    .join('');
}

/**
 * Safely renders cleaned academic Markdown (headings, paragraphs, tables, educational diagrams/images, lists)
 * into distraction-free HTML compatible with Dark, Sepia, and Light themes.
 */
export function renderAcademicReaderHtml(
  body: string,
  enableHighlight: boolean,
  theme: 'dark' | 'sepia' | 'light' = 'dark'
): string {
  if (!body || typeof body !== 'string') return '';

  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  const seenIds = new Set<string>();

  const h2Class =
    theme === 'dark'
      ? 'text-xl font-bold font-sans text-emerald-400 mt-7 mb-2.5'
      : theme === 'sepia'
      ? 'text-xl font-bold font-sans text-[#4a3518] mt-7 mb-2.5'
      : 'text-xl font-bold font-sans text-emerald-700 mt-7 mb-2.5';

  const h3Class =
    theme === 'dark'
      ? 'text-lg font-bold font-sans text-indigo-400 mt-5 mb-2 border-b border-slate-800/50 pb-1'
      : theme === 'sepia'
      ? 'text-lg font-bold font-sans text-[#6b4423] mt-5 mb-2 border-b border-[#d9c39e] pb-1'
      : 'text-lg font-bold font-sans text-indigo-700 mt-5 mb-2 border-b border-slate-200 pb-1';

  const tableBorder =
    theme === 'dark'
      ? 'border-slate-700'
      : theme === 'sepia'
      ? 'border-[#d6be96]'
      : 'border-slate-300';

  const tableHeaderBg =
    theme === 'dark'
      ? 'bg-slate-900 text-emerald-300'
      : theme === 'sepia'
      ? 'bg-[#efe0c1] text-[#3d2b14]'
      : 'bg-slate-100 text-slate-900';

  const makeHeadingId = (title: string, idx: number) => {
    let baseId =
      'reader-sec-' +
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
    if (!baseId || baseId === 'reader-sec-') baseId = `reader-sec-${idx}`;
    let finalId = baseId;
    let suffix = 2;
    while (seenIds.has(finalId)) {
      finalId = `${baseId}-${suffix++}`;
    }
    seenIds.add(finalId);
    return finalId;
  };

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Markdown Table Block
    if (/^\|.*\|$/.test(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const parsedRows = tableLines
        .filter((tl) => !/^\|[\s:|-]+\|$/.test(tl))
        .map((tl) =>
          tl
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim())
        );

      if (parsedRows.length > 0) {
        const headerRow = parsedRows[0];
        const bodyRows = parsedRows.slice(1);
        const thHtml = headerRow
          .map((cell) => `<th class="px-3 py-2 text-left font-sans text-xs font-bold border ${tableBorder}">${escapeHtml(cell)}</th>`)
          .join('');
        const trHtml = bodyRows
          .map((row) => {
            const tds = row
              .map(
                (cell) =>
                  `<td class="px-3 py-2 text-xs font-sans border ${tableBorder}">${applyInlineFormatting(escapeHtml(cell), enableHighlight, theme)}</td>`
              )
              .join('');
            return `<tr>${tds}</tr>`;
          })
          .join('');
        htmlParts.push(
          `<div class="my-5 overflow-x-auto rounded-xl border ${tableBorder}"><table class="w-full border-collapse"><thead><tr class="${tableHeaderBg}">${thHtml}</tr></thead><tbody>${trHtml}</tbody></table></div>`
        );
      }
      continue;
    }

    // 2. Educational Diagram / Image
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (imgMatch) {
      const alt = escapeHtml(imgMatch[1] || 'Educational Figure');
      const src = escapeHtml(stripTrackingParams(imgMatch[2]));
      if (/^https?:\/\//i.test(imgMatch[2])) {
        htmlParts.push(
          `<figure class="my-5 rounded-2xl overflow-hidden border ${tableBorder} p-3 bg-black/10 text-center"><img src="${src}" alt="${alt}" loading="lazy" onerror="this.closest('figure').style.display='none'" class="max-h-96 mx-auto rounded-lg object-contain" /><figcaption class="mt-2 text-xs font-sans opacity-75">${alt}</figcaption></figure>`
        );
      }
      i++;
      continue;
    }

    // 3. Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawTitle = headingMatch[2].replace(/[*_`]/g, '').trim();
      const id = makeHeadingId(rawTitle, i);
      const cls = level <= 2 ? h2Class : h3Class;
      const tag = level === 1 ? 'h2' : level === 2 ? 'h2' : 'h3';
      htmlParts.push(`<${tag} id="${id}" class="${cls}">${escapeHtml(rawTitle)}</${tag}>`);
      i++;
      continue;
    }

    // 4. Bullet / Numbered List Block
    if (/^([-*•]|\d+\.)\s+/.test(trimmed)) {
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      const listItems: string[] = [];
      while (i < lines.length && /^([-*•]|\d+\.)\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^([-*•]|\d+\.)\s+/, '');
        listItems.push(`<li>${applyInlineFormatting(escapeHtml(itemText), enableHighlight, theme)}</li>`);
        i++;
      }
      const listTag = isOrdered ? 'ol' : 'ul';
      const listCls = isOrdered ? 'list-decimal pl-6 my-3 space-y-1.5' : 'list-disc pl-6 my-3 space-y-1.5';
      htmlParts.push(`<${listTag} class="${listCls}">${listItems.join('')}</${listTag}>`);
      continue;
    }

    // 5. Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.replace(/^>\s+/, '');
      htmlParts.push(
        `<blockquote class="my-4 pl-4 border-l-4 border-emerald-500/60 italic opacity-90">${applyInlineFormatting(escapeHtml(quoteText), enableHighlight, theme)}</blockquote>`
      );
      i++;
      continue;
    }

    // 6. Standard Paragraph
    htmlParts.push(`<p class="my-3">${applyInlineFormatting(escapeHtml(trimmed), enableHighlight, theme)}</p>`);
    i++;
  }

  return htmlParts.join('\n');
}
