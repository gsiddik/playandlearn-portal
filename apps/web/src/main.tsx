import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, Child, hasToken, Policy, Progress, school, setToken, tokenRole } from './api';
import { TeacherDashboard } from './school';
import { OpsDashboard } from './ops';
import { AREA_LABEL, homeIdeas, radarPoints, summarize } from './narrative';
import './style.css';

function Auth({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<'parent' | 'school'>('parent');
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [reg, setReg] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = reg ? (kind === 'school' ? await school.register(schoolName, email, pw) : await api.register(email, pw)) : await api.login(email, pw);
      setToken(r.accessToken);
      onDone();
    } catch (x) { setErr(x instanceof ApiError && x.status === 401 ? 'Email atau password salah' : 'Gagal. Periksa data Anda.'); }
  }
  return (
    <form onSubmit={submit} className="card">
      <h1>{reg ? 'Daftar' : 'Masuk'} {kind === 'school' ? 'sekolah/guru' : 'orang tua'}</h1>
      {reg && <button type="button" className="link" onClick={() => setKind(kind === 'parent' ? 'school' : 'parent')}>{kind === 'parent' ? 'Saya mendaftarkan sekolah' : 'Saya orang tua'}</button>}
      {reg && kind === 'school' && <label>Nama sekolah<input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required /></label>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password (min. 10 karakter)<input type="password" minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {reg && <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {kind === 'school' ? 'Sekolah menyatakan telah memperoleh persetujuan orang tua/wali murid atas pengumpulan data minimum untuk progres belajar (draf kebijakan, menunggu review hukum).' : 'Saya orang tua/wali dan menyetujui pengumpulan data minimum untuk progres belajar anak saya (draf kebijakan, menunggu review hukum).'}</label>}
      {err && <p className="err">{err}</p>}
      <button disabled={reg && !consent}>{reg ? 'Daftar' : 'Masuk'}</button>
      <button type="button" className="link" onClick={() => setReg(!reg)}>{reg ? 'Sudah punya akun' : 'Buat akun baru'}</button>
    </form>
  );
}

function Radar({ areas }: { areas: Progress['areas'] }) {
  const n = areas.length, R = 90, C = 130;
  const axis = (i: number, f = 1) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
  return (
    <svg viewBox="0 0 260 260" role="img" aria-label="Grafik radar lima area perkembangan bermain" style={{ maxWidth: 320 }}>
      {[0.5, 1].map((f) => <polygon key={f} points={areas.map((_, i) => axis(i, f).join(',')).join(' ')} fill="none" stroke="currentColor" opacity={0.25} />)}
      {areas.map((a, i) => { const [x, y] = axis(i); const [lx, ly] = axis(i, 1.22); return (
        <g key={a.area}><line x1={C} y1={C} x2={x} y2={y} stroke="currentColor" opacity={0.25} />
          <text x={lx} y={ly} fontSize="9" textAnchor="middle" fill="currentColor" opacity={a.hasContent ? 1 : 0.5}>{AREA_LABEL[a.area].split(' (')[0]}{a.hasContent ? '' : ' (segera)'}</text></g>); })}
      <polygon points={radarPoints(areas, R, C, C)} fill="#1e88e5" fillOpacity={0.35} stroke="#1e88e5" strokeWidth="2" />
    </svg>
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
      {progress ? <><Radar areas={progress.areas} /><ul>{summarize(progress).map((l) => <li key={l}>{l}</li>)}</ul>
        {homeIdeas(progress).length > 0 && <><h3>Coba di rumah</h3><ul>{homeIdeas(progress).map((l) => <li key={l}>{l}</li>)}</ul></>}</> : <p>Memuat…</p>}
      <p className="note">Ringkasan ini menggambarkan aktivitas bermain, bukan penilaian atau diagnosis perkembangan anak. Area bertanda (segera) belum memiliki aktivitas.</p>
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
  if (!authed) return <Auth onDone={() => setAuthed(true)} />;
  const role = tokenRole();
  if (role === 'ops_admin' || role === 'content_designer') return <OpsDashboard onLogout={logout} />;
  return role === 'parent' ? <Dashboard onLogout={logout} /> : <TeacherDashboard onLogout={logout} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
