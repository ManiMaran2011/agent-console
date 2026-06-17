// ============================================================
// WebSocketManager — Connection lifecycle manager
//
// Responsibilities:
//   - Connect/disconnect to agent-server
//   - Exponential backoff reconnection (500ms→1s→2s→4s→10s)
//   - PING/PONG heartbeat with 3s deadline
//   - Corrupt PING (empty challenge) handling
//   - RESUME as first message on reconnect
//   - Delegate message processing to SeqBuffer
// ============================================================

import { SeqBuffer } from './SeqBuffer';
import { parseServerEvent } from '@/types/escape-hatch';
import type {
  ServerEvent,
  ClientMessage,
  ConnectionState,
  PingEvent,
} from './types';

export interface WSManagerCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onEvent: (event: ServerEvent) => void;
  onMetric: (metric: MetricEvent) => void;
  onReconnect: () => void;
}

export interface MetricEvent {
  type: 'pong_rtt' | 'reconnect_duration' | 'token_latency';
  value_ms: number;
}

const BACKOFF_STEPS = [500, 1000, 2000, 4000, 10000];
const PONG_DEADLINE_MS = 3000;
const PING_CHECK_INTERVAL_MS = 500;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private seqBuffer: SeqBuffer;
  private callbacks: WSManagerCallbacks;
  private url: string;

  private state: ConnectionState = 'IDLE';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectStartTime: number | null = null;

  // PING tracking
  private pendingPing: { challenge: string; sentAt: number } | null = null;
  private pingCheckTimer: ReturnType<typeof setInterval> | null = null;
  private missedPings = 0;

  // Tool ACK tracking
  private pendingToolAcks = new Map<string, ReturnType<typeof setTimeout>>();

  // Last rendered seq — updated by store after DOM commit
  private lastRenderedSeq = 0;

  constructor(url: string, callbacks: WSManagerCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
    this.seqBuffer = new SeqBuffer((event) => {
      this.callbacks.onEvent(event);
    });
  }

  connect(): void {
    if (this.state === 'CONNECTING' || this.state === 'CONNECTED') return;
    this.setState('CONNECTING');
    this.openSocket();
  }

  disconnect(): void {
    this.stopHeartbeatCheck();
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect trigger
      this.ws.close();
      this.ws = null;
    }
    this.setState('IDLE');
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Called by store after a seq has been fully rendered to DOM */
  markRendered(seq: number): void {
    if (seq > this.lastRenderedSeq) {
      this.lastRenderedSeq = seq;
    }
  }

  getLastRenderedSeq(): number {
    return this.lastRenderedSeq;
  }

  getChaosStats() {
    return {
      reorderedCount: this.seqBuffer.reorderedCount,
      dedupedCount: this.seqBuffer.dedupedCount,
    };
  }

  sendToolAck(call_id: string): void {
    this.send({ type: 'TOOL_ACK', call_id });
    // Cancel the safety timeout if it exists
    const timer = this.pendingToolAcks.get(call_id);
    if (timer) {
      clearTimeout(timer);
      this.pendingToolAcks.delete(call_id);
    }
  }

  /** Schedule a TOOL_ACK — call this when TOOL_CALL is received */
  scheduleToolAck(call_id: string): void {
    // Send immediately
    this.send({ type: 'TOOL_ACK', call_id });
  }

  private openSocket(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (e) => this.handleMessage(e);
    this.ws.onclose = (e) => this.handleClose(e);
    this.ws.onerror = () => this.handleError();
  }

  private handleOpen(): void {
    const isReconnect = this.reconnectStartTime !== null;

    if (isReconnect) {
      const duration = Date.now() - (this.reconnectStartTime ?? Date.now());
      this.callbacks.onMetric({ type: 'reconnect_duration', value_ms: duration });
      this.reconnectStartTime = null;
      this.reconnectAttempt = 0;
      this.callbacks.onReconnect();

      // RESUME must be the FIRST message sent on reconnect
      this.setState('RESUMING');
      this.seqBuffer.reset(this.lastRenderedSeq);
      this.send({ type: 'RESUME', last_seq: this.lastRenderedSeq });
    } else {
      this.seqBuffer.resetFull();
      this.setState('CONNECTED');
    }

    this.startHeartbeatCheck();
  }

  private handleMessage(e: MessageEvent): void {
    const tokenReceiveTime = Date.now();
    const event = parseServerEvent(e.data);
    if (!event) return;

    // Handle PING immediately — before seq buffering
    if (event.type === 'PING') {
      this.handlePing(event as PingEvent);
      return;
    }

    // Push through seq buffer for ordering/dedup
    this.seqBuffer.push(event);

    // Token latency metric
    if (event.type === 'TOKEN') {
      this.callbacks.onMetric({
        type: 'token_latency',
        value_ms: Date.now() - tokenReceiveTime,
      });
    }
  }

  private handlePing(ping: PingEvent): void {
    // Handle corrupt PING (empty challenge) without crashing
    const challenge = ping.challenge ?? '';
    const pingTime = Date.now();

    this.pendingPing = { challenge, sentAt: pingTime };
    this.missedPings = 0;

    // Always respond — even with empty echo
    this.send({ type: 'PONG', echo: challenge });

    // Track RTT approximate (will be updated when we see server log)
    const rtt = Date.now() - pingTime;
    this.callbacks.onMetric({ type: 'pong_rtt', value_ms: rtt });
    this.pendingPing = null;
  }

  private handleClose(_e: CloseEvent): void {
    this.ws = null;
    this.stopHeartbeatCheck();
    if (this.state !== 'IDLE') {
      this.scheduleReconnect();
    }
  }

  private handleError(): void {
    // Error events are always followed by close, so just let close handle it
  }

  private scheduleReconnect(): void {
    if (this.reconnectStartTime === null) {
      this.reconnectStartTime = Date.now();
    }

    const delay = BACKOFF_STEPS[Math.min(this.reconnectAttempt, BACKOFF_STEPS.length - 1)] ?? 10000;
    this.reconnectAttempt++;
    this.setState('RECONNECTING');

    this.reconnectTimer = setTimeout(() => {
      this.setState('CONNECTING');
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeatCheck(): void {
    this.stopHeartbeatCheck();
    this.missedPings = 0;
    this.pingCheckTimer = setInterval(() => {
      if (this.pendingPing) {
        const elapsed = Date.now() - this.pendingPing.sentAt;
        if (elapsed > PONG_DEADLINE_MS) {
          this.missedPings++;
          this.pendingPing = null;
        }
      }
    }, PING_CHECK_INTERVAL_MS);
  }

  private stopHeartbeatCheck(): void {
    if (this.pingCheckTimer) {
      clearInterval(this.pingCheckTimer);
      this.pingCheckTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }
}
