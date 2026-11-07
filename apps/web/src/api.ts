const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/v1';
let token: string | null = sessionStorage.getItem('pal_token'); // hanya sesi tab; bukan localStorage

export const setToken = (t: string | null) => {
  token = t;
  t ? sessionStorage.setItem('pal_token', t) : sessionStorage.removeItem('pal_token');
};
export const hasToken = () => token !== null;

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.status === 204 ? (undefined as T) : r.json();
}

export interface Child { id: string; alias: string; birthYear: number }
export interface Policy { dailyMinutes: number; sessionMinutes: number; allowedFrom?: string; allowedTo?: string; version: number }
export interface AreaProgress { area: 'kognitif' | 'motorik_halus' | 'literasi_bahasa' | 'sosio_emosional' | 'karakter'; hasContent: boolean; levelsCompleted: number }
export interface Progress { levelsCompletedLast7Days: number; areas: AreaProgress[]; activities: { activityId: string; completed: number; attempts: number; hints: number; highestLevel: number; lastPlayed: string }[] }

export function tokenRole(): string | null {
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { return null; }
}

/** Urutan gambar PIN — HARUS sama di semua klien (Android, iOS, portal). Indeks 0..8. */
export const PIN_ICONS = ['🐶', '🐱', '🐟', '🌳', '🚗', '🍎', '⭐', '🌙', '🎈'];

export interface ClassRow { id: string; name: string }
export interface StudentRow { id: string; alias: string; birthYear: number }
export interface Card { id: string; alias: string; loginCode: string; pin: number[] }
export interface Assignment { id: string; activityId: string; dueDate: string | null }
export interface ClassResults { students: { studentId: string; alias: string; activities: { activityId: string; completed: number; hints: number; lastPlayed: string }[] }[] }

export type GradeStatus = 'belum_mulai' | 'mulai_dikenalkan' | 'sedang_berkembang' | 'sudah_terbiasa';
export interface Gradebook {
  contentVersion: number | null; rules: string[];
  activities: { activityId: string; curriculum: string[]; areas: string[] }[];
  students: { studentId: string; alias: string; grades: { activityId: string; status: GradeStatus; highestLevel: number; maxLevel: number; completed: number; hints: number; revealed: number; needsSupportHint: boolean }[] }[];
}

export const school = {
  gradebook: (cid: string) => req<Gradebook>('GET', `/classes/${cid}/gradebook`),
  register: (schoolName: string, email: string, password: string) =>
    req<{ accessToken: string }>('POST', '/auth/schools/register', { schoolName, email, password, parentalConsentAttested: true }),
  classes: () => req<ClassRow[]>('GET', '/classes'),
  createClass: (name: string) => req<ClassRow>('POST', '/classes', { name }),
  students: (cid: string) => req<StudentRow[]>('GET', `/classes/${cid}/students`),
  addStudent: (cid: string, alias: string, birthYear: number) => req<Card & { birthYear: number }>('POST', `/classes/${cid}/students`, { alias, birthYear }),
  resetPin: (sid: string) => req<Card>('POST', `/students/${sid}/reset-pin`),
  assignments: (cid: string) => req<Assignment[]>('GET', `/classes/${cid}/assignments`),
  assign: (cid: string, activityId: string, dueDate?: string) => req<Assignment>('POST', `/classes/${cid}/assignments`, { activityId, dueDate }),
  unassign: (cid: string, aid: string) => req<void>('DELETE', `/classes/${cid}/assignments/${aid}`),
  results: (cid: string) => req<ClassResults>('GET', `/classes/${cid}/results`),
};

export const api = {
  register: (email: string, password: string) =>
    req<{ accessToken: string }>('POST', '/auth/parents/register', { email, password, consentPolicyVersion: '2026-11-draft', consentGranted: true }),
  login: (email: string, password: string) => req<{ accessToken: string }>('POST', '/auth/login', { email, password }),
  children: () => req<Child[]>('GET', '/children'),
  policy: (id: string) => req<Policy>('GET', `/children/${id}/policy`),
  setPolicy: (id: string, p: Omit<Policy, 'version'>) => req<Policy>('PUT', `/children/${id}/policy`, p),
  progress: (id: string) => req<Progress>('GET', `/children/${id}/progress`),
  exportData: (id: string) => req<unknown>('GET', `/children/${id}/export`),
  remove: (id: string) => req<void>('DELETE', `/children/${id}`),
};
