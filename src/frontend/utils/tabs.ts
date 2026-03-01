export type TabId = 'pdf-import' | 'onenote-import' | 'pdf-export';

export interface TabDefinition {
  id: TabId;
  label: string;
}

export const TABS: TabDefinition[] = [
  { id: 'pdf-import', label: 'Batch Import PDF' },
  { id: 'onenote-import', label: 'OneNote Import' },
  { id: 'pdf-export', label: 'Batch Export PDF' },
];

export const DEFAULT_TAB: TabId = 'pdf-import';

export function isValidTab(id: string): id is TabId {
  return TABS.some(t => t.id === id);
}
