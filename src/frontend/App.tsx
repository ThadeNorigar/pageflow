import React, { useState, useCallback } from 'react';
import SpaceDropdown, { ConfluenceSpace } from './components/SpaceDropdown';
import Tabs from './components/Tabs';
import PageTree from './components/PageTree';
import BatchImportPDF from './components/BatchImportPDF';
import BatchExportPDF from './components/BatchExportPDF';
import NotebookBrowser, { OneNoteSelection } from './components/NotebookBrowser';
import ImportButton from './components/ImportButton';
import LocalOneNoteImport from './components/LocalOneNoteImport';
import { TabId, DEFAULT_TAB } from './utils/tabs';
import { SpaceSelection } from './types';
import { C } from './utils/colors';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

const SECTION_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: C.N200,
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

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

  const isImportTab = activeTab === 'pdf-import' || activeTab === 'onenote-import' || activeTab === 'local-onenote';

  const renderSourceContent = () => {
    if (activeTab === 'pdf-import') {
      return <BatchImportPDF selection={selection} spaceId={selectedSpace?.id ?? null} />;
    }
    if (activeTab === 'onenote-import') {
      return (
        <>
          <NotebookBrowser onSelectionChange={handleOneNoteChange} />
          {oneNoteSelection.pages.length > 0 && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              backgroundColor: C.B75,
              borderRadius: 6,
              fontSize: 14,
              color: C.N800,
              border: '1px solid #B3D4FF',
            }}>
              <strong>{oneNoteSelection.pages.length}</strong> OneNote page{oneNoteSelection.pages.length !== 1 ? 's' : ''} selected
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
      );
    }
    if (activeTab === 'local-onenote') {
      return <LocalOneNoteImport selection={selection} spaceId={selectedSpace?.id ?? null} />;
    }
    return null;
  };

  const renderTargetPanel = () => (
    <div style={{ width: 380, flexShrink: 0 }}>
      <span style={SECTION_LABEL}>Target</span>
      <div style={{
        border: `1px solid ${C.N40}`,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
      }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.N40}`, backgroundColor: C.N10, borderRadius: '8px 8px 0 0' }}>
          <SpaceDropdown selectedSpace={selectedSpace} onSelectSpace={handleSpaceChange} />
        </div>
        {selectedSpace && (
          <PageTree
            spaceKey={selectedSpace.key}
            spaceId={selectedSpace.id}
            selectedPageId={selectedPageId}
            onSelectPage={handlePageChange}
            compact
          />
        )}
        {!selectedSpace && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: C.N200, fontSize: 13 }}>
            Select a space to see target pages
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, fontFamily: FONT }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.N800, margin: '0 0 4px' }}>
        PageFlow
      </h1>
      <p style={{ fontSize: 14, color: C.N200, margin: '0 0 20px' }}>
        Content migration to Confluence
      </p>

      <Tabs activeTab={activeTab} onChangeTab={setActiveTab} />

      <div style={{ paddingTop: 20 }}>
        {isImportTab ? (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', minHeight: 500 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={SECTION_LABEL}>Source</span>
              {renderSourceContent()}
            </div>
            {renderTargetPanel()}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={SECTION_LABEL}>Space</span>
              <SpaceDropdown selectedSpace={selectedSpace} onSelectSpace={handleSpaceChange} />
            </div>
            <BatchExportPDF
              spaceKey={selectedSpace?.key ?? null}
              spaceId={selectedSpace?.id ?? null}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default App;
