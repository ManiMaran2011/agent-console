'use client';

import type { TokenChunk } from '@/lib/websocket/types';

interface Props {
  chunks: TokenChunk[];
  frozen: boolean;
  isLast: boolean;
  isStreaming: boolean;
}

export function TokenStream({ chunks, frozen, isLast, isStreaming }: Props) {
  const text = chunks.map(c => c.text).join('');
  const showCursor = isStreaming && isLast && !frozen;
  if (!text && !showCursor) return null;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.75, color: frozen ? '#6b7280' : '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text}
      {showCursor && <span className="cursor-blink" aria-hidden="true" />}
    </div>
  );
}
