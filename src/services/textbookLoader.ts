export interface TextbookLoadResult {
  type: 'pdf' | 'html';
  arrayBuffer?: ArrayBuffer;
  htmlContent?: string;
  title: string;
  sourceUrl: string;
}

export async function loadTextbookSource(inputUrl: string): Promise<TextbookLoadResult> {
  let url = inputUrl.trim();

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
    try {
      const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return {
        type: 'pdf',
        arrayBuffer,
        title: url.split('/').pop() || 'Textbook PDF',
        sourceUrl: url,
      };
    } catch (e: any) {
      // Fallback via allorigins
      const fallbackRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      if (!fallbackRes.ok) throw new Error(`Failed to load PDF via proxy: ${e.message}`);
      const arrayBuffer = await fallbackRes.arrayBuffer();
      return {
        type: 'pdf',
        arrayBuffer,
        title: url.split('/').pop() || 'Textbook PDF',
        sourceUrl: url,
      };
    }
  } else {
    // HTML / Web Article Link (OpenStax, Wikipedia, etc.)
    // Use Jina Reader API for clean markdown/text extraction
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const res = await fetch(jinaUrl);
      if (!res.ok) throw new Error(`Jina Reader HTTP ${res.status}`);
      const text = await res.text();
      return {
        type: 'html',
        htmlContent: text,
        title: url.split('/').pop() || 'Web Article',
        sourceUrl: url,
      };
    } catch {
      // Fallback to allorigins HTML fetch
      const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      if (!proxyRes.ok) throw new Error('Failed to fetch web article.');
      const htmlText = await proxyRes.text();
      return {
        type: 'html',
        htmlContent: htmlText,
        title: url.split('/').pop() || 'Web Article',
        sourceUrl: url,
      };
    }
  }
}
