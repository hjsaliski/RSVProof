'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords don\'t match.');
      return;
    }

    setLoading(true);

    // If a session from a different account is already active in this
    // browser, signUp() below won't touch it (email confirmation means
    // no new session comes back yet), so whatever page loads next would
    // just show the old, already-logged-in account instead of the one
    // just being created. Clearing it first guarantees a clean slate.
    await supabase.auth.signOut();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Without this, Supabase falls back to the Site URL default
        // (the homepage) after someone clicks the confirmation link,
        // which leaves them on a page with no clear next step. Sending
        // them straight to /login instead means clicking the email link
        // is the one and only path to finishing signup, no duplicate
        // "log in now" button needed anywhere else in this flow.
        emailRedirectTo: `${window.location.origin}/login`,
        // There's no active session at this point (email confirmation
        // is required, so signUp doesn't hand one back yet), which means
        // a direct write to organizer_profiles below would silently fail
        // the security check and never actually save. Storing it in the
        // auth user's own metadata instead works regardless of session
        // state, and gets picked up to create the real profile row the
        // first time this person actually logs in (see login/page.js).
        data: { business_name: businessName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Best-effort only, this succeeds if a session happens to already
      // exist (e.g. email confirmation is ever turned off), and is a
      // harmless no-op otherwise since login.js creates the row for real.
      await supabase.from('organizer_profiles').insert({
        id: data.user.id,
        business_name: businessName,
      });
    }

    setLoading(false);

    // With email confirmation required, signUp succeeds but returns no
    // active session, the account exists but can't log in yet. Pushing
    // straight to /dashboard in that case just bounces back to login
    // with a confusing "Email not confirmed" error and no explanation.
    // Show a clear next step instead, and only redirect straight in if
    // Supabase actually handed back a usable session.
    if (data.session) {
      router.push('/dashboard');
    } else {
      setConfirmationSent(true);
    }
  }

  if (confirmationSent) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <p className="eyebrow mb-2">One more step</p>
          <h1 className="font-display text-3xl mb-4">Confirm your email.</h1>
          <p className="text-sm text-ink-soft">
            We sent a confirmation link to <strong className="text-ink">{email}</strong>.
            Click it to activate your account and log in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-2">Organizer account</p>
        <h1 className="font-display text-3xl mb-8">Set up your first event.</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Business or event name</label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="field w-full px-3 py-2"
            />
          </div>
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
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
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
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        <p className="text-sm mt-6 text-ink-soft">
          Already have an account? <a href="/login" className="underline">Log in</a>
        </p>
      </div>
    </main>
  );
}