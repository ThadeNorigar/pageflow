import React, { useState, useCallback } from 'react';
import SpaceBrowser, { SpaceSelection } from './components/SpaceBrowser';
import NotebookBrowser, { OneNoteSelection } from './components/NotebookBrowser';
import FileUpload from './components/FileUpload';

const App: React.FC = () => {
  const [selection, setSelection] = useState<SpaceSelection | null>(null);
  const [oneNoteSelection, setOneNoteSelection] = useState<OneNoteSelection>({ pages: [] });

  const handleSelect = useCallback((sel: SpaceSelection) => {
    setSelection(sel);
  }, []);

  const handleOneNoteChange = useCallback((sel: OneNoteSelection) => {
    setOneNoteSelection(sel);
  }, []);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#172B4D', margin: '0 0 4px' }}>
        PageFlow
      </h1>
      <p style={{ fontSize: 14, color: '#6B778C', margin: '0 0 24px' }}>
        Content-Migration nach Confluence
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#172B4D', margin: '0 0 12px' }}>
        Quelle
      </h2>
      <NotebookBrowser onSelectionChange={handleOneNoteChange} />

      {oneNoteSelection.pages.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          backgroundColor: '#DEEBFF',
          borderRadius: 6,
          fontSize: 14,
          color: '#172B4D',
          lineHeight: '20px',
          border: '1px solid #B3D4FF',
        }}>
          <strong>{oneNoteSelection.pages.length}</strong> OneNote-Seite{oneNoteSelection.pages.length !== 1 ? 'n' : ''} ausgewählt
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#172B4D', margin: '24px 0 12px' }}>
        Ziel
      </h2>
      <SpaceBrowser onSelect={handleSelect} />

      {selection && (
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          backgroundColor: '#E3FCEF',
          borderRadius: 6,
          fontSize: 14,
          color: '#172B4D',
          lineHeight: '20px',
          border: '1px solid #ABF5D1',
        }}>
          Space: <strong>{selection.spaceKey}</strong>
          {selection.pageId
            ? <> | Page ID: <strong>{selection.pageId}</strong></>
            : <> | <em style={{ color: '#6B778C' }}>Space Root</em></>
          }
        </div>
      )}

      <FileUpload selection={selection} spaceId={selection?.spaceId ?? null} />
    </div>
  );
};

export default App;
