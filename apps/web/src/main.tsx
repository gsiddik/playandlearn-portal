import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, Child, hasToken, Policy, Progress, setToken } from './api';
import { summarize } from './narrative';
import './style.css';

function Auth({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [reg, setReg] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = reg ? await api.register(email, pw) : await api.login(email, pw);
      setToken(r.accessToken);
      onDone();
    } catch (x) { setErr(x instanceof ApiError && x.status === 401 ? 'Email atau password salah' : 'Gagal. Periksa data Anda.'); }
  }
  return (
    <form onSubmit={submit} className="card">
      <h1>{reg ? 'Daftar orang tua' : 'Masuk orang tua'}</h1>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password (min. 10 karakter)<input type="password" minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {reg && <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Saya orang tua/wali dan menyetujui pengumpulan data minimum untuk progres belajar anak saya (draf kebijakan, menunggu review hukum).</label>}
      {err && <p className="err">{err}</p>}
      <button disabled={reg && !consent}>{reg ? 'Daftar' : 'Masuk'}</button>
      <button type="button" className="link" onClick={() => setReg(!reg)}>{reg ? 'Sudah punya akun' : 'Buat akun baru'}</button>
    </form>
  );
}

function ChildPanel({ child, onRemoved }: { child: Child; onRemoved: () => void }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.policy(child.id).then(setPolicy); api.progress(child.id).then(setProgress); }, [child.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!policy) return;
    const { version: _v, ...rest } = policy;
    try { setPolicy(await api.setPolicy(child.id, { ...rest, allowedFrom: rest.allowedFrom || undefined, allowedTo: rest.allowedTo || undefined })); setMsg('Tersimpan. Perangkat anak menerima aturan ini saat berikutnya tersambung.'); }
    catch { setMsg('Gagal menyimpan.'); }
  }
  async function download() {
    const blob = new Blob([JSON.stringify(await api.exportData(child.id), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `data-${child.alias}.json`; a.click();
  }
  async function remove() {
    if (window.confirm(`Hapus ${child.alias} beserta seluruh datanya secara permanen?`)) { await api.remove(child.id); onRemoved(); }
  }
  return (
    <section className="card">
      <h2>{child.alias} <small>(lahir {child.birthYear})</small></h2>
      <h3>Perkembangan bermain</h3>
      {progress ? <ul>{summarize(progress).map((l) => <li key={l}>{l}</li>)}</ul> : <p>Memuat…</p>}
      <p className="note">Ringkasan ini menggambarkan aktivitas bermain, bukan penilaian atau diagnosis perkembangan anak.</p>
      <h3>Waktu bermain</h3>
      {policy && (
        <form onSubmit={save}>
          <label>Batas harian (menit)<input type="number" min={5} max={240} value={policy.dailyMinutes} onChange={(e) => setPolicy({ ...policy, dailyMinutes: +e.target.value })} /></label>
          <label>Durasi per sesi (menit)<input type="number" min={3} max={60} value={policy.sessionMinutes} onChange={(e) => setPolicy({ ...policy, sessionMinutes: +e.target.value })} /></label>
          <label>Boleh main mulai<input type="time" value={policy.allowedFrom ?? ''} onChange={(e) => setPolicy({ ...policy, allowedFrom: e.target.value })} /></label>
          <label>Sampai<input type="time" value={policy.allowedTo ?? ''} onChange={(e) => setPolicy({ ...policy, allowedTo: e.target.value })} /></label>
          <button>Simpan aturan</button> {msg && <span>{msg}</span>}
        </form>
      )}
      <h3>Data anak</h3>
      <button onClick={download}>Unduh semua data</button> <button className="danger" onClick={remove}>Hapus anak &amp; data</button>
    </section>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [children, setChildren] = useState<Child[] | null>(null);
  const load = useCallback(() => { api.children().then(setChildren).catch(onLogout); }, [onLogout]);
  useEffect(load, [load]);
  return (
    <main>
      <header><h1>Play &amp; Learn — Orang Tua</h1><button className="link" onClick={onLogout}>Keluar</button></header>
      {children === null ? <p>Memuat…</p> : children.length === 0
        ? <p className="card">Belum ada profil anak. Tambahkan anak lewat aplikasi Android (di balik gerbang orang tua).</p>
        : children.map((c) => <ChildPanel key={c.id} child={c} onRemoved={load} />)}
    </main>
  );
}

function App() {
  const [authed, setAuthed] = useState(hasToken());
  const logout = useCallback(() => { setToken(null); setAuthed(false); }, []);
  return authed ? <Dashboard onLogout={logout} /> : <Auth onDone={() => setAuthed(true)} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
