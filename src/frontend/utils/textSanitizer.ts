// Roboto (pdfmake-Standardfont) deckt Latin/Latin-Ext/Kyrillisch/Griechisch ab,
// aber keine Emojis, Pfeile oder Dingbats. Diese Zeichen werden auf lesbare
// ASCII-Äquivalente gemappt bzw. entfernt, damit das PDF keine .notdef-Boxen zeigt.

const REPLACEMENTS: Record<string, string> = {
  '✅': '[x]', // ✅
  '☑': '[x]', // ☑
  '✓': 'v', // ✓
  '✔': 'v', // ✔
  '❌': 'x', // ❌
  '✗': 'x', // ✗
  '✘': 'x', // ✘
  '→': '->', // →
  '←': '<-', // ←
  '↔': '<->', // ↔
  '⇒': '=>', // ⇒
  '⇐': '<=', // ⇐
  '…': '...', // …
  '•': '·', // • → ·
  '●': '·', // ●
  '■': '·', // ■
  '★': '*', // ★
  '☆': '*', // ☆
  '⚠': '(!)', // ⚠ (ohne FE0F)
  'ℹ': '(i)', // ℹ
  ' ': ' ', // non-breaking space
};

// Emojis, Symbole, Dingbats, Variation Selectors, Zero-Width-Joiner
const UNSUPPORTED_PATTERN =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2460}-\u{24FF}\u{25A0}-\u{25FF}]/gu;

export function sanitizeForPdf(text: string): string {
  let result = '';
  for (const char of text) {
    result += REPLACEMENTS[char] ?? char;
  }
  return result.replace(UNSUPPORTED_PATTERN, '').replace(/ {2,}/g, ' ');
}
