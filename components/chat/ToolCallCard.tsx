'use client';

import { useState } from 'react';
import type { ToolCallState } from '@/lib/websocket/types';
import { useChatStore } from '@/lib/store/chatStore';
import { useTraceStore } from '@/lib/store/traceStore';

interface Props { toolCall: ToolCallState; }

const STATUS_CONFIG = {
  pending:        { border: '#f59e0b', bg: '#fffbeb', badge: '#fef3c7', badgeText: '#92400e', label: 'Pending ACK' },
  waiting_result: { border: '#f59e0b', bg: '#fffbeb', badge: '#fef3c7', badgeText: '#92400e', label: 'Waiting...' },
  complete:       { border: '#10b981', bg: '#f0fdf4', badge: '#d1fae5', badgeText: '#065f46', label: 'Complete' },
  timeout:        { border: '#ef4444', bg: '#fef2f2', badge: '#fee2e2', badgeText: '#991b1b', label: 'Timeout' },
};

export function ToolCallCard({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false);
  const setHighlightedCallId = useChatStore((s) => s.setHighlightedCallId);
  const setHighlightedTraceId = useTraceStore((s) => s.setHighlightedTraceId);
  const traceEvents = useTraceStore((s) => s.events);
  const config = STATUS_CONFIG[toolCall.status];
  const isWaiting = toolCall.status === 'waiting_result';

  const handleClick = () => {
    setHighlightedCallId(toolCall.call_id);
    const te = traceEvents.find(e => e.kind === 'tool_call' && e.call_id === toolCall.call_id);
    if (te) setHighlightedTraceId(te.id);
  };

  return (
    <div onClick={handleClick} className={isWaiting ? 'tool-card-new' : ''}
      style={{ marginTop: 10, borderLeft: `3px solid ${config.border}`, background: config.bg, borderRadius: '0 8px 8px 0', padding: '9px 12px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>⚙</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>{toolCall.tool_name}</span>
          <span style={{ fontSize: 9, color: '#d1d5db' }}>#{toolCall.call_id.slice(-6)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: config.badge, color: config.badgeText, fontWeight: 600 }}>
            {config.label}{toolCall.result_received_at && toolCall.ack_sent_at ? ` · ${toolCall.result_received_at - toolCall.ack_sent_at}ms` : ''}
          </span>
          <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} style={{ fontSize: 10, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Waiting dots */}
      {isWaiting && !expanded && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', animation: 'bounce 1s infinite', animationDelay: `${i*100}ms` }} />
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>awaiting result...</span>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <p style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Args</p>
            <pre style={{ fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace", color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', padding: '6px 8px', borderRadius: 6, overflowX: 'auto' }}>
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <p style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Result</p>
              <pre style={{ fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace", color: '#065f46', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 8px', borderRadius: 6, overflowX: 'auto' }}>
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
