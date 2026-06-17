'use client';

import { useEffect, useRef, useCallback } from 'react';
import { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { handleServerEvent, handleConnectionStateChange } from '@/lib/websocket/ProtocolHandler';
import { useConnectionStore } from '@/lib/store/connectionStore';
import { useChatStore } from '@/lib/store/chatStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4747/ws';

export function useAgentConnection() {
  const wsRef = useRef<WebSocketManager | null>(null);
  const updateMetric = useConnectionStore((s) => s.updateMetric);
  const updateChaosStats = useConnectionStore((s) => s.updateChaosStats);
  const chaosStats = useConnectionStore((s) => s.chaosStats);

  useEffect(() => {
    const manager = new WebSocketManager(WS_URL, {
      onStateChange: (state) => {
        handleConnectionStateChange(state);
      },
      onEvent: (event) => {
        handleServerEvent(event, manager);
        // Update chaos stats from buffer
        const stats = manager.getChaosStats();
        updateChaosStats({
          messages_reordered: stats.reorderedCount,
          duplicates_deduped: stats.dedupedCount,
        });
      },
      onMetric: (metric) => {
        updateMetric(metric.type, metric.value_ms);
      },
      onReconnect: () => {
        // Already handled by state change → RESUMING
      },
    });

    wsRef.current = manager;
    manager.connect();

    return () => {
      manager.disconnect();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current) return;
    useChatStore.getState().addUserMessage(content);
    wsRef.current.send({ type: 'USER_MESSAGE', content });
  }, []);

  const reconnect = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.disconnect();
    wsRef.current.connect();
  }, []);

  return { sendMessage, reconnect, wsRef };
}
