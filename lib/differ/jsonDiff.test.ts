import { describe, it, expect } from 'vitest';
import { computeDiff, countChanges } from '@/lib/differ/jsonDiff';

describe('computeDiff', () => {
  it('returns all unchanged for identical objects', () => {
    const obj = { a: 1, b: 'hello', c: true };
    const diff = computeDiff(obj, obj);
    expect(diff.every(n => n.kind === 'unchanged')).toBe(true);
  });

  it('detects added keys', () => {
    const diff = computeDiff({ a: 1 }, { a: 1, b: 2 });
    const added = diff.find(n => n.key === 'b');
    expect(added?.kind).toBe('added');
    expect(added?.newValue).toBe(2);
  });

  it('detects removed keys', () => {
    const diff = computeDiff({ a: 1, b: 2 }, { a: 1 });
    const removed = diff.find(n => n.key === 'b');
    expect(removed?.kind).toBe('removed');
    expect(removed?.oldValue).toBe(2);
  });

  it('detects changed primitive values', () => {
    const diff = computeDiff({ a: 1 }, { a: 2 });
    const changed = diff.find(n => n.key === 'a');
    expect(changed?.kind).toBe('changed');
    expect(changed?.oldValue).toBe(1);
    expect(changed?.newValue).toBe(2);
  });

  it('handles nested object changes', () => {
    const diff = computeDiff(
      { meta: { pages: 10, sections: 3 } },
      { meta: { pages: 12, sections: 3 } }
    );
    const meta = diff.find(n => n.key === 'meta');
    expect(meta?.kind).toBe('changed');
    const pages = meta?.children?.find(c => c.key === 'pages');
    expect(pages?.kind).toBe('changed');
    expect(pages?.oldValue).toBe(10);
    expect(pages?.newValue).toBe(12);
    const sections = meta?.children?.find(c => c.key === 'sections');
    expect(sections?.kind).toBe('unchanged');
  });

  it('handles empty objects', () => {
    expect(computeDiff({}, {})).toEqual([]);
  });

  it('handles array values as atomic (changed if different)', () => {
    const diff = computeDiff({ tags: [1, 2] }, { tags: [1, 3] });
    const tags = diff.find(n => n.key === 'tags');
    expect(tags?.kind).toBe('changed');
  });

  it('handles null values', () => {
    const diff = computeDiff({ x: null }, { x: null });
    expect(diff[0]?.kind).toBe('unchanged');
  });
});

describe('countChanges', () => {
  it('counts zero for no changes', () => {
    const diff = computeDiff({ a: 1 }, { a: 1 });
    const counts = countChanges(diff);
    expect(counts).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it('counts mixed changes correctly', () => {
    const diff = computeDiff(
      { a: 1, b: 2, c: 3 },
      { a: 99, b: 2, d: 4 }
    );
    const counts = countChanges(diff);
    expect(counts.changed).toBe(1); // a
    expect(counts.removed).toBe(1); // c
    expect(counts.added).toBe(1);   // d
  });
});
