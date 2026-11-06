import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { Db } from '../src/db';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('alur sekolah → kelas → murid → penugasan (butuh DATABASE_URL)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function school(tag: string) {
    const r = await http().post('/v1/auth/schools/register')
      .send({ schoolName: `TK ${tag}`, email: `${tag}${Date.now()}@sekolah.id`, password: 'sandi-panjang-123', parentalConsentAttested: true }).expect(201);
    return r.body.accessToken as string;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    const db = app.get(Db);
    await db.migrate();
    await db.publishPack(JSON.parse(readFileSync(join(__dirname, '../../../content/packs/v1.json'), 'utf8')));
  });
  afterAll(() => app.close());

  it('menolak pendaftaran sekolah tanpa pernyataan persetujuan orang tua', async () => {
    await http().post('/v1/auth/schools/register')
      .send({ schoolName: 'X', email: 'x@s.id', password: 'sandi-panjang-123', parentalConsentAttested: false }).expect(400);
  });

  it('guru membuat kelas, murid, penugasan; murid login dengan QR+PIN dan sinkron', async () => {
    const admin = await school('a');
    const teacherEmail = `guru${Date.now()}@sekolah.id`;
    await http().post('/v1/school/teachers').set(bearer(admin)).send({ email: teacherEmail, password: 'sandi-panjang-123' }).expect(201);
    const t = (await http().post('/v1/auth/login').send({ email: teacherEmail, password: 'sandi-panjang-123' }).expect(200)).body.accessToken;

    const cls = (await http().post('/v1/classes').set(bearer(t)).send({ name: 'TK B1' }).expect(201)).body;
    const st = (await http().post(`/v1/classes/${cls.id}/students`).set(bearer(t)).send({ alias: 'Bima', birthYear: 2020 }).expect(201)).body;
    expect(st.pin).toHaveLength(3);
    expect(st.loginCode.length).toBeGreaterThan(16);

    await http().post(`/v1/classes/${cls.id}/assignments`).set(bearer(t)).send({ activityId: 'nope' }).expect(400);
    await http().post(`/v1/classes/${cls.id}/assignments`).set(bearer(t)).send({ activityId: 'count-1-10', dueDate: '2026-12-01' }).expect(201);

    // PIN salah → 401; benar → token murid
    const wrong = st.pin.map((n: number) => (n + 1) % 9);
    await http().post('/v1/auth/students/login').send({ loginCode: st.loginCode, pin: wrong }).expect(401);
    const sl = await http().post('/v1/auth/students/login').send({ loginCode: st.loginCode, pin: st.pin }).expect(200);
    const s = bearer(sl.body.accessToken);

    const me = (await http().get('/v1/me/profile').set(s).expect(200)).body;
    expect(me.alias).toBe('Bima');
    expect(me.assignments).toEqual([{ activityId: 'count-1-10', dueDate: expect.any(String) }]);

    // murid hanya boleh mengirim event untuk dirinya sendiri, dan tidak mengakses area guru/orang tua
    const ev = { id: randomUUID(), childId: st.id, activityId: 'count-1-10', contentVersion: 1, type: 'completed', deviceTs: new Date().toISOString(), payload: { level: 1 } };
    await http().post('/v1/sync/events').set(s).send({ events: [ev] }).expect(200);
    await http().post('/v1/sync/events').set(s).send({ events: [{ ...ev, id: randomUUID(), childId: randomUUID() }] }).expect(404);
    await http().get('/v1/classes').set(s).expect(403);
    await http().get('/v1/children').set(s).expect(403);

    const res = (await http().get(`/v1/classes/${cls.id}/results`).set(bearer(t)).expect(200)).body;
    expect(res.students[0].activities[0]).toMatchObject({ activityId: 'count-1-10', completed: 1 });

    // reset PIN mencabut kode lama
    const re = (await http().post(`/v1/students/${st.id}/reset-pin`).set(bearer(t)).expect(200)).body;
    await http().post('/v1/auth/students/login').send({ loginCode: st.loginCode, pin: st.pin }).expect(401);
    await http().post('/v1/auth/students/login').send({ loginCode: re.loginCode, pin: re.pin }).expect(200);
  });

  it('mengunci login murid setelah 5 PIN salah', async () => {
    const t = await school('b');
    const cls = (await http().post('/v1/classes').set(bearer(t)).send({ name: 'K' }).expect(201)).body;
    const st = (await http().post(`/v1/classes/${cls.id}/students`).set(bearer(t)).send({ alias: 'Sari', birthYear: 2019 }).expect(201)).body;
    const wrong = st.pin.map((n: number) => (n + 1) % 9);
    for (let i = 0; i < 5; i++) await http().post('/v1/auth/students/login').send({ loginCode: st.loginCode, pin: wrong }).expect(401);
    await http().post('/v1/auth/students/login').send({ loginCode: st.loginCode, pin: st.pin }).expect(423); // terkunci walau PIN benar
  });

  it('mengisolasi antar sekolah', async () => {
    const a = await school('c');
    const b = await school('d');
    const cls = (await http().post('/v1/classes').set(bearer(a)).send({ name: 'A1' }).expect(201)).body;
    await http().get(`/v1/classes/${cls.id}/students`).set(bearer(b)).expect(404);
    expect((await http().get('/v1/classes').set(bearer(b)).expect(200)).body).toHaveLength(0);
  });

  it('orang tua tidak boleh mengakses API sekolah', async () => {
    const p = (await http().post('/v1/auth/parents/register')
      .send({ email: `ortu${Date.now()}@x.id`, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201)).body.accessToken;
    await http().post('/v1/classes').set(bearer(p)).send({ name: 'X' }).expect(403);
  });
});
