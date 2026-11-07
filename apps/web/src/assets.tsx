import { useEffect, useRef, useState } from 'react';
import { ApiError, AssetRow, assets } from './api';
import { MAX_SECONDS, TARGET_RATE, concat, downsample, encodeWav } from './wav';

const PURPOSES: Record<string, string> = { instruksi: 'Instruksi suara', umpan_balik: 'Umpan balik', efek: 'Efek suara', ilustrasi: 'Ilustrasi', lainnya: 'Lainnya' };

const toBase64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] ?? '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

function Preview({ a }: { a: AssetRow }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let u = ''; assets.blobUrl(a.id).then((x) => { u = x; setUrl(x); }).catch(() => {}); return () => { if (u) URL.revokeObjectURL(u); }; }, [a.id]);
  if (!url) return <span className="note">memuat…</span>;
  return a.kind === 'audio' ? <audio controls src={url} /> : <img src={url} alt={a.name} style={{ maxHeight: 60 }} />;
}

/** Perekam suara di browser; hasil WAV mono 22,05 kHz 16-bit (dapat diputar di Android & iOS). Maks 90 dtk. */
function Recorder({ onSaved }: { onSaved: () => void }) {
  const [state, setState] = useState<'diam' | 'merekam' | 'siap'>('diam');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('instruksi');
  const [transcript, setTranscript] = useState('');
  const [msg, setMsg] = useState('');

  const ctxRef = useRef<{ ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode; src: MediaStreamAudioSourceNode } | null>(null);
  const pcm = useRef<Float32Array[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function start() {
    setMsg('');
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') { setMsg('Peramban ini tidak mendukung perekaman. Gunakan Chrome/Edge/Firefox terbaru atau unggah berkas.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      pcm.current = [];
      node.onaudioprocess = (e) => { pcm.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(node); node.connect(ctx.destination);
      ctxRef.current = { ctx, stream, node, src };
      timer.current = setTimeout(stop, MAX_SECONDS * 1000);
      setState('merekam');
    } catch { setMsg('Izin mikrofon ditolak atau mikrofon tidak tersedia.'); }
  }
  function stop() {
    const r = ctxRef.current;
    if (!r) return;
    if (timer.current) clearTimeout(timer.current);
    r.node.disconnect(); r.src.disconnect(); r.stream.getTracks().forEach((t) => t.stop());
    const rate = r.ctx.sampleRate;
    r.ctx.close().catch(() => {});
    ctxRef.current = null;
    const wav = encodeWav(downsample(concat(pcm.current), rate, TARGET_RATE), Math.min(rate, TARGET_RATE));
    const b = new Blob([wav], { type: 'audio/wav' });
    setBlob(b); setPreview(URL.createObjectURL(b)); setState('siap');
  }
  async function save() {
    if (!blob) return;
    try {
      await assets.upload({ name: name.trim(), purpose, language: 'id', transcript: transcript.trim() || undefined, mime: 'audio/wav', recorded: true, dataBase64: await toBase64(blob) });
      setState('diam'); setBlob(null); setPreview(''); setName(''); setTranscript(''); setMsg('Rekaman tersimpan.'); onSaved();
    } catch (e) { setMsg(e instanceof ApiError ? `Gagal menyimpan (${e.status}). Maksimum 5 MB.` : 'Gagal menyimpan.'); }
  }
  return (
    <div className="card">
      <h3>Rekam suara</h3>
      {state !== 'merekam' ? <button onClick={start}>● Mulai rekam</button> : <button onClick={stop}>■ Berhenti</button>}{' '}
      {state === 'merekam' && <strong>Sedang merekam…</strong>}
      {state === 'siap' && (
        <>
          <p><audio controls src={preview} /></p>
          <label>Nama aset<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Jenis<select value={purpose} onChange={(e) => setPurpose(e.target.value)}>{Object.entries(PURPOSES).filter(([k]) => k !== 'ilustrasi').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Teks yang diucapkan (transkrip)<input value={transcript} maxLength={500} onChange={(e) => setTranscript(e.target.value)} /></label>
          <button disabled={!name.trim()} onClick={save}>Simpan rekaman</button>{' '}
          <button className="link" onClick={() => { setState('diam'); setBlob(null); setPreview(''); }}>Buang</button>
        </>
      )}
      {msg && <p>{msg}</p>}
    </div>
  );
}

function Upload({ onSaved }: { onSaved: () => void }) {
  const [msg, setMsg] = useState('');
  const [purpose, setPurpose] = useState('ilustrasi');
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await assets.upload({ name: f.name.replace(/\.[^.]+$/, ''), purpose, mime: f.type, dataBase64: await toBase64(f) });
      setMsg('Terunggah.'); onSaved();
    } catch (x) { setMsg(x instanceof ApiError ? `Ditolak (${x.status}): ${x.message.slice(0, 120)}` : 'Gagal.'); }
    e.target.value = '';
  }
  return (
    <div className="card">
      <h3>Unggah berkas</h3>
      <label>Jenis<select value={purpose} onChange={(e) => setPurpose(e.target.value)}>{Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,audio/webm,audio/ogg,audio/mpeg,audio/wav,audio/mp4" onChange={pick} />
      <p className="note">Gambar maks 2 MB; audio maks 5 MB. Tipe diperiksa dari isi berkas. Pastikan Anda berhak memakai ilustrasi/suara yang diunggah (lisensi jelas).</p>
      {msg && <p>{msg}</p>}
    </div>
  );
}

export function Assets() {
  const [rows, setRows] = useState<AssetRow[]>([]);
  const load = () => { assets.list().then(setRows).catch(() => setRows([])); };
  useEffect(load, []);
  return (
    <>
      <Recorder onSaved={load} />
      <Upload onSaved={load} />
      <section className="card">
        <h2>Pustaka aset</h2>
        {rows.length === 0 ? <p>Belum ada aset.</p> : (
          <table>
            <thead><tr><th>Nama</th><th>Jenis</th><th>Pratinjau</th><th>Transkrip</th><th></th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id}><td>{a.name}{a.recorded ? ' 🎙' : ''}</td><td>{PURPOSES[a.purpose] ?? a.purpose}</td><td><Preview a={a} /></td><td>{a.transcript ?? ''}</td>
                <td><button className="link" onClick={() => assets.archive(a.id).then(load)}>Arsipkan</button></td></tr>))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
