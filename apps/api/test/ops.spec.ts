import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { Db } from '../src/db';
import { validateManifest } from '../src/manifest';

const base = () => JSON.parse(readFileSync(join(__dirname, '../../../content/packs/v1.json'), 'utf8'));

describe('validateManifest', () => {
  it('menerima pack v1', () => expect(validateManifest(base())).toEqual([]));
  it('menolak id duplikat, area tak dikenal, dan jawaban di luar opsi', () => {
    const m = base();
    m.activities[1].id = m.activities[0].id;
    m.activities[0].areas = ['sihir'];
    m.activities[2].levels[0].options = [1, 2];
    const e = validateManifest(m).join('|');
    expect(e).toContain('duplikat');
    expect(e).toContain('areas');
    expect(e).toContain('memuat count');
  });
  it('menolak sort dengan satu kelompok', () => {
    const m = base();
    m.activities[0].levels[0].items = [{ id: 'a', group: 'red' }, { id: 'b', group: 'red' }];
    expect(validateManifest(m).join('|')).toContain('2 kelompok');
  });
});

const run = process.env.DATABASE_URL ? describe : describe.skip;
run('portal operasional (butuh DATABASE_URL)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const email = `ops${Date.now()}@pal.id`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
    const db = app.get(Db);
    await db.migrate();
    await db.bootstrapOps(email, 'sandi-ops-panjang-1');
  });
  afterAll(() => app.close());

  it('alur draf → terbit → versi baru → tarik; konten terbit tak bisa diubah', async () => {
    const t = (await http().post('/v1/auth/login').send({ email, password: 'sandi-ops-panjang-1' }).expect(200)).body.accessToken;
    const max = (await http().get('/v1/ops/packs').set(bearer(t)).expect(200)).body[0]?.version ?? 0;
    const m = base(); m.version = max + 2;

    const bad = { ...m, activities: [] };
    await http().post('/v1/ops/packs').set(bearer(t)).send({ manifest: bad }).expect(400);
    await http().post('/v1/ops/packs').set(bearer(t)).send({ manifest: m }).expect(201);
    await http().post('/v1/ops/packs').set(bearer(t)).send({ manifest: m }).expect(201); // timpa draf
    await http().post(`/v1/ops/packs/${m.version}/publish`).set(bearer(t)).expect(201);
    await http().post('/v1/ops/packs').set(bearer(t)).send({ manifest: m }).expect(409); // terbit = immutable
    await http().post('/v1/ops/packs').set(bearer(t)).send({ manifest: { ...m, version: max + 1 } }).expect(409); // versi harus naik

    // klien mendapat versi terbaru tanpa update aplikasi
    const p = (await http().post('/v1/auth/parents/register')
      .send({ email: `p${Date.now()}@x.id`, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201)).body.accessToken;
    expect((await http().get('/v1/content/packs/latest?age=5').set(bearer(p)).expect(200)).body.version).toBe(m.version);

    await http().post(`/v1/ops/packs/${m.version}/retire`).set(bearer(t)).expect(201);
    expect((await http().get('/v1/content/packs/latest?age=5').set(bearer(p))).body.version).not.toBe(m.version);
    expect((await http().get('/v1/ops/schools').set(bearer(t)).expect(200)).body).toBeInstanceOf(Array);
  });

  it('RBAC: guru/orang tua ditolak dari API operasional', async () => {
    const p = (await http().post('/v1/auth/parents/register')
      .send({ email: `q${Date.now()}@x.id`, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201)).body.accessToken;
    await http().get('/v1/ops/packs').set(bearer(p)).expect(403);
    await http().get('/v1/ops/schools').expect(401);
  });
});
