'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      if (signInError.message === 'Email not confirmed') {
        setError('Check your email for a confirmation link before logging in, we sent one when you signed up.');
      } else {
        setError(signInError.message);
      }
      return;
    }

    // Now that there's a real session, make sure the organizer_profiles
    // row actually exists, the signup-time write can't succeed before
    // email confirmation (see signup/page.js), so this is the first
    // point it's guaranteed safe to create it for real. Only fills in
    // business_name from signup metadata if the row is missing entirely,
    // never overwrites anything the person already saved later.
    if (data.user) {
      const { data: existingProfile } = await supabase
        .from('organizer_profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from('organizer_profiles').insert({
          id: data.user.id,
          business_name: data.user.user_metadata?.business_name || '',
        });
      }
    }

    setLoading(false);
    router.push('/dashboard');
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-2">Welcome back</p>
        <h1 className="font-display text-3xl mb-8">Log in.</h1>
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Password</label>
              <a href="/forgot-password" className="text-xs underline text-ink-soft">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full px-3 py-2"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className="text-sm mt-6 text-ink-soft">
          Need an account? <a href="/signup" className="underline">Sign up</a>
        </p>
      </div>
    </main>
  );
}