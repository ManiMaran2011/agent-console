import { create } from 'zustand';
import type { ContextSnapshot, DiffNode } from '@/lib/websocket/types';
import { computeDiff } from '@/lib/differ/jsonDiff';

interface ContextStore {
  snapshots: Record<string, ContextSnapshot[]>; // context_id → history
  activeContextId: string | null;
  scrubberIndex: Record<string, number>; // context_id → current index

  addSnapshot: (context_id: string, seq: number, data: Record<string, unknown>) => void;
  setActiveContext: (context_id: string) => void;
  setScrubberIndex: (context_id: string, index: number) => void;
  getCurrentSnapshot: (context_id: string) => ContextSnapshot | null;
  getLargestPayloadKb: () => number;
  reset: () => void;
}

export const useContextStore = create<ContextStore>()((set, get) => ({
  snapshots: {},
  activeContextId: null,
  scrubberIndex: {},

  addSnapshot: (context_id, seq, data) => {
    set((s) => {
      const history = s.snapshots[context_id] ?? [];
      const prev = history[history.length - 1];

      let diff: DiffNode[] | null = null;
      if (prev) {
        diff = computeDiff(prev.data, data);
      }

      const snapshot: ContextSnapshot = {
        context_id,
        seq,
        timestamp: Date.now(),
        data,
        diff,
      };

      const newHistory = [...history, snapshot];
      const newIndex = newHistory.length - 1;

      return {
        snapshots: { ...s.snapshots, [context_id]: newHistory },
        activeContextId: s.activeContextId ?? context_id,
        scrubberIndex: { ...s.scrubberIndex, [context_id]: newIndex },
      };
    });
  },

  setActiveContext: (context_id) => set({ activeContextId: context_id }),

  setScrubberIndex: (context_id, index) => {
    set((s) => ({
      scrubberIndex: { ...s.scrubberIndex, [context_id]: index },
    }));
  },

  getCurrentSnapshot: (context_id) => {
    const { snapshots, scrubberIndex } = get();
    const history = snapshots[context_id];
    if (!history || history.length === 0) return null;
    const idx = scrubberIndex[context_id] ?? history.length - 1;
    return history[idx] ?? null;
  },

  getLargestPayloadKb: () => {
    const { snapshots } = get();
    let max = 0;
    for (const history of Object.values(snapshots)) {
      for (const snap of history) {
        const size = JSON.stringify(snap.data).length / 1024;
        if (size > max) max = size;
      }
    }
    return max;
  },

  reset: () => set({ snapshots: {}, activeContextId: null, scrubberIndex: {} }),
}));
