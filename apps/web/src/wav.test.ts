import { describe, expect, it } from 'vitest';
import { concat, downsample, encodeWav } from './wav';

describe('wav', () => {
  it('header WAV valid', () => {
    const w = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 22050);
    const dv = new DataView(w.buffer);
    const tag = (o: number) => String.fromCharCode(w[o], w[o + 1], w[o + 2], w[o + 3]);
    expect(tag(0)).toBe('RIFF'); expect(tag(8)).toBe('WAVE'); expect(tag(36)).toBe('data');
    expect(dv.getUint32(24, true)).toBe(22050);
    expect(dv.getUint32(40, true)).toBe(8);
    expect(w.length).toBe(52);
    expect(dv.getInt16(50, true)).toBe(32767);
  });
  it('downsample mengurangi jumlah sampel sesuai rasio', () => {
    const out = downsample(new Float32Array(48000).fill(0.25), 48000, 22050);
    expect(Math.abs(out.length - 22050)).toBeLessThanOrEqual(1);
    expect(out[10]).toBeCloseTo(0.25);
  });
  it('tidak menaikkan laju sampel', () => {
    const x = new Float32Array(10);
    expect(downsample(x, 16000, 22050)).toBe(x);
  });
  it('concat menggabungkan potongan', () => {
    expect(Array.from(concat([new Float32Array([1]), new Float32Array([2, 3])]))).toEqual([1, 2, 3]);
  });
});
