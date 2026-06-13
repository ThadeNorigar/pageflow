import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@forge/bridge';
import { C } from '../utils/colors';
import ExportPageTree from './ExportPageTree';
import { generatePdf, downloadPdf, ExportPage } from '../utils/pdfExport';
import { buildDocx, docxToBlob, downloadDocx } from '../utils/docxExport';

type ExportFormat = 'pdf' | 'word';

interface BatchExportPDFProps {
  spaceKey: string | null;
  spaceId: string | null;
}

type Phase = 'select' | 'generating' | 'done';

interface FailedPage {
  pageId: string;
  error: string;
}

const MAX_PAGES = 50;

const BatchExportPDF: React.FC<BatchExportPDFProps> = ({ spaceKey, spaceId }) => {
  const [phase, setPhase] = useState<Phase>('select');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stationeryFile, setStationeryFile] = useState<File | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentTitle, setCurrentTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failedPages, setFailedPages] = useState<FailedPage[]>([]);
  const [exportedCount, setExportedCount] = useState(0);
  const cancelRef = useRef(false);

  const handleStationeryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Stationery PDF must not exceed 5 MB');
      return;
    }
    setStationeryFile(file);
  }, []);

  const reset = useCallback(() => {
    setPhase('select');
    setSelectedIds(new Set());
    setProgress({ current: 0, total: 0 });
    setCurrentTitle('');
    setError(null);
    setFailedPages([]);
    setExportedCount(0);
  }, []);

  const startExport = useCallback(async () => {
    if (!spaceId || selectedIds.size === 0) return;

    cancelRef.current = false;
    setPhase('generating');
    setError(null);

    const pageIds = Array.from(selectedIds);
    setProgress({ current: 0, total: pageIds.length });

    try {
      // Load and validate stationery bytes (PDF only)
      let stationeryBytes: Uint8Array | undefined;
      if (format === 'pdf' && stationeryFile) {
        const buffer = await stationeryFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
          throw new Error('Invalid stationery file (not a valid PDF)');
        }
        stationeryBytes = bytes;
      }

      // Fetch page bodies
      const exportPages: ExportPage[] = [];
      const failed: FailedPage[] = [];
      for (let i = 0; i < pageIds.length; i++) {
        if (cancelRef.current) break;

        setCurrentTitle(`Loading page ${i + 1}/${pageIds.length}...`);
        setProgress({ current: i, total: pageIds.length });

        try {
          const body = await invoke<{ id: string; title: string; blocks: unknown[] }>('getPageBody', { pageId: pageIds[i] });
          exportPages.push({
            id: body.id,
            title: body.title,
            blocks: body.blocks as ExportPage['blocks'],
            depth: 0,
          });
        } catch (err) {
          failed.push({
            pageId: pageIds[i],
            error: err instanceof Error ? err.message : 'Failed to load page',
          });
        }
      }

      if (cancelRef.current) {
        reset();
        return;
      }

      setFailedPages(failed);
      if (exportPages.length === 0) {
        throw new Error(
          failed.length > 0
            ? `No pages could be loaded (first error: ${failed[0].error})`
            : 'No pages selected'
        );
      }

      // Generate document
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'word') {
        setCurrentTitle('Generating Word document...');
        setProgress({ current: exportPages.length, total: exportPages.length });
        const blob = await docxToBlob(buildDocx(exportPages));
        downloadDocx(blob, `export-${dateStr}.docx`);
      } else {
        setCurrentTitle('Generating PDF...');
        const pdfBytes = await generatePdf(exportPages, stationeryBytes, (current, total) => {
          setProgress({ current, total });
          setCurrentTitle(`Rendering page ${current}/${total}...`);
        });
        downloadPdf(pdfBytes, `export-${dateStr}.pdf`);
      }
      setExportedCount(exportPages.length);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setPhase('done');
    }
  }, [spaceId, selectedIds, stationeryFile, format, reset]);

  if (!spaceKey || !spaceId) {
    return (
      <div style={{
        padding: '32px 24px',
        textAlign: 'center',
        color: C.N200,
        fontSize: 14,
        backgroundColor: C.N20,
        borderRadius: 8,
        border: `1px solid ${C.N40}`,
      }}>
        Please select a target space first
      </div>
    );
  }

  // SELECT phase
  if (phase === 'select') {
    const canExport = selectedIds.size > 0 && selectedIds.size <= MAX_PAGES;
    return (
      <div>
        <ExportPageTree
          spaceKey={spaceKey}
          spaceId={spaceId}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          maxPages={MAX_PAGES}
        />

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.N200, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Format
            </label>
            <div style={{ marginTop: 4, display: 'inline-flex', border: `1px solid ${C.N40}`, borderRadius: 4, overflow: 'hidden' }}>
              {(['pdf', 'word'] as ExportFormat[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    padding: '6px 18px',
                    fontSize: 13,
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    color: format === f ? '#fff' : C.N200,
                    backgroundColor: format === f ? C.B400 : '#fff',
                  }}
                >
                  {f === 'pdf' ? 'PDF' : 'Word (.docx)'}
                </button>
              ))}
            </div>
          </div>

          {format === 'pdf' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.N200, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stationery (optional)
              </label>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleStationeryChange}
                  style={{ fontSize: 13 }}
                />
                {stationeryFile && (
                  <button
                    onClick={() => setStationeryFile(null)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 12,
                      color: C.N200,
                      background: 'transparent',
                      border: `1px solid ${C.N40}`,
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedIds.size > MAX_PAGES && (
            <div style={{ padding: '8px 12px', backgroundColor: C.R75, fontSize: 13, color: C.R400, borderRadius: 4 }}>
              Max. {MAX_PAGES} pages per export. Please reduce your selection.
            </div>
          )}

          <button
            onClick={startExport}
            disabled={!canExport}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 500,
              color: canExport ? '#fff' : C.N200,
              backgroundColor: canExport ? C.B400 : C.N20,
              border: 'none',
              borderRadius: 4,
              cursor: canExport ? 'pointer' : 'default',
              alignSelf: 'flex-start',
            }}
          >
            Export {selectedIds.size} page{selectedIds.size !== 1 ? 's' : ''} as {format === 'pdf' ? 'PDF' : 'Word'}
          </button>
        </div>
      </div>
    );
  }

  // GENERATING phase
  if (phase === 'generating') {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.N800, marginBottom: 8 }}>
          Exporting... {progress.current}/{progress.total}
        </div>
        <div style={{ height: 6, backgroundColor: C.N20, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: C.B400, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 13, color: C.N200, marginBottom: 12 }}>{currentTitle}</div>
        <button
          onClick={() => { cancelRef.current = true; }}
          style={{
            padding: '6px 16px',
            fontSize: 13,
            color: C.R400,
            backgroundColor: 'transparent',
            border: `1px solid ${C.R400}`,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // DONE phase
  const isPartial = !error && failedPages.length > 0;
  return (
    <div>
      <div style={{
        padding: '16px',
        borderRadius: 8,
        backgroundColor: error ? C.R75 : isPartial ? '#FFF7D6' : C.G75,
        border: `1px solid ${error ? C.R400 : isPartial ? '#E2B203' : '#ABF5D1'}`,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.N800, marginBottom: 4 }}>
          {error ? 'Export failed' : isPartial ? 'Export completed with errors' : 'Export completed'}
        </div>
        <div style={{ fontSize: 13, color: C.N800 }}>
          {error ? error : `${exportedCount} page${exportedCount !== 1 ? 's' : ''} exported. The ${format === 'pdf' ? 'PDF' : 'Word document'} has been downloaded.`}
        </div>
        {!error && failedPages.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: C.N800 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {failedPages.length} page{failedPages.length !== 1 ? 's' : ''} could not be loaded:
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {failedPages.map(f => (
                <li key={f.pageId}>Page {f.pageId}: {f.error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={reset}
        style={{
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 500,
          color: '#fff',
          backgroundColor: C.B400,
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Start new export
      </button>
    </div>
  );
};

export default BatchExportPDF;
