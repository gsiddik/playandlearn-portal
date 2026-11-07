import { describe, expect, it } from 'vitest';
import { defaultLevel, newActivity, nextItemId, renumber, suggestCountOptions, suggestPatternOptions } from './builder';

describe('builder helpers', () => {
  it('opsi hitung selalu memuat jawaban, unik, dalam 1..10', () => {
    for (let n = 1; n <= 10; n++) {
      const o = suggestCountOptions(n);
      expect(o).toContain(n);
      expect(new Set(o).size).toBe(o.length);
      expect(o.length).toBeGreaterThanOrEqual(2);
      expect(o.every((x) => x >= 1 && x <= 10)).toBe(true);
    }
  });
  it('opsi pola memuat jawaban dan minimal 2 opsi', () => {
    const o = suggestPatternOptions(['A', 'A'], 'A');
    expect(o).toContain('A');
    expect(o.length).toBeGreaterThanOrEqual(2);
  });
  it('id aktivitas baru unik', () => {
    expect(newActivity('count', ['count-1', 'count-2']).id).toBe('count-3');
  });
  it('level default punya bentuk yang valid per jenis', () => {
    expect(defaultLevel('pattern')).toMatchObject({ answer: 'A' });
    expect((defaultLevel('sort').items as unknown[]).length).toBe(2);
  });
  it('renumber dan nextItemId', () => {
    expect(renumber([{ level: 5 }, { level: 9 }]).map((l) => l.level)).toEqual([1, 2]);
    expect(nextItemId([{ id: 'a' }, { id: 'b' }])).toBe('c');
  });
});

import { validateManifest } from '../../api/src/manifest';
import { emptyManifest } from './builder';

describe('keluaran penyusun lolos validator server', () => {
  it('manifest dari aktivitas default tiap jenis valid setelah diisi judul/indikator', () => {
    const m = emptyManifest(1);
    for (const k of ['sort', 'pattern', 'count'] as const) {
      const a = newActivity(k, m.activities.map((x) => x.id));
      a.title = `Uji ${k}`;
      a.curriculum = ['merdeka:numerasi'];
      m.activities.push(a);
    }
    expect(validateManifest(m)).toEqual([]);
  });
  it('mendeteksi aktivitas tanpa judul', () => {
    const m = emptyManifest(1);
    m.activities.push(newActivity('count', []));
    expect(validateManifest(m).join('|')).toContain('title');
  });
});
