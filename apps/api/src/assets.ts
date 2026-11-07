/** Validasi berkas aset: tipe yang diizinkan, batas ukuran, dan pemeriksaan "magic bytes" (bukan hanya percaya mime klien). */
export const LIMITS = { image: 2 * 1024 * 1024, audio: 5 * 1024 * 1024 };

const starts = (b: Buffer, ...bytes: number[]) => bytes.every((x, i) => b[i] === x);
const ascii = (b: Buffer, from: number, s: string) => b.subarray(from, from + s.length).toString('latin1') === s;

const CHECKS: Record<string, { kind: 'image' | 'audio'; ok: (b: Buffer) => boolean }> = {
  'image/png': { kind: 'image', ok: (b) => starts(b, 0x89, 0x50, 0x4e, 0x47) },
  'image/jpeg': { kind: 'image', ok: (b) => starts(b, 0xff, 0xd8, 0xff) },
  'image/webp': { kind: 'image', ok: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
  'image/svg+xml': { kind: 'image', ok: (b) => /<svg[\s>]/i.test(b.subarray(0, 2048).toString('utf8')) },
  'audio/webm': { kind: 'audio', ok: (b) => starts(b, 0x1a, 0x45, 0xdf, 0xa3) },
  'audio/ogg': { kind: 'audio', ok: (b) => ascii(b, 0, 'OggS') },
  'audio/mpeg': { kind: 'audio', ok: (b) => ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  'audio/wav': { kind: 'audio', ok: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE') },
  'audio/mp4': { kind: 'audio', ok: (b) => ascii(b, 4, 'ftyp') },
};

export function checkAsset(mimeRaw: string, data: Buffer): { kind: 'image' | 'audio'; mime: string } | string {
  const mime = String(mimeRaw ?? '').split(';')[0].trim().toLowerCase(); // "audio/webm;codecs=opus" → "audio/webm"
  const c = CHECKS[mime];
  if (!c) return `tipe berkas tidak diizinkan: ${mime || '(kosong)'}`;
  if (data.length === 0) return 'berkas kosong';
  if (data.length > LIMITS[c.kind]) return `berkas terlalu besar (maks ${LIMITS[c.kind] / 1024 / 1024} MB untuk ${c.kind})`;
  if (!c.ok(data)) return 'isi berkas tidak sesuai dengan tipe yang dinyatakan';
  return { kind: c.kind, mime };
}
