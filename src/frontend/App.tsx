import React, { useState, useCallback } from 'react';
import SpaceBrowser, { SpaceSelection } from './components/SpaceBrowser';

const App: React.FC = () => {
  const [selection, setSelection] = useState<SpaceSelection | null>(null);

  const handleSelect = useCallback((sel: SpaceSelection) => {
    setSelection(sel);
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '960px' }}>
      <h1>ConfluenceImporter</h1>
      <p>Content-Migration nach Confluence</p>

      <h2>Ziel auswählen</h2>
      <SpaceBrowser onSelect={handleSelect} />

      {selection && (
        <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#e3fcef', borderRadius: '3px' }}>
          Space: <strong>{selection.spaceKey}</strong>
          {selection.pageId
            ? <> | Page ID: <strong>{selection.pageId}</strong></>
            : <> | <em>Space Root</em></>
          }
        </div>
      )}
    </div>
  );
};

export default App;
