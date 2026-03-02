import { Parser } from 'htmlparser2';

export interface AttachmentRef {
  filename: string;
  data: Buffer;
  contentType: string;
  remoteUrl?: string;
}

export interface ConversionResult {
  storageFormat: string;
  attachments: AttachmentRef[];
}

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'li',
  'table', 'tr', 'td', 'th', 'thead', 'tbody',
  'a', 'strong', 'em', 'u', 'br',
]);

const TAG_MAP: Record<string, string> = {
  b: 'strong',
  i: 'em',
};

const SELF_CLOSING = new Set(['br', 'img']);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

const SAFE_HREF_PATTERN = /^(https?:|mailto:|#)/i;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of style.split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim().toLowerCase();
    if (key && val) result[key] = val;
  }
  return result;
}

function extractDataUri(src: string): { contentType: string; data: Buffer } | null {
  const match = src.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return null;
  return { contentType: match[1], data: Buffer.from(match[2], 'base64') };
}

function fileExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
  };
  return map[contentType] ?? 'png';
}

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB

export function convertOneNoteHtml(html: string): ConversionResult {
  if (!html || !html.trim()) {
    return { storageFormat: '', attachments: [] };
  }

  if (html.length > MAX_HTML_SIZE) {
    throw new Error('OneNote HTML exceeds maximum size (10MB)');
  }

  const attachments: AttachmentRef[] = [];
  const parts: string[] = [];
  const push = (s: string) => { parts.push(s); };
  let inBody = false;
  let hasBody = html.toLowerCase().includes('<body');
  let skipDepth = 0;
  const tagStack: string[] = [];

  const parser = new Parser({
    onopentag(name, attribs) {
      const tag = name.toLowerCase();

      // Skip head/style/script content
      if (tag === 'head' || tag === 'style' || tag === 'script') {
        skipDepth++;
        return;
      }
      if (skipDepth > 0) { skipDepth++; return; }

      // Track body
      if (tag === 'html') return;
      if (tag === 'body') { inBody = true; return; }
      if (hasBody && !inBody) return;

      // Handle images
      if (tag === 'img') {
        const src = attribs.src ?? '';
        const dataUri = extractDataUri(src);
        if (dataUri) {
          const idx = attachments.length;
          const filename = `image-${idx}.${fileExtension(dataUri.contentType)}`;
          attachments.push({ filename, data: dataUri.data, contentType: dataUri.contentType });
          push(`<ac:image><ri:attachment ri:filename="${escapeXml(filename)}" /></ac:image>`);
        } else if (src.startsWith('https://graph.microsoft.com/')) {
          const idx = attachments.length;
          const filename = `image-${idx}.png`;
          attachments.push({ filename, data: Buffer.alloc(0), contentType: 'image/png', remoteUrl: src });
          push(`<ac:image><ri:attachment ri:filename="${escapeXml(filename)}" /></ac:image>`);
        }
        return;
      }

      // Handle br
      if (tag === 'br') {
        push('<br />');
        return;
      }

      // Style-based mapping for span
      if (tag === 'span') {
        const style = attribs.style ? parseStyle(attribs.style) : {};
        if (style['font-weight'] === 'bold' || style['font-weight'] === '700') {
          push('<strong>');
          tagStack.push('strong');
          return;
        }
        if (style['font-style'] === 'italic') {
          push('<em>');
          tagStack.push('em');
          return;
        }
        if (style['text-decoration'] === 'underline') {
          push('<u>');
          tagStack.push('u');
          return;
        }
        // Plain span: strip tag, keep content
        tagStack.push('');
        return;
      }

      // Tag mapping (b→strong, i→em)
      const mapped = TAG_MAP[tag] ?? tag;

      // Check if allowed
      if (!ALLOWED_TAGS.has(mapped)) {
        tagStack.push('');
        return;
      }

      // Build opening tag with allowed attributes
      const allowedSet = ALLOWED_ATTRS[mapped];
      let attrStr = '';
      if (allowedSet) {
        for (const [key, val] of Object.entries(attribs)) {
          if (!allowedSet.has(key)) continue;
          if (key === 'href' && !SAFE_HREF_PATTERN.test(val)) continue;
          attrStr += ` ${key}="${escapeXml(val)}"`;
        }
      }

      push(`<${mapped}${attrStr}>`);
      tagStack.push(mapped);
    },

    ontext(text) {
      if (skipDepth > 0) return;
      if (hasBody && !inBody) return;
      push(escapeXml(text));
    },

    onclosetag(name) {
      const tag = name.toLowerCase();

      if (tag === 'head' || tag === 'style' || tag === 'script') {
        skipDepth = Math.max(0, skipDepth - 1);
        return;
      }
      if (skipDepth > 0) { skipDepth = Math.max(0, skipDepth - 1); return; }

      if (tag === 'html' || tag === 'body') return;
      if (SELF_CLOSING.has(tag)) return;

      const mapped = tagStack.pop();
      if (mapped) {
        push(`</${mapped}>`);
      }
    },
  }, { decodeEntities: true });

  parser.write(html);
  parser.end();

  return { storageFormat: parts.join('').trim(), attachments };
}
