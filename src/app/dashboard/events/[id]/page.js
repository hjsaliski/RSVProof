'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Colors and labels for each attendee charge_status, used to render a
// small badge instead of raw mono status text, so the state reads at a
// glance instead of needing to parse a code-like word.
function attendeeStatusMeta(status) {
  switch (status) {
    case 'charged':
      return { label: 'Charged', bg: '#fdf2ef', color: 'var(--clay)', dot: 'var(--clay)' };
    case 'not_charged':
      return { label: 'Not charged', bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' };
    case 'invited':
      return { label: 'Invited', bg: '#fbeecb', color: 'var(--marigold-dark)', dot: 'var(--marigold-dark)' };
    case 'cancelled':
      return { label: 'Cancelled', bg: '#f3f4f6', color: 'var(--ink-soft)', dot: '#9ca3af' };
    case 'charge_failed':
      return { label: 'Charge failed', bg: '#fdf2ef', color: 'var(--clay)', dot: 'var(--clay)' };
    case 'pending':
    default:
      return { label: 'Pending', bg: '#f3f4f6', color: 'var(--ink-soft)', dot: '#9ca3af' };
  }
}

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [copiedLink, setCopiedLink] = useState('');
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState('all');
  const [attendeePage, setAttendeePage] = useState(1);
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

  // Sums the exact fee actually taken per charge, not a fresh percentage
  // calculation, so this stays historically accurate even if the fee
  // rate changes later. Attendees charged on the platform account
  // (unconnected organizers) never had a fee applied, so this is 0 for
  // events where nothing routed through a connected account.
  const platformFeeTotalCents = attendees
    .filter((a) => a.charge_status === 'charged')
    .reduce((sum, a) => sum + (a.stripe_application_fee_cents || 0), 0);
  const platformFeeTotal = platformFeeTotalCents / 100;
  const netToOrganizer = revenueProtected - platformFeeTotal;
  const hadConnectedCharges = platformFeeTotalCents > 0;

  // Filtering and pagination for the attendee list, this stays a plain
  // computation (not useMemo) since it sits after this component's early
  // returns for loading/not-found, and hooks can't be called after a
  // conditional return without breaking React's rules of hooks.
  const ATTENDEES_PER_PAGE = 25;
  const searchLower = attendeeSearch.trim().toLowerCase();
  const filteredAttendees = attendees.filter((a) => {
    const matchesSearch =
      !searchLower ||
      a.name?.toLowerCase().includes(searchLower) ||
      a.email?.toLowerCase().includes(searchLower) ||
      a.phone?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    switch (attendeeStatusFilter) {
      case 'checked_in':
        return !!a.checked_in_at;
      case 'not_checked_in':
        return !a.checked_in_at && a.charge_status !== 'cancelled';
      case 'invited':
        return a.charge_status === 'invited';
      case 'charge_failed':
        return a.charge_status === 'charge_failed';
      case 'cancelled':
        return a.charge_status === 'cancelled';
      default:
        return true;
    }
  });
  const totalAttendeePages = Math.max(1, Math.ceil(filteredAttendees.length / ATTENDEES_PER_PAGE));
  const clampedAttendeePage = Math.min(attendeePage, totalAttendeePages);
  const paginatedAttendees = filteredAttendees.slice(
    (clampedAttendeePage - 1) * ATTENDEES_PER_PAGE,
    clampedAttendeePage * ATTENDEES_PER_PAGE
  );

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
          <p className="eyebrow mb-1">Deposits secured</p>
          <p className="font-display text-2xl">{securedDepositCount}/{totalAttendees}</p>
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
          {chargedCount === 0 ? (
            <p className="font-display text-2xl">
              Everyone showed up 🎉
            </p>
          ) : (
            <>
              <p className="font-display text-2xl">
                We recovered <span style={{ color: 'var(--marigold-dark)' }}>${revenueProtected.toFixed(2)}</span> for your event 🎉
              </p>
              <p className="text-xs text-ink-soft mt-2">
                *Gross amount, before Stripe processing and RSVproof service fees.
              </p>
            </>
          )}
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Attendees</h2>
              {attendees.length > 0 && (
                <span className="text-xs text-ink-soft">
                  {filteredAttendees.length} of {attendees.length}
                </span>
              )}
            </div>

            {attendees.length === 0 && (
              <p className="text-sm text-ink-soft">No signups yet.</p>
            )}

            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search name, email, or phone"
                  value={attendeeSearch}
                  onChange={(e) => {
                    setAttendeeSearch(e.target.value);
                    setAttendeePage(1);
                  }}
                  className="field px-3 py-2 text-sm flex-1 min-w-[180px]"
                />
                <select
                  value={attendeeStatusFilter}
                  onChange={(e) => {
                    setAttendeeStatusFilter(e.target.value);
                    setAttendeePage(1);
                  }}
                  className="field px-3 py-2 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="checked_in">Checked in</option>
                  <option value="not_checked_in">Not checked in</option>
                  <option value="invited">Invited, not secured</option>
                  <option value="charge_failed">Charge failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            {attendees.length > 0 && filteredAttendees.length === 0 && (
              <p className="text-sm text-ink-soft">No attendees match this search or filter.</p>
            )}

            <ul className="divide-y divide-line">
              {paginatedAttendees.map((a) => {
                const statusMeta = attendeeStatusMeta(a.charge_status);
                return (
                  <li key={a.id} className="py-3 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-ink-soft">{a.email || a.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {a.checked_in_at ? (
                        <span className="text-xs text-marigold-dark font-medium">
                          Checked in ({a.checked_in_method})
                        </span>
                      ) : a.charge_status === 'cancelled' ? (
                        <span className="text-xs text-ink-soft">Deposit cancelled</span>
                      ) : (
                        <button
                          onClick={() => manualCheckIn(a.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
                        >
                          Mark checked in
                        </button>
                      )}
                      {a.charge_status === 'invited' && (
                        <button
                          onClick={() => resendInvite(a.id)}
                          className="text-xs underline text-ink-soft hover:text-ink"
                        >
                          Resend invite
                        </button>
                      )}
                      {!(a.checked_in_at && a.charge_status === 'pending') && (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: statusMeta.bg, color: statusMeta.color }}
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ background: statusMeta.dot }}
                          />
                          {statusMeta.label}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {filteredAttendees.length > ATTENDEES_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setAttendeePage((p) => Math.max(1, p - 1))}
                  disabled={clampedAttendeePage === 1}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft disabled:opacity-40 hover:border-ink hover:text-ink transition-colors"
                >
                  &larr; Prev
                </button>
                <span className="text-xs text-ink-soft">
                  Page {clampedAttendeePage} of {totalAttendeePages}
                </span>
                <button
                  type="button"
                  onClick={() => setAttendeePage((p) => Math.min(totalAttendeePages, p + 1))}
                  disabled={clampedAttendeePage === totalAttendeePages}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft disabled:opacity-40 hover:border-ink hover:text-ink transition-colors"
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>

        </div>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-3">
            {!event.eventbrite_event_id && (
              <div className="panel p-4">
                <p className="text-xs text-ink-soft mb-1.5">Ticket link</p>
                <p className="text-xs text-ink-soft mb-2">Share this with attendees.</p>
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(scannerLink, 'scanner')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
                >
                  {copiedLink === 'scanner' ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={scannerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
                >
                  Open
                </a>
              </div>
            </div>
            {event.eventbrite_event_id && (
              <p className="text-xs text-ink-soft px-1">
                No RSVproof signup link for this event, attendees RSVP on
                Eventbrite and get invited from there automatically.
              </p>
            )}
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
                  Sends immediately instead of waiting for the next automatic run.
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
                  reminderResult.error ? (
                    <p className="text-sm font-medium mt-3" style={{ color: 'var(--clay)' }}>
                      Failed: {reminderResult.error}
                    </p>
                  ) : (
                    <p className="text-sm font-medium mt-3" style={{ color: '#16a34a' }}>
                      Reminders sent ✓
                    </p>
                  )
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
                  Runs immediately instead of waiting for the next automatic run.
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
                  chargeResult.error ? (
                    <p className="text-sm font-medium mt-3" style={{ color: 'var(--clay)' }}>
                      Failed: {chargeResult.error}
                    </p>
                  ) : (
                    <p className="text-sm font-medium mt-3" style={{ color: '#16a34a' }}>
                      Charges processed ✓
                    </p>
                  )
                )}
              </div>
            </div>
            <div className="panel p-5" style={{ borderColor: 'var(--clay)', borderWidth: '1.5px' }}>

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
        </aside>
      </div>
    </main>
  );
}