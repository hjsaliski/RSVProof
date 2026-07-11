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
  const [savingNotify, setSavingNotify] = useState(false);
  const [copiedLink, setCopiedLink] = useState('');
  const [depositInput, setDepositInput] = useState('');
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [depositSaved, setDepositSaved] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [chargeResult, setChargeResult] = useState(null);
  const [charging, setCharging] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [remindInvitedResult, setRemindInvitedResult] = useState(null);
  const [remindingInvited, setRemindingInvited] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [cancelEventResult, setCancelEventResult] = useState(null);
  const [disputeCount, setDisputeCount] = useState(0);
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

    const { count: disputesCount } = await supabase
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    setDisputeCount(disputesCount || 0);

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

  async function toggleNotifyOnSignup() {
    setSavingNotify(true);
    await supabase
      .from('events')
      .update({ notify_on_signup: !event.notify_on_signup })
      .eq('id', id);
    await load();
    setSavingNotify(false);
  }

  async function copyToClipboard(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(key);
      setTimeout(() => setCopiedLink(''), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Could not copy automatically, select and copy the link manually.');
    }
  }

  async function saveDepositAmount() {
    const cents = Math.round(parseFloat(depositInput) * 100);
    if (isNaN(cents) || cents < 0) {
      alert('Enter a valid deposit amount.');
      // Revert to the last saved value rather than leaving a broken
      // number sitting in the field.
      setDepositInput(event.deposit_amount_cents != null ? (event.deposit_amount_cents / 100).toFixed(2) : '');
      return;
    }

    // Skip the write entirely if nothing actually changed, no point
    // hitting the database just because they clicked in and back out.
    if (cents === event.deposit_amount_cents) return;

    setSavingDeposit(true);
    await supabase
      .from('events')
      .update({ deposit_amount_cents: cents })
      .eq('id', id);
    await load();
    setSavingDeposit(false);
    setDepositSaved(true);
    setTimeout(() => setDepositSaved(false), 1500);
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
  const failedChargeCount = attendees.filter((a) => a.charge_status === 'charge_failed').length;
  const pendingCount = attendees.filter((a) => a.charge_status === 'pending').length;
  const invitedCount = attendees.filter((a) => a.charge_status === 'invited').length;
  const totalAttendees = attendees.length;
  const securedCount = totalAttendees - invitedCount;
  const securedDepositCount = attendees.filter((a) =>
    ['pending', 'charged', 'not_charged'].includes(a.charge_status)
  ).length;
  const conversionRate = totalAttendees > 0 ? Math.round((securedCount / totalAttendees) * 100) : null;
  const showUpRate = totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 100) : null;
  const depositAmount = event.deposit_amount_cents / 100;
  const revenueProtected = chargedCount * depositAmount;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1">Event</p>
      <h1 className="font-display text-3xl mb-1">{event.name}</h1>
      <p className="text-sm text-ink-soft mb-8">
        {new Date(event.event_date).toLocaleString()} &middot; {event.location}
      </p>

      {(failedChargeCount > 0 || disputeCount > 0) && (
        <div className="panel p-4 mb-5" style={{ borderColor: 'var(--clay)', background: '#fdf2ef' }}>
          {failedChargeCount > 0 && (
            <p className="text-sm" style={{ color: 'var(--clay)' }}>
              {failedChargeCount} charge{failedChargeCount > 1 ? 's' : ''} failed for this event.
              Check Stripe for the reason, this could mean an expired or
              declined card.
            </p>
          )}
          {disputeCount > 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--clay)' }}>
              {disputeCount} dispute{disputeCount > 1 ? 's' : ''} opened against a charge from this
              event. Check Stripe for details and respond before the
              deadline shown there.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="panel p-4">
          <p className="eyebrow mb-1">Signups</p>
          <p className="font-display text-2xl">{totalAttendees}</p>
        </div>
        <div className="panel p-4">
          {event.status === 'charges_processed' ? (
            <>
              <p className="eyebrow mb-1">Recovered</p>
              <p className="font-display text-2xl font-mono">${revenueProtected.toFixed(2)}</p>
            </>
          ) : (
            <>
              <p className="eyebrow mb-1">Deposits secured</p>
              <p className="font-display text-2xl">{pendingCount}/{totalAttendees}</p>
            </>
          )}
        </div>
        <div className="panel p-4">
          <p className="eyebrow mb-1">Checked in</p>
          <p className="font-display text-2xl">{checkedInCount}/{totalAttendees}</p>
        </div>
        <div className="panel p-4">
          <p className="eyebrow mb-1">Show-up rate</p>
          <p className="font-display text-2xl">{showUpRate === null ? '—' : `${showUpRate}%`}</p>
        </div>
      </div>

      {event.status === 'charges_processed' && (
        <div className="panel p-6 mb-5 text-center">
          <p className="text-sm text-ink-soft mb-1">
            {totalAttendees} signups, {securedDepositCount} secured a deposit, {chargedCount} didn&apos;t show.
          </p>
          <p className="font-display text-2xl">
            We recovered <span style={{ color: 'var(--marigold-dark)' }}>${revenueProtected.toFixed(2)}</span> for your event 🎉
          </p>
          <p className="text-xs text-ink-soft mt-2">
            *Gross amount, before Stripe processing and RSVproof service fees.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className="panel p-5 space-y-4">
            <h2 className="font-medium">Settings</h2>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-ink-soft block">Deposits enabled for this event</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: event.deposit_enabled ? '#16a34a' : 'var(--ink-soft)' }}
                >
                  {event.deposit_enabled ? 'On' : 'Off'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={event.deposit_enabled}
                onClick={toggleDeposits}
                disabled={saving}
                className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: event.deposit_enabled ? '#22c55e' : '#d1d5db' }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-150"
                  style={{ transform: event.deposit_enabled ? 'translateX(22px)' : 'translateX(4px)' }}
                />
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
                  onBlur={saveDepositAmount}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur();
                    if (e.key === 'Escape') {
                      setDepositInput(event.deposit_amount_cents != null ? (event.deposit_amount_cents / 100).toFixed(2) : '');
                      e.target.blur();
                    }
                  }}
                  className="deposit-amount-input font-mono font-medium text-sm w-20 px-2 py-1 rounded-md border bg-white text-right outline-none focus:shadow-sm transition-shadow duration-150"
                  style={{ borderColor: 'var(--line)', color: '#16a34a' }}
                />
                {savingDeposit && <span className="text-xs text-ink-soft">Saving...</span>}
                {depositSaved && (
                  <span className="text-xs" style={{ color: '#16a34a' }}>Saved</span>
                )}
              </div>
            </div>
            <style>{`
              .deposit-amount-input::-webkit-outer-spin-button,
              .deposit-amount-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
              }
              .deposit-amount-input {
                -moz-appearance: textfield;
              }
            `}</style>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Check-in cutoff</span>
              <span className="font-mono font-medium">{new Date(event.checkin_cutoff).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <div>
                <span className="text-sm text-ink-soft block">Email me on every signup</span>
                <span className="text-xs text-ink-soft">
                  Off by default, for a popular event this can mean a lot of email.
                </span>
              </div>
              <button
                type="button"
                onClick={toggleNotifyOnSignup}
                disabled={savingNotify}
                className={`shrink-0 text-sm px-3 py-1 rounded-full font-medium disabled:opacity-50 ${
                  event.notify_on_signup ? 'bg-marigold text-ink' : 'bg-paper-dim text-ink-soft'
                }`}
              >
                {event.notify_on_signup ? 'On' : 'Off'}
              </button>
            </div>
            <p className="text-xs text-ink-soft border-t border-line pt-3">
              Anyone not checked in by the cutoff will be charged the deposit amount.
            </p>
          </div>

          <div className="panel p-5 space-y-3">
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

          <div className="panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Manage this event</h2>
              <a href="/dashboard/guide#reminders" className="text-xs underline text-ink-soft">
                Full guide &rarr;
              </a>
            </div>

            <div className="pb-5 mb-5 border-b border-line">
              <h3 className="text-sm font-semibold mb-1">Reminders <span className="text-ink-soft font-normal">(automatic)</span></h3>
              <p className="text-sm text-ink-soft mb-3">
                Sends immediately instead of waiting for today&apos;s scheduled run.
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

            <div className="pb-5 mb-5 border-b border-line">
              <h3 className="text-sm font-semibold mb-1">Invited, not yet secured <span className="text-ink-soft font-normal">(manual only)</span></h3>
              <p className="text-sm text-ink-soft mb-3">
                RSVP&apos;d on a connected platform, but hasn&apos;t secured a deposit yet.
              </p>
              <p className="font-display text-2xl mb-3">{invitedCount}</p>
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

            <div>
              <h3 className="text-sm font-semibold mb-1">No-show charges <span className="text-ink-soft font-normal">(automatic)</span></h3>
              <p className="text-sm text-ink-soft mb-3">
                Runs immediately instead of waiting for today&apos;s scheduled run.
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
          </div>

          {event.eventbrite_event_id && (
            <div className="panel p-5">
              <h2 className="font-medium mb-2">Eventbrite conversion</h2>
              <p className="text-sm text-ink-soft mb-4">
                Of the signups shown above, here&apos;s how many actually secured
                a deposit instead of staying a no-show risk with nothing backing it.
              </p>
              <div className="grid grid-cols-2 gap-3">
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

          <div className="panel p-5">
            <h2 className="font-medium mb-3">Attendees</h2>
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
                    <p
                      className="text-xs mt-1 font-mono"
                      style={a.charge_status === 'charge_failed' ? { color: 'var(--clay)', fontWeight: 600 } : { color: 'var(--ink-soft)' }}
                    >
                      {a.charge_status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5" style={{ borderColor: 'var(--clay)', borderWidth: '1.5px' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--clay)' }}>Danger zone</h2>

            <div className="pb-5 mb-5 border-b" style={{ borderColor: 'var(--clay)' }}>
              <h3 className="text-sm font-semibold mb-1">Cancel this event</h3>
              <p className="text-sm text-ink-soft mb-3">
                Releases every attendee&apos;s deposit hold and emails them that the
                event was cancelled. The event and its history stay on your
                dashboard, just marked cancelled.
              </p>
              {event.eventbrite_event_id && (
                <p className="text-sm text-ink-soft mb-3 border-l-2 pl-3" style={{ borderColor: 'var(--clay)' }}>
                  This event is linked to Eventbrite. Cancelling here only cancels
                  the deposit side, it does not cancel the event or tickets on
                  Eventbrite. If you also cancel or delete this event on
                  Eventbrite, you&apos;ll need to cancel it here separately too,
                  since syncing between the two isn&apos;t fully reliable yet.
                </p>
              )}
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

            <div>
              <h3 className="text-sm font-semibold mb-1">Delete this event</h3>
              <p className="text-sm text-ink-soft mb-3">
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
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-3">
            {!event.eventbrite_event_id && (
              <div className="panel p-4">
                <p className="text-xs text-ink-soft mb-1.5">Signup link</p>
                <p className="text-xs text-ink-soft mb-2">Post this on Instagram, etc.</p>
                <code className="font-mono text-xs bg-paper-dim px-3 py-2 rounded-lg block break-all mb-2">
                  {signupLink}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(signupLink, 'signup')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
                >
                  {copiedLink === 'signup' ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}
            <div className="panel p-4">
              <p className="text-xs text-ink-soft mb-1.5">Door scanner</p>
              <p className="text-xs text-ink-soft mb-2">Open this on your phone at the event.</p>
              <code className="font-mono text-xs bg-paper-dim px-3 py-2 rounded-lg block break-all mb-2">
                {scannerLink}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(scannerLink, 'scanner')}
                className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
              >
                {copiedLink === 'scanner' ? 'Copied' : 'Copy link'}
              </button>
            </div>
            {event.eventbrite_event_id && (
              <p className="text-xs text-ink-soft px-1">
                No RSVproof signup link for this event, attendees RSVP on
                Eventbrite and get invited from there automatically.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}