'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [chargeResult, setChargeResult] = useState(null);
  const [charging, setCharging] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  useEffect(() => {
    setSiteUrl(window.location.origin);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    setEvent(eventData);

    const { data: attendeeData } = await supabase
      .from('attendees')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });
    setAttendees(attendeeData || []);

    setLoading(false);
  }

  async function toggleDeposits() {
    setSaving(true);
    await supabase
      .from('events')
      .update({ deposit_enabled: !event.deposit_enabled })
      .eq('id', id);
    await load();
    setSaving(false);
  }

  async function manualCheckIn(attendeeId) {
    await supabase
      .from('attendees')
      .update({ checked_in_at: new Date().toISOString(), checked_in_method: 'manual' })
      .eq('id', attendeeId);
    await load();
  }

  async function runNoShowCharges() {
    if (!confirm('This will charge every attendee who has not checked in. Continue?')) return;
    setCharging(true);
    setChargeResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/charge-no-shows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ eventId: id }),
    });
    const json = await res.json();
    setChargeResult(json);
    setCharging(false);
    await load();
  }

  async function sendReminders() {
    setSendingReminders(true);
    setReminderResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/send-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId: id }),
      });
      const json = await res.json();
      setReminderResult(json);
    } catch (err) {
      setReminderResult({ error: `Request failed: ${err.message}` });
    }

    setSendingReminders(false);
    await load();
  }

  async function deleteEvent() {
    const confirmed = confirm(
      `Delete "${event.name}"? This also deletes all ${attendees.length} attendee signups and cannot be undone.`
    );
    if (!confirmed) return;

    await supabase.from('events').delete().eq('id', id);
    router.push('/dashboard');
  }

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;
  if (!event) return <main className="flex-1 px-6 py-10">Event not found.</main>;

  const signupLink = `${siteUrl}/e/${event.id}`;
  const scannerLink = `${siteUrl}/scan/${event.id}`;
  const checkedInCount = attendees.filter((a) => a.checked_in_at).length;
  const chargedCount = attendees.filter((a) => a.charge_status === 'charged').length;
  const pendingCount = attendees.filter((a) => a.charge_status === 'pending').length;
  const totalAttendees = attendees.length;
  const showUpRate = totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 100) : null;
  const depositAmount = event.deposit_amount_cents / 100;
  const revenueProtected = chargedCount * depositAmount;
  const atRisk = pendingCount * depositAmount;

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1">Event</p>
      <h1 className="font-display text-3xl mb-1">{event.name}</h1>
      <p className="text-sm text-ink-soft mb-8">
        {new Date(event.event_date).toLocaleString()} &middot; {event.location}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="panel p-4">
          <p className="eyebrow mb-1">Signups</p>
          <p className="font-display text-2xl">{totalAttendees}</p>
        </div>
        <div className="panel p-4">
          <p className="eyebrow mb-1">Show-up rate</p>
          <p className="font-display text-2xl">{showUpRate === null ? '—' : `${showUpRate}%`}</p>
        </div>
        <div className="panel p-4">
          <p className="eyebrow mb-1">
            {event.status === 'charges_processed' ? 'Recovered' : 'RSVP $'}
          </p>
          <p className="font-display text-2xl font-mono">
            ${(event.status === 'charges_processed' ? revenueProtected : atRisk).toFixed(2)}
          </p>
        </div>
        <div className="panel p-4">
          <p className="eyebrow mb-1">Checked in</p>
          <p className="font-display text-2xl">{checkedInCount}/{totalAttendees}</p>
        </div>
      </div>

      <div className="panel p-5 mb-5 space-y-4">
        <h2 className="font-medium">Settings</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-soft">Deposits enabled for this event</span>
          <button
            onClick={toggleDeposits}
            disabled={saving}
            className={`text-sm px-3 py-1 rounded-full font-medium ${
              event.deposit_enabled ? 'bg-marigold text-ink' : 'bg-paper-dim text-ink-soft'
            }`}
          >
            {event.deposit_enabled ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Deposit amount</span>
          <span className="font-mono font-medium">${(event.deposit_amount_cents / 100).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Check-in cutoff</span>
          <span className="font-mono font-medium">{new Date(event.checkin_cutoff).toLocaleString()}</span>
        </div>
        <p className="text-xs text-ink-soft border-t border-line pt-3">
          Anyone not checked in by the cutoff will be charged the deposit amount.
        </p>
      </div>

      <div className="panel p-5 mb-5 space-y-3">
        <h2 className="font-medium">Share these links</h2>
        <div>
          <p className="text-sm text-ink-soft mb-1">Signup link (post this on Instagram, etc.)</p>
          <code className="font-mono text-xs bg-paper-dim px-3 py-2 rounded-lg block break-all">
            {signupLink}
          </code>
        </div>
        <div>
          <p className="text-sm text-ink-soft mb-1">Door scanner (open this on your phone at the event)</p>
          <code className="font-mono text-xs bg-paper-dim px-3 py-2 rounded-lg block break-all">
            {scannerLink}
          </code>
        </div>
      </div>

      <div className="panel p-5 mb-5">
        <h2 className="font-medium mb-2">No-show charges</h2>
        <p className="text-sm text-ink-soft mb-4">
          Run this after the check-in cutoff has passed. It charges the deposit for
          everyone who was not checked in, and marks everyone else as not charged.
          This only needs to be run once per event.
        </p>
        <button
          onClick={runNoShowCharges}
          disabled={charging || event.status === 'charges_processed'}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--clay)' }}
        >
          {event.status === 'charges_processed'
            ? 'Already processed'
            : charging
            ? 'Processing...'
            : 'Run no-show charges'}
        </button>
        {chargeResult && (
          <pre className="font-mono text-xs bg-paper-dim p-3 rounded-lg mt-3 overflow-auto">
            {JSON.stringify(chargeResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="panel p-5 mb-5">
        <h2 className="font-medium mb-2">Reminders</h2>
        <p className="text-sm text-ink-soft mb-4">
          Emails anyone who hasn&apos;t checked in and hasn&apos;t been reminded yet,
          once the event is starting within 24 hours. Safe to click more than
          once, each attendee only ever gets one reminder.
        </p>
        <button
          onClick={sendReminders}
          disabled={sendingReminders}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--marigold-dark)' }}
        >
          {sendingReminders ? 'Sending...' : 'Send reminders now'}
        </button>
        {reminderResult && (
          <pre className="font-mono text-xs bg-paper-dim p-3 rounded-lg mt-3 overflow-auto">
            {JSON.stringify(reminderResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="panel p-5 mb-5">
        <h2 className="font-medium mb-3">
          Attendees <span className="text-ink-soft font-normal">({checkedInCount} / {attendees.length} checked in)</span>
        </h2>
        {attendees.length === 0 && (
          <p className="text-sm text-ink-soft">No signups yet.</p>
        )}
        <ul className="divide-y divide-line">
          {attendees.map((a) => (
            <li key={a.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-ink-soft">{a.email || a.phone}</p>
              </div>
              <div className="text-right">
                {a.checked_in_at ? (
                  <span className="text-xs text-marigold-dark font-medium">
                    Checked in ({a.checked_in_method})
                  </span>
                ) : (
                  <button
                    onClick={() => manualCheckIn(a.id)}
                    className="text-xs underline text-ink-soft"
                  >
                    Mark checked in
                  </button>
                )}
                <p className="text-xs text-ink-soft mt-1 font-mono">{a.charge_status}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel p-5" style={{ borderColor: 'var(--clay)' }}>
        <h2 className="font-medium mb-2">Delete this event</h2>
        <p className="text-sm text-ink-soft mb-4">
          Permanently removes this event and every attendee signup attached to it,
          including their saved card references. This cannot be undone.
        </p>
        <button
          onClick={deleteEvent}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold border"
          style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
        >
          Delete event
        </button>
      </div>
    </main>
  );
}
