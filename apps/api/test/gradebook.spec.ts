import { gradeActivity } from '../src/gradebook';

const ev = (type: string, payload: Record<string, unknown> = {}) => ({ type, payload });

describe('gradeActivity', () => {
  it('belum mulai tanpa event', () => {
    expect(gradeActivity([], 2).status).toBe('belum_mulai');
  });
  it('mulai dikenalkan bila belum separuh level selesai', () => {
    expect(gradeActivity([ev('started', { level: 1 }), ev('attempt', { level: 1 })], 3).status).toBe('mulai_dikenalkan');
  });
  it('sedang berkembang bila separuh level selesai', () => {
    const g = gradeActivity([ev('attempt'), ev('completed', { level: 1 })], 2);
    expect(g).toMatchObject({ status: 'sedang_berkembang', highestLevel: 1 });
  });
  it('sudah terbiasa bila semua level selesai dengan sedikit petunjuk (revealed boolean atau angka)', () => {
    const e = [ev('attempt'), ev('completed', { level: 1, revealed: false }), ev('completed', { level: 2, revealed: 0 })];
    expect(gradeActivity(e, 2).status).toBe('sudah_terbiasa');
  });
  it('tidak terbiasa bila jawaban pernah ditunjukkan', () => {
    const e = [ev('attempt'), ev('completed', { level: 1 }), ev('completed', { level: 2, revealed: true })];
    expect(gradeActivity(e, 2).status).toBe('sedang_berkembang');
  });
  it('menandai saran pendampingan secara lunak', () => {
    const e = [ev('attempt'), ev('hint_shown'), ev('hint_shown'), ev('hint_shown')];
    expect(gradeActivity(e, 2).needsSupportHint).toBe(true);
  });
});
