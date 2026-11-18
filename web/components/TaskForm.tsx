'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, STATUS_LABELS, type Status, type Task, type TaskFormValues } from '@/lib/api';

interface Props {
  initial?: Task;
  autoFocus?: boolean;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  onCancel?: () => void;
}

const EMPTY: TaskFormValues = { title: '', description: '', dueDate: '', status: 'todo' };

export default function TaskForm({ initial, autoFocus, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<TaskFormValues>(
    initial
      ? { title: initial.title, description: initial.description ?? '', dueDate: initial.dueDate ?? '', status: initial.status }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useRef(`f${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = 'Title is required';
    if (values.title.length > 200) next.title = 'Title must be 200 characters or fewer';
    if (values.description.length > 2000) next.description = 'Description must be 2000 characters or fewer';
    setErrors(next);
    if (Object.keys(next).length) {
      titleRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await onSubmit(values);
      if (!initial) {
        setValues(EMPTY);
        titleRef.current?.focus();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(Object.keys(err.fields).length ? '' : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const fieldProps = (name: string) => ({
    id: `${uid}-${name}`,
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${uid}-${name}-err` : undefined,
  });
  const fieldError = (name: string) =>
    errors[name] ? (
      <p className="field-error" id={`${uid}-${name}-err`}>
        {errors[name]}
      </p>
    ) : null;

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${uid}-title`}>Title</label>
        <input
          {...fieldProps('title')}
          ref={titleRef}
          type="text"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={220}
          required
        />
        {fieldError('title')}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-description`}>Description (optional)</label>
        <textarea
          {...fieldProps('description')}
          rows={3}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
        {fieldError('description')}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${uid}-dueDate`}>Due date (optional)</label>
          <input {...fieldProps('dueDate')} type="date" value={values.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          {fieldError('dueDate')}
        </div>

        <div className="field">
          <label htmlFor={`${uid}-status`}>Status</label>
          <select {...fieldProps('status')} value={values.status} onChange={(e) => set('status', e.target.value as Status)}>
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {fieldError('status')}
        </div>
      </div>

      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add task'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
