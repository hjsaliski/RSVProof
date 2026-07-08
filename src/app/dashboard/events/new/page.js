'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    event_date: '',
    checkin_cutoff: '',
    deposit_amount: '5.00',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const depositCents = Math.round(parseFloat(form.deposit_amount) * 100);

    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        organizer_id: user.id,
        name: form.name,
        description: form.description,
        location: form.location,
        event_date: form.event_date,
        checkin_cutoff: form.checkin_cutoff,
        deposit_amount_cents: depositCents,
      })
      .select()
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(`/dashboard/events/${data.id}`);
  }

  return (
    <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1">New event</p>
      <h1 className="font-display text-3xl mb-8">Set the details.</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Event name</label>
          <input
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="field w-full px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="field w-full px-3 py-2"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <input
            required
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            className="field w-full px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Event date and time</label>
          <input
            required
            type="datetime-local"
            value={form.event_date}
            onChange={(e) => update('event_date', e.target.value)}
            className="field w-full px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Check-in cutoff (when no-shows get charged)
          </label>
          <input
            required
            type="datetime-local"
            value={form.checkin_cutoff}
            onChange={(e) => update('checkin_cutoff', e.target.value)}
            className="field w-full px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Deposit amount (USD)</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.50"
            value={form.deposit_amount}
            onChange={(e) => update('deposit_amount', e.target.value)}
            className="field w-full px-3 py-2 font-mono"
          />
        </div>
        {error && <p className="text-clay text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5"
        >
          {loading ? 'Creating...' : 'Create event'}
        </button>
      </form>
    </main>
  );
}
