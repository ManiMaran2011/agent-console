'use client';

import { useState } from 'react';
import { useTraceStore } from '@/lib/store/traceStore';
import { useChatStore } from '@/lib/store/chatStore';
import type { TraceEvent, TraceEventKind } from '@/lib/websocket/types';

const KIND_CONFIG: Record<TraceEventKind, { color: string; icon: string; hlBg: string }> = {
  token_group:      { color: '#3b82f6', icon: '◈', hlBg: '#eff6ff' },
  tool_call:        { color: '#f59e0b', icon: '⚙', hlBg: '#fffbeb' },
  tool_result:      { color: '#10b981', icon: '✓', hlBg: '#f0fdf4' },
  context_snapshot: { color: '#8b5cf6', icon: '◉', hlBg: '#f5f3ff' },
  ping:             { color: '#d1d5db', icon: '♦', hlBg: '#f9fafb' },
  pong:             { color: '#d1d5db', icon: '♦', hlBg: '#f9fafb' },
  stream_end:       { color: '#9ca3af', icon: '■', hlBg: '#f9fafb' },
  error:            { color: '#ef4444', icon: '✕', hlBg: '#fef2f2' },
  reconnect:        { color: '#ef4444', icon: '↺', hlBg: '#fef2f2' },
  resume:           { color: '#8b5cf6', icon: '▶', hlBg: '#f5f3ff' },
};

interface Props { event: TraceEvent; index: number; }

export function EventRow({ event, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const highlightedTraceId = useTraceStore((s) => s.highlightedTraceId);
  const setHighlightedTraceId = useTraceStore((s) => s.setHighlightedTraceId);
  const setHighlightedCallId = useChatStore((s) => s.setHighlightedCallId);
  const config = KIND_CONFIG[event.kind];
  const isHighlighted = highlightedTraceId === event.id;
  const time = new Date(event.timestamp).toISOString().slice(11, 23);

  const handleClick = () => {
    setHighlightedTraceId(isHighlighted ? null : event.id);
    if (event.call_id) setHighlightedCallId(event.call_id);
  };

  return (
    <div onClick={handleClick} style={{
      borderBottom: '1px solid #f9fafb', padding: '8px 12px', cursor: 'pointer',
      background: isHighlighted ? config.hlBg : '#fff',
      borderLeft: isHighlighted ? `2px solid ${config.color}` : '2px solid transparent',
      transition: 'background 0.1s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 9, color: '#e5e7eb', fontWeight: 500, width: 16, flexShrink: 0, paddingTop: 1, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</span>
        <span style={{ fontSize: 10, color: config.color, flexShrink: 0, paddingTop: 1 }}>{config.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <p style={{ fontSize: 10, color: '#4b5563', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.summary}</p>
            <span style={{ fontSize: 9, color: '#d1d5db', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{time.slice(0, 8)}</span>
          </div>

          {event.kind === 'token_group' && event.token_text && (
            <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
              style={{ fontSize: 9, color: '#bfdbfe', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, fontFamily: 'inherit' }}>
              {expanded ? '▲ collapse' : '▼ expand text'}
            </button>
          )}
          {event.kind === 'token_group' && expanded && event.token_text && (
            <pre style={{ fontSize: 9, fontFamily: "'SF Mono','Fira Code',monospace", color: '#6b7280', background: '#f9fafb', border: '1px solid #f3f4f6', padding: '5px 7px', borderRadius: 5, marginTop: 4, overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 100 }}>
              {event.token_text}
            </pre>
          )}

          {event.detail && event.kind !== 'token_group' && !expanded && (
            <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
              style={{ fontSize: 9, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, fontFamily: 'inherit' }}>
              ▼ details
            </button>
          )}
          {event.detail && event.kind !== 'token_group' && expanded && (
            <pre style={{ fontSize: 9, fontFamily: "'SF Mono','Fira Code',monospace", color: '#6b7280', background: '#f9fafb', border: '1px solid #f3f4f6', padding: '5px 7px', borderRadius: 5, marginTop: 4, overflowX: 'auto', maxHeight: 100 }}>
              {JSON.stringify(event.detail, null, 2)}
            </pre>
          )}
        </div>
      </div>
      {event.call_id && (
        <div style={{ marginLeft: 24, marginTop: 2, fontSize: 9, color: '#e5e7eb', fontFamily: 'monospace' }}>
          call_id: …{event.call_id.slice(-8)}
        </div>
      )}
    </div>
  );
}
