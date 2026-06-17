// ============================================================
// AGENT CONSOLE — Protocol Types
// Every message type from the WebSocket protocol, strictly typed.
// No `any` types here. See types/escape-hatch.ts for the only
// permitted escape hatch.
// ============================================================

// ─── Client → Server ────────────────────────────────────────

export interface UserMessage {
  type: 'USER_MESSAGE';
  content: string;
}

export interface PongMessage {
  type: 'PONG';
  echo: string;
}

export interface ResumeMessage {
  type: 'RESUME';
  last_seq: number;
}

export interface ToolAckMessage {
  type: 'TOOL_ACK';
  call_id: string;
}

export type ClientMessage = UserMessage | PongMessage | ResumeMessage | ToolAckMessage;

// ─── Server → Client ────────────────────────────────────────

export interface TokenEvent {
  type: 'TOKEN';
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCallEvent {
  type: 'TOOL_CALL';
  seq: number;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResultEvent {
  type: 'TOOL_RESULT';
  seq: number;
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshotEvent {
  type: 'CONTEXT_SNAPSHOT';
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingEvent {
  type: 'PING';
  seq: number;
  challenge: string;
}

export interface StreamEndEvent {
  type: 'STREAM_END';
  seq: number;
  stream_id: string;
}

export interface ErrorEvent {
  type: 'ERROR';
  seq: number;
  code: string;
  message: string;
}

export type ServerEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | ContextSnapshotEvent
  | PingEvent
  | StreamEndEvent
  | ErrorEvent;

// ─── Connection States ───────────────────────────────────────

export type ConnectionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'STREAMING'
  | 'TOOL_CALL_PENDING'
  | 'RECONNECTING'
  | 'RESUMING';

// ─── Chat Domain ─────────────────────────────────────────────

export type ToolCallStatus = 'pending' | 'waiting_result' | 'complete' | 'timeout';

export interface ToolCallState {
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: ToolCallStatus;
  stream_id: string;
  seq: number;
  result_seq: number | null;
  ack_sent_at: number | null;
  result_received_at: number | null;
}

export interface TokenChunk {
  text: string;
  seq: number;
}

export type MessageSegment =
  | { kind: 'tokens'; chunks: TokenChunk[]; frozen: boolean }
  | { kind: 'tool_call'; call_id: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  stream_id: string | null;
  segments: MessageSegment[];
  complete: boolean;
  started_at: number;
  ended_at: number | null;
}

// ─── Trace Domain ────────────────────────────────────────────

export type TraceEventKind =
  | 'token_group'
  | 'tool_call'
  | 'tool_result'
  | 'context_snapshot'
  | 'ping'
  | 'pong'
  | 'stream_end'
  | 'error'
  | 'reconnect'
  | 'resume';

export interface TraceEvent {
  id: string;
  kind: TraceEventKind;
  seq: number | null;
  timestamp: number;
  stream_id: string | null;
  call_id: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  // For token groups
  token_count?: number;
  token_text?: string;
  duration_ms?: number;
  // For PONG
  pong_latency_ms?: number;
}

// ─── Context Domain ──────────────────────────────────────────

export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffNode {
  kind: DiffKind;
  key: string;
  oldValue?: unknown;
  newValue?: unknown;
  children?: DiffNode[];
}

export interface ContextSnapshot {
  context_id: string;
  seq: number;
  timestamp: number;
  data: Record<string, unknown>;
  diff: DiffNode[] | null; // null for first snapshot
}

// ─── Metrics Domain ─────────────────────────────────────────

export interface LatencyMetrics {
  last_token_latency_ms: number | null;
  last_pong_rtt_ms: number | null;
  last_reconnect_ms: number | null;
  last_tool_call_duration_ms: number | null;
  avg_token_latency_ms: number | null;
}

export interface ChaosStats {
  drops_recovered: number;
  messages_reordered: number;
  duplicates_deduped: number;
  largest_context_kb: number;
  corrupt_pings_handled: number;
  rapid_tool_calls: number;
}

// ─── Audit Domain ────────────────────────────────────────────

export interface ServerLogEntry {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ComplianceResult {
  score: number; // 0-100
  total_checks: number;
  passed_checks: number;
  violations: ComplianceViolation[];
  pong_compliance: PongCompliance[];
  tool_ack_compliance: ToolAckCompliance[];
  resume_correct: boolean | null;
}

export interface ComplianceViolation {
  type: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface PongCompliance {
  challenge: string;
  ping_time: string;
  pong_time: string | null;
  latency_ms: number | null;
  passed: boolean;
}

export interface ToolAckCompliance {
  call_id: string;
  call_time: string;
  ack_time: string | null;
  latency_ms: number | null;
  passed: boolean;
}

// ─── Guards ──────────────────────────────────────────────────

export function isServerEvent(raw: unknown): raw is ServerEvent {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['type'] !== 'string') return false;
  const validTypes = [
    'TOKEN', 'TOOL_CALL', 'TOOL_RESULT', 'CONTEXT_SNAPSHOT',
    'PING', 'STREAM_END', 'ERROR',
  ];
  return validTypes.includes(obj['type'] as string);
}

export function hasSeq(event: ServerEvent): boolean {
  return typeof (event as unknown as Record<string, unknown>)['seq'] === 'number';
}
