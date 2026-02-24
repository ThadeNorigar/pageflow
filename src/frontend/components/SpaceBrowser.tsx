import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@forge/bridge';

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
}

interface ConfluencePage {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  hasChildren: boolean;
}

export interface SpaceSelection {
  spaceKey: string;
  pageId: string | null;
}

interface SpaceBrowserProps {
  onSelect: (selection: SpaceSelection) => void;
}

interface PageNodeProps {
  page: ConfluencePage;
  depth: number;
  selectedPageId: string | null;
  onSelectPage: (page: ConfluencePage) => void;
}

const PageNode: React.FC<PageNodeProps> = ({ page, depth, selectedPageId, onSelectPage }) => {
  const [children, setChildren] = useState<ConfluencePage[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (children.length === 0 && page.hasChildren) {
      setLoading(true);
      try {
        const result = await invoke<ConfluencePage[]>('getChildPages', { pageId: page.id });
        setChildren(result);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  }, [expanded, children.length, page.hasChildren, page.id]);

  const isSelected = selectedPageId === page.id;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          paddingLeft: `${depth * 20 + 8}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? '#deebff' : 'transparent',
        }}
        onClick={() => onSelectPage(page)}
      >
        {page.hasChildren && (
          <span
            onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
            style={{ marginRight: '4px', userSelect: 'none', width: '16px', display: 'inline-block' }}
          >
            {loading ? '...' : expanded ? '▼' : '▶'}
          </span>
        )}
        {!page.hasChildren && <span style={{ width: '20px', display: 'inline-block' }} />}
        <span>{page.title}</span>
      </div>
      {expanded && children.map((child) => (
        <PageNode
          key={child.id}
          page={child}
          depth={depth + 1}
          selectedPageId={selectedPageId}
          onSelectPage={onSelectPage}
        />
      ))}
    </div>
  );
};

const SpaceBrowser: React.FC<SpaceBrowserProps> = ({ onSelect }) => {
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ConfluenceSpace | null>(null);
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    invoke<ConfluenceSpace[]>('getSpaces')
      .then(setSpaces)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selectSpace = useCallback(async (space: ConfluenceSpace) => {
    setSelectedSpace(space);
    setSelectedPageId(null);
    setPages([]);
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ConfluencePage[]>('getPages', { spaceId: space.id });
      setPages(result);
      onSelect({ spaceKey: space.key, pageId: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [onSelect]);

  const selectPage = useCallback((page: ConfluencePage) => {
    setSelectedPageId(page.id);
    if (selectedSpace) {
      onSelect({ spaceKey: selectedSpace.key, pageId: page.id });
    }
  }, [selectedSpace, onSelect]);

  return (
    <div style={{ border: '1px solid #dfe1e6', borderRadius: '3px', minHeight: '200px' }}>
      <div style={{ display: 'flex', minHeight: '300px' }}>
        {/* Space List */}
        <div style={{ width: '240px', borderRight: '1px solid #dfe1e6', overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid #dfe1e6' }}>
            Spaces
          </div>
          {loading && !selectedSpace && <div style={{ padding: '12px' }}>Loading...</div>}
          {error && !selectedSpace && <div style={{ padding: '12px', color: '#de350b' }}>{error}</div>}
          {spaces.map((space) => (
            <div
              key={space.id}
              onClick={() => selectSpace(space)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                backgroundColor: selectedSpace?.id === space.id ? '#deebff' : 'transparent',
              }}
            >
              <div style={{ fontWeight: 500 }}>{space.name}</div>
              <div style={{ fontSize: '11px', color: '#6b778c' }}>{space.key}</div>
            </div>
          ))}
        </div>

        {/* Page Tree */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid #dfe1e6' }}>
            Pages
            {selectedSpace && (
              <span
                onClick={() => {
                  setSelectedPageId(null);
                  onSelect({ spaceKey: selectedSpace.key, pageId: null });
                }}
                style={{
                  marginLeft: '8px',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#0052cc',
                  cursor: 'pointer',
                }}
              >
                (Space Root)
              </span>
            )}
          </div>
          {loading && selectedSpace && <div style={{ padding: '12px' }}>Loading...</div>}
          {error && selectedSpace && <div style={{ padding: '12px', color: '#de350b' }}>{error}</div>}
          {!selectedSpace && <div style={{ padding: '12px', color: '#6b778c' }}>Select a space</div>}
          {pages.map((page) => (
            <PageNode
              key={page.id}
              page={page}
              depth={0}
              selectedPageId={selectedPageId}
              onSelectPage={selectPage}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpaceBrowser;
