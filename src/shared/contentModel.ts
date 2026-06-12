export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: string;
}

export type PanelType = 'info' | 'note' | 'warning' | 'tip' | 'success' | 'error' | 'panel';

export interface ListItem {
  runs: InlineRun[];
  children?: ContentBlock[];
}

export interface TaskItem {
  checked: boolean;
  runs: InlineRun[];
}

export type ContentBlock =
  | { type: 'heading'; level: number; runs: InlineRun[] }
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'table'; headerRow: boolean; rows: InlineRun[][][] }
  | { type: 'codeBlock'; language?: string; text: string }
  | { type: 'panel'; panelType: PanelType; blocks: ContentBlock[] }
  | { type: 'taskList'; items: TaskItem[] }
  | { type: 'image'; filename?: string; url?: string }
  | { type: 'quote'; blocks: ContentBlock[] }
  | { type: 'hr' }
  | { type: 'placeholder'; reason?: string };

export function runsToText(runs: InlineRun[]): string {
  return runs.map(r => r.text).join('');
}
