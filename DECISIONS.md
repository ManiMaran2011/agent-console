# DECISIONS.md — Agent Console

## 1. Seq-based Ordering and Deduplication

**Data structure: sorted array as a priority queue, plus a processed-seq set.**

On each incoming message, the `SeqBuffer` checks:
1. Is `seq` in the processed set? → discard (dedup)
2. Is `seq === nextExpected`? → process immediately, then drain the buffer for any consecutive seqs that are now unblocked
3. Is `seq > nextExpected`? → binary-search insert into the sorted buffer array

This gives O(log n) insertion and O(k) drain where k is the number of consecutive messages now available. The processed set is bounded to 200 entries to avoid unbounded memory growth during long sessions.

**Why not a min-heap?** A sorted array with binary insertion gives the same asymptotic cost for this workload. The buffer is rarely larger than 5–10 items in chaos mode (the server only reorders locally), and the drain pattern (repeatedly check head, pop if ready) maps naturally to array iteration. A heap would add implementation complexity with no practical benefit.

**Why track `last_seq` as rendered, not received?** The RESUME semantics require the server to replay everything the client has not yet *processed*. If we track received seq, we might RESUME past events that were buffered but not rendered — and lose them permanently. The `WebSocketManager.markRendered(seq)` method is called by the protocol handler after each event is dispatched to the stores (i.e., after it has been committed to application state, not just received over the wire).

---

## 2. Preventing Layout Shift During Tool Call Interruptions

**Strategy: segment-based message model + CSS `contain: layout`.**

Each agent message is modelled as an ordered array of `MessageSegment` objects, each of which is either a `tokens` segment or a `tool_call` reference. When a TOOL_CALL arrives:

1. The current `tokens` segment is **frozen** (its `frozen: true` flag is set). This is a pure state mutation — no DOM elements are moved or removed.
2. A new `tool_call` segment is appended.
3. When TOOL_RESULT arrives and streaming resumes, new tokens go into a brand new `tokens` segment appended after the tool call.

Because each segment maps to its own fixed DOM subtree, the frozen text is never touched — its element, layout, and paint are completely stable. The tool card appearing below it is an append, not an insertion above or within the text.

This is fundamentally different from a single `innerHTML` or string concatenation approach, where inserting a tool card mid-string would force a full reflow of the text.

**No CSS animation on token append.** Animations at 30 events/second cause jank via repeated style recalculation. The only animation is the cursor blink, which is a pure CSS `animation` on a pseudo-element with zero layout impact.

---

## 3. Reconnection State Recovery

**The key insight: track what the DOM has consumed, not what the socket has received.**

`WebSocketManager` maintains `lastRenderedSeq`, incremented only when `markRendered(seq)` is called from the protocol handler — after the event has been written to the Zustand store (and thus to the virtual DOM). This is distinct from the seq that arrived over the wire.

On reconnect:
1. The `RECONNECTING → RESUMING` transition fires immediately when the new socket opens.
2. `RESUME { last_seq: lastRenderedSeq }` is sent as the **first and only** message before any buffered events are processed.
3. `SeqBuffer.reset(lastRenderedSeq)` sets `nextExpected = lastRenderedSeq + 1`, so replayed events that were already rendered are silently discarded.
4. The server replays everything after `last_seq`. These flow through the same SeqBuffer and protocol handler — the stores handle them identically to fresh events.

**Mid-tool-call drops:** If the connection drops after TOOL_CALL but before TOOL_RESULT, the tool card remains in `waiting_result` state (it was rendered, so `lastRenderedSeq` includes its seq). On reconnect, the server replays TOOL_RESULT, which resolves the card normally. The UI never shows an inconsistent state.

---

## 4. The Race Conditions in This Protocol

**Race condition 1 (documented by the assignment):** The TOOL_ACK timeout. The server starts a 5-second timer when it sends TOOL_CALL. If the client sends TOOL_ACK after 5 seconds (but before the server gives up), the server logs a violation even though the client eventually complied. Mitigation: send TOOL_ACK immediately upon rendering the tool card, before doing any other work.

**Race condition 2 (not documented):** Connection drop during TOOL_ACK window. If the connection drops after the server sends TOOL_CALL (seq N) but before the client sends TOOL_ACK, the server's 5-second timer keeps running during the reconnection window. If reconnection + RESUME + event replay takes longer than 5 seconds, the server logs a TOOL_ACK violation even though the client will send TOOL_ACK correctly after replay. This is a server-side protocol design flaw: the timer does not account for connection recovery time.

**Mitigation in our implementation:** We send TOOL_ACK immediately when the TOOL_CALL event is processed by the protocol handler — not deferred to a React render cycle. This minimises the window. However, the race cannot be fully eliminated without a protocol change (e.g., the server resetting the timer upon receiving a RESUME that includes the tool call's seq).

**Sequence diagram of the race:**

```
Client                    Server
  |                          |
  |  ← TOOL_CALL (seq 5)     |   t=0: server starts 5s timer
  |                          |
  |  [connection drops]      |   t=1
  |                          |
  |  [reconnecting...]       |   t=4: server timer expires → violation logged
  |                          |
  |  → RESUME {last_seq: 4}  |   t=4.5: client reconnects
  |  ← replay TOOL_CALL      |
  |  → TOOL_ACK              |   t=4.6: too late
```

---

## 5. What Would Change for 50 Concurrent Agent Streams

The current architecture is single-stream. For an operations dashboard with 50 concurrent streams:

- **One `WebSocketManager` per stream**, pooled. Sharing a single WebSocket with multiplexed `stream_id` routing would be cleaner but requires server protocol changes.
- **Zustand sliced by `stream_id`.** Currently the stores are flat. For 50 streams, each component would need to subscribe to `state.messages[stream_id]` rather than `state.messages`. This is a store shape change, not a paradigm change.
- **`SeqBuffer` per stream.** Seq spaces are per-connection, not per-stream, so one buffer per connection (current design) is correct. If the server moves to per-stream seq spaces, we'd need per-stream buffers.
- **Timeline virtualization becomes mandatory** (it already is, via @tanstack/virtual). At 50 streams × 30 events/sec = 1500 events/sec, the event list must never write to DOM synchronously. We'd also need stream-level filtering as a first-class control.
- **Consider a `SharedWorker`** for WebSocket management so multiple tabs sharing the same agent session don't open duplicate connections.
- **Context inspector** would need a stream selector — the current single-panel design doesn't scale to 50 context spaces.

---

## 6. What Would Change for 100x Longer Responses

Current design streams tokens into a flat array of chunks per segment. For document-length responses (50,000+ tokens):

- **Virtualize the token text itself.** The current `TokenStream` component renders all chunks as a single string concatenation. At 50K tokens, this is a large DOM text node but still manageable. At 500K tokens, we'd need to split into fixed-size "pages" of ~1000 tokens each and virtualise them.
- **Lazy diff computation for context.** The JSON differ currently runs synchronously on every CONTEXT_SNAPSHOT. For large contexts with many changes, this should move to a Web Worker.
- **Stream integrity verification would need chunked checksums.** Comparing two 1MB strings character-by-character on the main thread is not acceptable. We'd use rolling checksums per 1000-token window.
- **The trace timeline already handles this** via virtualisation — 50K token groups collapse into manageable row counts.
- **Consider pagination of message history.** After 100 messages, mount/unmount old message bubbles rather than keeping all DOM present. The current design keeps all messages in DOM, which is fine for typical sessions but not for long-running agent tasks.

---

## State Management Choice: Zustand

**Why Zustand over Redux:** Zustand stores live outside the React tree. The `WebSocketManager` can call `useChatStore.getState().appendToken(...)` directly without dispatching through a React event loop. At 30 token events/second, avoiding the Redux dispatch → reducer → selector → re-render cycle per event matters. Zustand's `subscribeWithSelector` middleware lets components subscribe to exactly the slice they need — `TraceTimeline` subscribes to `events.length`, not the full event objects, so it only re-renders when the count changes.

**Why Zustand over Context:** Context causes full subtree re-renders on every value change. At 30 events/sec, a Context-based store would re-render the entire component tree 30 times per second. Zustand's atom-style subscriptions make component re-renders surgical.

**Why not Jotai/Recoil:** Zustand's imperative `getState()` API is critical for the WebSocket handler, which lives outside React. Jotai and Recoil require hooks for reads, which means they cannot be used from a non-React singleton.
