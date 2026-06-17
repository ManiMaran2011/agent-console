'use client';

import { useAgentConnection } from '@/lib/websocket/useAgentConnection';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { TraceTimeline } from '@/components/timeline/TraceTimeline';
import { ContextInspector } from '@/components/context/ContextInspector';
import { ConnectionHeader } from '@/components/connection/ConnectionHeader';
import { TelemetryBar } from '@/components/telemetry/TelemetryBar';
import { ReconnectBanner } from '@/components/connection/ReconnectBanner';
import { useConnectionStore } from '@/lib/store/connectionStore';
import { useState } from 'react';

export default function Home() {
  const { sendMessage, wsRef } = useAgentConnection();
  const state = useConnectionStore((s) => s.state);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showContext, setShowContext] = useState(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f8f9fb' }}>
      <ConnectionHeader
        showTimeline={showTimeline}
        showContext={showContext}
        onToggleTimeline={() => setShowTimeline(v => !v)}
        onToggleContext={() => setShowContext(v => !v)}
        wsRef={wsRef}
      />

      {(state === 'RECONNECTING' || state === 'RESUMING') && <ReconnectBanner />}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {showTimeline && (
          <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid #eaecf0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TraceTimeline />
          </div>
        )}

        <div className="flex-1 overflow-hidden min-w-0">
          <ChatPanel onSendMessage={sendMessage} />
        </div>

        {showContext && (
          <div style={{ width: 195, flexShrink: 0, borderLeft: '1px solid #eaecf0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ContextInspector />
          </div>
        )}
      </div>

      <TelemetryBar />
    </div>
  );
}
