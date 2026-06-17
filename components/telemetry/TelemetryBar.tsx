'use client';

import { useConnectionStore } from '@/lib/store/connectionStore';

export function TelemetryBar() {
  const metrics = useConnectionStore((s) => s.metrics);
  const chaosStats = useConnectionStore((s) => s.chaosStats);
  const reconnectCount = useConnectionStore((s) => s.reconnectCount);
  const fmt = (v: number | null, unit = 'ms') => v !== null ? `${v}${unit}` : '—';

  return (
    <div style={{ height: 30, background: '#fff', borderTop: '1px solid #eaecf0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14, overflowX: 'auto', flexShrink: 0 }}>
      <Metric label="Token" value={fmt(metrics.last_token_latency_ms)} />
      <Metric label="Avg" value={fmt(metrics.avg_token_latency_ms)} />
      <Metric label="RTT" value={fmt(metrics.last_pong_rtt_ms)} />
      <Metric label="Tool" value={fmt(metrics.last_tool_call_duration_ms)} />
      <Sep />
      <Metric label="Drops" value={String(chaosStats.drops_recovered)} hot={chaosStats.drops_recovered > 0} />
      <Metric label="Reordered" value={String(chaosStats.messages_reordered)} hot={chaosStats.messages_reordered > 0} />
      <Metric label="Deduped" value={String(chaosStats.duplicates_deduped)} hot={chaosStats.duplicates_deduped > 0} />
      <Metric label="Corrupt PINGs" value={String(chaosStats.corrupt_pings_handled)} hot={chaosStats.corrupt_pings_handled > 0} />
      <Metric label="Max ctx" value={chaosStats.largest_context_kb > 0 ? `${chaosStats.largest_context_kb}KB` : '—'} />
      <Sep />
      <Metric label="Reconnects" value={String(reconnectCount)} hot={reconnectCount > 0} />
    </div>
  );
}

function Metric({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <span style={{ fontSize: 9, color: '#d1d5db', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: hot ? '#f59e0b' : '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 12, background: '#f3f4f6', flexShrink: 0 }} />;
}
