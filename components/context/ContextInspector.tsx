'use client';

import { useContextStore } from '@/lib/store/contextStore';
import { JsonTree } from './JsonTree';
import { countChanges } from '@/lib/differ/jsonDiff';

export function ContextInspector() {
  const snapshots = useContextStore((s) => s.snapshots);
  const activeContextId = useContextStore((s) => s.activeContextId);
  const scrubberIndex = useContextStore((s) => s.scrubberIndex);
  const setActiveContext = useContextStore((s) => s.setActiveContext);
  const setScrubberIndex = useContextStore((s) => s.setScrubberIndex);
  const getCurrentSnapshot = useContextStore((s) => s.getCurrentSnapshot);

  const contextIds = Object.keys(snapshots);

  if (contextIds.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>◉</div>
          <p style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>No context snapshots yet</p>
          <p style={{ fontSize: 10, color: '#e5e7eb', marginTop: 3 }}>Waiting for CONTEXT_SNAPSHOT...</p>
        </div>
      </div>
    );
  }

  const currentSnapshot = activeContextId ? getCurrentSnapshot(activeContextId) : null;
  const history = activeContextId ? (snapshots[activeContextId] ?? []) : [];
  const currentIndex = activeContextId ? (scrubberIndex[activeContextId] ?? history.length - 1) : 0;
  const diffStats = currentSnapshot?.diff ? countChanges(currentSnapshot.diff) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Context</span>
          {diffStats && (
            <div style={{ display: 'flex', gap: 4 }}>
              {diffStats.added > 0 && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>+{diffStats.added}</span>}
              {diffStats.removed > 0 && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>-{diffStats.removed}</span>}
              {diffStats.changed > 0 && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>~{diffStats.changed}</span>}
            </div>
          )}
        </div>

        {contextIds.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {contextIds.map(id => (
              <button key={id} onClick={() => setActiveContext(id)}
                style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 500, border: activeContextId === id ? '1px solid #ddd6fe' : '1px solid #f3f4f6', background: activeContextId === id ? '#f5f3ff' : '#fafafa', color: activeContextId === id ? '#5b21b6' : '#d1d5db' }}>
                {id.slice(0, 10)}
              </button>
            ))}
          </div>
        )}

        {history.length > 1 && activeContextId && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#d1d5db', fontWeight: 500, marginBottom: 5 }}>
              <span>Snapshot {currentIndex + 1} / {history.length}</span>
              <span style={{ fontFamily: 'monospace' }}>seq {currentSnapshot?.seq}</span>
            </div>
            <input type="range" min={0} max={history.length - 1} value={currentIndex}
              onChange={e => setScrubberIndex(activeContextId, parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#8b5cf6', height: 3 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <button onClick={() => setScrubberIndex(activeContextId, Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                style={{ fontSize: 9, color: currentIndex === 0 ? '#e5e7eb' : '#9ca3af', background: 'none', border: 'none', cursor: currentIndex === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                ◀ prev
              </button>
              <button onClick={() => setScrubberIndex(activeContextId, Math.min(history.length - 1, currentIndex + 1))}
                disabled={currentIndex === history.length - 1}
                style={{ fontSize: 9, color: currentIndex === history.length - 1 ? '#e5e7eb' : '#9ca3af', background: 'none', border: 'none', cursor: currentIndex === history.length - 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                next ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', minHeight: 0 }}>
        {currentSnapshot ? (
          <JsonTree data={currentSnapshot.data} diff={currentSnapshot.diff} showDiff={currentIndex > 0} />
        ) : (
          <p style={{ fontSize: 10, color: '#d1d5db' }}>No snapshot selected</p>
        )}
      </div>
    </div>
  );
}
