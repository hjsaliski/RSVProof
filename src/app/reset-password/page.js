'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Clicking the reset link in the email establishes a temporary session
    // automatically, this just confirms that session actually exists before
    // showing the form, rather than letting someone land here with nothing
    // and hit a confusing error only after typing a new password.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasValidSession(!!session);
      setCheckingSession(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  if (checkingSession) {
    return <main className="flex-1 px-6 py-16 text-center text-ink-soft">Loading...</main>;
  }

  if (!hasValidSession) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <p className="eyebrow mb-2">Link expired</p>
          <h1 className="font-display text-3xl mb-4">This link isn&apos;t valid.</h1>
          <p className="text-sm text-ink-soft mb-6">
            Password reset links only work once and expire after a while.
            Request a new one to continue.
          </p>
          <a href="/forgot-password" className="btn-primary inline-block py-2.5 px-6">
            Request a new link
          </a>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <p className="eyebrow mb-2">Success</p>
          <h1 className="font-display text-3xl mb-4">Password updated.</h1>
          <p className="text-sm text-ink-soft">Taking you to your dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-2">Set a new password</p>
        <h1 className="font-display text-3xl mb-8">Reset password.</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field w-full px-3 py-2"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </main>
  );
}