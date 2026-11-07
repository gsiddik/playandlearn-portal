import { useEffect, useState } from 'react';
import { ApiError, ops, PackRow, SchoolStat, tokenRole } from './api';

const STATUS: Record<string, string> = { draft: 'Draf', staging: 'Uji', published: 'Terbit', retired: 'Ditarik' };

function errorLines(x: unknown): string[] {
  if (x instanceof ApiError) {
    try { const j = JSON.parse(x.message); return Array.isArray(j.errors) ? j.errors : [j.message ?? x.message]; } catch { return [x.message]; }
  }
  return ['Terjadi kesalahan.'];
}

/** Manajemen konten: editor manifest + validasi server, versi berurutan, konten terbit tidak dapat diubah. */
function Content() {
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [text, setText] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [ok, setOk] = useState('');
  const isAdmin = tokenRole() === 'ops_admin';
  const load = () => { ops.packs().then(setPacks); };
  useEffect(load, []);

  const parse = (): unknown | null => { try { return JSON.parse(text); } catch { setLines(['JSON tidak valid.']); return null; } };
  async function act(fn: () => Promise<unknown>, done: string) {
    setLines([]); setOk('');
    try { await fn(); setOk(done); load(); } catch (e) { setLines(errorLines(e)); }
  }
  async function openAsNewDraft(v: number) {
    const p = await ops.pack(v);
    const next = Math.max(0, ...packs.map((x) => x.version)) + 1;
    setText(JSON.stringify({ ...(p.manifest as object), version: next }, null, 2));
    setLines([]); setOk(`Dimuat dari versi ${v} sebagai draf versi ${next}.`);
  }

  return (
    <>
      <section className="card">
        <h2>Versi konten</h2>
        <table>
          <thead><tr><th>Versi</th><th>Status</th><th>Usia</th><th>Aktivitas</th><th></th></tr></thead>
          <tbody>{packs.map((p) => (
            <tr key={p.version}><td>{p.version}</td><td>{STATUS[p.status]}</td><td>{p.minAge}–{p.maxAge}</td><td>{p.activityCount}</td>
              <td>
                <button className="link" onClick={() => openAsNewDraft(p.version)}>Salin ke draf baru</button>
                {p.status === 'draft' && isAdmin && <button className="link" onClick={() => act(() => ops.publish(p.version), `Versi ${p.version} diterbitkan.`)}>Terbitkan</button>}
                {p.status === 'published' && isAdmin && <button className="link" onClick={() => act(() => ops.retire(p.version), `Versi ${p.version} ditarik.`)}>Tarik</button>}
              </td></tr>))}</tbody>
        </table>
        <p className="note">Versi yang sudah terbit tidak dapat diubah; perubahan dibuat sebagai versi baru. Perangkat anak menerima versi terbaru otomatis tanpa pembaruan aplikasi.</p>
      </section>
      <section className="card">
        <h2>Editor manifest (JSON)</h2>
        <p className="note">Penyusun visual (no-code) belum tersedia; saat ini manifest disusun sebagai JSON dan divalidasi server. Setiap aktivitas wajib memuat indikator kurikulum dan area perkembangan.</p>
        <textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} style={{ width: '100%', fontFamily: 'monospace' }} />
        <div>
          <button onClick={() => { const m = parse(); if (m) act(async () => { const r = await ops.validate(m); if (!r.valid) throw new ApiError(400, JSON.stringify({ errors: r.errors })); }, 'Manifest valid.'); }}>Validasi</button>{' '}
          <button onClick={() => { const m = parse(); if (m) act(() => ops.saveDraft(m), 'Draf disimpan.'); }}>Simpan draf</button>
        </div>
        {ok && <p>{ok}</p>}
        {lines.length > 0 && <ul className="err">{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
      </section>
    </>
  );
}

function Schools() {
  const [rows, setRows] = useState<SchoolStat[] | null>(null);
  useEffect(() => { ops.schools().then(setRows).catch(() => setRows([])); }, []);
  return (
    <section className="card">
      <h2>Sekolah (tenant)</h2>
      {rows === null ? <p>Memuat…</p> : rows.length === 0 ? <p>Belum ada sekolah.</p> : (
        <table>
          <thead><tr><th>Sekolah</th><th>Guru</th><th>Kelas</th><th>Murid</th><th>Terdaftar</th></tr></thead>
          <tbody>{rows.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.teachers}</td><td>{s.classes}</td><td>{s.students}</td><td>{s.created_at.slice(0, 10)}</td></tr>)}</tbody>
        </table>
      )}
      <p className="note">Hanya angka agregat; data anak tidak ditampilkan di portal operasional.</p>
    </section>
  );
}

export function OpsDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'konten' | 'sekolah'>('konten');
  return (
    <main>
      <header><h1>Play &amp; Learn — Operasional</h1><button className="link" onClick={onLogout}>Keluar</button></header>
      <nav><button className="link" onClick={() => setTab('konten')}>Konten</button>
        {tokenRole() === 'ops_admin' && <button className="link" onClick={() => setTab('sekolah')}>Sekolah</button>}</nav>
      {tab === 'konten' ? <Content /> : <Schools />}
    </main>
  );
}
