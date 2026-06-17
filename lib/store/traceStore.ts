import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TraceEvent, TraceEventKind } from '@/lib/websocket/types';

interface TraceFilter {
  kinds: Set<TraceEventKind>;
  search: string;
}

interface TraceStore {
  events: TraceEvent[];
  filter: TraceFilter;
  highlightedTraceId: string | null;

  addEvent: (event: Omit<TraceEvent, 'id' | 'timestamp'>) => string;
  updateLastTokenGroup: (stream_id: string, text: string, seq: number) => void;
  setFilter: (filter: Partial<TraceFilter>) => void;
  setHighlightedTraceId: (id: string | null) => void;
  getFilteredEvents: () => TraceEvent[];
  reset: () => void;
}

const ALL_KINDS: TraceEventKind[] = [
  'token_group', 'tool_call', 'tool_result', 'context_snapshot',
  'ping', 'pong', 'stream_end', 'error', 'reconnect', 'resume',
];

let idCounter = 0;
function makeId(): string {
  return `trace_${++idCounter}`;
}

export const useTraceStore = create<TraceStore>()(
  subscribeWithSelector((set, get) => ({
    events: [],
    filter: { kinds: new Set(ALL_KINDS), search: '' },
    highlightedTraceId: null,

    addEvent: (event) => {
      const id = makeId();
      const traceEvent: TraceEvent = {
        ...event,
        id,
        timestamp: Date.now(),
      };
      set((s) => ({ events: [...s.events, traceEvent] }));
      return id;
    },

    updateLastTokenGroup: (stream_id: string, text: string, seq: number) => {
      set((s) => {
        const events = [...s.events];
        // Find last token_group for this stream
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i];
          if (e && e.kind === 'token_group' && e.stream_id === stream_id) {
            const count = (e.token_count ?? 0) + 1;
            const fullText = (e.token_text ?? '') + text;
            const duration = Date.now() - e.timestamp;
            events[i] = {
              ...e,
              token_count: count,
              token_text: fullText,
              duration_ms: duration,
              summary: `Streamed ${count} token${count !== 1 ? 's' : ''} (${(duration / 1000).toFixed(1)}s)`,
              seq,
            };
            return { events };
          }
        }
        // No existing group — create one
        const id = makeId();
        events.push({
          id,
          kind: 'token_group',
          seq,
          timestamp: Date.now(),
          stream_id,
          call_id: null,
          summary: 'Streamed 1 token (0.0s)',
          detail: null,
          token_count: 1,
          token_text: text,
          duration_ms: 0,
        });
        return { events };
      });
    },

    setFilter: (filter) => {
      set((s) => ({ filter: { ...s.filter, ...filter } }));
    },

    setHighlightedTraceId: (id) => set({ highlightedTraceId: id }),

    getFilteredEvents: () => {
      const { events, filter } = get();
      return events.filter((e) => {
        if (!filter.kinds.has(e.kind)) return false;
        if (filter.search) {
          const q = filter.search.toLowerCase();
          return (
            e.summary.toLowerCase().includes(q) ||
            e.kind.toLowerCase().includes(q) ||
            (e.token_text?.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      });
    },

    reset: () => set({ events: [], highlightedTraceId: null }),
  }))
);

export { ALL_KINDS };
