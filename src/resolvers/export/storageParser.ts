export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'placeholder';
  text?: string;
  level?: number;
  items?: string[];
  rows?: string[][];
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function extractListItems(html: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    items.push(stripTags(match[1]));
  }
  return items;
}

function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    rows.push(cells);
  }
  return rows;
}

const TOP_LEVEL_REGEX = /<(h[1-6]|p|ul|ol|table|ac:[a-z\-]+|div)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;

function parseTopLevelTag(tag: string, content: string): ContentBlock | null {
  const lower = tag.toLowerCase();

  if (/^h[1-6]$/.test(lower)) {
    const level = parseInt(lower[1], 10);
    return { type: 'heading', text: stripTags(content), level };
  }

  if (lower === 'p') {
    return { type: 'paragraph', text: stripTags(content) };
  }

  if (lower === 'ul' || lower === 'ol') {
    return { type: 'list', items: extractListItems(content) };
  }

  if (lower === 'table') {
    return { type: 'table', rows: extractTableRows(content) };
  }

  return { type: 'placeholder' };
}

export function parseStorageFormat(xhtml: string): ContentBlock[] {
  const trimmed = xhtml.trim();
  if (!trimmed) return [];

  const blocks: ContentBlock[] = [];
  const regex = /<(h[1-6]|p|ul|ol|table|ac:[a-z\-]+|div)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let match;

  while ((match = regex.exec(trimmed)) !== null) {
    const tag = match[1];
    const fullMatch = match[0];
    const block = parseTopLevelTag(tag, fullMatch);
    if (block) blocks.push(block);
  }

  return blocks;
}
