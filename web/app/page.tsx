'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TaskForm from '@/components/TaskForm';
import TaskItem from '@/components/TaskItem';
import {
  ApiError,
  STATUS_LABELS,
  api,
  clearSession,
  getSession,
  type ListFilters,
  type Status,
  type Task,
  type TaskFormValues,
} from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filters, setFilters] = useState<ListFilters>({ status: '', search: '', sort: 'createdAt', order: 'desc' });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Redirect to sign-in when there is no session.
  useEffect(() => {
    const session = getSession();
    if (!session) router.replace('/login');
    else setEmail(session.email);
  }, [router]);

  // Wait a moment after typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const handleError = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return 'Your session has ended. Please sign in again.';
      }
      return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    },
    [router],
  );

  // Load the list whenever the filters change (or after a reload request).
  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    setLoading(true);
    api
      .listTasks({ ...filters, search: debouncedSearch }, controller.signal)
      .then((data) => {
        setTasks(data);
        setLoadError('');
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setLoadError(handleError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, filters.status, filters.sort, filters.order, debouncedSearch, reloadKey, handleError]);

  const reload = () => setReloadKey((k) => k + 1);

  async function createTask(values: TaskFormValues) {
    await api.createTask(values);
    setMessage(`Added "${values.title.trim()}".`);
    reload();
  }

  async function saveEdit(id: number, values: TaskFormValues) {
    await api.updateTask(id, values);
    setEditingId(null);
    setMessage('Changes saved.');
    reload();
  }

  async function complete(task: Task) {
    setBusyId(task.id);
    try {
      await api.completeTask(task.id);
      setMessage(`Marked "${task.title}" as done.`);
      reload();
    } catch (err) {
      setMessage(handleError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setBusyId(task.id);
    try {
      await api.deleteTask(task.id);
      setMessage(`Deleted "${task.title}".`);
      reload();
    } catch (err) {
      setMessage(handleError(err));
    } finally {
      setBusyId(null);
    }
  }

  function signOut() {
    clearSession();
    router.replace('/login');
  }

  if (!email) return null;

  const filtered = filters.status !== '' || filters.search.trim() !== '';

  return (
    <>
      <header className="topbar">
        <h1>Mini Task Tracker</h1>
        <div className="topbar-user">
          <span className="muted">{email}</span>
          <button type="button" className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main id="main" className="container">
        <section aria-labelledby="new-heading" className="card">
          <h2 id="new-heading">New task</h2>
          <TaskForm onSubmit={createTask} />
        </section>

        <section aria-labelledby="list-heading" className="card">
          <h2 id="list-heading">Your tasks</h2>

          <div className="filters">
            <div className="field">
              <label htmlFor="filter-status">Show</label>
              <select
                id="filter-status"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Status | '' }))}
              >
                <option value="">All statuses</option>
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="filter-search">Search</label>
              <input
                id="filter-search"
                type="search"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Title or description"
              />
            </div>

            <div className="field">
              <label htmlFor="filter-sort">Sort by</label>
              <select
                id="filter-sort"
                value={`${filters.sort}:${filters.order}`}
                onChange={(e) => {
                  const [sort, order] = e.target.value.split(':') as [ListFilters['sort'], ListFilters['order']];
                  setFilters((f) => ({ ...f, sort, order }));
                }}
              >
                <option value="createdAt:desc">Newest first</option>
                <option value="createdAt:asc">Oldest first</option>
                <option value="dueDate:asc">Due soonest</option>
                <option value="dueDate:desc">Due latest</option>
                <option value="title:asc">Title A to Z</option>
                <option value="status:asc">Status</option>
              </select>
            </div>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {message}
          </p>
          {message && (
            <p className="notice" aria-hidden="true">
              {message}
            </p>
          )}

          {loadError && (
            <div className="form-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="btn" onClick={reload}>
                Try again
              </button>
            </div>
          )}

          {loading && tasks.length === 0 && !loadError && <p className="muted">Loading tasks…</p>}

          {!loading && !loadError && tasks.length === 0 && (
            <p className="muted">{filtered ? 'No tasks match those filters.' : 'No tasks yet. Add your first one above.'}</p>
          )}

          <ul className="task-list" aria-busy={loading}>
            {tasks.map((task) => (
              <li key={task.id}>
                {editingId === task.id ? (
                  <div className="task editing">
                    <TaskForm
                      initial={task}
                      autoFocus
                      onSubmit={(v) => saveEdit(task.id, v)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <TaskItem
                    task={task}
                    busy={busyId === task.id}
                    onComplete={() => complete(task)}
                    onEdit={() => setEditingId(task.id)}
                    onDelete={() => remove(task)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
