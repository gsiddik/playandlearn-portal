import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { Db } from '../src/db';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('dasbor kelas real-time (butuh DATABASE_URL)', () => {
  let app: INestApplication;
  let port: number;
  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as any).port;
    const db = app.get(Db);
    await db.migrate();
    await db.publishPack(JSON.parse(readFileSync(join(__dirname, '../../../content/packs/v1.json'), 'utf8')));
  });
  afterAll(() => app.close());

  const school = async (tag: string) => (await http().post('/v1/auth/schools/register')
    .send({ schoolName: tag, email: `${tag}${Date.now()}@s.id`, password: 'sandi-panjang-123', parentalConsentAttested: true }).expect(201)).body.accessToken as string;

  const open = (token: string) => new Promise<{ ws: WebSocket; msgs: any[]; closed: Promise<number> }>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/live?token=${token}`);
    const msgs: any[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
    ws.on('open', () => resolve({ ws, msgs, closed }));
    ws.on('error', () => resolve({ ws, msgs, closed }));
  });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('guru menerima event murid sekolahnya; sekolah lain tidak', async () => {
    const t = await school('live-a');
    const other = await school('live-b');
    const cls = (await http().post('/v1/classes').set(bearer(t)).send({ name: 'K1' }).expect(201)).body;
    const st = (await http().post(`/v1/classes/${cls.id}/students`).set(bearer(t)).send({ alias: 'Rani', birthYear: 2020 }).expect(201)).body;
    const sTok = (await http().post('/v1/auth/students/login').send({ loginCode: st.loginCode, pin: st.pin }).expect(200)).body.accessToken;

    const mine = await open(t);
    const theirs = await open(other);
    await wait(100);

    const ev = { id: randomUUID(), childId: st.id, activityId: 'count-1-10', contentVersion: 1, type: 'hint_shown', deviceTs: new Date().toISOString(), payload: { level: 1, hintLevel: 1 } };
    await http().post('/v1/sync/events').set(bearer(sTok)).send({ events: [ev] }).expect(200);
    await http().post('/v1/sync/events').set(bearer(sTok)).send({ events: [ev] }).expect(200); // duplikat: tidak diteruskan lagi
    await wait(200);

    expect(mine.msgs).toHaveLength(1);
    expect(mine.msgs[0]).toMatchObject({ classId: cls.id, studentId: st.id, alias: 'Rani', activityId: 'count-1-10', type: 'hint_shown', level: 1 });
    expect(theirs.msgs).toHaveLength(0);
    mine.ws.close(); theirs.ws.close();
  });

  it('menolak koneksi tanpa token valid atau bukan guru', async () => {
    const bad = await open('bukan-token');
    expect(await bad.closed).toBe(4401);
    const parent = (await http().post('/v1/auth/parents/register')
      .send({ email: `lp${Date.now()}@x.id`, password: 'sandi-panjang-123', consentPolicyVersion: 'v1', consentGranted: true }).expect(201)).body.accessToken;
    const p = await open(parent);
    expect(await p.closed).toBe(4401);
  });
});
