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
  const [depositInput, setDepositInput] = useState('');
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [chargeResult, setChargeResult] = useState(null);
  const [charging, setCharging] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [remindInvitedResult, setRemindInvitedResult] = useState(null);
  const [remindingInvited, setRemindingInvited] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [cancelEventResult, setCancelEventResult] = useState(null);
  const [eventbriteConnected, setEventbriteConnected] = useState(false);
  const [eventbriteEvents, setEventbriteEvents] = useState([]);
  const [loadingEbEvents, setLoadingEbEvents] = useState(false);
  const [linkingId, setLinkingId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

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
    setDepositInput(
      eventData?.deposit_amount_cents != null ? (eventData.deposit_amount_cents / 100).toFixed(2) : ''
    );

    const { data: attendeeData } = await supabase
      .from('attendees')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });
    setAttendees(attendeeData || []);

    const { data: connection } = await supabase
      .from('eventbrite_connections')
      .select('organizer_id')
      .eq('organizer_id', user.id)
      .single();
    setEventbriteConnected(!!connection);

    setLoading(false);
  }

  async function loadEventbriteEvents() {
    setLoadingEbEvents(true);
    setLinkError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/eventbrite/events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();

      if (json.error) {
        setLinkError(json.error);
      } else {
        setEventbriteEvents(json.events || []);
      }
    } catch (err) {
      setLinkError(`Request failed: ${err.message}`);
    }

    setLoadingEbEvents(false);
  }

  async function linkEventbrite() {
    if (!linkingId) return;
    setLinking(true);
    setLinkError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/eventbrite/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId: id, eventbriteEventId: linkingId }),
      });
      const json = await res.json();

      if (json.error) {
        setLinkError(json.error);
      } else {
        await load();
      }
    } catch (err) {
      setLinkError(`Request failed: ${err.message}`);
    }

    setLinking(false);
  }

  async function toggleDeposits() {
    // Auto-created events from Eventbrite start with no deposit amount at
    // all, since there's nothing on Eventbrite's side to pull one from.
    // Blocking this here prevents accidentally going live with a $0.00
    // hold, which invites people without actually protecting the event.
    if (!event.deposit_enabled && (!event.deposit_amount_cents || event.deposit_amount_cents <= 0)) {
      alert('Set a deposit amount below before turning deposits on.');
      return;
    }
    setSaving(true);
    await supabase
      .from('events')
      .update({ deposit_enabled: !event.deposit_enabled })
      .eq('id', id);
    await load();
    setSaving(false);
  }

  async function saveDepositAmount() {
    const cents = Math.round(parseFloat(depositInput) * 100);
    if (isNaN(cents) || cents < 0) {
      alert('Enter a valid deposit amount.');
      return;
    }
    setSavingDeposit(true);
    await supabase
      .from('events')
      .update({ deposit_amount_cents: cents })
      .eq('id', id);
    await load();
    setSavingDeposit(false);
  }

  async function manualCheckIn(attendeeId) {
    const attendee = attendees.find((a) => a.id === attendeeId);
    if (attendee?.charge_status === 'cancelled') return;

    await supabase
      .from('attendees')
      .update({ checked_in_at: new Date().toISOString(), checked_in_method: 'manual' })
      .eq('id', attendeeId);
    await load();
  }

  async function resendInvite(attendeeId) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/attendees/resend-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ attendeeId }),
    });
    const json = await res.json();
    if (json.error) {
      alert(`Send failed: ${json.error}`);
    } else {
      alert('Invite email sent, check the inbox.');
    }
  }

  async function remindAllInvited() {
    const invited = attendees.filter((a) => a.charge_status === 'invited');
    if (invited.length === 0) return;

    setRemindingInvited(true);
    setRemindInvitedResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const results = [];

    // Reuses the same resend-invite route as the individual button, just
    // looped across everyone still stuck at "invited" for this event.
    for (const a of invited) {
      try {
        const res = await fetch('/api/attendees/resend-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ attendeeId: a.id }),
        });
        const json = await res.json();
        results.push({ name: a.name, ...json });
      } catch (err) {
        results.push({ name: a.name, error: err.message });
      }
    }

    setRemindInvitedResult({
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => r.error).length,
      results,
    });
    setRemindingInvited(false);
  }

  async function cancelEvent() {
    const confirmed = confirm(
      `Cancel "${event.name}"? Every attendee's deposit will be released and they'll be notified by email. This can't be undone.`
    );
    if (!confirmed) return;

    setCancellingEvent(true);
    setCancelEventResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/events/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.error) {
        alert(`Cancellation failed: ${json.error}`);
      } else {
        setCancelEventResult(json);
      }
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    }

    setCancellingEvent(false);
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
  const invitedCount = attendees.filter((a) => a.charge_status === 'invited').length;
  const totalAttendees = attendees.length;
  const securedCount = totalAttendees - invitedCount;
  const conversionRate = totalAttendees > 0 ? Math.round((securedCount / totalAttendees) * 100) : null;
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
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-soft">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              className="field px-2 py-1 text-sm font-mono w-20"
            />
            <button
              type="button"
              onClick={saveDepositAmount}
              disabled={savingDeposit}
              className="text-xs underline text-ink-soft disabled:opacity-50"
            >
              {savingDeposit ? 'Saving...' : 'Save'}
            </button>
          </div>
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
        <h2 className="font-medium">Eventbrite</h2>
        {event.eventbrite_event_id ? (
          <p className="text-sm text-marigold-dark">
            Linked. New RSVPs on Eventbrite will automatically get invited to
            secure a deposit here.
          </p>
        ) : !eventbriteConnected ? (
          <p className="text-sm text-ink-soft">
            Connect your Eventbrite account first, from{' '}
            <a href="/dashboard/connect" className="underline">Connect a platform</a>,
            then come back here to link this specific event.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Link this event to one of your Eventbrite events, so new RSVPs
              there automatically get invited to secure a deposit here.
            </p>
            {eventbriteEvents.length === 0 ? (
              <button
                onClick={loadEventbriteEvents}
                disabled={loadingEbEvents}
                className="text-sm px-4 py-2 rounded-lg border border-line text-ink-soft disabled:opacity-50"
              >
                {loadingEbEvents ? 'Loading...' : 'Load my Eventbrite events'}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={linkingId}
                  onChange={(e) => setLinkingId(e.target.value)}
                  className="field px-3 py-2 text-sm"
                >
                  <option value="">Select an Eventbrite event</option>
                  {eventbriteEvents.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button
                  onClick={linkEventbrite}
                  disabled={!linkingId || linking}
                  className="btn-marigold text-sm px-4 py-2 disabled:opacity-50"
                >
                  {linking ? 'Linking...' : 'Link'}
                </button>
              </div>
            )}
            {linkError && <p className="text-clay text-sm">{linkError}</p>}
          </div>
        )}
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
        <h2 className="font-medium mb-2">Invited, not yet secured</h2>
        <p className="text-sm text-ink-soft mb-4">
          People who RSVP&apos;d on a connected platform like Eventbrite but
          haven&apos;t secured their deposit yet. Sends the same invite email
          they already got once.
        </p>
        <p className="font-display text-2xl mb-4">{invitedCount}</p>
        <button
          onClick={remindAllInvited}
          disabled={remindingInvited || invitedCount === 0}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--marigold-dark)' }}
        >
          {remindingInvited ? 'Sending...' : `Remind all invited (${invitedCount})`}
        </button>
        {remindInvitedResult && (
          <pre className="font-mono text-xs bg-paper-dim p-3 rounded-lg mt-3 overflow-auto">
            {JSON.stringify(remindInvitedResult, null, 2)}
          </pre>
        )}
      </div>

      {event.eventbrite_event_id && (
        <div className="panel p-5 mb-5">
          <h2 className="font-medium mb-2">Eventbrite RSVP conversion</h2>
          <p className="text-sm text-ink-soft mb-4">
            Before RSVproof, every one of these RSVPs was a no-show risk with
            nothing backing it. Here&apos;s how many actually secured a deposit.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="eyebrow mb-1">RSVP&apos;d on Eventbrite</p>
              <p className="font-display text-2xl">{totalAttendees}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Secured a deposit</p>
              <p className="font-display text-2xl">{securedCount}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Conversion</p>
              <p className="font-display text-2xl">
                {conversionRate === null ? '—' : `${conversionRate}%`}
              </p>
            </div>
          </div>
        </div>
      )}

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
                ) : a.charge_status === 'cancelled' ? (
                  <span className="text-xs text-ink-soft">Deposit cancelled</span>
                ) : (
                  <button
                    onClick={() => manualCheckIn(a.id)}
                    className="text-xs underline text-ink-soft"
                  >
                    Mark checked in
                  </button>
                )}
                {a.charge_status === 'invited' && (
                  <button
                    onClick={() => resendInvite(a.id)}
                    className="text-xs underline text-ink-soft block mt-1"
                  >
                    Resend invite
                  </button>
                )}
                <p className="text-xs text-ink-soft mt-1 font-mono">{a.charge_status}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {event.eventbrite_event_id ? (
        <div className="panel p-5 mb-5" style={{ borderColor: 'var(--clay)' }}>
          <h2 className="font-medium mb-2">Cancel this event</h2>
          <p className="text-sm text-ink-soft">
            This event was created on Eventbrite, so that&apos;s where it needs
            to be cancelled too. Cancel it there and it&apos;ll sync here
            automatically, releasing every attendee&apos;s deposit hold and
            notifying them, no extra step needed on your end.
          </p>
        </div>
      ) : (
        <div className="panel p-5 mb-5" style={{ borderColor: 'var(--clay)' }}>
          <h2 className="font-medium mb-2">Cancel this event</h2>
          <p className="text-sm text-ink-soft mb-4">
            Releases every attendee&apos;s deposit hold and emails them that the
            event was cancelled. The event and its history stay on your
            dashboard, just marked cancelled. Use this if the event itself
            isn&apos;t happening anymore.
          </p>
          <button
            onClick={cancelEvent}
            disabled={cancellingEvent || event.status === 'cancelled'}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-50"
            style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
          >
            {event.status === 'cancelled'
              ? 'Already cancelled'
              : cancellingEvent
              ? 'Cancelling...'
              : 'Cancel event'}
          </button>
          {cancelEventResult && (
            <p className="text-sm text-marigold-dark mt-3">
              Cancelled. {cancelEventResult.notified} of {cancelEventResult.totalAttendees} attendees notified by email.
            </p>
          )}
        </div>
      )}

      <div className="panel p-5" style={{ borderColor: 'var(--clay)' }}>
        <h2 className="font-medium mb-2">Delete this event</h2>
        <p className="text-sm text-ink-soft mb-4">
          Permanently removes this event and every attendee signup attached to
          it, including their saved card references. This cannot be undone,
          and unlike cancelling, no one is notified. Only use this for an
          event that never really happened, like a test, not a real event
          you&apos;re calling off, use Cancel above for that.
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