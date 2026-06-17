import { describe, it, expect, vi } from 'vitest';
import { SeqBuffer } from '@/lib/websocket/SeqBuffer';
import type { ServerEvent } from '@/lib/websocket/types';

function makeToken(seq: number, text = `t${seq}`): ServerEvent {
  return { type: 'TOKEN', seq, text, stream_id: 's_01' };
}

function makeStreamEnd(seq: number): ServerEvent {
  return { type: 'STREAM_END', seq, stream_id: 's_01' };
}

describe('SeqBuffer', () => {
  it('processes messages in order when they arrive in order', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(1));
    buf.push(makeToken(2));
    buf.push(makeToken(3));

    expect(processed).toEqual([1, 2, 3]);
  });

  it('buffers out-of-order messages and drains in order', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(3));
    buf.push(makeToken(1));
    buf.push(makeToken(2));

    expect(processed).toEqual([1, 2, 3]);
  });

  it('deduplicates messages with same seq', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(1));
    buf.push(makeToken(1)); // duplicate
    buf.push(makeToken(2));

    expect(processed).toEqual([1, 2]);
    expect(buf.dedupedCount).toBe(1);
  });

  it('handles fully reversed sequence', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(5));
    buf.push(makeToken(4));
    buf.push(makeToken(3));
    buf.push(makeToken(2));
    buf.push(makeToken(1));

    expect(processed).toEqual([1, 2, 3, 4, 5]);
    expect(buf.reorderedCount).toBe(4);
  });

  it('handles single element', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));
    buf.push(makeToken(1));
    expect(processed).toEqual([1]);
  });

  it('handles empty buffer (no pushes)', () => {
    const processFn = vi.fn();
    const buf = new SeqBuffer(processFn);
    expect(buf.getLastProcessedSeq()).toBe(0);
    expect(processFn).not.toHaveBeenCalled();
  });

  it('tracks last processed seq correctly', () => {
    const buf = new SeqBuffer(() => {});
    buf.push(makeToken(1));
    buf.push(makeToken(2));
    buf.push(makeToken(3));
    expect(buf.getLastProcessedSeq()).toBe(3);
  });

  it('resets correctly for reconnect', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(1));
    buf.push(makeToken(2));

    // Simulate reconnect — server will replay from seq 3
    buf.reset(2);
    expect(buf.getLastProcessedSeq()).toBe(2);

    buf.push(makeToken(3)); // replayed
    buf.push(makeToken(4));
    expect(processed).toEqual([1, 2, 3, 4]);
  });

  it('handles gaps (missing seq) without processing future messages', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(1));
    buf.push(makeToken(3)); // gap at 2
    buf.push(makeToken(4));

    expect(processed).toEqual([1]); // 3 and 4 buffered, waiting for 2

    buf.push(makeToken(2)); // fills gap
    expect(processed).toEqual([1, 2, 3, 4]);
  });

  it('deduplicates buffered duplicates', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(3));
    buf.push(makeToken(3)); // duplicate in buffer
    buf.push(makeToken(1));
    buf.push(makeToken(2));

    expect(processed).toEqual([1, 2, 3]);
    expect(buf.dedupedCount).toBeGreaterThanOrEqual(1);
  });

  it('handles mixed event types', () => {
    const types: string[] = [];
    const buf = new SeqBuffer((e) => types.push(e.type));

    buf.push(makeToken(2));
    buf.push(makeStreamEnd(3));
    buf.push(makeToken(1));

    expect(types).toEqual(['TOKEN', 'TOKEN', 'STREAM_END']);
  });

  it('fullReset starts fresh from seq 1', () => {
    const processed: number[] = [];
    const buf = new SeqBuffer((e) => processed.push(e.seq));

    buf.push(makeToken(1));
    buf.push(makeToken(2));
    buf.resetFull();

    buf.push(makeToken(1));
    expect(processed).toEqual([1, 2, 1]);
  });

  it('tracks reordered count correctly', () => {
    const buf = new SeqBuffer(() => {});
    buf.push(makeToken(2));
    buf.push(makeToken(3));
    buf.push(makeToken(1));
    expect(buf.reorderedCount).toBe(2);
  });
});
