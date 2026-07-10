'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    // Always show the same confirmation regardless of whether the email
    // matched an account. Showing a different message for "no account
    // found" would let someone check which emails are registered.
    if (resetError) {
      setError('Something went wrong. Please try again.');
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <p className="eyebrow mb-2">Check your email</p>
          <h1 className="font-display text-3xl mb-4">Reset link sent.</h1>
          <p className="text-sm text-ink-soft">
            If an account exists for {email}, a password reset link is on its
            way. Click it to set a new password.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-2">Reset your password</p>
        <h1 className="font-display text-3xl mb-8">Forgot password?</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field w-full px-3 py-2"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <p className="text-sm mt-6 text-ink-soft">
          <a href="/login" className="underline">Back to log in</a>
        </p>
      </div>
    </main>
  );
}