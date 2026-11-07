import { useState } from 'react';
import {
  Activity, AREAS, CURRICULUM_SUGGESTIONS, defaultLevel, Kind, KIND_LABEL, Level, Manifest, newActivity, nextItemId,
  PATTERN_TOKENS, renumber, SORT_GROUPS, suggestCountOptions, suggestPatternOptions,
} from './builder';
import { curriculumLabel } from './narrative';

type Item = { id: string; group: string };

function LevelEditor({ kind, level, onChange }: { kind: Kind; level: Level; onChange: (l: Level) => void }) {
  if (kind === 'count') {
    const count = Number(level.count ?? 1);
    return (
      <div>
        <label>Jumlah bintang (1–10)
          <input type="number" min={1} max={10} value={count}
            onChange={(e) => { const c = Math.min(10, Math.max(1, +e.target.value || 1)); onChange({ ...level, count: c, options: suggestCountOptions(c) }); }} /></label>
        <p className="note">Pilihan jawaban dibuat otomatis: {(level.options as number[] | undefined)?.join(', ')}.</p>
      </div>
    );
  }
  if (kind === 'pattern') {
    const seq = (level.sequence as string[]) ?? [];
    const set = (sequence: string[], answer = String(level.answer)) => onChange({ ...level, sequence, answer, options: suggestPatternOptions(sequence, answer) });
    return (
      <div>
        <p>Urutan pola: {seq.map((t, i) => <button key={i} type="button" className="link" title="Klik untuk menghapus" onClick={() => set(seq.filter((_, j) => j !== i))}>{t}</button>)}</p>
        <p>Tambah: {PATTERN_TOKENS.map((t) => <button key={t} type="button" onClick={() => set([...seq, t])}>{t}</button>)} (A=lingkaran merah, B=kotak biru, C=segitiga hijau)</p>
        <label>Jawaban yang benar
          <select value={String(level.answer)} onChange={(e) => set(seq, e.target.value)}>{PATTERN_TOKENS.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
    );
  }
  const items = (level.items as Item[]) ?? [];
  const setItems = (next: Item[]) => onChange({ ...level, items: next, groups: [...new Set(next.map((i) => i.group))] });
  return (
    <div>
      {items.map((it, i) => (
        <p key={it.id}>Item {it.id}: kelompok{' '}
          <select value={it.group} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))}>
            {SORT_GROUPS.map((g) => <option key={g} value={g}>{g === 'red' ? 'merah' : 'biru'}</option>)}</select>{' '}
          <button type="button" className="link" disabled={items.length <= 2} onClick={() => setItems(items.filter((_, j) => j !== i))}>Hapus</button></p>))}
      <button type="button" onClick={() => setItems([...items, { id: nextItemId(items), group: 'red' }])}>Tambah item</button>
    </div>
  );
}

function ActivityEditor({ a, onChange, onRemove }: { a: Activity; onChange: (a: Activity) => void; onRemove: () => void }) {
  const [tag, setTag] = useState('');
  const toggleArea = (id: string) => onChange({ ...a, areas: a.areas.includes(id) ? a.areas.filter((x) => x !== id) : [...a.areas, id] });
  const addTag = (t: string) => { const v = t.trim(); if (v && !a.curriculum.includes(v)) onChange({ ...a, curriculum: [...a.curriculum, v] }); setTag(''); };
  return (
    <section className="card">
      <h3>{KIND_LABEL[a.kind]} <small>({a.id})</small> <button type="button" className="link" onClick={onRemove}>Hapus aktivitas</button></h3>
      <label>Judul (untuk guru/orang tua)<input value={a.title} onChange={(e) => onChange({ ...a, title: e.target.value })} /></label>
      <fieldset><legend>Area perkembangan</legend>
        {AREAS.map((ar) => <label key={ar.id} className="check"><input type="checkbox" checked={a.areas.includes(ar.id)} onChange={() => toggleArea(ar.id)} />{ar.label}</label>)}
      </fieldset>
      <fieldset><legend>Indikator kurikulum</legend>
        <p>{a.curriculum.map((c) => <button key={c} type="button" className="link" title="Klik untuk menghapus" onClick={() => onChange({ ...a, curriculum: a.curriculum.filter((x) => x !== c) })}>{curriculumLabel(c)} ✕</button>)}</p>
        <select value="" onChange={(e) => addTag(e.target.value)}><option value="">+ pilih indikator…</option>
          {CURRICULUM_SUGGESTIONS.filter((c) => !a.curriculum.includes(c)).map((c) => <option key={c} value={c}>{curriculumLabel(c)}</option>)}</select>{' '}
        <input placeholder="atau ketik: kerangka:topik" value={tag} onChange={(e) => setTag(e.target.value)} />
        <button type="button" onClick={() => addTag(tag)}>Tambah</button>
      </fieldset>
      <h4>Level</h4>
      {a.levels.map((l, i) => (
        <div key={i} className="card">
          <strong>Level {i + 1}</strong>{' '}
          <button type="button" className="link" disabled={a.levels.length <= 1}
            onClick={() => onChange({ ...a, levels: renumber(a.levels.filter((_, j) => j !== i)) })}>Hapus level</button>
          <LevelEditor kind={a.kind} level={l} onChange={(nl) => onChange({ ...a, levels: a.levels.map((x, j) => (j === i ? nl : x)) })} />
        </div>))}
      <button type="button" onClick={() => onChange({ ...a, levels: renumber([...a.levels, defaultLevel(a.kind)]) })}>Tambah level</button>
    </section>
  );
}

/** Penyusun konten visual: menghasilkan manifest yang divalidasi server. Jenis permainan baru memerlukan pembaruan aplikasi. */
export function Builder({ manifest, onChange }: { manifest: Manifest; onChange: (m: Manifest) => void }) {
  const ids = manifest.activities.map((a) => a.id);
  return (
    <div>
      <p>
        <label>Versi<input type="number" min={1} value={manifest.version} onChange={(e) => onChange({ ...manifest, version: +e.target.value })} /></label>
        <label>Usia dari<input type="number" min={3} max={8} value={manifest.minAge} onChange={(e) => onChange({ ...manifest, minAge: +e.target.value })} /></label>
        <label>sampai<input type="number" min={3} max={8} value={manifest.maxAge} onChange={(e) => onChange({ ...manifest, maxAge: +e.target.value })} /></label>
      </p>
      {manifest.activities.map((a, i) => (
        <ActivityEditor key={a.id} a={a}
          onChange={(na) => onChange({ ...manifest, activities: manifest.activities.map((x, j) => (j === i ? na : x)) })}
          onRemove={() => onChange({ ...manifest, activities: manifest.activities.filter((_, j) => j !== i) })} />))}
      <p>Tambah aktivitas:{' '}
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button key={k} type="button" onClick={() => onChange({ ...manifest, activities: [...manifest.activities, newActivity(k, ids)] })}>{KIND_LABEL[k]}</button>))}</p>
    </div>
  );
}
