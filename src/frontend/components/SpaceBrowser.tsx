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
  spaceKey: string;
  parentId: string | null;
  hasChildren: boolean;
  isFolder?: boolean;
}

export interface SpaceSelection {
  spaceKey: string;
  spaceId: string;
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

const C = {
  N900: '#091E42',
  N800: '#172B4D',
  N200: '#6B778C',
  N40: '#DFE1E6',
  N20: '#F4F5F7',
  N10: '#FAFBFC',
  B400: '#0052CC',
  B75: '#DEEBFF',
  B50: '#E6FCFF',
  R400: '#DE350B',
  G75: '#E3FCEF',
};

const Spinner: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 12px', color: C.N200, fontSize: 14 }}>
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeLinecap="round" />
    </svg>
    Loading...
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

interface PageNodePropsExt extends PageNodeProps {
  allPages: ConfluencePage[];
}

const PageNode: React.FC<PageNodePropsExt> = ({ page, depth, selectedPageId, onSelectPage, allPages }) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const children = allPages.filter(p => p.parentId === page.id);
  const hasChildren = children.length > 0;

  const toggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const isSelected = selectedPageId === page.id;

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          paddingLeft: depth * 20 + 12,
          cursor: 'pointer',
          backgroundColor: isSelected ? C.B75 : hovered ? C.N20 : 'transparent',
          borderRadius: 3,
          margin: '1px 4px',
          transition: 'background-color 0.1s',
          fontSize: 14,
          color: C.N800,
          lineHeight: '20px',
        }}
        onClick={() => onSelectPage(page)}
      >
        {hasChildren && (
          <span
            onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
            style={{
              marginRight: 6,
              userSelect: 'none',
              width: 16,
              height: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: C.N200,
              flexShrink: 0,
              borderRadius: 3,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {!hasChildren && <span style={{ width: 22, display: 'inline-block', flexShrink: 0 }} />}
        {page.isFolder && <span style={{ marginRight: 4, fontSize: 14 }}>📁</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.title}</span>
      </div>
      {expanded && children.map((child) => (
        <PageNode
          key={child.id}
          page={child}
          depth={depth + 1}
          selectedPageId={selectedPageId}
          onSelectPage={onSelectPage}
          allPages={allPages}
        />
      ))}
    </div>
  );
};

const SpaceItem: React.FC<{
  space: ConfluenceSpace;
  isSelected: boolean;
  onClick: () => void;
}> = ({ space, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        backgroundColor: isSelected ? C.B75 : hovered ? C.N20 : 'transparent',
        borderRadius: 3,
        margin: '1px 4px',
        transition: 'background-color 0.1s',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: isSelected ? 600 : 400, color: C.N800, lineHeight: '20px' }}>
        {space.name}
      </div>
      <div style={{ fontSize: 12, color: C.N200, lineHeight: '16px', marginTop: 1 }}>
        {space.key}
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: C.N200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${C.N40}`,
    backgroundColor: C.N10,
  }}>
    {children}
  </div>
);

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
      const result = await invoke<ConfluencePage[]>('getPages', { spaceKey: space.key, spaceId: space.id });
      setPages(result);
      onSelect({ spaceKey: space.key, spaceId: space.id, pageId: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [onSelect]);

  const selectPage = useCallback((page: ConfluencePage) => {
    setSelectedPageId(page.id);
    if (selectedSpace) {
      onSelect({ spaceKey: selectedSpace.key, spaceId: selectedSpace.id, pageId: page.id });
    }
  }, [selectedSpace, onSelect]);

  return (
    <div style={{
      border: `1px solid ${C.N40}`,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
    }}>
      <div style={{ display: 'flex', minHeight: 340 }}>
        <div style={{ width: 260, borderRight: `1px solid ${C.N40}`, overflowY: 'auto', backgroundColor: '#fff' }}>
          <SectionHeader>Spaces</SectionHeader>
          {loading && !selectedSpace && <Spinner />}
          {error && !selectedSpace && (
            <div style={{ padding: 12, color: C.R400, fontSize: 13, lineHeight: '18px' }}>{error}</div>
          )}
          <div style={{ padding: '4px 0' }}>
            {spaces.map((space) => (
              <SpaceItem
                key={space.id}
                space={space}
                isSelected={selectedSpace?.id === space.id}
                onClick={() => selectSpace(space)}
              />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
          <SectionHeader>
            <span>Pages</span>
            {selectedSpace && (
              <span
                onClick={() => {
                  setSelectedPageId(null);
                  onSelect({ spaceKey: selectedSpace.key, spaceId: selectedSpace.id, pageId: null });
                }}
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.B400,
                  cursor: 'pointer',
                  textTransform: 'none',
                  letterSpacing: 'normal',
                }}
              >
                Space Root
              </span>
            )}
          </SectionHeader>
          {loading && selectedSpace && <Spinner />}
          {error && selectedSpace && (
            <div style={{ padding: 12, color: C.R400, fontSize: 13, lineHeight: '18px' }}>{error}</div>
          )}
          {!selectedSpace && (
            <div style={{ padding: '24px 16px', color: C.N200, fontSize: 14, textAlign: 'center' }}>
              Select a space to browse pages
            </div>
          )}
          <div style={{ padding: '4px 0' }}>
            {pages.filter(p => {
              if (p.parentId === null) return true;
              return !pages.some(other => other.id === p.parentId);
            }).map((page) => (
              <PageNode
                key={page.id}
                page={page}
                depth={0}
                selectedPageId={selectedPageId}
                onSelectPage={selectPage}
                allPages={pages}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpaceBrowser;
