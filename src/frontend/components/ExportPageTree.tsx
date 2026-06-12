import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { invoke } from '@forge/bridge';
import { C } from '../utils/colors';

interface ConfluencePage {
  id: string;
  title: string;
  parentId: string | null;
  hasChildren: boolean;
  isFolder?: boolean;
}

interface ExportPageTreeProps {
  spaceKey: string;
  spaceId: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  maxPages?: number;
}

const Spinner: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 12px', color: C.N200, fontSize: 14 }}>
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeLinecap="round" />
    </svg>
    Loading...
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

interface PageNodeProps {
  page: ConfluencePage;
  depth: number;
  selectedIds: Set<string>;
  onToggle: (pageId: string) => void;
  childrenMap: Map<string | null, ConfluencePage[]>;
}

const PageNode: React.FC<PageNodeProps> = ({ page, depth, selectedIds, onToggle, childrenMap }) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const children = childrenMap.get(page.id) ?? [];
  const hasChildren = children.length > 0;
  const isChecked = selectedIds.has(page.id);

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 12px',
          paddingLeft: depth * 20 + 12,
          backgroundColor: hovered ? C.N20 : 'transparent',
          borderRadius: 3,
          margin: '1px 4px',
          transition: 'background-color 0.1s',
          fontSize: 14,
          color: C.N800,
          lineHeight: '20px',
        }}
      >
        {hasChildren && (
          <span
            onClick={() => setExpanded(prev => !prev)}
            style={{
              marginRight: 4,
              width: 16,
              height: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: C.N200,
              flexShrink: 0,
              borderRadius: 3,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {!hasChildren && <span style={{ width: 20, display: 'inline-block', flexShrink: 0 }} />}
        {!page.isFolder && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggle(page.id)}
            style={{ marginRight: 8, cursor: 'pointer', flexShrink: 0 }}
          />
        )}
        {page.isFolder && <span style={{ marginRight: 8, fontSize: 12 }}>&#128193;</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.title}
        </span>
      </div>
      {expanded && children.map((child) => (
        <PageNode key={child.id} page={child} depth={depth + 1} selectedIds={selectedIds} onToggle={onToggle} childrenMap={childrenMap} />
      ))}
    </div>
  );
};

const ExportPageTree: React.FC<ExportPageTreeProps> = ({ spaceKey, spaceId, selectedIds, onSelectionChange, maxPages = 50 }) => {
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setLoading(true);
    setError(null);
    invoke<ConfluencePage[]>('getPages', { spaceKey, spaceId })
      .then(data => { if (!cancelled) setPages(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spaceKey, spaceId]);

  const { childrenMap, rootPages } = useMemo(() => {
    const cMap = new Map<string | null, ConfluencePage[]>();
    const pageIds = new Set(pages.map(p => p.id));
    for (const p of pages) {
      const key = p.parentId;
      const list = cMap.get(key);
      if (list) list.push(p);
      else cMap.set(key, [p]);
    }
    const roots = pages.filter(p => p.parentId === null || !pageIds.has(p.parentId));
    return { childrenMap: cMap, rootPages: roots };
  }, [pages]);

  const getDescendantIds = useCallback((parentId: string): string[] => {
    const result: string[] = [];
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      if (!child.isFolder) result.push(child.id);
      result.push(...getDescendantIds(child.id));
    }
    return result;
  }, [childrenMap]);

  const handleToggle = useCallback((pageId: string) => {
    const next = new Set(selectedIds);
    if (next.has(pageId)) {
      next.delete(pageId);
      for (const id of getDescendantIds(pageId)) next.delete(id);
    } else {
      next.add(pageId);
      for (const id of getDescendantIds(pageId)) next.add(id);
    }
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange, getDescendantIds]);

  const selectAll = useCallback(() => {
    const allIds = new Set(pages.filter(p => !p.isFolder).map(p => p.id));
    onSelectionChange(allIds);
  }, [pages, onSelectionChange]);

  const selectNone = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  return (
    <div style={{
      border: `1px solid ${C.N40}`,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
    }}>
      <div style={{
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 700,
        color: C.N200,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: `1px solid ${C.N40}`,
        backgroundColor: C.N10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: selectedIds.size > maxPages ? C.R400 : C.N200 }}>
          Select pages ({selectedIds.size} / {maxPages})
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <span
            onClick={selectAll}
            style={{ fontSize: 11, fontWeight: 500, color: C.B400, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}
          >
            All
          </span>
          <span
            onClick={selectNone}
            style={{ fontSize: 11, fontWeight: 500, color: C.B400, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}
          >
            None
          </span>
        </span>
      </div>
      <div style={{ maxHeight: 350, overflowY: 'auto', backgroundColor: '#fff' }}>
        {loading && <Spinner />}
        {error && <div style={{ padding: 12, color: C.R400, fontSize: 13 }}>{error}</div>}
        {!loading && !error && rootPages.length === 0 && (
          <div style={{ padding: '16px 12px', color: C.N200, fontSize: 14, textAlign: 'center' }}>
            No pages in this space
          </div>
        )}
        <div style={{ padding: '4px 0' }}>
          {rootPages.map((page) => (
            <PageNode key={page.id} page={page} depth={0} selectedIds={selectedIds} onToggle={handleToggle} childrenMap={childrenMap} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExportPageTree;
