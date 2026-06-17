// ============================================================
// ESCAPE HATCH — The ONLY file where `any` is permitted.
//
// Rationale: JSON.parse returns `any` by type definition.
// WebSocket MessageEvent.data is `any` at the browser API boundary.
// Rather than casting throughout the codebase, we isolate the
// boundary crossing here and immediately narrow with type guards.
//
// RULES:
//   1. Never export `any` typed values from this file.
//   2. Always narrow to a known type before returning.
//   3. Every function here must have a test.
// ============================================================

import { isServerEvent, type ServerEvent } from '@/lib/websocket/types';

/**
 * Safely parse a raw WebSocket message data value into a ServerEvent.
 * Returns null if parsing fails or the result doesn't match the protocol.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseServerEvent(raw: any): ServerEvent | null {
  try {
    const data: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (isServerEvent(data)) return data;
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON from the /log endpoint.
 * Returns an empty array if parsing fails.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLogResponse(raw: any): unknown[] {
  try {
    const data: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

/**
 * Safely deep-clone an unknown object via JSON round-trip.
 */
export function safeClone<T>(value: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(JSON.stringify(value)) as T;
}
