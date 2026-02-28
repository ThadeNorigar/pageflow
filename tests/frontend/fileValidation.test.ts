import { validateFile, titleFromFilename } from '../../src/frontend/utils/fileValidation';

describe('validateFile', () => {
  it('accepts a valid PDF under 10MB', () => {
    const file = { name: 'report.pdf', type: 'application/pdf', size: 5 * 1024 * 1024 };
    expect(validateFile(file)).toBeNull();
  });

  it('rejects non-PDF file types', () => {
    const file = { name: 'image.png', type: 'image/png', size: 1024 };
    expect(validateFile(file)).toBe('"image.png" ist keine PDF-Datei');
  });

  it('rejects files over 10MB', () => {
    const file = { name: 'huge.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 };
    const result = validateFile(file);
    expect(result).toContain('"huge.pdf" ist größer als 10MB');
    expect(result).toContain('11.0MB');
  });

  it('rejects empty MIME type', () => {
    const file = { name: 'noext', type: '', size: 100 };
    expect(validateFile(file)).toBe('"noext" ist keine PDF-Datei');
  });

  it('accepts PDF at exactly 10MB', () => {
    const file = { name: 'exact.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 };
    expect(validateFile(file)).toBeNull();
  });

  it('rejects PDF at 10MB + 1 byte', () => {
    const file = { name: 'over.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 };
    expect(validateFile(file)).toContain('größer als 10MB');
  });

  it('rejects Word documents', () => {
    const file = { name: 'doc.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1024 };
    expect(validateFile(file)).toBe('"doc.docx" ist keine PDF-Datei');
  });
});

describe('titleFromFilename', () => {
  it('strips .pdf extension', () => {
    expect(titleFromFilename('Report.pdf')).toBe('Report');
  });

  it('strips .PDF extension (case-insensitive)', () => {
    expect(titleFromFilename('DOCUMENT.PDF')).toBe('DOCUMENT');
  });

  it('returns name unchanged if no .pdf extension', () => {
    expect(titleFromFilename('readme.txt')).toBe('readme.txt');
  });

  it('only strips trailing .pdf', () => {
    expect(titleFromFilename('pdf.summary.pdf')).toBe('pdf.summary');
  });
});
