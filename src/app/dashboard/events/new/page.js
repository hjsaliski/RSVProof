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

    // Deposit amount is set afterward on the event's own page, same as
    // events auto-synced from Eventbrite. deposit_enabled stays off by
    // default (its normal column default) until an amount is actually set,
    // the same guard already in place on the event dashboard prevents
    // turning deposits on with nothing configured.
    if (new Date(form.checkin_cutoff) < new Date(form.event_date)) {
      setError('Check-in cutoff can\'t be before the event start time.');
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        organizer_id: user.id,
        name: form.name,
        description: form.description,
        location: form.location,
        // datetime-local inputs give back a plain "YYYY-MM-DDTHH:mm"
        // string with no timezone. new Date() on a string in that exact
        // shape is interpreted as the browser's local time (per the JS
        // spec), so converting through a Date object here and calling
        // toISOString() bakes in the correct UTC-equivalent instant
        // before it reaches Postgres. Sending the raw string instead
        // would let Postgres reinterpret "22:10" as 22:10 UTC rather
        // than 22:10 local, silently shifting the stored time by
        // whatever the organizer's UTC offset happens to be.
        event_date: new Date(form.event_date).toISOString(),
        checkin_cutoff: new Date(form.checkin_cutoff).toISOString(),
        // No Eventbrite data to pull a timezone from here, so the best
        // available signal is wherever this organizer's browser actually
        // is right now, which is what they had in mind when they typed
        // these times in. Used later to format dates correctly in
        // emails regardless of what timezone the server happens to run.
        event_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        deposit_amount_cents: null,
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
        <p className="text-xs text-ink-soft">
          Deposit amount and enabling deposits happen on the event page after
          it&apos;s created.
        </p>
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