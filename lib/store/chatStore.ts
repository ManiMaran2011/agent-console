// ============================================================
// Chat Store — Messages, tool calls, stream state
// ============================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  ChatMessage,
  ToolCallState,
  MessageSegment,
  TokenChunk,
} from '@/lib/websocket/types';

interface ChatStore {
  messages: ChatMessage[];
  toolCalls: Record<string, ToolCallState>;
  activeStreamId: string | null;
  highlightedCallId: string | null;

  addUserMessage: (content: string) => string;
  startStream: (stream_id: string) => void;
  appendToken: (stream_id: string, text: string, seq: number) => void;
  freezeStream: (stream_id: string) => void;
  addToolCall: (tc: Omit<ToolCallState, 'result' | 'status' | 'result_seq' | 'result_received_at'>) => void;
  resolveToolCall: (call_id: string, result: Record<string, unknown>, seq: number) => void;
  resumeStream: (stream_id: string) => void;
  endStream: (stream_id: string) => void;
  setHighlightedCallId: (call_id: string | null) => void;
  getRenderedText: (stream_id: string) => string;
  reset: () => void;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    messages: [],
    toolCalls: {},
    activeStreamId: null,
    highlightedCallId: null,

    addUserMessage: (content: string) => {
      const id = makeId();
      const msg: ChatMessage = {
        id,
        role: 'user',
        stream_id: null,
        segments: [{ kind: 'tokens', chunks: [{ text: content, seq: 0 }], frozen: false }],
        complete: true,
        started_at: Date.now(),
        ended_at: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, msg] }));
      return id;
    },

    startStream: (stream_id: string) => {
      const existing = get().messages.find(m => m.stream_id === stream_id);
      if (existing) return;

      const msg: ChatMessage = {
        id: makeId(),
        role: 'agent',
        stream_id,
        segments: [{ kind: 'tokens', chunks: [], frozen: false }],
        complete: false,
        started_at: Date.now(),
        ended_at: null,
      };
      set((s) => ({
        messages: [...s.messages, msg],
        activeStreamId: stream_id,
      }));
    },

    appendToken: (stream_id: string, text: string, seq: number) => {
      set((s) => {
        const msgs = s.messages.map((m) => {
          if (m.stream_id !== stream_id) return m;

          const segments = [...m.segments];
          const last = segments[segments.length - 1];

          if (last && last.kind === 'tokens' && !last.frozen) {
            // Append to existing unfrozen token segment
            segments[segments.length - 1] = {
              ...last,
              chunks: [...last.chunks, { text, seq }],
            };
          } else {
            // Start new token segment (after a tool call)
            segments.push({ kind: 'tokens', chunks: [{ text, seq }], frozen: false });
          }

          return { ...m, segments };
        });

        return { messages: msgs };
      });
    },

    freezeStream: (stream_id: string) => {
      set((s) => {
        const msgs = s.messages.map((m) => {
          if (m.stream_id !== stream_id) return m;
          const segments = m.segments.map((seg) =>
            seg.kind === 'tokens' && !seg.frozen
              ? { ...seg, frozen: true }
              : seg
          );
          return { ...m, segments };
        });
        return { messages: msgs };
      });
    },

    addToolCall: (tc) => {
      const toolCallState: ToolCallState = {
        ...tc,
        result: null,
        status: 'waiting_result',
        result_seq: null,
        result_received_at: null,
      };

      set((s) => {
        const msgs = s.messages.map((m) => {
          if (m.stream_id !== tc.stream_id) return m;
          return {
            ...m,
            segments: [...m.segments, { kind: 'tool_call' as const, call_id: tc.call_id }],
          };
        });

        return {
          messages: msgs,
          toolCalls: { ...s.toolCalls, [tc.call_id]: toolCallState },
        };
      });
    },

    resolveToolCall: (call_id: string, result: Record<string, unknown>, seq: number) => {
      set((s) => {
        const tc = s.toolCalls[call_id];
        if (!tc) return s;
        return {
          toolCalls: {
            ...s.toolCalls,
            [call_id]: {
              ...tc,
              result,
              status: 'complete' as const,
              result_seq: seq,
              result_received_at: Date.now(),
            },
          },
        };
      });
    },

    resumeStream: (stream_id: string) => {
      // Stream resumes — new tokens will be added to a new unfrozen segment
      // (appendToken handles this naturally)
      set((s) => ({ ...s, activeStreamId: stream_id }));
    },

    endStream: (stream_id: string) => {
      set((s) => {
        const msgs = s.messages.map((m) => {
          if (m.stream_id !== stream_id) return m;
          return { ...m, complete: true, ended_at: Date.now() };
        });
        return {
          messages: msgs,
          activeStreamId: s.activeStreamId === stream_id ? null : s.activeStreamId,
        };
      });
    },

    setHighlightedCallId: (call_id) => set({ highlightedCallId: call_id }),

    getRenderedText: (stream_id: string) => {
      const msg = get().messages.find(m => m.stream_id === stream_id);
      if (!msg) return '';
      return msg.segments
        .filter((s): s is Extract<MessageSegment, { kind: 'tokens' }> => s.kind === 'tokens')
        .flatMap(s => s.chunks)
        .map((c: TokenChunk) => c.text)
        .join('');
    },

    reset: () => set({ messages: [], toolCalls: {}, activeStreamId: null }),
  }))
);
