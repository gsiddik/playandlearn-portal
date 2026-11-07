import type { Gradebook } from './api';

export interface LiveEvent { classId: string; studentId: string; alias: string; activityId: string; type: string; level: number | null; ts: string }
export interface LiveStudent {
  studentId: string; alias: string; activityId: string; level: number | null;
  lastTs: number; hintsThisLevel: number; completedSession: number; playing: boolean;
}
export type LiveState = Record<string, LiveStudent>;

export const ACTIVE_WINDOW_MS = 2 * 60_000;
export const HELP_HINTS = 3;

/** Reduksi event bermain → keadaan dasbor per murid. Murni, sehingga dapat diuji. */
export function applyEvent(state: LiveState, e: LiveEvent): LiveState {
  const prev = state[e.studentId];
  const base: LiveStudent = prev ?? { studentId: e.studentId, alias: e.alias, activityId: e.activityId, level: e.level, lastTs: 0, hintsThisLevel: 0, completedSession: 0, playing: false };
  const next: LiveStudent = { ...base, alias: e.alias, activityId: e.activityId, level: e.level ?? base.level, lastTs: Date.parse(e.ts) || Date.now(), playing: true };
  if (e.type === 'started') next.hintsThisLevel = 0;
  else if (e.type === 'hint_shown') next.hintsThisLevel = base.hintsThisLevel + 1;
  else if (e.type === 'completed') { next.hintsThisLevel = 0; next.completedSession = base.completedSession + 1; }
  else if (e.type === 'abandoned') next.playing = false;
  return { ...state, [e.studentId]: next };
}

export const isActive = (s: LiveStudent, now: number) => s.playing && now - s.lastTs <= ACTIVE_WINDOW_MS;
/** Sinyal lunak untuk guru, bukan label untuk anak. */
export const maybeNeedsHelp = (s: LiveStudent, now: number) => isActive(s, now) && s.hintsThisLevel >= HELP_HINTS;

/** Saran pasangan sebaya: murid lain yang sudah "sudah terbiasa" pada aktivitas yang sama (dari buku nilai). */
export function peerSuggestions(s: LiveStudent, gb: Gradebook | null): string[] {
  if (!gb) return [];
  return gb.students
    .filter((p) => p.studentId !== s.studentId && p.grades.some((g) => g.activityId === s.activityId && g.status === 'sudah_terbiasa'))
    .map((p) => p.alias);
}
