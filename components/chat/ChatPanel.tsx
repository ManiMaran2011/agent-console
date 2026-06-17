'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
import { useConnectionStore } from '@/lib/store/connectionStore';
import { MessageBubble } from './MessageBubble';

interface Props { onSendMessage: (content: string) => void; }

export function ChatPanel({ onSendMessage }: Props) {
  const messages = useChatStore((s) => s.messages);
  const state = useConnectionStore((s) => s.state);
  const streamIntegrity = useConnectionStore((s) => s.streamIntegrity);
  const [input, setInput] = useState('');
  const [userScrolled, setUserScrolled] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isConnected = ['CONNECTED','STREAMING','TOOL_CALL_PENDING','RESUMING'].includes(state);

  useEffect(() => {
    if (!userScrolled) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userScrolled]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setUserScrolled(el.scrollHeight - el.scrollTop - el.clientHeight > 50);
  }, []);

  const handleSend = useCallback(() => {
    const t = input.trim();
    if (!t || !isConnected) return;
    onSendMessage(t);
    setInput('');
    setUserScrolled(false);
  }, [input, isConnected, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f9fb' }}>
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>⚡</div>
            <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Send a message to start the agent</p>
            <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>Connected to ws://localhost:4747/ws</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} integrity={msg.stream_id ? streamIntegrity[msg.stream_id] : null} />
        ))}
        <div ref={bottomRef} />
      </div>

      {userScrolled && (
        <button onClick={() => { setUserScrolled(false); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          style={{ position: 'absolute', bottom: 80, right: 20, background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 11, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          ↓ Latest
        </button>
      )}

      {/* Input */}
      <div style={{ borderTop: '1px solid #eaecf0', padding: '10px 16px', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            placeholder={isConnected ? 'Send a message... (Enter to send, Shift+Enter for newline)' : 'Connecting...'}
            rows={2}
            style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#374151', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <button onClick={handleSend} disabled={!isConnected || !input.trim()}
            style={{ padding: '8px 18px', background: isConnected && input.trim() ? '#4f46e5' : '#e5e7eb', color: isConnected && input.trim() ? '#fff' : '#9ca3af', fontSize: 12, fontWeight: 600, borderRadius: 9, border: 'none', cursor: isConnected && input.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, alignSelf: 'flex-end', transition: 'all 0.15s' }}>
            Send
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#d1d5db', marginTop: 4 }}>State: <span style={{ fontFamily: 'monospace' }}>{state}</span></p>
      </div>
    </div>
  );
}
