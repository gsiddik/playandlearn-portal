/** Validasi manifest content pack sebelum disimpan/terbit. Mengembalikan daftar kesalahan (kosong = valid). */
export const AREAS = ['kognitif', 'motorik_halus', 'literasi_bahasa', 'sosio_emosional', 'karakter'];
const KINDS = ['sort', 'pattern', 'count'];
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function validateManifest(m: any): string[] {
  const errs: string[] = [];
  if (!m || typeof m !== 'object') return ['manifest harus objek'];
  if (!isInt(m.version) || m.version < 1) errs.push('version harus bilangan bulat ≥ 1');
  if (!isInt(m.minAge) || !isInt(m.maxAge) || m.minAge < 3 || m.maxAge > 8 || m.minAge > m.maxAge) errs.push('minAge/maxAge harus 3..8 dan minAge ≤ maxAge');
  if (!Array.isArray(m.activities) || m.activities.length === 0) { errs.push('activities tidak boleh kosong'); return errs; }
  const ids = new Set<string>();
  m.activities.forEach((a: any, i: number) => {
    const p = `activities[${i}]`;
    if (!isStr(a?.id) || !/^[a-z0-9-]+$/.test(a.id)) errs.push(`${p}.id harus huruf kecil/angka/strip`);
    else if (ids.has(a.id)) errs.push(`${p}.id duplikat: ${a.id}`);
    else ids.add(a.id);
    if (!KINDS.includes(a?.kind)) errs.push(`${p}.kind harus salah satu dari ${KINDS.join(', ')}`);
    if (!isStr(a?.title)) errs.push(`${p}.title wajib`);
    if (!Array.isArray(a?.curriculum) || !a.curriculum.every(isStr)) errs.push(`${p}.curriculum harus array string (indikator kurikulum)`);
    if (!Array.isArray(a?.areas) || a.areas.length === 0 || !a.areas.every((x: any) => AREAS.includes(x))) errs.push(`${p}.areas harus berisi minimal satu dari ${AREAS.join(', ')}`);
    if (a?.promptAudio != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.promptAudio)) errs.push(`${p}.promptAudio harus ID aset (UUID)`);
    if (!Array.isArray(a?.levels) || a.levels.length === 0) { errs.push(`${p}.levels tidak boleh kosong`); return; }
    a.levels.forEach((l: any, j: number) => {
      const q = `${p}.levels[${j}]`;
      if (a.kind === 'sort') {
        const items = Array.isArray(l?.items) ? l.items : [];
        if (items.length < 2 || !items.every((x: any) => isStr(x?.id) && isStr(x?.group))) errs.push(`${q}.items minimal 2 item {id, group}`);
        else {
          if (new Set(items.map((x: any) => x.id)).size !== items.length) errs.push(`${q}.items id harus unik`);
          if (new Set(items.map((x: any) => x.group)).size < 2) errs.push(`${q}.items harus punya minimal 2 kelompok`);
        }
      } else if (a.kind === 'pattern') {
        if (!Array.isArray(l?.sequence) || l.sequence.length < 3 || !l.sequence.every(isStr)) errs.push(`${q}.sequence minimal 3 elemen`);
        if (!Array.isArray(l?.options) || l.options.length < 2 || !isStr(l?.answer) || !l.options.includes(l.answer)) errs.push(`${q}.options minimal 2 dan harus memuat answer`);
      } else if (a.kind === 'count') {
        if (!isInt(l?.count) || l.count < 1 || l.count > 10) errs.push(`${q}.count harus 1..10`);
        if (!Array.isArray(l?.options) || l.options.length < 2 || !l.options.every(isInt) || new Set(l.options).size !== l.options.length || !l.options.includes(l.count)) errs.push(`${q}.options harus ≥2 angka unik dan memuat count`);
      }
    });
  });
  return errs;
}
