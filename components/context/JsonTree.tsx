'use client';

import { useState } from 'react';
import type { DiffNode } from '@/lib/websocket/types';

interface JsonTreeProps { data: Record<string, unknown>; diff: DiffNode[] | null; showDiff: boolean; }

export function JsonTree({ data, diff, showDiff }: JsonTreeProps) {
  const diffMap = new Map<string, DiffNode>();
  if (diff && showDiff) for (const node of diff) diffMap.set(node.key, node);
  return (
    <div style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 10, lineHeight: 1.9 }}>
      {Object.entries(data).map(([key, value]) => (
        <JsonNode key={key} nodeKey={key} value={value} diffNode={diffMap.get(key) ?? null} showDiff={showDiff} depth={0} />
      ))}
    </div>
  );
}

interface JsonNodeProps { nodeKey: string; value: unknown; diffNode: DiffNode | null; showDiff: boolean; depth: number; }

function JsonNode({ nodeKey, value, diffNode, showDiff, depth }: JsonNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  const diffKind = diffNode?.kind ?? 'unchanged';

  const rowStyle: React.CSSProperties = {
    paddingLeft: depth * 12,
    borderRadius: 3,
    ...(showDiff && diffKind !== 'unchanged' ? {
      background: diffKind === 'added' ? '#ecfdf5' : diffKind === 'removed' ? '#fef2f2' : '#fffbeb',
      borderLeft: `2px solid ${diffKind === 'added' ? '#10b981' : diffKind === 'removed' ? '#ef4444' : '#f59e0b'}`,
      paddingLeft: depth * 12 + 4,
    } : {}),
  };

  const diffPrefix = showDiff
    ? diffKind === 'added' ? <span style={{ color: '#10b981', fontWeight: 700, marginRight: 3 }}>+</span>
      : diffKind === 'removed' ? <span style={{ color: '#ef4444', fontWeight: 700, marginRight: 3 }}>-</span>
      : diffKind === 'changed' ? <span style={{ color: '#f59e0b', fontWeight: 700, marginRight: 3 }}>~</span>
      : null
    : null;

  if (!isExpandable) {
    return (
      <div style={{ display: 'flex', gap: 4, padding: '1px 0', ...rowStyle }}>
        {diffPrefix}
        <span style={{ color: '#7c3aed', fontWeight: 500 }}>{nodeKey}</span>
        <span style={{ color: '#d1d5db' }}>:</span>
        <span style={{ color: getValueColor(value) }}>{formatValue(value, diffNode, showDiff)}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const childDiffMap = new Map<string, DiffNode>();
  if (diffNode?.children && showDiff) for (const c of diffNode.children) childDiffMap.set(c.key, c);

  return (
    <div style={rowStyle}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', gap: 4, padding: '1px 0', cursor: 'pointer' }}>
        {diffPrefix}
        <span style={{ color: '#d1d5db', fontSize: 8 }}>{open ? '▼' : '▶'}</span>
        <span style={{ color: '#7c3aed', fontWeight: 500 }}>{nodeKey}</span>
        <span style={{ color: '#d1d5db' }}>:</span>
        <span style={{ color: '#d1d5db' }}>{isArray ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </div>
      {open && entries.map(([k, v]) => (
        <JsonNode key={k} nodeKey={k} value={v} diffNode={childDiffMap.get(k) ?? null} showDiff={showDiff} depth={depth + 1} />
      ))}
    </div>
  );
}

function formatValue(value: unknown, diffNode: DiffNode | null, showDiff: boolean): string {
  if (showDiff && diffNode?.kind === 'changed' && diffNode.oldValue !== undefined)
    return `${JSON.stringify(diffNode.newValue)} (was: ${JSON.stringify(diffNode.oldValue)})`;
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

function getValueColor(value: unknown): string {
  if (value === null) return '#d1d5db';
  if (typeof value === 'boolean') return '#f59e0b';
  if (typeof value === 'number') return '#10b981';
  if (typeof value === 'string') return '#ef4444';
  return '#374151';
}
