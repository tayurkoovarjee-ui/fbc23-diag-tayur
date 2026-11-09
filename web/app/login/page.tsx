'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, getSession, saveSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getSession()) router.replace('/');
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    setBusy(true);
    try {
      const res = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      saveSession(res.token, res.email);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(Object.keys(err.fields).length ? '' : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      setBusy(false);
    }
  }

  const registering = mode === 'register';

  return (
    <main id="main" className="auth">
      <h1>{registering ? 'Create an account' : 'Sign in'}</h1>
      <p className="muted">Each account only sees its own tasks.</p>

      <form onSubmit={handleSubmit} noValidate className="task-form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-err' : undefined}
            required
          />
          {errors.email && (
            <p className="field-error" id="email-err">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Password{registering ? ' (at least 8 characters)' : ''}</label>
          <input
            id="password"
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-err' : undefined}
            required
          />
          {errors.password && (
            <p className="field-error" id="password-err">
              {errors.password}
            </p>
          )}
        </div>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'One moment…' : registering ? 'Create account' : 'Sign in'}
          </button>
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              setMode(registering ? 'login' : 'register');
              setErrors({});
              setFormError('');
            }}
          >
            {registering ? 'I already have an account' : 'Create an account instead'}
          </button>
        </div>
      </form>
    </main>
  );
}
