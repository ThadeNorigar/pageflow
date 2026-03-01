import React, { useState, useCallback, useRef } from 'react';
import { invoke, requestConfluence } from '@forge/bridge';
import { SpaceSelection } from '../types';
import { validateFile, titleFromFilename } from '../utils/fileValidation';

interface FileUploadProps {
  selection: SpaceSelection | null;
  spaceId: string | null;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  pageId?: string;
}

const C = {
  N900: '#091E42',
  N800: '#172B4D',
  N200: '#6B778C',
  N40: '#DFE1E6',
  N20: '#F4F5F7',
  B400: '#0052CC',
  B75: '#DEEBFF',
  R400: '#DE350B',
  R75: '#FFEBE6',
  G400: '#00875A',
  G75: '#E3FCEF',
};

const FileUpload: React.FC<FileUploadProps> = ({ selection, spaceId }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      const err = validateFile(file);
      if (err) {
        errors.push(err);
      } else {
        newFiles.push({ file, status: 'pending', progress: 0 });
      }
    }

    setValidationErrors(errors);
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  }, [addFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadAll = useCallback(async () => {
    if (!selection || !spaceId) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== 'pending') continue;

      setFiles(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading', progress: 10 } : item
      ));

      try {
        // Step 1: Create Confluence page via resolver
        const title = titleFromFilename(f.file.name);
        const result = await invoke<{ pageId: string; title: string }>('createPage', {
          title,
          spaceId,
          parentId: selection.pageId,
        });

        setFiles(prev => prev.map((item, idx) =>
          idx === i ? { ...item, progress: 40 } : item
        ));

        // Step 2: Upload PDF as attachment via requestConfluence (direct from frontend)
        const form = new FormData();
        form.append('file', f.file, f.file.name);

        const attachResponse = await requestConfluence(`/wiki/rest/api/content/${result.pageId}/child/attachment`, {
          method: 'POST',
          body: form,
          headers: {
            'X-Atlassian-Token': 'nocheck',
          },
        });

        if (!attachResponse.ok) {
          const errText = await attachResponse.text();
          throw new Error(`Attachment upload failed: ${attachResponse.status} ${errText}`);
        }

        setFiles(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'done', progress: 100, pageId: result.pageId } : item
        ));

      } catch (err) {
        setFiles(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'error',
            progress: 0,
            error: err instanceof Error ? err.message : 'Upload fehlgeschlagen',
          } : item
        ));
      }
    }

    setUploading(false);
  }, [files, selection, spaceId]);

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const disabled = !selection || !spaceId || pendingCount === 0 || uploading;

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? C.B400 : C.N40}`,
          borderRadius: 8,
          padding: '32px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? C.B75 : C.N20,
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>&#128196;</div>
        <div style={{ fontSize: 14, color: C.N800, fontWeight: 500 }}>
          PDF-Dateien hierher ziehen
        </div>
        <div style={{ fontSize: 12, color: C.N200, marginTop: 4 }}>
          oder klicken zum Auswählen (max. 10MB pro Datei)
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: C.R75, borderRadius: 4, fontSize: 13, color: C.R400 }}>
          {validationErrors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              backgroundColor: f.status === 'error' ? C.R75 : f.status === 'done' ? C.G75 : '#fff',
              border: `1px solid ${C.N40}`,
              borderRadius: 4,
              marginBottom: 4,
              fontSize: 13,
            }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.N800 }}>
                {f.file.name}
                <span style={{ color: C.N200, marginLeft: 8 }}>
                  ({(f.file.size / 1024 / 1024).toFixed(1)}MB)
                </span>
              </span>

              {f.status === 'uploading' && (
                <span style={{ color: C.B400, marginLeft: 8, flexShrink: 0 }}>
                  {f.progress}%
                </span>
              )}
              {f.status === 'done' && (
                <span style={{ color: C.G400, marginLeft: 8, flexShrink: 0 }}>Fertig</span>
              )}
              {f.status === 'error' && (
                <span style={{ color: C.R400, marginLeft: 8, flexShrink: 0, fontSize: 12 }} title={f.error}>
                  Fehler
                </span>
              )}
              {f.status === 'pending' && !uploading && (
                <span
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{ cursor: 'pointer', color: C.N200, marginLeft: 8, flexShrink: 0, fontSize: 16, lineHeight: 1 }}
                  title="Entfernen"
                >
                  &times;
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={uploadAll}
          disabled={disabled}
          style={{
            marginTop: 12,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 500,
            color: disabled ? C.N200 : '#fff',
            backgroundColor: disabled ? C.N20 : C.B400,
            border: 'none',
            borderRadius: 4,
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          {uploading ? 'Wird hochgeladen...' : `${pendingCount} PDF${pendingCount !== 1 ? 's' : ''} hochladen`}
        </button>
      )}

      {!selection && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.N200 }}>
          Bitte zuerst ein Ziel auswählen
        </div>
      )}
    </div>
  );
};

export default FileUpload;
