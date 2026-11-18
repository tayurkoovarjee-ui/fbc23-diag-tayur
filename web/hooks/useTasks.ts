'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, clearSession, type ListFilters, type Task, type TaskFormValues } from '@/lib/api';

const DEFAULT_FILTERS: ListFilters = { status: '', search: '', sort: 'createdAt', order: 'desc' };

/**
 * Everything the task page needs from the API: the list, the filters that shape it,
 * and the actions that change it. The page itself only decides what to draw.
 *
 * `onSessionExpired` runs when the API answers 401, so the page can send the user to sign in.
 */
export function useTasks(enabled: boolean, onSessionExpired: () => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const updateFilters = useCallback((patch: Partial<ListFilters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Wait a moment after typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // A 401 means the token is gone or expired: forget it, then let the page redirect.
  const describeError = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        onSessionExpired();
        return 'Your session has ended. Please sign in again.';
      }
      return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    },
    [onSessionExpired],
  );

  // Load the list whenever the filters change (or after a reload request).
  useEffect(() => {
    if (!enabled) return;
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
        setLoadError(describeError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // `filters.search` is left out on purpose: the debounced copy triggers the reload instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filters.status, filters.sort, filters.order, debouncedSearch, reloadKey, describeError]);

  // The form shows field errors itself, so create and update rethrow after handling a 401.
  async function createTask(values: TaskFormValues) {
    try {
      await api.createTask(values);
    } catch (err) {
      describeError(err);
      throw err;
    }
    setMessage(`Added "${values.title.trim()}".`);
    reload();
  }

  async function updateTask(id: number, values: TaskFormValues) {
    try {
      await api.updateTask(id, values);
    } catch (err) {
      describeError(err);
      throw err;
    }
    setMessage('Changes saved.');
    reload();
  }

  // Complete and delete have no form to show errors in, so failures become the status message.
  async function runOnTask(task: Task, action: () => Promise<unknown>, success: string) {
    setBusyId(task.id);
    try {
      await action();
      setMessage(success);
      reload();
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  const completeTask = (task: Task) => runOnTask(task, () => api.completeTask(task.id), `Marked "${task.title}" as done.`);
  const deleteTask = (task: Task) => runOnTask(task, () => api.deleteTask(task.id), `Deleted "${task.title}".`);

  const isFiltered = filters.status !== '' || filters.search.trim() !== '';

  return {
    tasks,
    loading,
    loadError,
    message,
    busyId,
    filters,
    isFiltered,
    updateFilters,
    reload,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
  };
}
