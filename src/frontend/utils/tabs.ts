export type TabId = 'pdf-import' | 'onenote-import' | 'local-onenote' | 'pdf-export';

export interface TabDefinition {
  id: TabId;
  label: string;
}

export const TABS: TabDefinition[] = [
  { id: 'pdf-import', label: 'PDF Import' },
  { id: 'onenote-import', label: 'OneNote Import' },
  { id: 'local-onenote', label: 'Local OneNote' },
  { id: 'pdf-export', label: 'PDF Export' },
];

export const DEFAULT_TAB: TabId = 'pdf-import';

export function isValidTab(id: string): id is TabId {
  return TABS.some(t => t.id === id);
}
