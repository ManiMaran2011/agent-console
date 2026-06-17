// ============================================================
// JSON Differ — Recursive structural diff for context snapshots
//
// Produces a DiffNode tree showing added/removed/changed/unchanged
// keys between two arbitrary JSON objects.
// ============================================================

import type { DiffNode } from '@/lib/websocket/types';

export function computeDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): DiffNode[] {
  return diffObjects(oldObj, newObj, '');
}

function diffValue(key: string, oldVal: unknown, newVal: unknown): DiffNode {
  if (isObject(oldVal) && isObject(newVal)) {
    const children = diffObjects(
      oldVal as Record<string, unknown>,
      newVal as Record<string, unknown>,
      key
    );
    const hasChanges = children.some(
      (c) => c.kind !== 'unchanged'
    );
    return {
      kind: hasChanges ? 'changed' : 'unchanged',
      key,
      oldValue: oldVal,
      newValue: newVal,
      children,
    };
  }

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const same = JSON.stringify(oldVal) === JSON.stringify(newVal);
    return {
      kind: same ? 'unchanged' : 'changed',
      key,
      oldValue: oldVal,
      newValue: newVal,
    };
  }

  if (oldVal === newVal) {
    return { kind: 'unchanged', key, oldValue: oldVal, newValue: newVal };
  }

  return { kind: 'changed', key, oldValue: oldVal, newValue: newVal };
}

function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  _parentKey: string
): DiffNode[] {
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const nodes: DiffNode[] = [];

  for (const key of allKeys) {
    const inOld = Object.prototype.hasOwnProperty.call(oldObj, key);
    const inNew = Object.prototype.hasOwnProperty.call(newObj, key);

    if (inOld && !inNew) {
      nodes.push({ kind: 'removed', key, oldValue: oldObj[key] });
    } else if (!inOld && inNew) {
      nodes.push({ kind: 'added', key, newValue: newObj[key] });
    } else if (inOld && inNew) {
      nodes.push(diffValue(key, oldObj[key], newObj[key]));
    }
  }

  return nodes;
}

function isObject(val: unknown): boolean {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Count the number of changed nodes in a diff tree.
 */
export function countChanges(nodes: DiffNode[]): { added: number; removed: number; changed: number } {
  let added = 0;
  let removed = 0;
  let changed = 0;

  function walk(node: DiffNode): void {
    if (node.kind === 'added') added++;
    else if (node.kind === 'removed') removed++;
    else if (node.kind === 'changed') changed++;
    if (node.children) node.children.forEach(walk);
  }

  nodes.forEach(walk);
  return { added, removed, changed };
}
