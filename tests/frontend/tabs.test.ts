import { TABS, DEFAULT_TAB, isValidTab, TabId } from '../../src/frontend/utils/tabs';

describe('Tab definitions', () => {
  it('has exactly 3 tabs', () => {
    expect(TABS).toHaveLength(3);
  });

  it('has correct tab IDs', () => {
    const ids = TABS.map(t => t.id);
    expect(ids).toEqual(['pdf-import', 'onenote-import', 'pdf-export']);
  });

  it('has correct labels', () => {
    const labels = TABS.map(t => t.label);
    expect(labels).toEqual(['Batch Import PDF', 'OneNote Import', 'Batch Export PDF']);
  });

  it('default tab is pdf-import', () => {
    expect(DEFAULT_TAB).toBe('pdf-import');
  });
});

describe('isValidTab', () => {
  it('returns true for valid tab IDs', () => {
    expect(isValidTab('pdf-import')).toBe(true);
    expect(isValidTab('onenote-import')).toBe(true);
    expect(isValidTab('pdf-export')).toBe(true);
  });

  it('returns false for invalid tab IDs', () => {
    expect(isValidTab('invalid')).toBe(false);
    expect(isValidTab('')).toBe(false);
    expect(isValidTab('PDF-IMPORT')).toBe(false);
  });
});
