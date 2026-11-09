import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import type { Repo } from './types';
import { createTaskSchema, credentialsSchema, listQuerySchema, updateTaskSchema } from './validation';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export interface AppOptions {
  jwtSecret: string;
  corsOrigin: string;
  bcryptRounds?: number;
}

export function createApp(repo: Repo, opts: AppOptions) {
  const app = express();
  const rounds = opts.bcryptRounds ?? 10;

  app.use(cors({ origin: opts.corsOrigin }));
  app.use(express.json({ limit: '10kb' }));

  const signToken = (userId: number) => jwt.sign({ sub: String(userId) }, opts.jwtSecret, { expiresIn: '8h' });

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
      const payload = jwt.verify(token, opts.jwtSecret) as jwt.JwtPayload;
      res.locals.userId = Number(payload.sub);
      next();
    } catch {
      next(new HttpError(401, 'Please sign in again'));
    }
  };

  const idParam = (req: Request) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Task id must be a positive whole number');
    return id;
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---- auth ----
  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const hash = await bcrypt.hash(password, rounds);
    const user = await repo.createUser(email, hash);
    if (!user) throw new HttpError(409, 'An account with that email already exists');
    res.status(201).json({ token: signToken(user.id), email: user.email });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await repo.findUserByEmail(email);
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect');
    res.json({ token: signToken(user.id), email: user.email });
  });

  // ---- tasks (all scoped to the signed-in user) ----
  const tasks = express.Router();
  tasks.use(requireAuth);

  tasks.get('/', async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(await repo.listTasks(res.locals.userId, query));
  });

  tasks.post('/', async (req, res) => {
    const input = createTaskSchema.parse(req.body);
    res.status(201).json(await repo.createTask(res.locals.userId, input));
  });

  tasks.get('/:id', async (req, res) => {
    const task = await repo.getTask(res.locals.userId, idParam(req));
    if (!task) throw new HttpError(404, 'Task not found');
    res.json(task);
  });

  tasks.put('/:id', async (req, res) => {
    const input = updateTaskSchema.parse(req.body);
    const task = await repo.updateTask(res.locals.userId, idParam(req), input);
    if (!task) throw new HttpError(404, 'Task not found');
    res.json(task);
  });

  tasks.patch('/:id/complete', async (req, res) => {
    const task = await repo.updateTask(res.locals.userId, idParam(req), { status: 'done' });
    if (!task) throw new HttpError(404, 'Task not found');
    res.json(task);
  });

  tasks.delete('/:id', async (req, res) => {
    const removed = await repo.deleteTask(res.locals.userId, idParam(req));
    if (!removed) throw new HttpError(404, 'Task not found');
    res.status(204).end();
  });

  app.use('/api/tasks', tasks);

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));

  // ---- errors: one shape for everything, { error, details? } ----
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      res.status(400).json({ error: 'Please fix the highlighted fields', details });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Request body is not valid JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side' });
  });

  return app;
}
