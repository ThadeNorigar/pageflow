import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@forge/bridge';
import { C } from '../utils/colors';

interface Notebook {
  id: string;
  displayName: string;
  lastModifiedDateTime: string;
}

interface Section {
  id: string;
  displayName: string;
}

interface OneNotePage {
  id: string;
  title: string;
  lastModifiedDateTime: string;
}

export interface OneNoteSelection {
  pages: Array<{ id: string; title: string; sectionId: string }>;
}

interface NotebookBrowserProps {
  onSelectionChange: (selection: OneNoteSelection) => void;
}

const Spinner: React.FC<{ inline?: boolean }> = ({ inline }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: inline ? '0 4px' : '12px', color: C.N200, fontSize: 13 }}>
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeLinecap="round" />
    </svg>
    {!inline && 'Loading...'}
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </span>
);

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

const TreeRow: React.FC<{
  depth: number;
  label: string;
  icon?: string;
  expanded?: boolean;
  hasChildren?: boolean;
  loading?: boolean;
  checked?: boolean;
  indeterminate?: boolean;
  showCheckbox?: boolean;
  onToggle?: () => void;
  onCheck?: () => void;
  subtitle?: string;
}> = ({ depth, label, icon, expanded, hasChildren, loading, checked, indeterminate, showCheckbox, onToggle, onCheck, subtitle }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        paddingLeft: depth * 20 + 12,
        backgroundColor: hovered ? C.N20 : 'transparent',
        borderRadius: 3,
        margin: '1px 4px',
        transition: 'background-color 0.1s',
        fontSize: 14,
        color: C.N800,
        lineHeight: '20px',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      {hasChildren && (
        <span style={{ marginRight: 4, width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {loading ? <Spinner inline /> : (
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: C.N200 }}>
              <path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      )}
      {!hasChildren && <span style={{ width: 20, display: 'inline-block', flexShrink: 0 }} />}
      {showCheckbox && (
        <input
          type="checkbox"
          checked={checked}
          ref={el => { if (el) el.indeterminate = !!indeterminate; }}
          onChange={e => { e.stopPropagation(); onCheck?.(); }}
          onClick={e => e.stopPropagation()}
          style={{ marginRight: 6, flexShrink: 0, cursor: 'pointer' }}
        />
      )}
      {icon && <span style={{ marginRight: 4, fontSize: 14 }}>{icon}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
      {subtitle && <span style={{ fontSize: 11, color: C.N200, marginLeft: 8, flexShrink: 0 }}>{subtitle}</span>}
    </div>
  );
};

interface AuthStatus {
  authenticated: boolean;
  error?: string;
  user?: { displayName?: string; mail?: string };
}

const NotebookBrowser: React.FC<NotebookBrowserProps> = ({ onSelectionChange }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sectionsCache, setSectionsCache] = useState<Map<string, Section[]>>(new Map());
  const [pagesCache, setPagesCache] = useState<Map<string, OneNotePage[]>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    invoke<AuthStatus>('checkAuthStatus')
      .then(status => {
        setAuthStatus(status);
        if (status.authenticated) {
          loadNotebooks();
        }
      })
      .catch(err => setAuthStatus({ authenticated: false, error: err.message }));
  }, []);

  const loadNotebooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<{ notebooks: Notebook[] }>('getNotebooks');
      setNotebooks(result.notebooks);
      setAuthStatus(prev => ({ ...prev, authenticated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notebooks');
    } finally {
      setLoading(false);
    }
  }, []);

  const connectAccount = useCallback(async () => {
    try {
      await invoke('requestAuth');
      const status = await invoke<AuthStatus>('checkAuthStatus');
      setAuthStatus(status);
      if (status.authenticated) {
        loadNotebooks();
      }
    } catch {
      // requestCredentials() throws a platform exception that Forge handles
      // to show the consent dialog — this is expected behavior
    }
  }, [loadNotebooks]);

  const toggleExpand = useCallback(async (id: string, type: 'notebook' | 'section') => {
    if (expandedIds.has(id)) {
      setExpandedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      return;
    }

    setExpandedIds(prev => new Set(prev).add(id));

    if (type === 'notebook' && !sectionsCache.has(id)) {
      setLoadingIds(prev => new Set(prev).add(id));
      try {
        const result = await invoke<{ sections: Section[] }>('getNotebookSections', { notebookId: id });
        setSectionsCache(prev => new Map(prev).set(id, result.sections));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sections');
        setExpandedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      } finally {
        setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }

    if (type === 'section' && !pagesCache.has(id)) {
      setLoadingIds(prev => new Set(prev).add(id));
      try {
        const result = await invoke<{ pages: OneNotePage[] }>('getSectionPages', { sectionId: id });
        setPagesCache(prev => new Map(prev).set(id, result.pages));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pages');
        setExpandedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      } finally {
        setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }
  }, [expandedIds, sectionsCache, pagesCache]);

  const togglePage = useCallback((page: OneNotePage) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(page.id)) {
        next.delete(page.id);
      } else {
        next.add(page.id);
      }
      // Build selection and notify parent
      const allPages: Array<{ id: string; title: string; sectionId: string }> = [];
      pagesCache.forEach((pages, secId) => {
        pages.forEach(p => {
          if (next.has(p.id)) {
            allPages.push({ id: p.id, title: p.title, sectionId: secId });
          }
        });
      });
      onSelectionChange({ pages: allPages });
      return next;
    });
  }, [pagesCache, onSelectionChange]);

  const toggleAllSectionPages = useCallback((sectionId: string) => {
    const pages = pagesCache.get(sectionId) ?? [];
    const allSelected = pages.every(p => selectedPageIds.has(p.id));

    setSelectedPageIds(prev => {
      const next = new Set(prev);
      pages.forEach(p => {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      const allPages: Array<{ id: string; title: string; sectionId: string }> = [];
      pagesCache.forEach((ps, secId) => {
        ps.forEach(p => {
          if (next.has(p.id)) {
            allPages.push({ id: p.id, title: p.title, sectionId: secId });
          }
        });
      });
      onSelectionChange({ pages: allPages });
      return next;
    });
  }, [pagesCache, selectedPageIds, onSelectionChange]);

  const getSectionCheckState = (sectionId: string): { checked: boolean; indeterminate: boolean } => {
    const pages = pagesCache.get(sectionId) ?? [];
    if (pages.length === 0) return { checked: false, indeterminate: false };
    const selectedCount = pages.filter(p => selectedPageIds.has(p.id)).length;
    return {
      checked: selectedCount === pages.length,
      indeterminate: selectedCount > 0 && selectedCount < pages.length,
    };
  };

  // Auth not connected
  if (authStatus && !authStatus.authenticated) {
    return (
      <div style={{
        border: `1px solid ${C.N40}`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
      }}>
        <SectionHeader>OneNote</SectionHeader>
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
          <div style={{ fontSize: 14, color: C.N800, fontWeight: 500, marginBottom: 4 }}>
            Connect Microsoft Account
          </div>
          <div style={{ fontSize: 12, color: C.N200, marginBottom: 16 }}>
            Connect your Microsoft account to access OneNote notebooks.
          </div>
          {authStatus.error && (
            <div style={{ fontSize: 12, color: C.R400, marginBottom: 12 }}>{authStatus.error}</div>
          )}
          <button
            onClick={connectAccount}
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
            Connect Microsoft Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: `1px solid ${C.N40}`,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
    }}>
      <SectionHeader>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            OneNote Notebooks
            {selectedPageIds.size > 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, color: C.B400, textTransform: 'none', letterSpacing: 'normal' }}>
                {selectedPageIds.size} page{selectedPageIds.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </span>
          <span
            title={authStatus?.user?.mail || authStatus?.user?.displayName || 'Connected to Microsoft'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, color: C.G400, textTransform: 'none', letterSpacing: 'normal' }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: C.G400, display: 'inline-block' }} />
            Connected
          </span>
        </span>
      </SectionHeader>

      <div style={{ maxHeight: 400, overflowY: 'auto', backgroundColor: '#fff' }}>
        {loading && <Spinner />}
        {error && (
          <div style={{ padding: 12, fontSize: 13, lineHeight: '18px' }}>
            <div style={{ color: C.R400, marginBottom: 8 }}>{error}</div>
            {error.includes('401') && (
              <button
                onClick={connectAccount}
                style={{ padding: '4px 12px', fontSize: 12, color: C.B400, background: C.N20, border: `1px solid ${C.N40}`, borderRadius: 3, cursor: 'pointer' }}
              >
                Reconnect Microsoft Account
              </button>
            )}
          </div>
        )}
        {!loading && notebooks.length === 0 && !error && (
          <div style={{ padding: '24px 16px', color: C.N200, fontSize: 14, textAlign: 'center' }}>
            No notebooks found
          </div>
        )}

        <div style={{ padding: '4px 0' }}>
          {notebooks.map(notebook => (
            <div key={notebook.id}>
              <TreeRow
                depth={0}
                label={notebook.displayName}
                icon="📓"
                hasChildren
                expanded={expandedIds.has(notebook.id)}
                loading={loadingIds.has(notebook.id)}
                onToggle={() => toggleExpand(notebook.id, 'notebook')}
              />
              {expandedIds.has(notebook.id) && (sectionsCache.get(notebook.id) ?? []).map(section => {
                const checkState = getSectionCheckState(section.id);
                return (
                  <div key={section.id}>
                    <TreeRow
                      depth={1}
                      label={section.displayName}
                      icon="📑"
                      hasChildren
                      expanded={expandedIds.has(section.id)}
                      loading={loadingIds.has(section.id)}
                      showCheckbox={pagesCache.has(section.id)}
                      checked={checkState.checked}
                      indeterminate={checkState.indeterminate}
                      onToggle={() => toggleExpand(section.id, 'section')}
                      onCheck={() => toggleAllSectionPages(section.id)}
                    />
                    {expandedIds.has(section.id) && (pagesCache.get(section.id) ?? []).map(page => (
                      <TreeRow
                        key={page.id}
                        depth={2}
                        label={page.title}
                        icon="📝"
                        showCheckbox
                        checked={selectedPageIds.has(page.id)}
                        onToggle={() => togglePage(page)}
                        onCheck={() => togglePage(page)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotebookBrowser;
