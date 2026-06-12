import * as pdfMake from 'pdfmake/build/pdfmake';
import * as vfsFonts from 'pdfmake/build/vfs_fonts';
import { PDFDocument } from 'pdf-lib';
import robotoMonoBase64 from '../fonts/RobotoMono-Regular.ttf';
import { buildDocDefinition, ExportPage } from './docDefinition';

export { ExportPage } from './docDefinition';

// vfs_fonts.js exportiert je nach pdfmake-Version das vfs-Objekt direkt
// oder verschachtelt unter pdfMake.vfs — beides abfangen.
const baseVfs: Record<string, string> =
  (vfsFonts as unknown as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ??
  (vfsFonts as unknown as { vfs?: Record<string, string> }).vfs ??
  (vfsFonts as unknown as Record<string, string>);

const VFS: Record<string, string> = {
  ...baseVfs,
  'RobotoMono-Regular.ttf': robotoMonoBase64,
};

const FONTS = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
  RobotoMono: {
    normal: 'RobotoMono-Regular.ttf',
    bold: 'RobotoMono-Regular.ttf',
    italics: 'RobotoMono-Regular.ttf',
    bolditalics: 'RobotoMono-Regular.ttf',
  },
};

interface PdfDocument {
  getBuffer(callback: (buffer: Uint8Array) => void): void;
}

function renderContentPdf(pages: ExportPage[]): Promise<Uint8Array> {
  const docDefinition = buildDocDefinition(pages);
  const pdfMakeInstance = pdfMake as unknown as {
    addVirtualFileSystem(vfs: Record<string, string>): void;
    setFonts(fonts: typeof FONTS): void;
    createPdf(def: ReturnType<typeof buildDocDefinition>): PdfDocument;
  };
  pdfMakeInstance.addVirtualFileSystem(VFS);
  pdfMakeInstance.setFonts(FONTS);
  return new Promise((resolve, reject) => {
    try {
      pdfMakeInstance.createPdf(docDefinition).getBuffer(buffer => resolve(new Uint8Array(buffer)));
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function overlayOnStationery(contentBytes: Uint8Array, stationeryBytes: Uint8Array): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const contentDoc = await PDFDocument.load(contentBytes);
  const stationeryDoc = await PDFDocument.load(stationeryBytes);

  let stationeryPage;
  try {
    [stationeryPage] = await out.embedPdf(stationeryDoc, [0]);
  } catch {
    throw new Error('Stationery PDF could not be used (first page has no drawable content)');
  }
  const contentPages = await out.embedPdf(contentDoc, contentDoc.getPageIndices());

  for (const contentPage of contentPages) {
    const page = out.addPage([contentPage.width, contentPage.height]);
    page.drawPage(stationeryPage, { x: 0, y: 0, width: contentPage.width, height: contentPage.height });
    page.drawPage(contentPage, { x: 0, y: 0, width: contentPage.width, height: contentPage.height });
  }

  return out.save();
}

export async function generatePdf(
  pages: ExportPage[],
  stationeryBytes?: Uint8Array,
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  onProgress?.(0, pages.length);
  const contentBytes = await renderContentPdf(pages);
  onProgress?.(pages.length, pages.length);

  if (!stationeryBytes) {
    return contentBytes;
  }
  return overlayOnStationery(contentBytes, stationeryBytes);
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
