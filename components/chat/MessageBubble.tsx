'use client';

import { useChatStore } from '@/lib/store/chatStore';
import { ToolCallCard } from './ToolCallCard';
import { TokenStream } from './TokenStream';
import type { ChatMessage } from '@/lib/websocket/types';

interface Props {
  message: ChatMessage;
  integrity: { expected: string; rendered: string; match: boolean } | null | undefined;
}

export function MessageBubble({ message, integrity }: Props) {
  const toolCalls = useChatStore((s) => s.toolCalls);
  const activeStreamId = useChatStore((s) => s.activeStreamId);
  const isStreaming = activeStreamId === message.stream_id && !message.complete;

  if (message.role === 'user') {
    const text = message.segments.filter(s => s.kind === 'tokens').flatMap(s => s.chunks).map(c => c.text).join('');
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '65%', background: '#4f46e5', color: '#fff', fontSize: 12, padding: '9px 14px', borderRadius: '14px 14px 4px 14px', lineHeight: 1.55, fontWeight: 400 }}>
          {text}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ maxWidth: '88%', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#7c3aed', fontWeight: 700 }}>A</div>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Agent</span>
          {isStreaming && (
            <div style={{ display: 'flex', gap: 3 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#4f46e5', opacity: 0.6, animation: 'bounce 1s infinite', animationDelay: `${i*150}ms` }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px 14px 14px 14px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {message.segments.map((seg, i) => {
            if (seg.kind === 'tokens') {
              return (
                <TokenStream key={i} chunks={seg.chunks} frozen={seg.frozen}
                  isLast={i === message.segments.length - 1} isStreaming={isStreaming && i === message.segments.length - 1} />
              );
            }
            if (seg.kind === 'tool_call') {
              const tc = toolCalls[seg.call_id];
              if (!tc) return null;
              return <ToolCallCard key={seg.call_id} toolCall={tc} />;
            }
            return null;
          })}

          {integrity && message.complete && (
            <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 8, fontSize: 10, fontWeight: 500, color: integrity.match ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{integrity.match ? '✓' : '⚠'}</span>
              <span>{integrity.match ? `Stream integrity verified — ${integrity.rendered.length} chars` : `Stream mismatch — ${integrity.rendered.length} vs ${integrity.expected.length} chars`}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
