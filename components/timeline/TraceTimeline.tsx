'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTraceStore, ALL_KINDS } from '@/lib/store/traceStore';
import { EventRow } from './EventRow';
import type { TraceEventKind } from '@/lib/websocket/types';

const KIND_LABELS: Record<TraceEventKind, string> = {
  token_group: 'Tokens', tool_call: 'Tool Call', tool_result: 'Tool Result',
  context_snapshot: 'Context', ping: 'PING', pong: 'PONG',
  stream_end: 'Stream End', error: 'Error', reconnect: 'Reconnect', resume: 'Resume',
};

export function TraceTimeline() {
  const filter = useTraceStore((s) => s.filter);
  const setFilter = useTraceStore((s) => s.setFilter);
  const getFilteredEvents = useTraceStore((s) => s.getFilteredEvents);
  const filteredEvents = getFilteredEvents();
  const [autoScroll, setAutoScroll] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  useEffect(() => {
    if (autoScroll && filteredEvents.length > 0) {
      virtualizer.scrollToIndex(filteredEvents.length - 1, { align: 'end' });
    }
  }, [filteredEvents.length, autoScroll, virtualizer]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }, []);

  const toggleKind = (kind: TraceEventKind) => {
    const newKinds = new Set(filter.kinds);
    if (newKinds.has(kind)) newKinds.delete(kind); else newKinds.add(kind);
    setFilter({ kinds: newKinds });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Trace Timeline</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#e5e7eb', fontWeight: 500 }}>{filteredEvents.length}</span>
            <button onClick={() => setShowFilter(v => !v)} style={{ fontSize: 11, color: showFilter ? '#4f46e5' : '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>⚙</button>
          </div>
        </div>
        <input type="text" value={filter.search} onChange={e => setFilter({ search: e.target.value })}
          placeholder="Search events..."
          style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 9px', fontSize: 11, color: '#6b7280', outline: 'none', fontFamily: 'inherit' }} />

        {showFilter && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {ALL_KINDS.map(kind => (
              <button key={kind} onClick={() => toggleKind(kind)}
                style={{ fontSize: 10, padding: '3px 6px', borderRadius: 5, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, border: filter.kinds.has(kind) ? '1px solid #bfdbfe' : '1px solid #f3f4f6', background: filter.kinds.has(kind) ? '#eff6ff' : '#fafafa', color: filter.kinds.has(kind) ? '#2563eb' : '#d1d5db' }}>
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Events */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vItem => {
            const event = filteredEvents[vItem.index];
            if (!event) return null;
            return (
              <div key={event.id} style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: vItem.size }}>
                <EventRow event={event} index={vItem.index} />
              </div>
            );
          })}
        </div>
      </div>

      {!autoScroll && (
        <button onClick={() => { setAutoScroll(true); virtualizer.scrollToIndex(filteredEvents.length - 1, { align: 'end' }); }}
          style={{ position: 'absolute', bottom: 40, left: 8, fontSize: 10, background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280', padding: '3px 8px', borderRadius: 20, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          ↓ Live
        </button>
      )}
    </div>
  );
}
