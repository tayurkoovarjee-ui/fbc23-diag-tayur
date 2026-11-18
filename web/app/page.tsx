'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import StatusMessage from '@/components/StatusMessage';
import TaskFilters from '@/components/TaskFilters';
import TaskForm from '@/components/TaskForm';
import TaskList from '@/components/TaskList';
import { clearSession, getSession } from '@/lib/api';
import { useTasks } from '@/hooks/useTasks';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  const goToLogin = useCallback(() => router.replace('/login'), [router]);

  // Redirect to sign-in when there is no session.
  useEffect(() => {
    const session = getSession();
    if (!session) goToLogin();
    else setEmail(session.email);
  }, [goToLogin]);

  const t = useTasks(email !== null, goToLogin);

  function signOut() {
    clearSession();
    goToLogin();
  }

  if (!email) return null;

  return (
    <>
      <AppHeader email={email} onSignOut={signOut} />

      <main id="main" className="container">
        <section aria-labelledby="new-heading" className="card">
          <h2 id="new-heading">New task</h2>
          <TaskForm onSubmit={t.createTask} />
        </section>

        <section aria-labelledby="list-heading" className="card">
          <h2 id="list-heading">Your tasks</h2>
          <TaskFilters filters={t.filters} onChange={t.updateFilters} />
          <StatusMessage message={t.message} />
          <TaskList
            tasks={t.tasks}
            loading={t.loading}
            loadError={t.loadError}
            isFiltered={t.isFiltered}
            busyId={t.busyId}
            onRetry={t.reload}
            onSave={t.updateTask}
            onComplete={t.completeTask}
            onDelete={t.deleteTask}
          />
        </section>
      </main>
    </>
  );
}
