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

export const AREA_LABEL: Record<string, string> = {
  kognitif: 'Kognitif (matematika & logika)',
  motorik_halus: 'Motorik halus',
  literasi_bahasa: 'Literasi bahasa',
  sosio_emosional: 'Sosio-emosional',
  karakter: 'Karakter',
};

/**
 * Saran aktivitas di rumah (gaya practical life Montessori), terkait aktivitas di aplikasi.
 * DRAFT: perlu ditinjau ahli PAUD sebelum rilis.
 */
export const HOME_IDEAS: Record<string, string> = {
  'sort-shapes-color': 'Ajak anak memilah mainan atau pakaian berdasarkan warna ke dua keranjang.',
  'pattern-next': 'Susun pola dengan sendok dan garpu (sendok–garpu–sendok–…) lalu minta anak melanjutkannya.',
  'count-1-10': 'Minta anak membantu menghitung buah atau sendok saat menyiapkan makan.',
};

export function homeIdeas(p: Progress): string[] {
  return p.activities.map((a) => HOME_IDEAS[a.activityId]).filter((x): x is string => Boolean(x));
}

/** Titik-titik poligon radar; area tanpa konten tetap di pusat. */
export function radarPoints(areas: { levelsCompleted: number; hasContent: boolean }[], r: number, cx: number, cy: number): string {
  const max = Math.max(1, ...areas.map((a) => a.levelsCompleted));
  return areas
    .map((a, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / areas.length;
      const v = a.hasContent ? a.levelsCompleted / max : 0;
      return `${(cx + Math.cos(ang) * r * v).toFixed(1)},${(cy + Math.sin(ang) * r * v).toFixed(1)}`;
    })
    .join(' ');
}
