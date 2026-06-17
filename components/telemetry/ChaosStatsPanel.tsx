'use client';

import { useConnectionStore } from '@/lib/store/connectionStore';

export function ChaosStatsPanel() {
  const chaosStats = useConnectionStore((s) => s.chaosStats);
  const streamIntegrity = useConnectionStore((s) => s.streamIntegrity);
  const integrityEntries = Object.entries(streamIntegrity);
  const allMatch = integrityEntries.every(([, v]) => v.match);

  return (
    <div style={{ background: '#fff', padding: '14px 16px' }}>
      <h2 style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>⚡</span> Chaos Survival Stats
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Stat label="Drops Recovered" value={chaosStats.drops_recovered} />
        <Stat label="Reordered" value={chaosStats.messages_reordered} />
        <Stat label="Deduped" value={chaosStats.duplicates_deduped} />
        <Stat label="Corrupt PINGs" value={chaosStats.corrupt_pings_handled} />
        <Stat label="Max Context" value={`${chaosStats.largest_context_kb}KB`} />
        <Stat label="Rapid Tools" value={chaosStats.rapid_tool_calls} />
      </div>
      {integrityEntries.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Stream Integrity</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {integrityEntries.map(([stream_id, v]) => (
              <div key={stream_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '4px 10px', borderRadius: 6, fontFamily: 'monospace', background: v.match ? '#f0fdf4' : '#fef2f2', color: v.match ? '#065f46' : '#991b1b' }}>
                <span>{v.match ? '✓' : '⚠'} {stream_id.slice(0, 12)}</span>
                <span>{v.rendered.length} chars {v.match ? '✓' : '≠'}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, marginTop: 6, fontWeight: 500, color: allMatch ? '#10b981' : '#ef4444' }}>
            {allMatch ? '✓ All streams verified intact' : '⚠ Stream integrity issues detected'}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const isActive = typeof value === 'number' ? value > 0 : value !== '0KB' && value !== '—';
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: isActive ? '#f59e0b' : '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 2, fontWeight: 500 }}>{label}</div>
    </div>
  );
}
