import React, { useState, useCallback } from 'react';
import SpaceDropdown, { ConfluenceSpace } from './components/SpaceDropdown';
import Tabs from './components/Tabs';
import PageTree from './components/PageTree';
import BatchImportPDF from './components/BatchImportPDF';
import BatchExportPDF from './components/BatchExportPDF';
import NotebookBrowser, { OneNoteSelection } from './components/NotebookBrowser';
import ImportButton from './components/ImportButton';
import { TabId, DEFAULT_TAB } from './utils/tabs';
import { SpaceSelection } from './types';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

const App: React.FC = () => {
  const [selectedSpace, setSelectedSpace] = useState<ConfluenceSpace | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  const [oneNoteSelection, setOneNoteSelection] = useState<OneNoteSelection>({ pages: [] });

  const handleSpaceChange = useCallback((space: ConfluenceSpace) => {
    setSelectedSpace(space);
    setSelectedPageId(null);
  }, []);

  const handlePageChange = useCallback((pageId: string | null) => {
    setSelectedPageId(pageId);
  }, []);

  const handleOneNoteChange = useCallback((sel: OneNoteSelection) => {
    setOneNoteSelection(sel);
  }, []);

  const selection: SpaceSelection | null = selectedSpace
    ? { spaceKey: selectedSpace.key, spaceId: selectedSpace.id, pageId: selectedPageId }
    : null;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, fontFamily: FONT }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#172B4D', margin: '0 0 4px' }}>
        PageFlow
      </h1>
      <p style={{ fontSize: 14, color: '#6B778C', margin: '0 0 24px' }}>
        Content-Migration nach Confluence
      </p>

      {/* Space Dropdown */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B778C', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Ziel-Space
        </label>
        <SpaceDropdown selectedSpace={selectedSpace} onSelectSpace={handleSpaceChange} />
      </div>

      {/* Tabs */}
      <Tabs activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Tab Content */}
      <div style={{ padding: '20px 0' }}>
        {activeTab === 'pdf-import' && (
          <BatchImportPDF selection={selection} spaceId={selectedSpace?.id ?? null} />
        )}
        {activeTab === 'onenote-import' && (
          <>
            <NotebookBrowser onSelectionChange={handleOneNoteChange} />
            {oneNoteSelection.pages.length > 0 && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                backgroundColor: '#DEEBFF',
                borderRadius: 6,
                fontSize: 14,
                color: '#172B4D',
                border: '1px solid #B3D4FF',
              }}>
                <strong>{oneNoteSelection.pages.length}</strong> OneNote-Seite{oneNoteSelection.pages.length !== 1 ? 'n' : ''} ausgewählt
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <ImportButton
                pages={oneNoteSelection.pages}
                spaceId={selectedSpace?.id ?? ''}
                parentId={selectedPageId}
                disabled={!selectedSpace}
              />
            </div>
          </>
        )}
        {activeTab === 'pdf-export' && (
          <BatchExportPDF
            spaceKey={selectedSpace?.key ?? null}
            spaceId={selectedSpace?.id ?? null}
          />
        )}
      </div>

      {/* Shared Page Tree (target selection) */}
      {selectedSpace && (
        <PageTree
          spaceKey={selectedSpace.key}
          spaceId={selectedSpace.id}
          selectedPageId={selectedPageId}
          onSelectPage={handlePageChange}
        />
      )}

      {/* Selection Summary */}
      {selection && (
        <div style={{
          marginTop: 12,
          padding: '10px 14px',
          backgroundColor: '#E3FCEF',
          borderRadius: 6,
          fontSize: 14,
          color: '#172B4D',
          border: '1px solid #ABF5D1',
        }}>
          Ziel: <strong>{selection.spaceKey}</strong>
          {selection.pageId
            ? <> | Seite: <strong>{selection.pageId}</strong></>
            : <> | <em style={{ color: '#6B778C' }}>Space Root</em></>
          }
        </div>
      )}
    </div>
  );
};

export default App;
