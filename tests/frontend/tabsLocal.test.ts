import { TABS, isValidTab } from '../../src/frontend/utils/tabs';

describe('Tab definitions — with local-onenote tab', () => {
  it('has exactly 4 tabs', () => {
    expect(TABS).toHaveLength(4);
  });

  it('includes local-onenote tab', () => {
    const ids = TABS.map(t => t.id);
    expect(ids).toContain('local-onenote');
  });

  it('local-onenote has correct label', () => {
    const tab = TABS.find(t => t.id === 'local-onenote');
    expect(tab).toBeDefined();
    expect(tab!.label).toBe('Local OneNote');
  });

  it('isValidTab accepts local-onenote', () => {
    expect(isValidTab('local-onenote')).toBe(true);
  });

  it('tab order is correct', () => {
    const ids = TABS.map(t => t.id);
    expect(ids).toEqual(['pdf-import', 'onenote-import', 'local-onenote', 'pdf-export']);
  });
});
