import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@forge/bridge';
import { C } from '../utils/colors';
import { describeError } from '../utils/errorMessages';

interface ImportPage {
  id: string;
  title: string;
}

interface ImportResult {
  pageId: string;
  confluencePageId: string;
  title: string;
  status: 'success' | 'error';
  error?: string;
  imagesTotal?: number;
  imagesUploaded?: number;
  imagesFailed?: number;
}

interface ImportButtonProps {
  pages: ImportPage[];
  spaceId: string;
  parentId: string | null;
  disabled?: boolean;
}

type Phase = 'idle' | 'importing' | 'done';

const ImportButton: React.FC<ImportButtonProps> = ({ pages, spaceId, parentId, disabled }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [current, setCurrent] = useState(0);
  const [currentTitle, setCurrentTitle] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const cancelRef = useRef(false);

  const startImport = useCallback(async () => {
    cancelRef.current = false;
    setPhase('importing');
    setCurrent(0);
    setResults([]);

    const importResults: ImportResult[] = [];

    for (let i = 0; i < pages.length; i++) {
      if (cancelRef.current) break;

      const page = pages[i];
      setCurrentTitle(page.title);
      setCurrent(i + 1);

      try {
        const result = await invoke<ImportResult>('importOneNotePage', {
          pageId: page.id,
          title: page.title,
          spaceId,
          parentId,
        });
        importResults.push(result);
      } catch (err) {
        importResults.push({
          pageId: page.id,
          confluencePageId: '',
          title: page.title,
          status: 'error',
          error: describeError(err, 'Import failed'),
        });
      }
    }

    setResults(importResults);
    setPhase('done');
  }, [pages, spaceId, parentId]);

  const reset = useCallback(() => {
    setPhase('idle');
    setResults([]);
    setCurrent(0);
    setCurrentTitle('');
  }, []);

  // IDLE
  if (phase === 'idle') {
    const canImport = pages.length > 0 && !disabled;
    const label =
      disabled ? 'Select a target space'
        : pages.length === 0 ? 'Select pages to import'
          : `Import ${pages.length} page${pages.length !== 1 ? 's' : ''}`;
    return (
      <button
        onClick={startImport}
        disabled={!canImport}
        style={{
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 500,
          color: canImport ? '#fff' : C.N200,
          backgroundColor: canImport ? C.B400 : C.N20,
          border: 'none',
          borderRadius: 4,
          cursor: canImport ? 'pointer' : 'default',
        }}
      >
        {label}
      </button>
    );
  }

  // IMPORTING
  if (phase === 'importing') {
    const pct = pages.length > 0 ? Math.round((current / pages.length) * 100) : 0;
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.N800, marginBottom: 8 }}>
          Importing... {current}/{pages.length}
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

  // DONE
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const imagesUploaded = results.reduce((sum, r) => sum + (r.imagesUploaded ?? 0), 0);
  const imagesFailed = results.reduce((sum, r) => sum + (r.imagesFailed ?? 0), 0);
  return (
    <div>
      <div style={{
        padding: '16px',
        borderRadius: 8,
        backgroundColor: failed === 0 ? C.G75 : C.N20,
        border: `1px solid ${failed === 0 ? '#ABF5D1' : C.N40}`,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.N800, marginBottom: 4 }}>
          Import completed
        </div>
        <div style={{ fontSize: 13, color: C.N800 }}>
          {succeeded} successful{failed > 0 ? `, ${failed} failed` : ''}
          {imagesUploaded + imagesFailed > 0 && (
            <> · {imagesUploaded} image{imagesUploaded !== 1 ? 's' : ''} uploaded
            {imagesFailed > 0 ? `, ${imagesFailed} failed (see info panels on the pages)` : ''}</>
          )}
        </div>
      </div>

      {failed > 0 && (
        <div style={{ marginBottom: 12 }}>
          {results.filter(r => r.status === 'error').map((r, i) => (
            <div key={i} style={{
              padding: '6px 12px',
              fontSize: 13,
              color: C.R400,
              backgroundColor: C.R75,
              borderRadius: 4,
              marginBottom: 2,
            }}>
              {r.title}: {r.error}
            </div>
          ))}
        </div>
      )}

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
        Start new import
      </button>
    </div>
  );
};

export default ImportButton;
