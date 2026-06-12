import { sanitizeForPdf } from '../../src/frontend/utils/textSanitizer';

describe('sanitizeForPdf', () => {
  it('passes plain latin text through unchanged', () => {
    expect(sanitizeForPdf('Hello World 123')).toBe('Hello World 123');
  });

  it('keeps German umlauts and quotes', () => {
    expect(sanitizeForPdf('„Grüße“ – ein Überblick')).toBe('„Grüße“ – ein Überblick');
  });

  it('maps arrows to ASCII', () => {
    expect(sanitizeForPdf('Text → Bild ⇒ fertig')).toBe('Text -> Bild => fertig');
  });

  it('maps checkmarks and crosses', () => {
    expect(sanitizeForPdf('✅ done ❌ failed')).toBe('[x] done x failed');
  });

  it('strips emojis instead of crashing', () => {
    expect(sanitizeForPdf('Rocket 🚀 launch 🎉')).toBe('Rocket launch ');
  });

  it('strips variation selectors and ZWJ sequences', () => {
    expect(sanitizeForPdf('a️b‍c')).toBe('abc');
  });

  it('maps warning sign', () => {
    expect(sanitizeForPdf('⚠ caution')).toBe('(!) caution');
  });

  it('handles empty string', () => {
    expect(sanitizeForPdf('')).toBe('');
  });
});
