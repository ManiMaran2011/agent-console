'use client';

import { useConnectionStore } from '@/lib/store/connectionStore';
import type { ConnectionState } from '@/lib/websocket/types';

const STATES: ConnectionState[] = ['IDLE','CONNECTING','CONNECTED','STREAMING','TOOL_CALL_PENDING','RECONNECTING','RESUMING'];

const STATE_COLORS: Record<ConnectionState, { bg: string; border: string; text: string }> = {
  IDLE:              { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
  CONNECTING:        { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  CONNECTED:         { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  STREAMING:         { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  TOOL_CALL_PENDING: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  RECONNECTING:      { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  RESUMING:          { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
};

interface Props { onClose: () => void; }

export function StateMachineViz({ onClose }: Props) {
  const state = useConnectionStore((s) => s.state);

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #eaecf0', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>WebSocket State Machine</span>
        <button onClick={onClose} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>✕ close</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {STATES.map((s) => {
          const c = STATE_COLORS[s];
          const isActive = state === s;
          return (
            <div key={s} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              border: `1px solid ${isActive ? c.border : '#f3f4f6'}`,
              background: isActive ? c.bg : '#fafafa',
              color: isActive ? c.text : '#d1d5db',
              transition: 'all 0.2s',
            }}>
              {isActive && <span style={{ marginRight: 4 }}>●</span>}
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}
