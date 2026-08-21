import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@forge/bridge';
import { SpaceSelection } from '../types';
import { C } from '../utils/colors';
import { buildFolderTree, countFiles, totalSize, FolderNode } from '../utils/folderTree';
import { validateFile, titleFromFilename } from '../utils/fileValidation';
import { escapeXml } from '../utils/escapeXml';
import { describeError } from '../utils/errorMessages';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function viewFileMacro(filename: string): string {
  return `<ac:structured-macro ac:name="view-file" ac:schema-version="1"><ac:parameter ac:name="name"><ri:attachment ri:filename="${escapeXml(filename)}"/></ac:parameter></ac:structured-macro>`;
}

const BatchImportPDF: React.FC<BatchImportPDFProps> = ({ selection, spaceId }) => {
  const [phase, setPhase] = useState<Phase>('select');
  const [tree, setTree] = useState<FolderNode | null>(null);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [excludedFiles, setExcludedFiles] = useState<Set<string>>(new Set());
  const [currentFile, setCurrentFile] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const built = buildFolderTree(Array.from(e.target.files));
    if (!built) return;
    setTree(built);
    setExcludedFiles(new Set());
    setPhase('preview');
  }, []);

  const allFileCount = tree ? countFiles(tree, includeSubfolders) : 0;
  const selectedFileCount = allFileCount - excludedFiles.size;
  const fileSizeMB = tree ? (totalSize(tree, includeSubfolders) / 1024 / 1024).toFixed(1) : '0';

  const toggleFile = useCallback((fileKey: string) => {
    setExcludedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileKey)) next.delete(fileKey);
      else next.add(fileKey);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPhase('select');
    setTree(null);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setCurrentFile('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const startImport = useCallback(async () => {
    if (!tree || !selection || !spaceId) return;

    cancelRef.current = false;
    setPhase('importing');
    const importResults: ImportResult[] = [];
    setProgress({ current: 0, total: selectedFileCount });

    async function importFolder(node: FolderNode, parentId: string | null): Promise<void> {
      if (cancelRef.current) return;

      // Create folder page
      let folderPageId = parentId;
      try {
        setCurrentFile(`Creating folder: ${node.name}`);
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
          error: describeError(err, 'Folder page failed'),
        });
        return;
      }

      // Import PDFs in this folder
      for (const file of node.files) {
        if (cancelRef.current) return;

        const fileKey = `${node.path}/${file.name}`;
        if (excludedFiles.has(fileKey)) continue;

        const validationErr = validateFile(file);
        if (validationErr) {
          importResults.push({ name: file.name, status: 'error', error: validationErr });
          setProgress(p => ({ ...p, current: p.current + 1 }));
          continue;
        }

        try {
          setCurrentFile(file.name);

          const title = titleFromFilename(file.name);
          const pageResult = await invoke<{ pageId: string }>('createPage', {
            title,
            spaceId,
            parentId: folderPageId,
          });

          const fileBase64 = await fileToBase64(file);
          await invoke('uploadAttachment', {
            pageId: pageResult.pageId,
            filename: file.name,
            fileBase64,
            mimeType: file.type || 'application/pdf',
          });

          await invoke('updatePageBody', {
            pageId: pageResult.pageId,
            title,
            body: viewFileMacro(file.name),
          });

          importResults.push({ name: file.name, status: 'done' });
        } catch (err) {
          importResults.push({
            name: file.name,
            status: 'error',
            error: describeError(err, 'Upload failed'),
          });
        }
        setProgress(p => ({ ...p, current: p.current + 1 }));
      }

      // Recurse into subfolders
      if (includeSubfolders) {
        for (const child of node.children) {
          if (cancelRef.current) return;
          await importFolder(child, folderPageId);
        }
      }
    }

    await importFolder(tree, selection.pageId);
    setResults(importResults);
    setPhase('done');
  }, [tree, selection, spaceId, includeSubfolders, excludedFiles, selectedFileCount]);

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
            Select folder
          </div>
          <div style={{ fontSize: 12, color: C.N200, marginTop: 4 }}>
            All PDFs in the folder will be imported as Confluence pages
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
                {selectedFileCount}/{allFileCount} PDF{allFileCount !== 1 ? 's' : ''} &middot; {fileSizeMB} MB
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
              Change
            </button>
          </div>

          <div style={{ padding: '12px 16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.N800, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeSubfolders}
                onChange={e => setIncludeSubfolders(e.target.checked)}
              />
              Include subfolders
              {tree.children.length > 0 && (
                <span style={{ color: C.N200 }}>({tree.children.length} subfolders)</span>
              )}
            </label>
          </div>

          {selectedFileCount > MAX_FILE_COUNT && (
            <div style={{ padding: '8px 16px', backgroundColor: C.R75, fontSize: 13, color: C.R400 }}>
              Max. {MAX_FILE_COUNT} PDFs per batch. Please disable subfolders or split the folder.
            </div>
          )}

          <PreviewTree node={tree} depth={0} includeSubfolders={includeSubfolders} excludedFiles={excludedFiles} onToggleFile={toggleFile} />
        </div>

        {(() => {
          const canImport = !!selection && !!spaceId && selectedFileCount > 0 && selectedFileCount <= MAX_FILE_COUNT;
          const reason = !spaceId ? 'Please select a space first'
            : !selection?.pageId ? 'Please select a target page in the page tree'
            : null;
          return (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={startImport}
                disabled={!canImport}
                style={{
                  padding: '8px 20px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: canImport ? '#fff' : C.N200,
                  backgroundColor: canImport ? C.B400 : C.N20,
                  border: canImport ? 'none' : `1px solid ${C.N40}`,
                  borderRadius: 4,
                  cursor: canImport ? 'pointer' : 'default',
                }}
              >
                Import {selectedFileCount} PDF{selectedFileCount !== 1 ? 's' : ''}
              </button>
              {!canImport && reason && (
                <div style={{ marginTop: 6, fontSize: 12, color: C.N200 }}>
                  {reason}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // IMPORTING phase
  if (phase === 'importing') {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.N800, marginBottom: 8 }}>
          Importing... {progress.current}/{progress.total}
        </div>
        <div style={{ height: 6, backgroundColor: C.N20, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: C.B400, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 13, color: C.N200, marginBottom: 12 }}>{currentFile}</div>
        <button
          onClick={cancelImport}
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
            Import completed
          </div>
          <div style={{ fontSize: 13, color: C.N800 }}>
            {succeeded} successful{failed > 0 ? `, ${failed} failed` : ''}
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
          Start new import
        </button>
      </div>
    );
  }

  return null;
};

// Preview sub-component
const PreviewTree: React.FC<{
  node: FolderNode; depth: number; includeSubfolders: boolean;
  excludedFiles: Set<string>; onToggleFile: (key: string) => void;
}> = ({ node, depth, includeSubfolders, excludedFiles, onToggleFile }) => (
  <div style={{ padding: depth === 0 ? '4px 0' : 0 }}>
    {node.files.map((f, i) => {
      const fileKey = `${node.path}/${f.name}`;
      const isExcluded = excludedFiles.has(fileKey);
      return (
        <div key={i} style={{
          padding: '4px 16px',
          paddingLeft: (depth + 1) * 16,
          fontSize: 13,
          color: isExcluded ? C.N200 : C.N800,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: isExcluded ? 0.6 : 1,
        }}>
          <input
            type="checkbox"
            checked={!isExcluded}
            onChange={() => onToggleFile(fileKey)}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ color: C.R400, fontSize: 12 }}>PDF</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          <span style={{ color: C.N200, fontSize: 12, flexShrink: 0 }}>
            {(f.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
      );
    })}
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
        <PreviewTree node={child} depth={depth + 1} includeSubfolders={includeSubfolders} excludedFiles={excludedFiles} onToggleFile={onToggleFile} />
      </div>
    ))}
  </div>
);

export default BatchImportPDF;
