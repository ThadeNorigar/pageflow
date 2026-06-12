import React, { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@forge/bridge';
import { filterSpaces } from '../utils/spaceFilter';
import { C } from '../utils/colors';

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
}

interface SpaceDropdownProps {
  selectedSpace: ConfluenceSpace | null;
  onSelectSpace: (space: ConfluenceSpace) => void;
}

const SpaceDropdown: React.FC<SpaceDropdownProps> = ({ selectedSpace, onSelectSpace }) => {
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    invoke<ConfluenceSpace[]>('getSpaces')
      .then(setSpaces)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const toggle = useCallback(() => {
    setOpen(prev => !prev);
    setFilter('');
  }, []);

  const select = useCallback((space: ConfluenceSpace) => {
    onSelectSpace(space);
    setOpen(false);
    setFilter('');
  }, [onSelectSpace]);

  const filtered = filterSpaces(spaces, filter);

  if (error) {
    return <div style={{ color: C.R400, fontSize: 13 }}>{error}</div>;
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 14,
          color: selectedSpace ? C.N800 : C.N200,
          backgroundColor: '#fff',
          border: `1px solid ${C.N40}`,
          borderRadius: 3,
          cursor: loading ? 'wait' : 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          lineHeight: '20px',
        }}
      >
        <span>
          {loading ? 'Loading spaces...' : selectedSpace ? `${selectedSpace.name} (${selectedSpace.key})` : 'Select space...'}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          backgroundColor: '#fff',
          border: `1px solid ${C.N40}`,
          borderRadius: 3,
          boxShadow: '0 4px 12px rgba(9, 30, 66, 0.15)',
          zIndex: 100,
          maxHeight: 'min(60vh, 620px)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={inputRef}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search spaces..."
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 13,
                border: `1px solid ${C.N40}`,
                borderRadius: 3,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'min(52vh, 560px)' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 12px', color: C.N200, fontSize: 13 }}>No spaces found</div>
            )}
            {filtered.map(space => (
              <div
                key={space.id}
                onClick={() => select(space)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: selectedSpace?.id === space.id ? C.B75 : 'transparent',
                  fontSize: 14,
                  color: C.N800,
                  lineHeight: '20px',
                }}
                onMouseEnter={e => { if (selectedSpace?.id !== space.id) (e.currentTarget.style.backgroundColor = C.N20); }}
                onMouseLeave={e => { (e.currentTarget.style.backgroundColor = selectedSpace?.id === space.id ? C.B75 : 'transparent'); }}
              >
                <div style={{ fontWeight: selectedSpace?.id === space.id ? 600 : 400 }}>{space.name}</div>
                <div style={{ fontSize: 12, color: C.N200, marginTop: 1 }}>{space.key}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceDropdown;
