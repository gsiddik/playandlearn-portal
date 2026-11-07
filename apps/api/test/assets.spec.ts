import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { Db } from '../src/db';
import { configure } from '../src/bootstrap';
import { checkAsset } from '../src/assets';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 1)]);

describe('checkAsset', () => {
  it('menerima isi yang cocok dengan tipe', () => {
    expect(checkAsset('image/png', png)).toEqual({ kind: 'image', mime: 'image/png' });
    expect(checkAsset('audio/webm;codecs=opus', webm)).toEqual({ kind: 'audio', mime: 'audio/webm' });
  });
  it('menolak tipe tak dikenal, isi tak cocok, kosong, dan terlalu besar', () => {
    expect(checkAsset('application/x-msdownload', png)).toContain('tidak diizinkan');
    expect(checkAsset('image/png', webm)).toContain('tidak sesuai');
    expect(checkAsset('image/png', Buffer.alloc(0))).toContain('kosong');
    expect(checkAsset('audio/webm', Buffer.concat([webm, Buffer.alloc(6 * 1024 * 1024)]))).toContain('terlalu besar');
  });
});

const run = process.env.DATABASE_URL ? describe : describe.skip;
run('aset & rekaman suara (butuh DATABASE_URL)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const email = `ast${Date.now()}@pal.id`;
  let ops = '';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configure(app);
    await app.init();
    const db = app.get(Db);
    await db.migrate();
    await db.bootstrapOps(email, 'sandi-ops-panjang-1');
    ops = (await http().post('/v1/auth/login').send({ email, password: 'sandi-ops-panjang-1' }).expect(200)).body.accessToken;
  });
  afterAll(() => app.close());

  it('unggah rekaman → daftar → unduh dengan header aman → arsipkan', async () => {
    const up = (await http().post('/v1/ops/assets').set(bearer(ops)).send({
      name: 'Instruksi hitung bintang', purpose: 'instruksi', language: 'id', transcript: 'Ada berapa bintang?',
      mime: 'audio/webm;codecs=opus', recorded: true, dataBase64: webm.toString('base64'),
    }).expect(201)).body;
    expect(up).toMatchObject({ kind: 'audio', mime: 'audio/webm', recorded: true, sizeBytes: webm.length });

    expect((await http().get('/v1/ops/assets?kind=audio').set(bearer(ops)).expect(200)).body.some((a: any) => a.id === up.id)).toBe(true);

    const f = await http().get(`/v1/assets/${up.id}/file`).set(bearer(ops)).expect(200);
    expect(f.headers['content-type']).toContain('audio/webm');
    expect(f.headers['x-content-type-options']).toBe('nosniff');
    expect(f.headers['content-security-policy']).toContain('sandbox');
    expect(Buffer.from(f.body).equals(webm)).toBe(true);
    await http().get(`/v1/assets/${up.id}/file`).expect(401);

    await http().patch(`/v1/ops/assets/${up.id}`).set(bearer(ops)).send({ status: 'archived' }).expect(200);
    await http().get(`/v1/assets/${up.id}/file`).set(bearer(ops)).expect(404);
  });

  it('menolak berkas yang menyamar dan peran tanpa izin', async () => {
    await http().post('/v1/ops/assets').set(bearer(ops)).send({ name: 'x', mime: 'image/png', dataBase64: webm.toString('base64') }).expect(400);
    const parent = (await http().post('/v1/auth/parents/register')
      .send({ email: `ap${Date.now()}@x.id`, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201)).body.accessToken;
    await http().post('/v1/ops/assets').set(bearer(parent)).send({ name: 'x', mime: 'image/png', dataBase64: png.toString('base64') }).expect(403);
  });

  it('paket konten terbit membawa daftar aset audio untuk klien', async () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(40)]);
    const up = (await http().post('/v1/ops/assets').set(bearer(ops)).send({ name: 'Prompt WAV', purpose: 'instruksi', mime: 'audio/wav', recorded: true, dataBase64: wav.toString('base64') }).expect(201)).body;
    const base = JSON.parse(readFileSync(join(__dirname, '../../../content/packs/v1.json'), 'utf8'));
    const max = (await http().get('/v1/ops/packs').set(bearer(ops)).expect(200)).body[0]?.version ?? 0;
    const m = { ...base, version: max + 1 };
    m.activities[0].promptAudio = up.id;
    await http().post('/v1/ops/packs').set(bearer(ops)).send({ manifest: m }).expect(201);
    await http().post(`/v1/ops/packs/${m.version}/publish`).set(bearer(ops)).expect(201);
    const parent = (await http().post('/v1/auth/parents/register')
      .send({ email: `ac${Date.now()}@x.id`, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201)).body.accessToken;
    const pack = (await http().get('/v1/content/packs/latest?age=5').set(bearer(parent)).expect(200)).body;
    expect(pack.version).toBe(m.version);
    expect(pack.assets[up.id]).toMatchObject({ mime: 'audio/wav', sizeBytes: wav.length });
    expect(pack.assets[up.id].sha256).toHaveLength(64);
    await http().post(`/v1/ops/packs/${m.version}/retire`).set(bearer(ops)).expect(201); // kembalikan agar tes lain stabil
  });

  it('konten yang merujuk audio yang tidak ada tidak dapat diterbitkan', async () => {
    const base = JSON.parse(readFileSync(join(__dirname, '../../../content/packs/v1.json'), 'utf8'));
    const max = (await http().get('/v1/ops/packs').set(bearer(ops)).expect(200)).body[0]?.version ?? 0;
    const m = { ...base, version: max + 1 };
    m.activities[0].promptAudio = '00000000-0000-4000-8000-000000000000';
    await http().post('/v1/ops/packs').set(bearer(ops)).send({ manifest: m }).expect(201);
    await http().post(`/v1/ops/packs/${m.version}/publish`).set(bearer(ops)).expect(400);
  });
});
