'use client';

import { useConnectionStore } from '@/lib/store/connectionStore';
import { StateMachineViz } from './StateMachineViz';
import { ComplianceAudit } from '@/components/telemetry/ComplianceAudit';
import { ChaosStatsPanel } from '@/components/telemetry/ChaosStatsPanel';
import type { RefObject } from 'react';
import type { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { useState } from 'react';

const STATE_DOT: Record<string, string> = {
  IDLE: '#9ca3af',
  CONNECTING: '#f59e0b',
  CONNECTED: '#16a34a',
  STREAMING: '#4f46e5',
  TOOL_CALL_PENDING: '#f59e0b',
  RECONNECTING: '#ef4444',
  RESUMING: '#8b5cf6',
};

const STATE_BG: Record<string, string> = {
  IDLE: '#f9fafb',
  CONNECTING: '#fffbeb',
  CONNECTED: '#f0fdf4',
  STREAMING: '#eff6ff',
  TOOL_CALL_PENDING: '#fffbeb',
  RECONNECTING: '#fef2f2',
  RESUMING: '#f5f3ff',
};

const STATE_BORDER: Record<string, string> = {
  IDLE: '#e5e7eb',
  CONNECTING: '#fde68a',
  CONNECTED: '#bbf7d0',
  STREAMING: '#bfdbfe',
  TOOL_CALL_PENDING: '#fde68a',
  RECONNECTING: '#fecaca',
  RESUMING: '#ddd6fe',
};

const STATE_TEXT: Record<string, string> = {
  IDLE: '#6b7280',
  CONNECTING: '#92400e',
  CONNECTED: '#15803d',
  STREAMING: '#1d4ed8',
  TOOL_CALL_PENDING: '#92400e',
  RECONNECTING: '#991b1b',
  RESUMING: '#5b21b6',
};

interface Props {
  showTimeline: boolean;
  showContext: boolean;
  onToggleTimeline: () => void;
  onToggleContext: () => void;
  wsRef: RefObject<WebSocketManager | null>;
}

export function ConnectionHeader({ showTimeline, showContext, onToggleTimeline, onToggleContext, wsRef }: Props) {
  const state = useConnectionStore((s) => s.state);
  const chaosStats = useConnectionStore((s) => s.chaosStats);
  const [showStateMachine, setShowStateMachine] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showChaos, setShowChaos] = useState(false);

  const isChaos = chaosStats.drops_recovered > 0 || chaosStats.messages_reordered > 0 ||
    chaosStats.corrupt_pings_handled > 0 || chaosStats.duplicates_deduped > 0;

  const pillStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: STATE_BG[state] ?? '#f0fdf4',
    border: `1px solid ${STATE_BORDER[state] ?? '#bbf7d0'}`,
    borderRadius: 20, padding: '3px 10px',
  };

  const btnStyle = (active: boolean) => ({
    padding: '5px 11px', fontSize: 11, fontWeight: 500,
    borderRadius: 6, cursor: 'pointer',
    border: active ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#2563eb' : '#6b7280',
  });

  return (
    <>
      <header style={{
        height: 48, background: '#fff', borderBottom: '1px solid #eaecf0',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
        flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Logo */}
        <div style={{ width: 26, height: 26, background: '#4f46e5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>A</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', letterSpacing: '-0.2px' }}>Agent Console</span>

        <div style={{ width: 1, height: 18, background: '#e5e7eb' }} />

        {/* State pill */}
        <div style={pillStyle}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATE_DOT[state] ?? '#16a34a' }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: STATE_TEXT[state] ?? '#15803d' }}>{state}</span>
        </div>

        {/* Chaos badge */}
        {isChaos && (
          <button onClick={() => setShowChaos(v => !v)} style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: 'pointer', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
            ⚡ Chaos
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Controls */}
        <button onClick={() => setShowStateMachine(v => !v)} style={btnStyle(showStateMachine)}>⬡ State</button>
        <button onClick={() => setShowAudit(v => !v)} style={btnStyle(showAudit)}>✓ Audit</button>

        <div style={{ width: 1, height: 18, background: '#e5e7eb' }} />

        <button onClick={onToggleTimeline} style={btnStyle(showTimeline)}>Timeline</button>
        <button onClick={onToggleContext} style={btnStyle(showContext)}>Context</button>
      </header>

      {showStateMachine && <StateMachineViz onClose={() => setShowStateMachine(false)} />}
      {showAudit && <ComplianceAudit onClose={() => setShowAudit(false)} wsRef={wsRef} />}
      {showChaos && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, zIndex: 10, width: 380, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            <ChaosStatsPanel />
          </div>
        </div>
      )}
    </>
  );
}
