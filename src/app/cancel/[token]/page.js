'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function CancelPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/attendees/cancel?token=${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setInfo(json);
      })
      .catch(() => setError('Something went wrong loading this page.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirmCancel() {
    setCancelling(true);
    try {
      const res = await fetch('/api/attendees/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelToken: token }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setDone(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
    setCancelling(false);
  }

  if (loading) {
    return (
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-16 text-center text-ink-soft">
        Loading...
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-16 text-center">
        <p className="text-clay">{error}</p>
      </main>
    );
  }

  if (done || info?.status === 'already_cancelled') {
    return (
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-16 text-center">
        <p className="eyebrow mb-2">Cancelled</p>
        <h1 className="font-display text-2xl mb-3">{info?.eventName}</h1>
        <p className="text-ink-soft">
          Your deposit has been cancelled. Your card will not be charged for this event.
        </p>
      </main>
    );
  }

  if (info?.status === 'checked_in') {
    return (
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">{info.eventName}</h1>
        <p className="text-ink-soft">
          You&apos;re already checked in for this event, there&apos;s nothing to cancel.
        </p>
      </main>
    );
  }

  if (info?.status === 'already_charged') {
    return (
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">{info.eventName}</h1>
        <p className="text-ink-soft">
          This deposit has already been charged and can&apos;t be cancelled here.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-md mx-auto w-full px-6 py-16 text-center">
      <p className="eyebrow mb-2">Cancel your deposit</p>
      <h1 className="font-display text-2xl mb-3">{info?.eventName}</h1>
      <p className="text-ink-soft mb-8">
        This releases your saved card, a {info?.depositDisplay} hold, and cancels
        your spot. This can&apos;t be undone.
      </p>
      <button
        onClick={confirmCancel}
        disabled={cancelling}
        className="px-5 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-50"
        style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
      >
        {cancelling ? 'Cancelling...' : 'Yes, cancel my deposit'}
      </button>
    </main>
  );
}