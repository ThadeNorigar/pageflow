import React, { useState, useCallback, useRef } from 'react';
import { invoke, requestConfluence } from '@forge/bridge';
import { SpaceSelection } from '../types';
import { C } from '../utils/colors';
import { buildFolderTree, flattenTree, countFiles, totalSize, FolderNode } from '../utils/folderTree';
import { validateFile } from '../utils/fileValidation';

interface BatchImportPDFProps {
  selection: SpaceSelection | null;
  spaceId: string | null;
}

type Phase = 'select' | 'preview' | 'importing' | 'done';

interface ImportResult {
  name: string;
  status: 'done' | 'error';
  error?: string;
}

const MAX_FILE_COUNT = 100;

const BatchImportPDF: React.FC<BatchImportPDFProps> = ({ selection, spaceId }) => {
  const [phase, setPhase] = useState<Phase>('select');
  const [tree, setTree] = useState<FolderNode | null>(null);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [currentFile, setCurrentFile] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const built = buildFolderTree(Array.from(e.target.files));
    if (!built) return;
    setTree(built);
    setPhase('preview');
  }, []);

  const fileCount = tree ? countFiles(tree, includeSubfolders) : 0;
  const fileSizeMB = tree ? (totalSize(tree, includeSubfolders) / 1024 / 1024).toFixed(1) : '0';

  const reset = useCallback(() => {
    setPhase('select');
    setTree(null);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setCurrentFile('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const startImport = useCallback(async () => {
    if (!tree || !selection || !spaceId) return;

    setPhase('importing');
    const importResults: ImportResult[] = [];
    const total = countFiles(tree, includeSubfolders);
    setProgress({ current: 0, total });

    async function importFolder(node: FolderNode, parentId: string | null): Promise<void> {
      // Create folder page
      let folderPageId = parentId;
      try {
        setCurrentFile(`Erstelle Ordner: ${node.name}`);
        const result = await invoke<{ pageId: string }>('createPage', {
          title: node.name,
          spaceId,
          parentId,
        });
        folderPageId = result.pageId;
      } catch (err) {
        importResults.push({
          name: `📁 ${node.name}`,
          status: 'error',
          error: err instanceof Error ? err.message : 'Ordner-Seite fehlgeschlagen',
        });
        return; // Skip all files in this folder
      }

      // Import PDFs in this folder
      for (const file of node.files) {
        const validationErr = validateFile(file);
        if (validationErr) {
          importResults.push({ name: file.name, status: 'error', error: validationErr });
          setProgress(p => ({ ...p, current: p.current + 1 }));
          continue;
        }

        try {
          setCurrentFile(file.name);

          // Create page for PDF
          const title = file.name.replace(/\.pdf$/i, '');
          const pageResult = await invoke<{ pageId: string }>('createPage', {
            title,
            spaceId,
            parentId: folderPageId,
          });

          // Upload PDF as attachment
          const form = new FormData();
          form.append('file', file, file.name);
          const attachResponse = await requestConfluence(`/wiki/rest/api/content/${pageResult.pageId}/child/attachment`, {
            method: 'POST',
            body: form,
            headers: { 'X-Atlassian-Token': 'nocheck' },
          });

          if (!attachResponse.ok) {
            const errText = await attachResponse.text();
            throw new Error(`Attachment: ${attachResponse.status} ${errText}`);
          }

          importResults.push({ name: file.name, status: 'done' });
        } catch (err) {
          importResults.push({
            name: file.name,
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload fehlgeschlagen',
          });
        }
        setProgress(p => ({ ...p, current: p.current + 1 }));
      }

      // Recurse into subfolders
      if (includeSubfolders) {
        for (const child of node.children) {
          await importFolder(child, folderPageId);
        }
      }
    }

    await importFolder(tree, selection.pageId);
    setResults(importResults);
    setPhase('done');
  }, [tree, selection, spaceId, includeSubfolders]);

  // SELECT phase
  if (phase === 'select') {
    return (
      <div>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${C.N40}`,
            borderRadius: 8,
            padding: '32px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: C.N20,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>&#128193;</div>
          <div style={{ fontSize: 14, color: C.N800, fontWeight: 500 }}>
            Ordner auswählen
          </div>
          <div style={{ fontSize: 12, color: C.N200, marginTop: 4 }}>
            Alle PDFs im Ordner werden als Confluence-Seiten importiert
          </div>
          <input
            ref={inputRef}
            type="file"
            onChange={handleFolderSelect}
            style={{ display: 'none' }}
            {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
          />
        </div>
      </div>
    );
  }

  // PREVIEW phase
  if (phase === 'preview' && tree) {
    return (
      <div>
        <div style={{
          border: `1px solid ${C.N40}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            backgroundColor: C.N10,
            borderBottom: `1px solid ${C.N40}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.N800 }}>
                {tree.name}
              </span>
              <span style={{ fontSize: 13, color: C.N200, marginLeft: 8 }}>
                {fileCount} PDF{fileCount !== 1 ? 's' : ''} &middot; {fileSizeMB} MB
              </span>
            </div>
            <button
              onClick={reset}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                color: C.N200,
                background: 'transparent',
                border: `1px solid ${C.N40}`,
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              Ändern
            </button>
          </div>

          <div style={{ padding: '12px 16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.N800, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeSubfolders}
                onChange={e => setIncludeSubfolders(e.target.checked)}
              />
              Unterordner einbeziehen
              {tree.children.length > 0 && (
                <span style={{ color: C.N200 }}>({tree.children.length} Unterordner)</span>
              )}
            </label>
          </div>

          {fileCount > MAX_FILE_COUNT && (
            <div style={{ padding: '8px 16px', backgroundColor: C.R75, fontSize: 13, color: C.R400 }}>
              Max. {MAX_FILE_COUNT} PDFs pro Batch. Bitte Unterordner deaktivieren oder Ordner aufteilen.
            </div>
          )}

          <PreviewTree node={tree} depth={0} includeSubfolders={includeSubfolders} />
        </div>

        {!selection && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.N200 }}>
            Bitte zuerst eine Ziel-Seite auswählen
          </div>
        )}

        <button
          onClick={startImport}
          disabled={!selection || !spaceId || fileCount === 0 || fileCount > MAX_FILE_COUNT}
          style={{
            marginTop: 12,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 500,
            color: !selection || fileCount === 0 || fileCount > MAX_FILE_COUNT ? C.N200 : '#fff',
            backgroundColor: !selection || fileCount === 0 || fileCount > MAX_FILE_COUNT ? C.N20 : C.B400,
            border: 'none',
            borderRadius: 4,
            cursor: !selection || fileCount === 0 || fileCount > MAX_FILE_COUNT ? 'default' : 'pointer',
          }}
        >
          {fileCount} PDF{fileCount !== 1 ? 's' : ''} importieren
        </button>
      </div>
    );
  }

  // IMPORTING phase
  if (phase === 'importing') {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.N800, marginBottom: 8 }}>
          Import läuft... {progress.current}/{progress.total}
        </div>
        <div style={{ height: 6, backgroundColor: C.N20, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: C.B400, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 13, color: C.N200 }}>{currentFile}</div>
      </div>
    );
  }

  // DONE phase
  if (phase === 'done') {
    const succeeded = results.filter(r => r.status === 'done').length;
    const failed = results.filter(r => r.status === 'error').length;
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
            Import abgeschlossen
          </div>
          <div style={{ fontSize: 13, color: C.N800 }}>
            {succeeded} erfolgreich{failed > 0 ? `, ${failed} fehlgeschlagen` : ''}
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
                {r.name}: {r.error}
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
          Neuen Import starten
        </button>
      </div>
    );
  }

  return null;
};

// Preview sub-component
const PreviewTree: React.FC<{ node: FolderNode; depth: number; includeSubfolders: boolean }> = ({ node, depth, includeSubfolders }) => (
  <div style={{ padding: depth === 0 ? '4px 0' : 0 }}>
    {node.files.map((f, i) => (
      <div key={i} style={{
        padding: '4px 16px',
        paddingLeft: (depth + 1) * 16,
        fontSize: 13,
        color: C.N800,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ color: C.R400, fontSize: 12 }}>PDF</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
        <span style={{ color: C.N200, fontSize: 12, flexShrink: 0 }}>
          {(f.size / 1024 / 1024).toFixed(1)} MB
        </span>
      </div>
    ))}
    {includeSubfolders && node.children.map((child, i) => (
      <div key={i}>
        <div style={{
          padding: '4px 16px',
          paddingLeft: (depth + 1) * 16,
          fontSize: 13,
          fontWeight: 500,
          color: C.N800,
        }}>
          &#128193; {child.name}
        </div>
        <PreviewTree node={child} depth={depth + 1} includeSubfolders={includeSubfolders} />
      </div>
    ))}
  </div>
);

export default BatchImportPDF;
