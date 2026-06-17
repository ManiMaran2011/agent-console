'use client';

import { useConnectionStore } from '@/lib/store/connectionStore';

export function ReconnectBanner() {
  const state = useConnectionStore((s) => s.state);
  const reconnectCount = useConnectionStore((s) => s.reconnectCount);
  const isResuming = state === 'RESUMING';

  return (
    <div className="reconnect-banner" style={{
      height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 11, fontWeight: 500,
      background: isResuming ? '#f5f3ff' : '#fef2f2',
      borderBottom: `1px solid ${isResuming ? '#ddd6fe' : '#fecaca'}`,
      color: isResuming ? '#5b21b6' : '#991b1b',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', opacity: 0.8 }} />
      {isResuming
        ? 'Reconnected — replaying missed events...'
        : `Reconnecting... (attempt ${reconnectCount})`}
    </div>
  );
}
