/**
 * Mozambique Law HTML/Text Parser
 *
 * Parses Mozambican legislation (Portuguese) from HTML pages and PDF-extracted
 * text. Supports content from multiple sources:
 *   - ts.gov.mz (Supreme Court PDFs -- HTML-wrapped or plain text)
 *   - africa-laws.org (HTML pages)
 *   - WIPO Lex (structured HTML)
 *   - FAOLEX (HTML)
 *   - Constitute Project (HTML)
 *
 * Portuguese legal structure conventions:
 *   - Artigo N / Art. N -- individual articles
 *   - Capitulo I / CAPITULO I -- chapter groupings
 *   - Titulo I / TITULO I -- title groupings
 *   - Seccao I / SECCAO I -- section groupings
 *   - Subseccao I -- subsection groupings
 *   - Paragrafo unico / ss -- single paragraph marker
 *   - Alinea a), b), c) -- lettered sub-items
 *   - n.o 1, 2, 3 -- numbered sub-items
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: string;
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/* ---------- HTML Utilities ---------- */

/**
 * Strip HTML tags and decode common entities, normalising whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '--')
    .replace(/&laquo;/g, '"')
    .replace(/&raquo;/g, '"')
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+));/g, (_m, dec, hex) => {
      const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      return String.fromCharCode(code);
    })
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------- Portuguese Date Parsing ---------- */

const PT_MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parsePortugueseDate(dateStr: string): string {
  // "24 de Dezembro de 2019" -> "2019-12-24"
  const match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = removeAccents(match[2].toLowerCase());
    const month = PT_MONTHS[monthName] ?? '01';
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

/* ---------- Article Number Extraction ---------- */

/**
 * Strip ordinal suffixes from article numbers: 1o, 1.o, 1.o -> 1
 */
function stripOrdinal(s: string): string {
  return s.replace(/[.ºªo°]+$/i, '').trim();
}

/**
 * Parse Roman numeral to Arabic number.
 */
function romanToArabic(roman: string): number {
  const map: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };
  let result = 0;
  const upper = roman.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const cur = map[upper[i]] ?? 0;
    const next = i + 1 < upper.length ? (map[upper[i + 1]] ?? 0) : 0;
    result += cur < next ? -cur : cur;
  }
  return result;
}

/* ---------- Structure Detection ---------- */

interface StructuralHeading {
  type: 'titulo' | 'capitulo' | 'seccao' | 'subseccao';
  number: string;
  title: string;
}

/**
 * Detect structural headings in a line of text.
 * Matches: TITULO I, CAPITULO II, SECCAO III, Subseccao IV, etc.
 */
function detectHeading(line: string): StructuralHeading | null {
  const normalized = removeAccents(line.trim());

  // TITULO / Titulo
  const tituloMatch = normalized.match(/^T[IiI]TULO\s+([IVXLCDM]+)\b(.*)/i);
  if (tituloMatch) {
    return {
      type: 'titulo',
      number: tituloMatch[1].toUpperCase(),
      title: tituloMatch[2].replace(/^[\s\-–—:]+/, '').trim(),
    };
  }

  // CAPITULO / Capitulo
  const capMatch = normalized.match(/^CAP[IiI]TULO\s+([IVXLCDM]+)\b(.*)/i);
  if (capMatch) {
    return {
      type: 'capitulo',
      number: capMatch[1].toUpperCase(),
      title: capMatch[2].replace(/^[\s\-–—:]+/, '').trim(),
    };
  }

  // SECCAO / Seccao / Secao
  const secMatch = normalized.match(/^SE[CcC][CcC]?[AaA]O\s+([IVXLCDM]+)\b(.*)/i);
  if (secMatch) {
    return {
      type: 'seccao',
      number: secMatch[1].toUpperCase(),
      title: secMatch[2].replace(/^[\s\-–—:]+/, '').trim(),
    };
  }

  // SUBSECCAO / Subseccao
  const subMatch = normalized.match(/^SUBSE[CcC][CcC]?[AaA]O\s+([IVXLCDM]+)\b(.*)/i);
  if (subMatch) {
    return {
      type: 'subseccao',
      number: subMatch[1].toUpperCase(),
      title: subMatch[2].replace(/^[\s\-–—:]+/, '').trim(),
    };
  }

  return null;
}

/**
 * Detect article start patterns.
 * Matches: "Artigo 1", "Art. 1", "Artigo 1.o", "ARTIGO 1", "Art. 1.o"
 * Returns the article number as a string, or null if not an article line.
 */
function detectArticle(line: string): { number: string; rest: string } | null {
  const match = line.match(
    /^(?:ARTIGO|Artigo|Art\.?)\s*(\d+)[.ºªo°]*\s*(.*)/i
  );
  if (match) {
    return {
      number: stripOrdinal(match[1]),
      rest: match[2].trim(),
    };
  }
  return null;
}

/* ---------- Definition Extraction ---------- */

/**
 * Extract definitions from an article's text.
 * Portuguese definition patterns:
 *   - "termo" - significa/entende-se por/e definido como ...
 *   - Para efeitos desta lei, "termo" e/significa ...
 */
function extractDefinitions(
  text: string,
  sourceProvision: string,
): ParsedDefinition[] {
  const defs: ParsedDefinition[] = [];

  // Pattern: "term" - definition text
  // Also: a) term - definition; b) term - definition;
  const patterns = [
    // Quoted term with "significa", "entende-se por", "e definido como"
    /["\u201c]([^"\u201d]+)["\u201d]\s*[-–:]\s*(.*?)(?=["\u201c;]|$)/gi,
    // Lettered items: a) Term - definition;
    /[a-z]\)\s*([^-–:]+)\s*[-–:]\s*(.*?)(?=\n[a-z]\)|$)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const term = match[1].trim();
      const definition = match[2]
        .replace(/;$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (term.length > 1 && term.length < 100 && definition.length > 5) {
        defs.push({ term, definition, source_provision: sourceProvision });
      }
    }
  }

  return defs;
}

/* ---------- Main Parser ---------- */

/**
 * Parse Mozambican law HTML (or plain text) into structured provisions.
 *
 * Works with HTML from various sources. Extracts:
 * - Articles (Artigo N / Art. N)
 * - Chapter/section groupings (Capitulo, Titulo, Seccao)
 * - Definitions from interpretation/definition articles
 */
export function parseMozambiqueLawHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Strip HTML to plain text, preserving line breaks
  const text = stripHtml(html);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Track current structural context
  let currentTitulo = '';
  let currentCapitulo = '';
  let currentSeccao = '';

  // Extract date from the act title
  let issuedDate = act.issuedDate || '';
  if (!issuedDate) {
    const dateStr = parsePortugueseDate(act.title);
    if (dateStr !== act.title) {
      issuedDate = dateStr;
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for structural headings
    const heading = detectHeading(line);
    if (heading) {
      // Next line might be the heading title (if title was empty)
      let headingTitle = heading.title;
      if (!headingTitle && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        // Only treat next line as title if it doesn't look like an article or heading
        if (!detectArticle(nextLine) && !detectHeading(nextLine)) {
          headingTitle = nextLine;
          i++;
        }
      }

      const label = `${heading.type.charAt(0).toUpperCase() + heading.type.slice(1)} ${heading.number}`;

      switch (heading.type) {
        case 'titulo':
          currentTitulo = headingTitle ? `${label} - ${headingTitle}` : label;
          currentCapitulo = '';
          currentSeccao = '';
          break;
        case 'capitulo':
          currentCapitulo = headingTitle ? `${label} - ${headingTitle}` : label;
          currentSeccao = '';
          break;
        case 'seccao':
        case 'subseccao':
          currentSeccao = headingTitle ? `${label} - ${headingTitle}` : label;
          break;
      }

      i++;
      continue;
    }

    // Check for article start
    const article = detectArticle(line);
    if (article) {
      const artNum = article.number;
      let artTitle = '';
      let contentParts: string[] = [];

      // The rest of the article start line might be a title or content
      if (article.rest) {
        // Check if rest looks like a title (short, possibly in parentheses or before content)
        const titleContentSplit = article.rest.match(/^\(([^)]+)\)\s*(.*)/);
        if (titleContentSplit) {
          artTitle = titleContentSplit[1];
          if (titleContentSplit[2]) contentParts.push(titleContentSplit[2]);
        } else if (article.rest.length < 80 && !article.rest.includes('.')) {
          // Short text without period -- likely a title
          artTitle = article.rest;
        } else {
          contentParts.push(article.rest);
        }
      }

      // Collect continuation lines until next article or heading
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (detectArticle(nextLine) || detectHeading(nextLine)) break;
        contentParts.push(nextLine);
        i++;
      }

      const content = contentParts
        .join('\n')
        .replace(/\s+/g, ' ')
        .trim();

      // Build chapter context string
      const chapterParts: string[] = [];
      if (currentTitulo) chapterParts.push(currentTitulo);
      if (currentCapitulo) chapterParts.push(currentCapitulo);
      if (currentSeccao) chapterParts.push(currentSeccao);
      const chapter = chapterParts.length > 0 ? chapterParts.join(' > ') : undefined;

      const provisionRef = `art${artNum}`;

      if (content.length > 5 || artTitle.length > 0) {
        provisions.push({
          provision_ref: provisionRef,
          chapter,
          section: artNum,
          title: artTitle,
          content: (content || artTitle).substring(0, 15000),
        });

        // Extract definitions from interpretation/definition articles
        const titleLower = artTitle.toLowerCase();
        const contentLower = content.toLowerCase();
        if (
          titleLower.includes('defini') ||
          titleLower.includes('interpreta') ||
          titleLower.includes('conceito') ||
          titleLower.includes('nocoes') ||
          contentLower.startsWith('para efeitos d') ||
          contentLower.startsWith('para os efeitos') ||
          (parseInt(artNum) <= 3 && contentLower.includes('entende-se por'))
        ) {
          const defs = extractDefinitions(content, provisionRef);
          definitions.push(...defs);
        }
      }
    }

    i++;
  }

  // If no articles were found via structured parsing, try a fallback:
  // split by numbered paragraphs or sections
  if (provisions.length === 0) {
    const fallbackProvisions = parseFallback(text, act);
    provisions.push(...fallbackProvisions);
  }

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: issuedDate || act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}

/**
 * Fallback parser for unstructured text (e.g. OCR-extracted PDFs or
 * constitutions from Constitute Project).
 *
 * Splits by numbered sections (1., 2., 3., etc.) or by "Article N" patterns
 * in English-language sources (e.g. Constitute Project).
 */
function parseFallback(text: string, act: ActIndexEntry): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  // Try English-language article pattern (Constitute Project)
  const articlePattern = /(?:^|\n)(?:Article|Section)\s+(\d+)[.:]?\s*(.*?)(?=(?:\n(?:Article|Section)\s+\d+)|\n{2,}|$)/gis;
  let match: RegExpExecArray | null;
  const matches: { num: string; content: string }[] = [];

  while ((match = articlePattern.exec(text)) !== null) {
    matches.push({ num: match[1], content: match[2].replace(/\s+/g, ' ').trim() });
  }

  if (matches.length >= 3) {
    for (const m of matches) {
      if (m.content.length > 5) {
        provisions.push({
          provision_ref: `art${m.num}`,
          section: m.num,
          title: '',
          content: m.content.substring(0, 15000),
        });
      }
    }
    return provisions;
  }

  // Last resort: split into numbered paragraphs
  const numberedPattern = /(?:^|\n)(\d+)\.\s+(.*?)(?=\n\d+\.\s+|\n{2,}|$)/gs;
  while ((match = numberedPattern.exec(text)) !== null) {
    const content = match[2].replace(/\s+/g, ' ').trim();
    if (content.length > 10) {
      provisions.push({
        provision_ref: `s${match[1]}`,
        section: match[1],
        title: '',
        content: content.substring(0, 15000),
      });
    }
  }

  return provisions;
}

/* ---------- Exports ---------- */

export { parsePortugueseDate, stripHtml, detectArticle, detectHeading, romanToArabic };
