import React from 'react';
import { C } from '../utils/colors';
import { TabId } from '../utils/tabs';

interface HelpContent {
  title: string;
  steps: string[];
  notes?: string[];
}

const HELP_CONTENT: Record<TabId, HelpContent> = {
  'pdf-import': {
    title: 'How to import PDFs',
    steps: [
      'Select the target space on the right — optionally pick a parent page in the tree below it.',
      'Click "Select folder" on the left and choose a folder on your computer. All PDFs in it (including subfolders) are listed.',
      'Review the preview: subfolders become Confluence pages, each PDF becomes a child page with the file attached and embedded.',
      'Click Import and keep this tab open until it finishes.',
    ],
    notes: [
      'Limits: max. 10 MB per PDF, max. 100 files per run.',
      'Page titles are taken from the file names (without ".pdf").',
    ],
  },
  'onenote-import': {
    title: 'How to import from OneNote (cloud)',
    steps: [
      'Connect your Microsoft account when asked (button appears on first use).',
      'Expand your notebook and its sections on the left, then tick the pages you want to import.',
      'Select the target space on the right — optionally pick a parent page.',
      'Click Import. Each OneNote page becomes one Confluence page.',
    ],
    notes: [
      'Only notebooks stored in OneDrive/Microsoft 365 are available here. For notebooks exported from OneNote Desktop use the "Local OneNote" tab.',
    ],
  },
  'local-onenote': {
    title: 'How to import a OneNote Desktop export',
    steps: [
      'In OneNote Desktop, save your pages as web pages: File → Save As → select the web page format (*.htm). Save everything into one empty folder — image subfolders created by OneNote belong there too.',
      'Single File Web Page (*.mht) is NOT supported — it must be plain .htm/.html files.',
      'Select the target space (and optional parent page) on the right.',
      'Click "Select OneNote HTML export folder" on the left, choose that folder and start the import.',
    ],
    notes: [
      'Images from the export are uploaded as attachments automatically.',
      'Limit: max. 100 files per run.',
    ],
  },
  'pdf-export': {
    title: 'How to export pages as PDF or Word',
    steps: [
      'Select the space you want to export from.',
      'Tick pages in the tree. Ticking a parent automatically selects all of its child pages — the counter shows how many are selected.',
      'Choose the output format: PDF or Word (.docx).',
      'PDF only — optional: upload a stationery PDF (max. 5 MB). Its first page is used as background for every exported page.',
      'Click Export. You get ONE combined file with one section per Confluence page.',
    ],
    notes: [
      'Limit: max. 50 pages per export. Split larger exports into multiple runs.',
      'Macros that cannot be rendered (e.g. Jira tickets) appear as "[Unsupported content]" hints.',
      'Stationery backgrounds are available for PDF only, not for Word.',
    ],
  },
};

const HelpBox: React.FC<{ tab: TabId }> = ({ tab }) => {
  const content = HELP_CONTENT[tab];

  return (
    <div style={{
      marginBottom: 16,
      border: '1px solid #B3D4FF',
      borderRadius: 8,
      backgroundColor: C.B75,
    }}>
      <div style={{
        padding: '8px 12px 6px',
        fontSize: 13,
        fontWeight: 700,
        color: C.B400,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span aria-hidden="true">ℹ</span>
        {content.title}
      </div>
      <div style={{ padding: '0 12px 10px 12px', fontSize: 13, color: C.N800 }}>
        <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
          {content.steps.map((step, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{step}</li>
          ))}
        </ol>
        {content.notes && content.notes.map((note, i) => (
          <div key={i} style={{ marginTop: 4, fontSize: 12, color: C.N200 }}>ℹ {note}</div>
        ))}
      </div>
    </div>
  );
};

export default HelpBox;
