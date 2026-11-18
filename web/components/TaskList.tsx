'use client';

import { useState } from 'react';
import type { Task, TaskFormValues } from '@/lib/api';
import TaskForm from './TaskForm';
import TaskItem from './TaskItem';

interface Props {
  tasks: Task[];
  loading: boolean;
  loadError: string;
  isFiltered: boolean;
  busyId: number | null;
  onRetry: () => void;
  onSave: (id: number, values: TaskFormValues) => Promise<void>;
  onComplete: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/** The list plus its loading, error and empty states. Knows which row is being edited, nothing about the API. */
export default function TaskList({ tasks, loading, loadError, isFiltered, busyId, onRetry, onSave, onComplete, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  async function save(id: number, values: TaskFormValues) {
    await onSave(id, values);
    setEditingId(null);
  }

  function confirmDelete(task: Task) {
    if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) onDelete(task);
  }

  return (
    <>
      {loadError && (
        <div className="form-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {loading && tasks.length === 0 && !loadError && <p className="muted">Loading tasks…</p>}

      {!loading && !loadError && tasks.length === 0 && (
        <p className="muted">{isFiltered ? 'No tasks match those filters.' : 'No tasks yet. Add your first one above.'}</p>
      )}

      <ul className="task-list" aria-busy={loading}>
        {tasks.map((task) => (
          <li key={task.id}>
            {editingId === task.id ? (
              <div className="task editing">
                <TaskForm
                  initial={task}
                  autoFocus
                  onSubmit={(values) => save(task.id, values)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <TaskItem
                task={task}
                busy={busyId === task.id}
                onComplete={() => onComplete(task)}
                onEdit={() => setEditingId(task.id)}
                onDelete={() => confirmDelete(task)}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
