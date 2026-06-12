import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ContentBlock, InlineRun } from '../../shared/contentModel';
import { sanitizeForPdf } from './textSanitizer';

export interface ExportPage {
  id: string;
  title: string;
  blocks: ContentBlock[];
  depth: number;
}

const TEXT_COLOR = '#172B4D';
const MUTED_COLOR = '#6B778C';
const LINK_COLOR = '#0052CC';
const CODE_BG = '#F4F5F7';

const PANEL_COLORS: Record<string, { bg: string; border: string }> = {
  info: { bg: '#DEEBFF', border: '#0052CC' },
  note: { bg: '#EAE6FF', border: '#5243AA' },
  warning: { bg: '#FFEBE6', border: '#DE350B' },
  tip: { bg: '#E3FCEF', border: '#00875A' },
  success: { bg: '#E3FCEF', border: '#00875A' },
  error: { bg: '#FFEBE6', border: '#DE350B' },
  panel: { bg: '#F4F5F7', border: '#6B778C' },
};

const HEADING_SIZES: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 12, 5: 11, 6: 10.5 };

interface PdfTextRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: 'lineThrough';
  link?: string;
  color?: string;
  font?: string;
  fontSize?: number;
}

function mapRuns(runs: InlineRun[]): PdfTextRun[] {
  if (runs.length === 0) return [{ text: '' }];
  return runs.map(run => {
    const mapped: PdfTextRun = { text: sanitizeForPdf(run.text) };
    if (run.bold) mapped.bold = true;
    if (run.italic) mapped.italics = true;
    if (run.strike) mapped.decoration = 'lineThrough';
    if (run.code) {
      mapped.font = 'RobotoMono';
      mapped.fontSize = 9.5;
    }
    if (run.link) {
      mapped.link = run.link;
      mapped.color = LINK_COLOR;
    }
    return mapped;
  });
}

function mapBlock(block: ContentBlock): Content | null {
  switch (block.type) {
    case 'heading':
      return {
        text: mapRuns(block.runs),
        fontSize: HEADING_SIZES[block.level] ?? 12,
        bold: true,
        margin: [0, 10, 0, 4],
      };

    case 'paragraph':
      return { text: mapRuns(block.runs), margin: [0, 2, 0, 4] };

    case 'list': {
      const items = block.items.map(item => {
        const text: Content = { text: mapRuns(item.runs) };
        if (item.children && item.children.length > 0) {
          return { stack: [text, ...mapBlocks(item.children)] };
        }
        return text;
      });
      return block.ordered
        ? { ol: items, margin: [0, 2, 0, 4] }
        : { ul: items, margin: [0, 2, 0, 4] };
    }

    case 'table': {
      if (block.rows.length === 0) return null;
      const columnCount = Math.max(...block.rows.map(r => r.length));
      const body = block.rows.map((row, rowIndex) => {
        const cells: Content[] = row.map(cellRuns => {
          const cell: Content & { bold?: boolean; fillColor?: string } = { text: mapRuns(cellRuns), fontSize: 9.5 };
          if (block.headerRow && rowIndex === 0) {
            cell.bold = true;
            cell.fillColor = '#F4F5F7';
          }
          return cell;
        });
        while (cells.length < columnCount) cells.push({ text: '' });
        return cells;
      });
      return {
        table: {
          headerRows: block.headerRow ? 1 : 0,
          widths: Array(columnCount).fill('*'),
          body,
        },
        layout: {
          hLineColor: () => '#DFE1E6',
          vLineColor: () => '#DFE1E6',
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
        margin: [0, 4, 0, 8],
      };
    }

    case 'codeBlock': {
      const header = block.language ? [{ text: block.language, fontSize: 8, color: MUTED_COLOR, margin: [0, 0, 0, 2] } as Content] : [];
      return {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                ...header,
                { text: block.text || ' ', font: 'RobotoMono', fontSize: 9, preserveLeadingSpaces: true },
              ],
              fillColor: CODE_BG,
              margin: [6, 4, 6, 4],
            },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 8],
      };
    }

    case 'panel': {
      const colors = PANEL_COLORS[block.panelType] ?? PANEL_COLORS.panel;
      const inner = mapBlocks(block.blocks);
      return {
        table: {
          widths: [2, '*'],
          body: [[
            { text: '', fillColor: colors.border },
            { stack: inner.length > 0 ? inner : [{ text: '' }], fillColor: colors.bg, margin: [6, 4, 6, 4] },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 8],
      };
    }

    case 'taskList': {
      const items = block.items.map(item => ({
        text: [{ text: item.checked ? '[x] ' : '[ ] ', font: 'RobotoMono', fontSize: 9.5 }, ...mapRuns(item.runs)],
      }));
      return { ul: items, type: 'none', margin: [0, 2, 0, 4] } as Content;
    }

    case 'image':
      return {
        text: `[Image: ${block.filename ?? block.url ?? 'unknown'}]`,
        italics: true,
        color: MUTED_COLOR,
        fontSize: 9,
        margin: [0, 2, 0, 4],
      };

    case 'quote':
      return {
        table: {
          widths: [2, '*'],
          body: [[
            { text: '', fillColor: '#C1C7D0' },
            { stack: mapBlocks(block.blocks), margin: [8, 2, 0, 2] },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 8],
      };

    case 'hr':
      return {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: '#C1C7D0' }],
        margin: [0, 8, 0, 8],
      };

    case 'placeholder':
      return {
        text: `[Unsupported content${block.reason ? `: ${block.reason}` : ''}]`,
        italics: true,
        color: MUTED_COLOR,
        fontSize: 9,
        margin: [0, 2, 0, 4],
      };

    default:
      return null;
  }
}

export function mapBlocks(blocks: ContentBlock[]): Content[] {
  return blocks.map(mapBlock).filter((c): c is Content => c !== null);
}

export function buildDocDefinition(pages: ExportPage[]): TDocumentDefinitions {
  const content: Content[] = [];

  pages.forEach((page, index) => {
    const title: Content = {
      text: sanitizeForPdf(page.title),
      fontSize: 20,
      bold: true,
      margin: [0, 0, 0, 2],
    };
    if (index > 0) {
      (title as { pageBreak?: 'before' }).pageBreak = 'before';
    }
    content.push(title);
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: '#0052CC' }],
      margin: [0, 0, 0, 10],
    });
    content.push(...mapBlocks(page.blocks));
  });

  return {
    pageSize: 'A4',
    pageMargins: [50, 50, 50, 60],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10.5,
      color: TEXT_COLOR,
      lineHeight: 1.25,
    },
    content,
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'right',
      fontSize: 8,
      color: MUTED_COLOR,
      margin: [0, 20, 50, 0],
    }),
  };
}
