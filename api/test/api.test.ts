import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MemoryRepo } from '../src/memoryRepo';

function makeApp() {
  // bcryptRounds is low only so the tests run fast.
  return createApp(new MemoryRepo(), { jwtSecret: 'test-secret-test-secret', corsOrigin: '*', bcryptRounds: 4 });
}

async function signUp(app: ReturnType<typeof makeApp>, email = 'a@example.com') {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  return res.body.token as string;
}

describe('auth', () => {
  it('registers, then logs in', async () => {
    const app = makeApp();
    await signUp(app);
    const res = await request(app).post('/api/auth/login').send({ email: 'A@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects a duplicate email and a wrong password', async () => {
    const app = makeApp();
    await signUp(app);
    const dup = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'password123' });
    expect(dup.status).toBe(409);
    const bad = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('blocks task routes without a token', async () => {
    const res = await request(makeApp()).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});

describe('tasks', () => {
  let app: ReturnType<typeof makeApp>;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    app = makeApp();
    token = await signUp(app);
  });

  it('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').set(auth()).send({ title: '  Write README  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write README', status: 'todo', description: null, dueDate: null });
  });

  it('validates input and says which field is wrong', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(auth())
      .send({ title: '', dueDate: '2026-02-31', status: 'later' });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['dueDate', 'status', 'title']);
  });

  it('edits, completes and deletes', async () => {
    const created = await request(app).post('/api/tasks').set(auth()).send({ title: 'One' });
    const id = created.body.id;

    const edited = await request(app).put(`/api/tasks/${id}`).set(auth()).send({ title: 'Two', dueDate: '2026-12-01' });
    expect(edited.body).toMatchObject({ title: 'Two', dueDate: '2026-12-01' });

    const done = await request(app).patch(`/api/tasks/${id}/complete`).set(auth());
    expect(done.body.status).toBe('done');

    expect((await request(app).delete(`/api/tasks/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/tasks/${id}`).set(auth())).status).toBe(404);
  });

  it('filters by status and searches', async () => {
    await request(app).post('/api/tasks').set(auth()).send({ title: 'Buy milk', status: 'todo' });
    await request(app).post('/api/tasks').set(auth()).send({ title: 'Pay rent', status: 'done' });
    await request(app).post('/api/tasks').set(auth()).send({ title: 'Call Sam', description: 'about the milk run' });

    const done = await request(app).get('/api/tasks?status=done').set(auth());
    expect(done.body.map((t: { title: string }) => t.title)).toEqual(['Pay rent']);

    const milk = await request(app).get('/api/tasks?search=MILK&sort=title&order=asc').set(auth());
    expect(milk.body.map((t: { title: string }) => t.title)).toEqual(['Buy milk', 'Call Sam']);

    expect((await request(app).get('/api/tasks?status=nope').set(auth())).status).toBe(400);
  });

  it('sorts by due date with empty dates last', async () => {
    await request(app).post('/api/tasks').set(auth()).send({ title: 'none' });
    await request(app).post('/api/tasks').set(auth()).send({ title: 'late', dueDate: '2026-12-31' });
    await request(app).post('/api/tasks').set(auth()).send({ title: 'soon', dueDate: '2026-11-15' });
    const res = await request(app).get('/api/tasks?sort=dueDate&order=asc').set(auth());
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(['soon', 'late', 'none']);
  });

  it("never shows one user another user's tasks", async () => {
    const created = await request(app).post('/api/tasks').set(auth()).send({ title: 'Private' });
    const other = await signUp(app, 'b@example.com');
    const otherAuth = { Authorization: `Bearer ${other}` };

    expect((await request(app).get('/api/tasks').set(otherAuth)).body).toEqual([]);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(otherAuth)).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${created.body.id}`).set(otherAuth)).status).toBe(404);
  });

  it('returns 400 for a bad id and for broken JSON', async () => {
    expect((await request(app).get('/api/tasks/abc').set(auth())).status).toBe(400);
    const res = await request(app).post('/api/tasks').set(auth()).set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
  });
});
