/** Logika murni penyusun konten (diuji terpisah dari UI). Bentuk manifest sama dengan validator server. */
export type Kind = 'sort' | 'pattern' | 'count';
export type Level = Record<string, unknown>;
export interface Activity { promptAudio?: string; id: string; kind: Kind; title: string; curriculum: string[]; areas: string[]; levels: Level[] }
export interface Manifest { version: number; minAge: number; maxAge: number; activities: Activity[] }

export const AREAS: { id: string; label: string }[] = [
  { id: 'kognitif', label: 'Kognitif' }, { id: 'motorik_halus', label: 'Motorik halus' },
  { id: 'literasi_bahasa', label: 'Literasi bahasa' }, { id: 'sosio_emosional', label: 'Sosio-emosional' }, { id: 'karakter', label: 'Karakter' },
];
export const KIND_LABEL: Record<Kind, string> = { sort: 'Memilah', pattern: 'Melanjutkan pola', count: 'Berhitung' };
/** Bentuk yang dikenali aplikasi anak saat ini; token lain digambar abu-abu. Tambah di klien sebelum menambah di sini. */
export const SORT_GROUPS = ['red', 'blue'];
export const PATTERN_TOKENS = ['A', 'B', 'C'];
export const CURRICULUM_SUGGESTIONS = [
  'montessori:sensorial', 'montessori:matematika-dasar', 'montessori:practical-life',
  'merdeka:literasi-numerasi-dasar', 'merdeka:numerasi', 'merdeka:numerasi-pola',
];

export const emptyManifest = (version: number): Manifest => ({ version, minAge: 4, maxAge: 7, activities: [] });

export function defaultLevel(kind: Kind): Level {
  if (kind === 'count') return { level: 1, count: 3, options: suggestCountOptions(3) };
  if (kind === 'pattern') return { level: 1, sequence: ['A', 'B', 'A', 'B'], options: ['A', 'B', 'C'], answer: 'A' };
  return { level: 1, items: [{ id: 'a', group: 'red' }, { id: 'b', group: 'blue' }], groups: ['red', 'blue'] };
}

export function newActivity(kind: Kind, existingIds: string[]): Activity {
  let n = 1;
  while (existingIds.includes(`${kind}-${n}`)) n++;
  return { id: `${kind}-${n}`, kind, title: '', curriculum: [], areas: ['kognitif'], levels: [defaultLevel(kind)] };
}

/** Tiga opsi unik 1..10 yang memuat jawaban, berurutan naik. */
export function suggestCountOptions(count: number): number[] {
  const set = new Set([count]);
  for (const d of [1, -1, 2, -2, 3]) { const v = count + d; if (v >= 1 && v <= 10 && set.size < 3) set.add(v); }
  return [...set].sort((a, b) => a - b);
}

/** Opsi pola: token pada urutan + jawaban, minimal 2 opsi unik. */
export function suggestPatternOptions(sequence: string[], answer: string): string[] {
  const set = new Set([...sequence, answer]);
  for (const t of PATTERN_TOKENS) if (set.size < 3) set.add(t);
  return [...set];
}

/** Menomori ulang level 1..n setelah tambah/hapus. */
export const renumber = (levels: Level[]): Level[] => levels.map((l, i) => ({ ...l, level: i + 1 }));

/** Item sort: id unik otomatis (a, b, c, ...). */
export function nextItemId(items: { id: string }[]): string {
  const used = new Set(items.map((i) => i.id));
  for (let i = 0; i < 26; i++) { const c = String.fromCharCode(97 + i); if (!used.has(c)) return c; }
  return `x${items.length + 1}`;
}

export function withGroups(items: { id: string; group: string }[]): string[] {
  return [...new Set(items.map((i) => i.group))];
}
