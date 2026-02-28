/**
 * Rate-limited HTTP client for Mozambique Law MCP
 *
 * - 500ms minimum delay between requests (respectful to government servers)
 * - User-Agent header identifying the MCP
 * - PDF detection: fetches binary and extracts text via pdf-parse
 * - Supports multiple sources: ts.gov.mz, africa-laws.org, WIPO, FAOLEX
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> = require('pdf-parse');

const USER_AGENT = 'mozambican-law-mcp/1.0 (https://github.com/Ansvar-Systems/mozambican-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
  isPdf: boolean;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * If the response is a PDF, extracts text content automatically.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  // Detect if the URL points to a PDF
  const isPdfUrl = url.toLowerCase().endsWith('.pdf');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': isPdfUrl
            ? 'application/pdf, */*'
            : 'text/html, application/xhtml+xml, */*',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(120000),
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
      }

      const contentType = response.headers.get('content-type') ?? '';
      const isPdf = isPdfUrl || contentType.includes('application/pdf');

      let body: string;
      if (isPdf && response.status === 200) {
        try {
          const buffer = Buffer.from(await response.arrayBuffer());
          const pdfData = await pdfParse(buffer);
          body = pdfData.text;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`\n  PDF parse warning: ${msg.substring(0, 80)}`);
          body = '';
        }
      } else {
        body = await response.text();
      }

      return {
        status: response.status,
        body,
        contentType,
        url: response.url,
        isPdf,
      };
    } catch (err) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`\n  Fetch error: ${msg.substring(0, 60)}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      // Return a failure result instead of throwing
      return {
        status: 0,
        body: '',
        contentType: '',
        url,
        isPdf: isPdfUrl,
      };
    }
  }

  return {
    status: 0,
    body: '',
    contentType: '',
    url,
    isPdf: isPdfUrl,
  };
}
