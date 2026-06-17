// ============================================================
// SeqBuffer — Sequence-ordered message buffer
//
// Guarantees:
//   - Messages are processed in seq order regardless of arrival order
//   - Duplicate seqs are silently discarded
//   - O(log n) insertion via sorted array maintenance
//   - Drain is O(k) where k = consecutive messages available
// ============================================================

import type { ServerEvent } from './types';

export type ProcessFn = (event: ServerEvent) => void;

interface BufferedEvent {
  seq: number;
  event: ServerEvent;
}

export class SeqBuffer {
  private buffer: BufferedEvent[] = [];
  private processedSeqs = new Set<number>();
  private nextExpected = 1;
  private processFn: ProcessFn;

  // Chaos stats
  public reorderedCount = 0;
  public dedupedCount = 0;

  constructor(processFn: ProcessFn) {
    this.processFn = processFn;
  }

  /**
   * Push a new event into the buffer.
   * If seq === nextExpected, process immediately and drain.
   * If seq < nextExpected, it's a duplicate — discard.
   * Otherwise buffer it in sorted order.
   */
  push(event: ServerEvent): void {
    const seq = event.seq;

    // Deduplicate
    if (this.processedSeqs.has(seq)) {
      this.dedupedCount++;
      return;
    }

    if (seq === this.nextExpected) {
      this.markProcessed(seq);
      this.processFn(event);
      this.drain();
    } else if (seq > this.nextExpected) {
      // Track reordering (will be counted when we drain)
      this.insertSorted({ seq, event });
    }
    // seq < nextExpected but not in processedSeqs: shouldn't happen in normal
    // mode, but handle gracefully by discarding
  }

  /**
   * Reset buffer state for a new session or after reconnect.
   * last_seq: the highest seq the client has fully processed.
   */
  reset(last_seq: number): void {
    this.buffer = [];
    this.processedSeqs.clear();
    this.nextExpected = last_seq + 1;
    this.reorderedCount = 0;
    this.dedupedCount = 0;
  }

  /**
   * Reset completely (new connection, no prior state).
   */
  resetFull(): void {
    this.buffer = [];
    this.processedSeqs.clear();
    this.nextExpected = 1;
    this.reorderedCount = 0;
    this.dedupedCount = 0;
  }

  /**
   * Get the highest seq fully processed.
   * Used to compute last_seq for RESUME messages.
   */
  getLastProcessedSeq(): number {
    return this.nextExpected - 1;
  }

  /**
   * Get current buffer size (unprocessed events).
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  private drain(): void {
    while (this.buffer.length > 0) {
      const head = this.buffer[0];
      if (!head) break;

      if (head.seq === this.nextExpected) {
        this.buffer.shift();
        if (!this.processedSeqs.has(head.seq)) {
          this.reorderedCount++;
          this.markProcessed(head.seq);
          this.processFn(head.event);
        }
        this.drain();
        break;
      } else if (head.seq < this.nextExpected) {
        // Delayed duplicate surfaced from buffer
        this.dedupedCount++;
        this.buffer.shift();
      } else {
        // Gap still exists
        break;
      }
    }
  }

  private markProcessed(seq: number): void {
    this.processedSeqs.add(seq);
    this.nextExpected = seq + 1;
    // Bound memory: keep only last 200 seqs in the processed set
    if (this.processedSeqs.size > 200) {
      const oldest = Math.min(...this.processedSeqs);
      this.processedSeqs.delete(oldest);
    }
  }

  private insertSorted(item: BufferedEvent): void {
    // Check for duplicate in buffer
    const existingIdx = this.buffer.findIndex(b => b.seq === item.seq);
    if (existingIdx !== -1) {
      this.dedupedCount++;
      return;
    }

    // Binary search insertion
    let lo = 0;
    let hi = this.buffer.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.buffer[mid]?.seq ?? 0) < item.seq) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.buffer.splice(lo, 0, item);
  }
}
