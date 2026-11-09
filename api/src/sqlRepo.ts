import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';
import type { Repo, SortField, Status, Task, TaskInput, TaskQuery, User } from './types';

export interface DbConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

export function dbConfigFromEnv(env = process.env): DbConfig {
  return {
    server: env.DB_SERVER ?? 'localhost',
    port: Number(env.DB_PORT ?? 1433),
    user: env.DB_USER ?? 'sa',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'TaskTracker',
    encrypt: (env.DB_ENCRYPT ?? 'true') === 'true',
    trustServerCertificate: (env.DB_TRUST_CERT ?? 'true') === 'true',
  };
}

function poolConfig(c: DbConfig, database: string): sql.config {
  return {
    server: c.server,
    port: c.port,
    user: c.user,
    password: c.password,
    database,
    options: { encrypt: c.encrypt, trustServerCertificate: c.trustServerCertificate },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

/** Creates the database if it is missing, runs sql/schema.sql, and returns a connected repo. */
export async function connectSqlRepo(config: DbConfig): Promise<SqlRepo> {
  if (!/^[A-Za-z0-9_]+$/.test(config.database)) {
    throw new Error('DB_NAME may only contain letters, numbers and underscores');
  }

  const master = await new sql.ConnectionPool(poolConfig(config, 'master')).connect();
  try {
    await master
      .request()
      .input('name', sql.NVarChar, config.database)
      .query(`IF DB_ID(@name) IS NULL EXEC('CREATE DATABASE [${config.database}]')`);
  } finally {
    await master.close();
  }

  const pool = await new sql.ConnectionPool(poolConfig(config, config.database)).connect();
  const schema = fs.readFileSync(path.resolve(__dirname, '../sql/schema.sql'), 'utf8');
  await pool.request().batch(schema);
  return new SqlRepo(pool);
}

// Column names are never taken from the request, only looked up here.
const SORT_COLUMNS: Record<SortField, string> = {
  createdAt: 'CreatedAt',
  dueDate: 'DueDate',
  title: 'Title',
  status: 'Status',
};

const TASK_COLUMNS = 'Id, Title, Description, DueDate, Status, CreatedAt, UpdatedAt';

function toTask(r: any): Task {
  return {
    id: r.Id,
    title: r.Title,
    description: r.Description ?? null,
    dueDate: r.DueDate ? (r.DueDate as Date).toISOString().slice(0, 10) : null,
    status: r.Status as Status,
    createdAt: (r.CreatedAt as Date).toISOString(),
    updatedAt: (r.UpdatedAt as Date).toISOString(),
  };
}

const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

export class SqlRepo implements Repo {
  constructor(private pool: sql.ConnectionPool) {}

  async findUserByEmail(email: string): Promise<User | null> {
    const r = await this.pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT Id, Email, PasswordHash FROM dbo.Users WHERE Email = @email');
    const row = r.recordset[0];
    return row ? { id: row.Id, email: row.Email, passwordHash: row.PasswordHash } : null;
  }

  async createUser(email: string, passwordHash: string): Promise<User | null> {
    try {
      const r = await this.pool
        .request()
        .input('email', sql.NVarChar(255), email)
        .input('hash', sql.NVarChar(100), passwordHash)
        .query('INSERT INTO dbo.Users (Email, PasswordHash) OUTPUT INSERTED.Id VALUES (@email, @hash)');
      return { id: r.recordset[0].Id, email, passwordHash };
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) return null; // unique constraint
      throw err;
    }
  }

  async listTasks(userId: number, q: TaskQuery): Promise<Task[]> {
    const req = this.pool.request().input('userId', sql.Int, userId);
    const where = ['UserId = @userId'];
    if (q.status) {
      req.input('status', sql.VarChar(20), q.status);
      where.push('Status = @status');
    }
    if (q.search) {
      // Escape LIKE wildcards so a search for "50%" means a literal 50%.
      const escaped = q.search.replace(/[\\%_\[]/g, (c) => `\\${c}`);
      req.input('search', sql.NVarChar(210), `%${escaped}%`);
      where.push(`(Title LIKE @search ESCAPE '\\' OR Description LIKE @search ESCAPE '\\')`);
    }
    const col = SORT_COLUMNS[q.sort];
    const dir = q.order === 'asc' ? 'ASC' : 'DESC';
    // Nulls last for both directions, with Id as a stable tie-break.
    const nullsLast = col === 'DueDate' ? 'CASE WHEN DueDate IS NULL THEN 1 ELSE 0 END, ' : '';
    const r = await req.query(
      `SELECT ${TASK_COLUMNS} FROM dbo.Tasks WHERE ${where.join(' AND ')} ORDER BY ${nullsLast}${col} ${dir}, Id DESC`,
    );
    return r.recordset.map(toTask);
  }

  async getTask(userId: number, id: number): Promise<Task | null> {
    const r = await this.pool
      .request()
      .input('userId', sql.Int, userId)
      .input('id', sql.Int, id)
      .query(`SELECT ${TASK_COLUMNS} FROM dbo.Tasks WHERE Id = @id AND UserId = @userId`);
    return r.recordset[0] ? toTask(r.recordset[0]) : null;
  }

  async createTask(userId: number, input: TaskInput): Promise<Task> {
    const r = await this.pool
      .request()
      .input('userId', sql.Int, userId)
      .input('title', sql.NVarChar(200), input.title)
      .input('description', sql.NVarChar(2000), input.description)
      .input('dueDate', sql.Date, toDate(input.dueDate))
      .input('status', sql.VarChar(20), input.status)
      .query(
        `INSERT INTO dbo.Tasks (UserId, Title, Description, DueDate, Status)
         OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Description, INSERTED.DueDate, INSERTED.Status, INSERTED.CreatedAt, INSERTED.UpdatedAt
         VALUES (@userId, @title, @description, @dueDate, @status)`,
      );
    return toTask(r.recordset[0]);
  }

  async updateTask(userId: number, id: number, input: Partial<TaskInput>): Promise<Task | null> {
    const req = this.pool.request().input('userId', sql.Int, userId).input('id', sql.Int, id);
    const sets: string[] = ['UpdatedAt = SYSUTCDATETIME()'];
    if (input.title !== undefined) {
      req.input('title', sql.NVarChar(200), input.title);
      sets.push('Title = @title');
    }
    if (input.description !== undefined) {
      req.input('description', sql.NVarChar(2000), input.description);
      sets.push('Description = @description');
    }
    if (input.dueDate !== undefined) {
      req.input('dueDate', sql.Date, toDate(input.dueDate));
      sets.push('DueDate = @dueDate');
    }
    if (input.status !== undefined) {
      req.input('status', sql.VarChar(20), input.status);
      sets.push('Status = @status');
    }
    const r = await req.query(
      `UPDATE dbo.Tasks SET ${sets.join(', ')}
       OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Description, INSERTED.DueDate, INSERTED.Status, INSERTED.CreatedAt, INSERTED.UpdatedAt
       WHERE Id = @id AND UserId = @userId`,
    );
    return r.recordset[0] ? toTask(r.recordset[0]) : null;
  }

  async deleteTask(userId: number, id: number): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('userId', sql.Int, userId)
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.Tasks WHERE Id = @id AND UserId = @userId');
    return r.rowsAffected[0] > 0;
  }
}
