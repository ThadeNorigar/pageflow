import { PDFDocument, PDFFont, PDFPage, PDFEmbeddedPage, StandardFonts, rgb } from 'pdf-lib';

interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'placeholder';
  text?: string;
  level?: number;
  items?: string[];
  rows?: string[][];
}

export interface ExportPage {
  id: string;
  title: string;
  blocks: ContentBlock[];
  depth: number;
}

interface LayoutState {
  y: number;
  page: PDFPage;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const LINE_HEIGHT = 16;
const HEADING_SIZES: Record<number, number> = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 };

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length === 0) lines.push('');
  return lines;
}

function addPageWithStationery(doc: PDFDocument, embedded?: PDFEmbeddedPage): PDFPage {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (embedded) {
    page.drawPage(embedded, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
  }
  return page;
}

function ensureSpace(state: LayoutState, doc: PDFDocument, needed: number, embedded?: PDFEmbeddedPage): LayoutState {
  if (state.y - needed < MARGIN) {
    const newPage = addPageWithStationery(doc, embedded);
    return { y: PAGE_HEIGHT - MARGIN, page: newPage };
  }
  return state;
}

function drawText(
  state: LayoutState,
  doc: PDFDocument,
  text: string,
  font: PDFFont,
  fontSize: number,
  embedded?: PDFEmbeddedPage,
  indent: number = 0,
): LayoutState {
  const lines = wrapText(text, font, fontSize, CONTENT_WIDTH - indent);
  for (const line of lines) {
    state = ensureSpace(state, doc, fontSize + 4, embedded);
    state.page.drawText(line, {
      x: MARGIN + indent,
      y: state.y,
      size: fontSize,
      font,
      color: rgb(0.09, 0.17, 0.29),
    });
    state.y -= fontSize + 4;
  }
  return state;
}

export async function generatePdf(
  pages: ExportPage[],
  stationeryBytes?: Uint8Array,
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let embedded: PDFEmbeddedPage | undefined;
  if (stationeryBytes) {
    const stationeryDoc = await PDFDocument.load(stationeryBytes);
    const [copied] = await doc.copyPages(stationeryDoc, [0]);
    embedded = await doc.embedPage(copied);
  }

  let state: LayoutState = {
    page: addPageWithStationery(doc, embedded),
    y: PAGE_HEIGHT - MARGIN,
  };

  // Title page
  state.page.drawText('PDF Export', {
    x: MARGIN,
    y: state.y,
    size: 28,
    font: fontBold,
    color: rgb(0.09, 0.17, 0.29),
  });
  state.y -= 40;

  state.page.drawText(`${pages.length} Seite${pages.length !== 1 ? 'n' : ''}`, {
    x: MARGIN,
    y: state.y,
    size: 14,
    font,
    color: rgb(0.42, 0.47, 0.55),
  });
  state.y -= 30;

  // Table of contents
  for (const p of pages) {
    const indent = p.depth * 15;
    state = drawText(state, doc, `${'  '.repeat(p.depth)}${p.title}`, font, 11, embedded, indent);
  }

  // Content pages
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    onProgress?.(i + 1, pages.length);

    const newPage = addPageWithStationery(doc, embedded);
    state = { page: newPage, y: PAGE_HEIGHT - MARGIN };

    // Page title as chapter heading
    const headingLevel = Math.min(p.depth + 1, 6);
    const titleSize = HEADING_SIZES[headingLevel] ?? 14;
    state = drawText(state, doc, p.title, fontBold, titleSize, embedded);
    state.y -= 10;

    // Render content blocks
    for (const block of p.blocks) {
      switch (block.type) {
        case 'heading': {
          state.y -= 8;
          const size = HEADING_SIZES[block.level ?? 3] ?? 14;
          state = drawText(state, doc, block.text ?? '', fontBold, size, embedded);
          state.y -= 4;
          break;
        }
        case 'paragraph': {
          state = drawText(state, doc, block.text ?? '', font, 11, embedded);
          state.y -= LINE_HEIGHT * 0.5;
          break;
        }
        case 'list': {
          for (const item of block.items ?? []) {
            state = drawText(state, doc, `\u2022  ${item}`, font, 11, embedded, 15);
          }
          state.y -= LINE_HEIGHT * 0.3;
          break;
        }
        case 'table': {
          for (const row of block.rows ?? []) {
            const cellText = row.join('  |  ');
            state = drawText(state, doc, cellText, font, 10, embedded);
          }
          state.y -= LINE_HEIGHT * 0.5;
          break;
        }
        case 'placeholder': {
          state = drawText(state, doc, '[Nicht darstellbarer Inhalt]', font, 10, embedded);
          state.y -= LINE_HEIGHT * 0.3;
          break;
        }
      }
    }

    // Yield to UI between pages
    if (i < pages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
