import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ACTIVITY_LABEL, curriculumLabel, HOME_IDEAS, STATUS_LABEL } from './narrative';
import { Assignment, Card, ClassResults, Gradebook, ClassRow, PIN_ICONS, school, StudentRow } from './api';

/** Kartu login ramah anak: kode QR + 3 gambar PIN. Dicetak langsung; PIN tidak tersimpan di server (hanya hash). */
function CardView({ card }: { card: Card }) {
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(card.loginCode, { margin: 1, width: 180 }).then(setQr); }, [card.loginCode]);
  return (
    <div className="login-card">
      <strong>{card.alias}</strong>
      {qr && <img src={qr} alt={`Kode QR untuk ${card.alias}`} width={180} height={180} />}
      <div className="pin" aria-label="PIN gambar">{card.pin.map((i, k) => <span key={k}>{PIN_ICONS[i]}</span>)}</div>
    </div>
  );
}

/** Laporan perkembangan murid, siap cetak / simpan PDF lewat dialog cetak peramban. */
function Report({ cls, gb, studentId, onClose }: { cls: ClassRow; gb: Gradebook; studentId: string; onClose: () => void }) {
  const st = gb.students.find((s) => s.studentId === studentId);
  if (!st) return null;
  const played = st.grades.filter((g) => g.status !== 'belum_mulai');
  return (
    <div className="report">
      <h2>Laporan Perkembangan Bermain — {st.alias}</h2>
      <p>Kelas {cls.name} · dicetak {new Date().toLocaleDateString('id-ID')}</p>
      {played.length === 0 ? <p>Belum ada aktivitas yang dimainkan.</p> : (
        <ul>{played.map((g) => {
          const tags = gb.activities.find((a) => a.activityId === g.activityId)?.curriculum ?? [];
          return (
            <li key={g.activityId}>
              <strong>{ACTIVITY_LABEL[g.activityId] ?? g.activityId}</strong>: {STATUS_LABEL[g.status]} (level tertinggi {g.highestLevel} dari {g.maxLevel}).
              <br /><small>Terkait: {tags.map(curriculumLabel).join('; ') || '—'}</small>
              {g.needsSupportHint && <><br /><em>Catatan untuk guru: anak banyak memakai petunjuk; pendampingan singkat mungkin membantu.</em></>}
              {HOME_IDEAS[g.activityId] && <><br /><small>Coba di rumah: {HOME_IDEAS[g.activityId]}</small></>}
            </li>);
        })}</ul>
      )}
      <p className="note">Laporan ini merangkum aktivitas bermain di aplikasi dan bukan penilaian resmi atau diagnosis perkembangan. Aturan pengelompokan: draf, menunggu validasi ahli PAUD.</p>
      <p className="noprint"><button onClick={() => window.print()}>Cetak / simpan PDF</button> <button className="link" onClick={onClose}>Tutup</button></p>
    </div>
  );
}

function ClassPanel({ cls }: { cls: ClassRow }) {
  const [gb, setGb] = useState<Gradebook | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<ClassResults | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [alias, setAlias] = useState('');
  const [year, setYear] = useState('2020');
  const [act, setAct] = useState(Object.keys(ACTIVITY_LABEL)[0]);
  const [due, setDue] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    school.students(cls.id).then(setStudents);
    school.assignments(cls.id).then(setAssignments);
    school.results(cls.id).then(setResults);
    school.gradebook(cls.id).then(setGb);
  };
  useEffect(load, [cls.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { const c = await school.addStudent(cls.id, alias.trim(), +year); setCards((x) => [...x, c]); setAlias(''); load(); setErr(''); }
    catch { setErr('Gagal menambah murid.'); }
  }
  async function reissue(s: StudentRow) {
    const c = await school.resetPin(s.id);
    setCards((x) => [...x.filter((y) => y.id !== c.id), c]);
  }

  return (
    <section className="card">
      <h2>{cls.name}</h2>

      <h3>Murid ({students.length})</h3>
      <ul>{students.map((s) => <li key={s.id}>{s.alias} <button className="link" onClick={() => reissue(s)}>Terbitkan kartu baru</button></li>)}</ul>
      <form onSubmit={add}>
        <label>Panggilan murid (bukan nama lengkap)<input value={alias} maxLength={30} onChange={(e) => setAlias(e.target.value)} required /></label>
        <label>Tahun lahir<input type="number" value={year} onChange={(e) => setYear(e.target.value)} required /></label>
        <button>Tambah murid &amp; buat kartu</button> {err && <span className="err">{err}</span>}
      </form>

      {cards.filter((c) => c.loginCode).length > 0 && (
        <>
          <h3>Kartu login (cetak sekarang)</h3>
          <p className="note">PIN hanya tampil sekali dan tidak dapat dilihat lagi. Cetak lalu bagikan kepada murid.</p>
          <div className="cards">{cards.filter((c) => c.loginCode).map((c) => <CardView key={c.loginCode} card={c} />)}</div>
          <button onClick={() => window.print()}>Cetak kartu</button>
        </>
      )}

      <h3>Misi yang ditugaskan</h3>
      <ul>{assignments.map((a) => (
        <li key={a.id}>{ACTIVITY_LABEL[a.activityId] ?? a.activityId}{a.dueDate ? ` (sampai ${a.dueDate.slice(0, 10)})` : ''}{' '}
          <button className="link" onClick={() => school.unassign(cls.id, a.id).then(load)}>Cabut</button></li>))}</ul>
      <form onSubmit={(e) => { e.preventDefault(); school.assign(cls.id, act, due || undefined).then(load); }}>
        <label>Aktivitas<select value={act} onChange={(e) => setAct(e.target.value)}>
          {Object.entries(ACTIVITY_LABEL).map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>
        <label>Batas waktu (opsional)<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <button>Tugaskan ke kelas</button>
      </form>

      <h3>Buku nilai deskriptif</h3>
      {gb && (
        <>
          <table>
            <thead><tr><th>Murid</th>{gb.activities.map((a) => <th key={a.activityId}>{ACTIVITY_LABEL[a.activityId] ?? a.activityId}</th>)}<th></th></tr></thead>
            <tbody>{gb.students.map((s) => (
              <tr key={s.studentId}><td>{s.alias}</td>
                {s.grades.map((g) => <td key={g.activityId}>{STATUS_LABEL[g.status]}{g.needsSupportHint ? ' ⚠' : ''}</td>)}
                <td><button className="link" onClick={() => setReportFor(s.studentId)}>Laporan</button></td></tr>))}</tbody>
          </table>
          <details><summary>Cara pengelompokan (draf, menunggu validasi ahli PAUD)</summary><ul>{gb.rules.map((r) => <li key={r}>{r}</li>)}</ul></details>
          {reportFor && <Report cls={cls} gb={gb} studentId={reportFor} onClose={() => setReportFor(null)} />}
        </>
      )}

      <h3>Hasil bermain</h3>
      <table>
        <thead><tr><th>Murid</th><th>Aktivitas</th><th>Level selesai</th><th>Petunjuk dipakai</th></tr></thead>
        <tbody>{results?.students.flatMap((s) => s.activities.length === 0
          ? [<tr key={s.studentId}><td>{s.alias}</td><td colSpan={3}>belum bermain</td></tr>]
          : s.activities.map((a) => <tr key={s.studentId + a.activityId}><td>{s.alias}</td><td>{ACTIVITY_LABEL[a.activityId] ?? a.activityId}</td><td>{a.completed}</td><td>{a.hints}</td></tr>))}</tbody>
      </table>
      <p className="note">Data ini menggambarkan aktivitas bermain, bukan penilaian atau diagnosis anak.</p>
    </section>
  );
}

export function TeacherDashboard({ onLogout }: { onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [name, setName] = useState('');
  const load = () => { school.classes().then(setClasses).catch(onLogout); };
  useEffect(load, []);
  return (
    <main>
      <header><h1>Play &amp; Learn — Sekolah &amp; Guru</h1><button className="link" onClick={onLogout}>Keluar</button></header>
      <form className="card" onSubmit={(e) => { e.preventDefault(); school.createClass(name.trim()).then(() => { setName(''); load(); }); }}>
        <label>Buat kelas baru<input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} required /></label>
        <button>Buat kelas</button>
      </form>
      {classes?.map((c) => <ClassPanel key={c.id} cls={c} />)}
    </main>
  );
}
