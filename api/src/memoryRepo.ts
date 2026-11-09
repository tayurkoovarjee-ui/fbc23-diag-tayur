import type { Repo, Task, TaskInput, TaskQuery, User } from './types';

/** In-memory stand-in for the SQL repo. Used by the tests so they run without a database. */
export class MemoryRepo implements Repo {
  private users: User[] = [];
  private tasks: (Task & { userId: number })[] = [];
  private nextUserId = 1;
  private nextTaskId = 1;

  async findUserByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async createUser(email: string, passwordHash: string) {
    if (this.users.some((u) => u.email === email)) return null;
    const user = { id: this.nextUserId++, email, passwordHash };
    this.users.push(user);
    return user;
  }

  async listTasks(userId: number, q: TaskQuery) {
    const needle = q.search?.toLowerCase();
    const rows = this.tasks.filter(
      (t) =>
        t.userId === userId &&
        (!q.status || t.status === q.status) &&
        (!needle || t.title.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle)),
    );
    const dir = q.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[q.sort];
      const bv = b[q.sort];
      if (av === bv) return b.id - a.id;
      if (av === null) return 1; // nulls last, like the SQL version
      if (bv === null) return -1;
      return av < bv ? -dir : dir;
    });
    return rows.map(strip);
  }

  async getTask(userId: number, id: number) {
    const t = this.tasks.find((x) => x.id === id && x.userId === userId);
    return t ? strip(t) : null;
  }

  async createTask(userId: number, input: TaskInput) {
    const now = new Date().toISOString();
    const task = { ...input, id: this.nextTaskId++, userId, createdAt: now, updatedAt: now };
    this.tasks.push(task);
    return strip(task);
  }

  async updateTask(userId: number, id: number, input: Partial<TaskInput>) {
    const t = this.tasks.find((x) => x.id === id && x.userId === userId);
    if (!t) return null;
    Object.assign(t, input, { updatedAt: new Date().toISOString() });
    return strip(t);
  }

  async deleteTask(userId: number, id: number) {
    const i = this.tasks.findIndex((x) => x.id === id && x.userId === userId);
    if (i === -1) return false;
    this.tasks.splice(i, 1);
    return true;
  }
}

function strip(t: Task & { userId: number }): Task {
  const { userId: _userId, ...task } = t;
  return task;
}
