import { describe, expect, it } from 'vitest';
import { applyEvent, isActive, LiveEvent, LiveState, maybeNeedsHelp, peerSuggestions } from './live';
import type { Gradebook } from './api';

const ev = (type: string, extra: Partial<LiveEvent> = {}): LiveEvent =>
  ({ classId: 'c', studentId: 's1', alias: 'Rani', activityId: 'count-1-10', type, level: 1, ts: new Date().toISOString(), ...extra });

describe('dasbor real-time', () => {
  it('melacak petunjuk dalam satu level dan menandai kemungkinan butuh bantuan', () => {
    let st: LiveState = {};
    for (const t of ['started', 'attempt', 'hint_shown', 'hint_shown', 'hint_shown']) st = applyEvent(st, ev(t));
    const now = Date.now();
    expect(st.s1.hintsThisLevel).toBe(3);
    expect(maybeNeedsHelp(st.s1, now)).toBe(true);
    st = applyEvent(st, ev('completed'));
    expect(st.s1).toMatchObject({ hintsThisLevel: 0, completedSession: 1 });
    expect(maybeNeedsHelp(st.s1, now)).toBe(false);
  });
  it('murid tidak aktif setelah jendela waktu atau abandoned', () => {
    let st = applyEvent({}, ev('started', { ts: new Date(Date.now() - 5 * 60_000).toISOString() }));
    expect(isActive(st.s1, Date.now())).toBe(false);
    st = applyEvent(st, ev('abandoned'));
    expect(st.s1.playing).toBe(false);
  });
  it('menyarankan teman sebaya yang sudah terbiasa pada aktivitas yang sama', () => {
    const gb = { students: [
      { studentId: 's1', alias: 'Rani', grades: [{ activityId: 'count-1-10', status: 'mulai_dikenalkan' }] },
      { studentId: 's2', alias: 'Bima', grades: [{ activityId: 'count-1-10', status: 'sudah_terbiasa' }] },
      { studentId: 's3', alias: 'Sari', grades: [{ activityId: 'count-1-10', status: 'sedang_berkembang' }] },
    ] } as unknown as Gradebook;
    const st = applyEvent({}, ev('started'));
    expect(peerSuggestions(st.s1, gb)).toEqual(['Bima']);
    expect(peerSuggestions(st.s1, null)).toEqual([]);
  });
});
