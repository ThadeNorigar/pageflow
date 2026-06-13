import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, PageNumber, Footer, PageBreak,
} from 'docx';
import { ContentBlock, InlineRun } from '../../shared/contentModel';
import { ExportPage } from './docDefinition';

const MUTED = '6B778C';
const LINK = '0052CC';
const CODE_BG = 'F4F5F7';
const BORDER = 'DFE1E6';

const PANEL_FILL: Record<string, string> = {
  info: 'DEEBFF', note: 'EAE6FF', warning: 'FFEBE6', tip: 'E3FCEF',
  success: 'E3FCEF', error: 'FFEBE6', panel: 'F4F5F7',
};

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

type InlineChild = TextRun | ExternalHyperlink;

function mapRun(run: InlineRun): InlineChild {
  const base = {
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    strike: run.strike,
    ...(run.code ? { font: 'Courier New' } : {}),
  };
  if (run.link) {
    return new ExternalHyperlink({
      link: run.link,
      children: [new TextRun({ ...base, color: LINK, underline: {} })],
    });
  }
  return new TextRun(base);
}

function mapRuns(runs: InlineRun[]): InlineChild[] {
  return runs.length > 0 ? runs.map(mapRun) : [new TextRun('')];
}

function codeParagraphs(text: string): Paragraph[] {
  const lines = text.length > 0 ? text.split('\n') : [''];
  return lines.map(line =>
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: 'auto' },
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18 })],
    })
  );
}

function mapBlock(block: ContentBlock): (Paragraph | Table)[] {
  switch (block.type) {
    case 'heading':
      return [new Paragraph({ heading: HEADING_LEVELS[block.level] ?? HeadingLevel.HEADING_3, children: mapRuns(block.runs) })];

    case 'paragraph':
      return [new Paragraph({ spacing: { after: 120 }, children: mapRuns(block.runs) })];

    case 'list': {
      const out: Paragraph[] = [];
      block.items.forEach((item, idx) => {
        const prefix = block.ordered ? `${idx + 1}. ` : '•  ';
        out.push(new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [new TextRun(prefix), ...mapRuns(item.runs)],
        }));
        if (item.children) {
          for (const child of item.children) {
            for (const mapped of mapBlock(child)) {
              if (mapped instanceof Paragraph) {
                out.push(mapped);
              }
            }
          }
        }
      });
      return out;
    }

    case 'table': {
      if (block.rows.length === 0) return [];
      const columnCount = Math.max(...block.rows.map(r => r.length));
      const rows = block.rows.map((row, rowIndex) => {
        const cells = [];
        for (let c = 0; c < columnCount; c++) {
          const cellRuns = row[c] ?? [];
          const isHeader = block.headerRow && rowIndex === 0;
          cells.push(new TableCell({
            shading: isHeader ? { type: ShadingType.CLEAR, fill: CODE_BG, color: 'auto' } : undefined,
            children: [new Paragraph({
              children: cellRuns.length > 0
                ? cellRuns.map(r => mapRun(isHeader ? { ...r, bold: true } : r))
                : [new TextRun('')],
            })],
          }));
        }
        return new TableRow({ tableHeader: block.headerRow && rowIndex === 0, children: cells });
      });
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
          left: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
          right: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        },
        rows,
      })];
    }

    case 'codeBlock':
      return codeParagraphs(block.text);

    case 'panel': {
      const fill = PANEL_FILL[block.panelType] ?? PANEL_FILL.panel;
      const inner: (Paragraph | Table)[] = [];
      for (const b of block.blocks) inner.push(...mapBlock(b));
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        rows: [new TableRow({
          children: [new TableCell({
            shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
            children: inner.length > 0 ? inner : [new Paragraph('')],
          })],
        })],
      })];
    }

    case 'taskList':
      return block.items.map(item =>
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [new TextRun({ text: item.checked ? '[x]  ' : '[ ]  ', font: 'Courier New' }), ...mapRuns(item.runs)],
        })
      );

    case 'image':
      return [new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `[Image: ${block.filename ?? block.url ?? 'unknown'}]`, italics: true, color: MUTED, size: 18 })],
      })];

    case 'quote': {
      const inner: (Paragraph | Table)[] = [];
      for (const b of block.blocks) {
        for (const mapped of mapBlock(b)) {
          if (mapped instanceof Paragraph) {
            inner.push(new Paragraph({
              indent: { left: 360 },
              border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C1C7D0', space: 12 } },
              children: [new TextRun('')],
            }));
          }
          inner.push(mapped);
        }
      }
      return inner;
    }

    case 'hr':
      return [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C1C7D0', space: 1 } },
        spacing: { before: 120, after: 120 },
        children: [new TextRun('')],
      })];

    case 'placeholder':
      return [new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `[Unsupported content${block.reason ? `: ${block.reason}` : ''}]`, italics: true, color: MUTED, size: 18 })],
      })];

    default:
      return [];
  }
}

export function blocksToDocxChildren(blocks: ContentBlock[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const block of blocks) out.push(...mapBlock(block));
  return out;
}

export function buildDocx(pages: ExportPage[]): Document {
  const children: (Paragraph | Table)[] = [];

  pages.forEach((page, index) => {
    children.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      ...(index > 0 ? { children: [new PageBreak(), new TextRun(page.title)] } : { children: [new TextRun(page.title)] }),
      spacing: { after: 200 },
    }));
    children.push(...blocksToDocxChildren(page.blocks));
  });

  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16, color: MUTED })],
    })],
  });

  return new Document({
    sections: [{ properties: {}, footers: { default: footer }, children }],
  });
}

export async function docxToBlob(doc: Document): Promise<Blob> {
  return Packer.toBlob(doc);
}

export function downloadDocx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
