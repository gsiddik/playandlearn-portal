/**
 * Buku nilai DESKRIPTIF v1. Aturan sengaja sederhana dan transparan; ini bukan penilaian resmi atau diagnosis.
 * Ambang batas adalah ASUMSI awal dan WAJIB divalidasi ahli PAUD sebelum dipakai di sekolah.
 */
export type Status = 'belum_mulai' | 'mulai_dikenalkan' | 'sedang_berkembang' | 'sudah_terbiasa';

export interface EventRow { type: string; payload: Record<string, unknown> | null }

export interface ActivityGrade {
  status: Status;
  highestLevel: number;
  maxLevel: number;
  completed: number;
  hints: number;
  revealed: number;
  /** Saran lunak untuk guru, bukan label untuk anak. */
  needsSupportHint: boolean;
}

export const RULES = [
  'Belum mulai: belum ada percobaan.',
  'Mulai dikenalkan: level tertinggi yang selesai kurang dari separuh jumlah level.',
  'Sedang berkembang: sudah menyelesaikan separuh atau lebih level, tetapi belum semua, atau semua level selesai dengan banyak petunjuk.',
  'Sudah terbiasa: semua level selesai dengan rata-rata paling banyak 1 petunjuk per level dan tanpa jawaban yang ditunjukkan.',
  'Catatan: aturan dan ambang ini draf dan perlu divalidasi ahli PAUD.',
];

const isTrue = (v: unknown) => v === true || v === 1;

export function gradeActivity(events: EventRow[], maxLevel: number): ActivityGrade {
  let highest = 0, completed = 0, hints = 0, revealed = 0, attempts = 0;
  for (const e of events) {
    const level = Number(e.payload?.level ?? 0);
    if (e.type === 'attempt') attempts++;
    else if (e.type === 'hint_shown') hints++;
    else if (e.type === 'completed') {
      completed++;
      highest = Math.max(highest, level);
      if (isTrue(e.payload?.revealed)) revealed++;
    }
  }
  let status: Status;
  if (attempts === 0 && completed === 0) status = 'belum_mulai';
  else if (maxLevel > 0 && highest >= maxLevel) {
    status = hints / Math.max(completed, 1) <= 1 && revealed === 0 ? 'sudah_terbiasa' : 'sedang_berkembang';
  } else if (highest * 2 >= maxLevel) status = 'sedang_berkembang';
  else status = 'mulai_dikenalkan';
  return {
    status, highestLevel: highest, maxLevel, completed, hints, revealed,
    needsSupportHint: attempts > 0 && hints >= 3 && completed <= 1,
  };
}
