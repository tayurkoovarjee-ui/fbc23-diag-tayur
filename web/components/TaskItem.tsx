'use client';

import { STATUS_LABELS, type Task } from '@/lib/api';

interface Props {
  task: Task;
  busy: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TaskItem({ task, busy, onComplete, onEdit, onDelete }: Props) {
  const overdue = task.dueDate !== null && task.status !== 'done' && task.dueDate < todayLocal();

  return (
    <article className={`task ${task.status === 'done' ? 'task-done' : ''}`} aria-busy={busy}>
      <div className="task-head">
        <h3>{task.title}</h3>
        <span className={`badge badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
      </div>

      {task.description && <p className="task-desc">{task.description}</p>}

      {task.dueDate && (
        <p className={`task-due ${overdue ? 'overdue' : ''}`}>
          Due <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time>
          {overdue && ' (overdue)'}
        </p>
      )}

      <div className="actions">
        {task.status !== 'done' && (
          <button type="button" className="btn" onClick={onComplete} disabled={busy} aria-label={`Mark "${task.title}" as done`}>
            Complete
          </button>
        )}
        <button type="button" className="btn" onClick={onEdit} disabled={busy} aria-label={`Edit "${task.title}"`}>
          Edit
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy} aria-label={`Delete "${task.title}"`}>
          Delete
        </button>
      </div>
    </article>
  );
}
