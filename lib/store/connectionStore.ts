import { create } from 'zustand';
import type { ConnectionState, LatencyMetrics, ChaosStats } from '@/lib/websocket/types';

interface ConnectionStore {
  state: ConnectionState;
  reconnectCount: number;
  lastDropAt: number | null;
  metrics: LatencyMetrics;
  chaosStats: ChaosStats;
  chaosMode: boolean;
  streamIntegrity: Record<string, { expected: string; rendered: string; match: boolean }>;

  setState: (state: ConnectionState) => void;
  incrementReconnect: () => void;
  updateMetric: (type: 'pong_rtt' | 'reconnect_duration' | 'token_latency', value_ms: number) => void;
  updateChaosStats: (stats: Partial<ChaosStats>) => void;
  setChaosMode: (chaos: boolean) => void;
  recordStreamIntegrity: (stream_id: string, expected: string, rendered: string) => void;
  reset: () => void;
}

const initialMetrics: LatencyMetrics = {
  last_token_latency_ms: null,
  last_pong_rtt_ms: null,
  last_reconnect_ms: null,
  last_tool_call_duration_ms: null,
  avg_token_latency_ms: null,
};

const initialChaosStats: ChaosStats = {
  drops_recovered: 0,
  messages_reordered: 0,
  duplicates_deduped: 0,
  largest_context_kb: 0,
  corrupt_pings_handled: 0,
  rapid_tool_calls: 0,
};

let tokenLatencies: number[] = [];

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  state: 'IDLE',
  reconnectCount: 0,
  lastDropAt: null,
  metrics: { ...initialMetrics },
  chaosStats: { ...initialChaosStats },
  chaosMode: false,
  streamIntegrity: {},

  setState: (state) => set({ state }),

  incrementReconnect: () =>
    set((s) => ({
      reconnectCount: s.reconnectCount + 1,
      lastDropAt: Date.now(),
      chaosStats: {
        ...s.chaosStats,
        drops_recovered: s.chaosStats.drops_recovered + 1,
      },
    })),

  updateMetric: (type, value_ms) => {
    set((s) => {
      const m = { ...s.metrics };
      if (type === 'pong_rtt') m.last_pong_rtt_ms = value_ms;
      if (type === 'reconnect_duration') m.last_reconnect_ms = value_ms;
      if (type === 'token_latency') {
        m.last_token_latency_ms = value_ms;
        tokenLatencies.push(value_ms);
        if (tokenLatencies.length > 50) tokenLatencies = tokenLatencies.slice(-50);
        m.avg_token_latency_ms = Math.round(
          tokenLatencies.reduce((a, b) => a + b, 0) / tokenLatencies.length
        );
      }
      return { metrics: m };
    });
  },

  updateChaosStats: (stats) =>
    set((s) => ({ chaosStats: { ...s.chaosStats, ...stats } })),

  setChaosMode: (chaosMode) => set({ chaosMode }),

  recordStreamIntegrity: (stream_id, expected, rendered) =>
    set((s) => ({
      streamIntegrity: {
        ...s.streamIntegrity,
        [stream_id]: { expected, rendered, match: expected === rendered },
      },
    })),

  reset: () =>
    set({
      state: 'IDLE',
      reconnectCount: 0,
      lastDropAt: null,
      metrics: { ...initialMetrics },
      chaosStats: { ...initialChaosStats },
      streamIntegrity: {},
    }),
}));
