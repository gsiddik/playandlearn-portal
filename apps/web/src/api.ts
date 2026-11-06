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
