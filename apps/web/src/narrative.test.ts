import { describe, expect, it } from 'vitest';
import { summarize } from './narrative';

describe('summarize', () => {
  it('menangani belum ada data', () => {
    expect(summarize({ levelsCompletedLast7Days: 0, activities: [] })).toEqual(['Belum ada aktivitas yang dimainkan.']);
  });
  it('merangkum aktivitas dengan nama ramah', () => {
    const out = summarize({ levelsCompletedLast7Days: 2, activities: [{ activityId: 'count-1-10', completed: 2, attempts: 5, hints: 1, highestLevel: 2, lastPlayed: '' }] });
    expect(out[1]).toContain('Berhitung 1–10');
    expect(out[1]).toContain('level tertinggi 2');
  });
});
