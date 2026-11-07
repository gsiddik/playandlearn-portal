import { describe, expect, it } from 'vitest';
import { curriculumLabel, homeIdeas, radarPoints, summarize } from './narrative';

describe('summarize', () => {
  it('menangani belum ada data', () => {
    expect(summarize({ levelsCompletedLast7Days: 0, areas: [], activities: [] })).toEqual(['Belum ada aktivitas yang dimainkan.']);
  });
  it('merangkum aktivitas dengan nama ramah', () => {
    const out = summarize({ levelsCompletedLast7Days: 2, areas: [], activities: [{ activityId: 'count-1-10', completed: 2, attempts: 5, hints: 1, highestLevel: 2, lastPlayed: '' }] });
    expect(out[1]).toContain('Berhitung 1–10');
    expect(out[1]).toContain('level tertinggi 2');
  });
});

describe('radar & ide rumah', () => {
  it('area tanpa konten tetap di pusat', () => {
    const pts = radarPoints([{ levelsCompleted: 4, hasContent: true }, { levelsCompleted: 0, hasContent: false }], 100, 100, 100);
    expect(pts).toBe('100.0,0.0 100.0,100.0');
  });
  it('ide rumah mengikuti aktivitas yang dimainkan', () => {
    const p = { levelsCompletedLast7Days: 1, areas: [], activities: [{ activityId: 'pattern-next', completed: 1, attempts: 1, hints: 0, highestLevel: 1, lastPlayed: '' }] };
    expect(homeIdeas(p)).toHaveLength(1);
  });
});

describe('curriculumLabel', () => {
  it('memanusiakan tag kurikulum', () => {
    expect(curriculumLabel('montessori:matematika-dasar')).toBe('Montessori — Matematika dasar');
    expect(curriculumLabel('merdeka:numerasi')).toBe('Kurikulum Merdeka — Numerasi');
  });
});
