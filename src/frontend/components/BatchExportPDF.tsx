import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@forge/bridge';
import { C } from '../utils/colors';
import ExportPageTree from './ExportPageTree';
import { generatePdf, downloadPdf, ExportPage } from '../utils/pdfExport';

interface BatchExportPDFProps {
  spaceKey: string | null;
  spaceId: string | null;
}

type Phase = 'select' | 'generating' | 'done';

const MAX_PAGES = 50;

const BatchExportPDF: React.FC<BatchExportPDFProps> = ({ spaceKey, spaceId }) => {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeChildren, setIncludeChildren] = useState(false);
  const [stationeryFile, setStationeryFile] = useState<File | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentTitle, setCurrentTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exportedCount, setExportedCount] = useState(0);
  const cancelRef = useRef(false);

  const handleStationeryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Briefpapier-PDF darf max. 5 MB gross sein');
      return;
    }
    setStationeryFile(file);
  }, []);

  const reset = useCallback(() => {
    setPhase('select');
    setProgress({ current: 0, total: 0 });
    setCurrentTitle('');
    setError(null);
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
      // Load and validate stationery bytes
      let stationeryBytes: Uint8Array | undefined;
      if (stationeryFile) {
        const buffer = await stationeryFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
          throw new Error('Ungültige Briefpapier-Datei (kein gültiges PDF)');
        }
        stationeryBytes = bytes;
      }

      // Fetch page bodies
      const exportPages: ExportPage[] = [];
      for (let i = 0; i < pageIds.length; i++) {
        if (cancelRef.current) break;

        setCurrentTitle(`Lade Seite ${i + 1}/${pageIds.length}...`);
        setProgress({ current: i, total: pageIds.length });

        try {
          const body = await invoke<{ id: string; title: string; blocks: unknown[] }>('getPageBody', { pageId: pageIds[i] });
          exportPages.push({
            id: body.id,
            title: body.title,
            blocks: body.blocks as ExportPage['blocks'],
            depth: 0,
          });
        } catch {
          exportPages.push({
            id: pageIds[i],
            title: `Seite ${pageIds[i]}`,
            blocks: [{ type: 'placeholder' as const }],
            depth: 0,
          });
        }
      }

      if (cancelRef.current) {
        reset();
        return;
      }

      // Generate PDF
      setCurrentTitle('PDF wird generiert...');
      const pdfBytes = await generatePdf(exportPages, stationeryBytes, (current, total) => {
        setProgress({ current, total });
        setCurrentTitle(`Rendere Seite ${current}/${total}...`);
      });

      // Download
      const filename = `export-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadPdf(pdfBytes, filename);
      setExportedCount(exportPages.length);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen');
      setPhase('done');
    }
  }, [spaceId, selectedIds, stationeryFile, reset]);

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
        Bitte zuerst einen Ziel-Space auswählen
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
          includeChildren={includeChildren}
        />

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.N800, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeChildren}
              onChange={e => setIncludeChildren(e.target.checked)}
            />
            Unterseiten einbeziehen
          </label>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.N200, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Briefpapier (optional)
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
                  Entfernen
                </button>
              )}
            </div>
          </div>

          {selectedIds.size > MAX_PAGES && (
            <div style={{ padding: '8px 12px', backgroundColor: C.R75, fontSize: 13, color: C.R400, borderRadius: 4 }}>
              Max. {MAX_PAGES} Seiten pro Export. Bitte Auswahl reduzieren.
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
            {selectedIds.size} Seite{selectedIds.size !== 1 ? 'n' : ''} exportieren
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
          Export läuft... {progress.current}/{progress.total}
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
          Abbrechen
        </button>
      </div>
    );
  }

  // DONE phase
  return (
    <div>
      <div style={{
        padding: '16px',
        borderRadius: 8,
        backgroundColor: error ? C.R75 : C.G75,
        border: `1px solid ${error ? C.R400 : '#ABF5D1'}`,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.N800, marginBottom: 4 }}>
          {error ? 'Export fehlgeschlagen' : 'Export abgeschlossen'}
        </div>
        <div style={{ fontSize: 13, color: C.N800 }}>
          {error ? error : `${exportedCount} Seite${exportedCount !== 1 ? 'n' : ''} exportiert. PDF wurde heruntergeladen.`}
        </div>
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
        Neuen Export starten
      </button>
    </div>
  );
};

export default BatchExportPDF;
