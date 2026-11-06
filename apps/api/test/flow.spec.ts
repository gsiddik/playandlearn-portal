import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { Db } from '../src/db';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('alur orang tua → anak → sync (butuh DATABASE_URL)', () => {
  let app: INestApplication;
  let db: Db;
  const http = () => request(app.getHttpServer());

  async function register(email: string) {
    const r = await http().post('/v1/auth/parents/register')
      .send({ email, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201);
    return r.body.accessToken as string;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    db = app.get(Db);
    await db.migrate();
    await db.publishPack(JSON.parse(readFileSync(join(__dirname, '../../../content/packs/v1.json'), 'utf8')));
  });
  afterAll(() => app.close());

  it('menolak registrasi tanpa persetujuan', async () => {
    await http().post('/v1/auth/parents/register')
      .send({ email: 'x@y.id', password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: false }).expect(400);
  });

  it('registrasi, login, profil anak, kebijakan, sync idempoten, ekspor, hapus', async () => {
    const email = `p${Date.now()}@example.id`;
    const token = await register(email);
    await http().post('/v1/auth/login').send({ email, password: 'salah' }).expect(401);
    const login = await http().post('/v1/auth/login').send({ email, password: 'sandi-panjang-123' }).expect(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    const child = (await http().post('/v1/children').set(auth).send({ alias: 'Bintang', birthYear: 2020 }).expect(201)).body;
    expect((await http().get('/v1/children').set(auth).expect(200)).body).toHaveLength(1);

    const pol = (await http().put(`/v1/children/${child.id}/policy`).set(auth)
      .send({ dailyMinutes: 20, sessionMinutes: 8, allowedFrom: '07:00', allowedTo: '19:00' }).expect(200)).body;
    expect(pol).toMatchObject({ dailyMinutes: 20, version: 2, allowedFrom: '07:00' });
    await http().put(`/v1/children/${child.id}/policy`).set(auth).send({ dailyMinutes: 999, sessionMinutes: 8 }).expect(400);

    const pack = (await http().get('/v1/content/packs/latest?age=5').set(auth).expect(200)).body;
    expect(pack.version).toBe(1);
    await http().get('/v1/content/packs/latest?age=5&haveVersion=1').set(auth).expect(304);

    const ev = { id: randomUUID(), childId: child.id, activityId: 'count-1-10', contentVersion: 1, type: 'completed', deviceTs: new Date().toISOString(), payload: { level: 1 } };
    const s1 = await http().post('/v1/sync/events').set(auth).send({ events: [ev] }).expect(200);
    expect(s1.body).toMatchObject({ accepted: 1, duplicates: 0 });
    expect(s1.body.policy.dailyMinutes).toBe(20);
    const s2 = await http().post('/v1/sync/events').set(auth).send({ events: [ev] }).expect(200);
    expect(s2.body).toMatchObject({ accepted: 0, duplicates: 1 });

    expect((await http().get(`/v1/children/${child.id}/export`).set(auth).expect(200)).body.events).toHaveLength(1);
    await http().delete(`/v1/children/${child.id}`).set(auth).expect(204);
    expect((await http().get('/v1/children').set(auth).expect(200)).body).toHaveLength(0);
  });

  it('mengisolasi tenant: orang tua lain tidak bisa mengakses anak', async () => {
    const a = { Authorization: `Bearer ${await register(`a${Date.now()}@example.id`)}` };
    const b = { Authorization: `Bearer ${await register(`b${Date.now()}@example.id`)}` };
    const child = (await http().post('/v1/children').set(a).send({ alias: 'A', birthYear: 2019 }).expect(201)).body;
    await http().get(`/v1/children/${child.id}/policy`).set(b).expect(404);
    await http().post('/v1/sync/events').set(b).send({ events: [{ id: randomUUID(), childId: child.id, activityId: 'x', contentVersion: 1, type: 'started', deviceTs: new Date().toISOString() }] }).expect(404);
    expect((await http().get('/v1/children').set(b).expect(200)).body).toHaveLength(0);
  });

  it('menolak akses tanpa token', async () => {
    await http().get('/v1/children').expect(401);
  });
});
