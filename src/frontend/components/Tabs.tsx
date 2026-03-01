import React from 'react';
import { TABS, TabId } from '../utils/tabs';

interface TabsProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

const C = {
  N800: '#172B4D',
  N200: '#6B778C',
  N40: '#DFE1E6',
  B400: '#0052CC',
};

const Tabs: React.FC<TabsProps> = ({ activeTab, onChangeTab }) => (
  <div style={{
    display: 'flex',
    borderBottom: `2px solid ${C.N40}`,
    gap: 0,
  }}>
    {TABS.map(tab => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          onClick={() => onChangeTab(tab.id)}
          style={{
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? C.B400 : C.N200,
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: isActive ? `2px solid ${C.B400}` : '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

export default Tabs;
