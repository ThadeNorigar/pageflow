/**
 * Strips HTML tags and converts OneNote HTML content to plain text.
 * For v1: simple tag stripping, no image extraction, no formatting preservation.
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  let text = html;

  // Replace <br>, <br/>, </p>, </div>, </li>, </tr> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n');

  // Replace <li> with bullet
  text = text.replace(/<li[^>]*>/gi, '- ');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim
  text = text.trim();

  return text;
}

/**
 * Wraps plain text in Confluence Storage Format paragraphs.
 */
export function textToStorageFormat(text: string): string {
  if (!text) return '<p></p>';

  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map(p => {
      const escaped = escapeXml(p);
      return `<p>${escaped.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
