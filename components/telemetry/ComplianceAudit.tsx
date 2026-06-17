'use client';

import { useState, useCallback, type RefObject } from 'react';
import { fetchProtocolAudit } from '@/lib/audit/protocolAudit';
import type { ComplianceResult } from '@/lib/websocket/types';
import type { WebSocketManager } from '@/lib/websocket/WebSocketManager';

const SERVER_HTTP_URL = process.env.NEXT_PUBLIC_SERVER_HTTP_URL ?? 'http://localhost:4747';

interface Props { onClose: () => void; wsRef: RefObject<WebSocketManager | null>; }

export function ComplianceAudit({ onClose, wsRef: _wsRef }: Props) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetchProtocolAudit(SERVER_HTTP_URL);
      if (r) setResult(r); else setError('Could not fetch /log. Is agent-server running?');
    } catch { setError('Audit failed — check server connection'); }
    finally { setLoading(false); }
  }, []);

  const scoreColor = result ? result.score >= 90 ? '#10b981' : result.score >= 70 ? '#f59e0b' : '#ef4444' : '#9ca3af';

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #eaecf0', padding: '14px 16px', maxHeight: 380, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Protocol Compliance Audit</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={runAudit} disabled={loading}
            style={{ padding: '5px 14px', background: loading ? '#e5e7eb' : '#4f46e5', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 7, border: 'none', cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'Fetching /log...' : 'Run Audit'}
          </button>
          <button onClick={onClose} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      </div>

      {error && <div style={{ fontSize: 11, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '8px 12px', marginBottom: 10 }}>{error}</div>}
      {!result && !loading && !error && <p style={{ fontSize: 11, color: '#d1d5db' }}>Click "Run Audit" to fetch server log and score protocol compliance.</p>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>
              {result.score}<span style={{ fontSize: 18, color: '#e5e7eb' }}>/100</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              <div>{result.passed_checks} / {result.total_checks} checks passed</div>
              {result.resume_correct !== null && (
                <div style={{ color: result.resume_correct ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                  RESUME: {result.resume_correct ? '✓ correct' : '✕ incorrect'}
                </div>
              )}
            </div>
          </div>

          {result.violations.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Violations</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.violations.map((v, i) => (
                  <div key={i} style={{ fontSize: 10, padding: '5px 10px', borderRadius: 6, fontFamily: 'monospace', background: v.severity === 'error' ? '#fef2f2' : '#fffbeb', color: v.severity === 'error' ? '#991b1b' : '#92400e', border: `1px solid ${v.severity === 'error' ? '#fecaca' : '#fde68a'}` }}>
                    [{v.type}] {v.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.pong_compliance.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>PONG responses ({result.pong_compliance.filter(p => p.passed).length}/{result.pong_compliance.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {result.pong_compliance.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '4px 10px', borderRadius: 6, fontFamily: 'monospace', background: p.passed ? '#f0fdf4' : '#fef2f2', color: p.passed ? '#065f46' : '#991b1b' }}>
                    <span>{p.passed ? '✓' : '✕'} {p.challenge.slice(0, 12)}</span>
                    <span>{p.latency_ms !== null ? `${p.latency_ms}ms` : 'missing'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tool_ack_compliance.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>TOOL_ACK ({result.tool_ack_compliance.filter(t => t.passed).length}/{result.tool_ack_compliance.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {result.tool_ack_compliance.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '4px 10px', borderRadius: 6, fontFamily: 'monospace', background: t.passed ? '#f0fdf4' : '#fef2f2', color: t.passed ? '#065f46' : '#991b1b' }}>
                    <span>{t.passed ? '✓' : '✕'} {t.call_id.slice(-10)}</span>
                    <span>{t.latency_ms !== null ? `${t.latency_ms}ms` : 'missing'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
