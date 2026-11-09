export type Status = 'todo' | 'in_progress' | 'done';

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFormValues {
  title: string;
  description: string;
  dueDate: string;
  status: Status;
}

export interface ListFilters {
  status: Status | '';
  search: string;
  sort: 'createdAt' | 'dueDate' | 'title' | 'status';
  order: 'asc' | 'desc';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tt_token';
const EMAIL_KEY = 'tt_email';

// The token lives in localStorage so a refresh keeps you signed in. See the README for the trade-off.
export function getSession(): { token: string; email: string } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const email = localStorage.getItem(EMAIL_KEY);
    return token && email ? { token, email } : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, email: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* storage blocked: the user will just have to sign in again after a refresh */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* nothing to clear */
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const session = getSession();
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && auth) clearSession();
    const fields: Record<string, string> = {};
    for (const d of body?.details ?? []) fields[d.field] = d.message;
    throw new ApiError(res.status, body?.error ?? 'Something went wrong', fields);
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; email: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
  register: (email: string, password: string) =>
    request<{ token: string; email: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }, false),

  listTasks: (f: ListFilters, signal?: AbortSignal) => {
    const qs = new URLSearchParams({ sort: f.sort, order: f.order });
    if (f.status) qs.set('status', f.status);
    if (f.search.trim()) qs.set('search', f.search.trim());
    return request<Task[]>(`/api/tasks?${qs}`, { signal });
  },
  createTask: (v: TaskFormValues) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(v) }),
  updateTask: (id: number, v: TaskFormValues) => request<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(v) }),
  completeTask: (id: number) => request<Task>(`/api/tasks/${id}/complete`, { method: 'PATCH' }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
};
