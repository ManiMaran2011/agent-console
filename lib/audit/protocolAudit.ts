// ============================================================
// Protocol Audit — Fetches /log from agent-server and scores
// client protocol compliance.
// ============================================================

import type { ComplianceResult, ComplianceViolation, PongCompliance, ToolAckCompliance } from '@/lib/websocket/types';

const PONG_DEADLINE_MS = 3000;
const TOOL_ACK_DEADLINE_MS = 2000;

interface LogEntry {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export async function fetchProtocolAudit(serverUrl: string): Promise<ComplianceResult | null> {
  try {
    const res = await fetch(`${serverUrl}/log`);
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return null;
    const entries = raw as LogEntry[];
    return analyzeLog(entries);
  } catch {
    return null;
  }
}

function analyzeLog(entries: LogEntry[]): ComplianceResult {
  const violations: ComplianceViolation[] = [];
  const pongCompliance: PongCompliance[] = [];
  const toolAckCompliance: ToolAckCompliance[] = [];
  let resumeCorrect: boolean | null = null;

  // Build timeline of events
  const pings = entries.filter(e => e.event === 'ping_sent');
  const pongs = entries.filter(e => e.event === 'pong_received');
  const toolCalls = entries.filter(e => e.event === 'tool_call_sent');
  const toolAcks = entries.filter(e => e.event === 'tool_ack_received');
  const resumes = entries.filter(e => e.event === 'resume_received');

  // Check PONG compliance
  for (const ping of pings) {
    const challenge = ping.data['challenge'] as string;
    const pingTime = new Date(ping.timestamp).getTime();

    const matchingPong = pongs.find(p => p.data['echo'] === challenge);
    const pongTime = matchingPong ? new Date(matchingPong.timestamp).getTime() : null;
    const latency = pongTime ? pongTime - pingTime : null;
    const passed = latency !== null && latency <= PONG_DEADLINE_MS;

    pongCompliance.push({
      challenge: challenge || '(empty)',
      ping_time: ping.timestamp,
      pong_time: matchingPong?.timestamp ?? null,
      latency_ms: latency,
      passed,
    });

    if (!passed) {
      if (latency === null) {
        violations.push({
          type: 'MISSING_PONG',
          description: `No PONG received for PING challenge "${challenge || '(empty)'}"`,
          severity: 'error',
        });
      } else {
        violations.push({
          type: 'LATE_PONG',
          description: `PONG received after ${latency}ms (deadline: ${PONG_DEADLINE_MS}ms)`,
          severity: 'error',
        });
      }
    }
  }

  // Check TOOL_ACK compliance
  for (const tc of toolCalls) {
    const callId = tc.data['call_id'] as string;
    const callTime = new Date(tc.timestamp).getTime();

    const matchingAck = toolAcks.find(a => a.data['call_id'] === callId);
    const ackTime = matchingAck ? new Date(matchingAck.timestamp).getTime() : null;
    const latency = ackTime ? ackTime - callTime : null;
    const passed = latency !== null && latency <= TOOL_ACK_DEADLINE_MS;

    toolAckCompliance.push({
      call_id: callId,
      call_time: tc.timestamp,
      ack_time: matchingAck?.timestamp ?? null,
      latency_ms: latency,
      passed,
    });

    if (!passed) {
      if (latency === null) {
        violations.push({
          type: 'MISSING_TOOL_ACK',
          description: `No TOOL_ACK sent for call_id "${callId}"`,
          severity: 'error',
        });
      } else {
        violations.push({
          type: 'LATE_TOOL_ACK',
          description: `TOOL_ACK sent after ${latency}ms (deadline: ${TOOL_ACK_DEADLINE_MS}ms)`,
          severity: 'warning',
        });
      }
    }
  }

  // Check RESUME correctness
  if (resumes.length > 0) {
    const resume = resumes[0];
    const lastSeq = resume?.data['last_seq'];
    resumeCorrect = typeof lastSeq === 'number' && lastSeq >= 0;
    if (!resumeCorrect) {
      violations.push({
        type: 'BAD_RESUME',
        description: `RESUME sent with invalid last_seq: ${String(lastSeq)}`,
        severity: 'error',
      });
    }
  }

  const total_checks =
    pongCompliance.length + toolAckCompliance.length + (resumes.length > 0 ? 1 : 0);
  const passed_checks =
    pongCompliance.filter(p => p.passed).length +
    toolAckCompliance.filter(t => t.passed).length +
    (resumeCorrect === true ? 1 : 0);

  const score = total_checks > 0 ? Math.round((passed_checks / total_checks) * 100) : 100;

  return {
    score,
    total_checks,
    passed_checks,
    violations,
    pong_compliance: pongCompliance,
    tool_ack_compliance: toolAckCompliance,
    resume_correct: resumeCorrect,
  };
}
