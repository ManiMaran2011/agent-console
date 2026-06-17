// ============================================================
// ProtocolHandler — Routes processed server events to stores
//
// This is the brain of the application. It maintains the stream
// state machine and dispatches to the appropriate stores.
//
// State machine:
//   CONNECTED → STREAMING → TOOL_CALL_PENDING → STREAMING → CONNECTED
// ============================================================

import type { ServerEvent, ConnectionState } from '@/lib/websocket/types';
import { useChatStore } from '@/lib/store/chatStore';
import { useTraceStore } from '@/lib/store/traceStore';
import { useContextStore } from '@/lib/store/contextStore';
import { useConnectionStore } from '@/lib/store/connectionStore';
import type { WebSocketManager } from './WebSocketManager';

// Track tool call timing for duration metrics
const toolCallStartTimes = new Map<string, number>();
// Track rapid tool calls per stream
const pendingToolCallsPerStream = new Map<string, number>();

export function handleServerEvent(event: ServerEvent, wsManager: WebSocketManager): void {
  const chat = useChatStore.getState();
  const trace = useTraceStore.getState();
  const context = useContextStore.getState();
  const conn = useConnectionStore.getState();

  switch (event.type) {
    case 'TOKEN': {
      // Ensure stream exists
      chat.startStream(event.stream_id);
      chat.appendToken(event.stream_id, event.text, event.seq);

      // Update trace (grouped by stream)
      trace.updateLastTokenGroup(event.stream_id, event.text, event.seq);

      // Update connection state
      if (conn.state !== 'STREAMING' && conn.state !== 'TOOL_CALL_PENDING') {
        conn.setState('STREAMING');
      }

      // Mark rendered for RESUME tracking
      wsManager.markRendered(event.seq);
      break;
    }

    case 'TOOL_CALL': {
      const startTime = Date.now();
      toolCallStartTimes.set(event.call_id, startTime);

      // Track rapid tool calls
      const pending = pendingToolCallsPerStream.get(event.stream_id) ?? 0;
      if (pending > 0) {
        conn.updateChaosStats({ rapid_tool_calls: conn.chaosStats.rapid_tool_calls + 1 });
      }
      pendingToolCallsPerStream.set(event.stream_id, pending + 1);

      // Freeze current token stream
      chat.startStream(event.stream_id);
      chat.freezeStream(event.stream_id);
      chat.addToolCall({
        call_id: event.call_id,
        tool_name: event.tool_name,
        args: event.args,
        stream_id: event.stream_id,
        seq: event.seq,
        ack_sent_at: Date.now(),
      });

      // Send TOOL_ACK immediately
      wsManager.scheduleToolAck(event.call_id);

      // Trace
      trace.addEvent({
        kind: 'tool_call',
        seq: event.seq,
        stream_id: event.stream_id,
        call_id: event.call_id,
        summary: `Tool call: ${event.tool_name}`,
        detail: { tool_name: event.tool_name, args: event.args },
      });

      conn.setState('TOOL_CALL_PENDING');
      wsManager.markRendered(event.seq);
      break;
    }

    case 'TOOL_RESULT': {
      const startTime = toolCallStartTimes.get(event.call_id);
      if (startTime) {
        const duration = Date.now() - startTime;
        useConnectionStore.setState((s) => ({
          metrics: { ...s.metrics, last_tool_call_duration_ms: duration },
        }));
        toolCallStartTimes.delete(event.call_id);
      }

      // Decrement pending tool calls
      const stream_id = event.stream_id;
      const pending = pendingToolCallsPerStream.get(stream_id) ?? 1;
      pendingToolCallsPerStream.set(stream_id, Math.max(0, pending - 1));

      chat.resolveToolCall(event.call_id, event.result, event.seq);
      chat.resumeStream(event.stream_id);

      trace.addEvent({
        kind: 'tool_result',
        seq: event.seq,
        stream_id: event.stream_id,
        call_id: event.call_id,
        summary: `Tool result: ${event.call_id}`,
        detail: { result: event.result },
      });

      conn.setState('STREAMING');
      wsManager.markRendered(event.seq);
      break;
    }

    case 'CONTEXT_SNAPSHOT': {
      const payloadKb = JSON.stringify(event.data).length / 1024;
      context.addSnapshot(event.context_id, event.seq, event.data);

      // Update largest context stat
      if (payloadKb > conn.chaosStats.largest_context_kb) {
        conn.updateChaosStats({ largest_context_kb: Math.round(payloadKb) });
      }

      trace.addEvent({
        kind: 'context_snapshot',
        seq: event.seq,
        stream_id: null,
        call_id: null,
        summary: `Context snapshot: ${event.context_id} (${payloadKb.toFixed(1)}KB)`,
        detail: { context_id: event.context_id, size_kb: payloadKb },
      });

      wsManager.markRendered(event.seq);
      break;
    }

    case 'PING': {
      const isCorrupt = !event.challenge || event.challenge === '';
      if (isCorrupt) {
        conn.updateChaosStats({
          corrupt_pings_handled: conn.chaosStats.corrupt_pings_handled + 1,
        });
      }

      trace.addEvent({
        kind: 'ping',
        seq: event.seq,
        stream_id: null,
        call_id: null,
        summary: isCorrupt ? 'PING (corrupt — empty challenge)' : `PING challenge: ${event.challenge}`,
        detail: { challenge: event.challenge, corrupt: isCorrupt },
      });

      // PONG is sent by WebSocketManager directly
      // Log the PONG in trace too
      setTimeout(() => {
        trace.addEvent({
          kind: 'pong',
          seq: null,
          stream_id: null,
          call_id: null,
          summary: `PONG sent: echo="${event.challenge ?? ''}"`,
          detail: { echo: event.challenge ?? '' },
        });
      }, 0);

      wsManager.markRendered(event.seq);
      break;
    }

    case 'STREAM_END': {
      chat.endStream(event.stream_id);

      trace.addEvent({
        kind: 'stream_end',
        seq: event.seq,
        stream_id: event.stream_id,
        call_id: null,
        summary: `Stream ended: ${event.stream_id}`,
        detail: { stream_id: event.stream_id },
      });

      // Compute stream integrity
      const renderedText = useChatStore.getState().getRenderedText(event.stream_id);
      // Build expected from trace token groups for this stream
      const traceEvents = useTraceStore.getState().events;
      const expectedText = traceEvents
        .filter(e => e.kind === 'token_group' && e.stream_id === event.stream_id)
        .map(e => e.token_text ?? '')
        .join('');

      useConnectionStore.getState().recordStreamIntegrity(
        event.stream_id,
        expectedText,
        renderedText
      );

      // Clear pending tool calls for this stream
      pendingToolCallsPerStream.delete(event.stream_id);

      conn.setState('CONNECTED');
      wsManager.markRendered(event.seq);
      break;
    }

    case 'ERROR': {
      trace.addEvent({
        kind: 'error',
        seq: event.seq,
        stream_id: null,
        call_id: null,
        summary: `Error [${event.code}]: ${event.message}`,
        detail: { code: event.code, message: event.message },
      });

      if (event.seq) wsManager.markRendered(event.seq);
      break;
    }
  }
}

export function handleConnectionStateChange(state: ConnectionState): void {
  useConnectionStore.getState().setState(state);

  if (state === 'RECONNECTING') {
    useConnectionStore.getState().incrementReconnect();
    useTraceStore.getState().addEvent({
      kind: 'reconnect',
      seq: null,
      stream_id: null,
      call_id: null,
      summary: 'Connection lost — reconnecting...',
      detail: null,
    });
  }

  if (state === 'RESUMING') {
    useTraceStore.getState().addEvent({
      kind: 'resume',
      seq: null,
      stream_id: null,
      call_id: null,
      summary: 'Reconnected — sending RESUME',
      detail: null,
    });
  }
}
