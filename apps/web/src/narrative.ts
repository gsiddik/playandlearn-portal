import type { Progress } from './api';

// Nama aktivitas ramah orang tua. Narasi berikut deskriptif (apa yang dimainkan), BUKAN diagnosis perkembangan.
export const ACTIVITY_LABEL: Record<string, string> = {
  'sort-shapes-color': 'Memilah berdasarkan warna',
  'pattern-next': 'Melanjutkan pola',
  'count-1-10': 'Berhitung 1–10',
};

export function summarize(p: Progress): string[] {
  if (p.activities.length === 0) return ['Belum ada aktivitas yang dimainkan.'];
  const lines = [`Dalam 7 hari terakhir, anak menyelesaikan ${p.levelsCompletedLast7Days} level.`];
  for (const a of p.activities) {
    const name = ACTIVITY_LABEL[a.activityId] ?? a.activityId;
    lines.push(`${name}: ${a.completed} level selesai (level tertinggi ${a.highestLevel}), petunjuk dipakai ${a.hints} kali.`);
  }
  return lines;
}
