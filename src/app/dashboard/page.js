'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// Friendly labels for each event source. Falls back to a capitalized
// version of the raw value for any future platform not listed here yet,
// so a new integration never shows up as a blank or broken label.
const SOURCE_LABELS = {
  standalone: 'RSVproof',
  eventbrite: 'Eventbrite',
};

function sourceLabel(source) {
  return SOURCE_LABELS[source] || (source ? source[0].toUpperCase() + source.slice(1) : 'RSVproof');
}

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (!error) setEvents(data);
      setLoading(false);
    }
    load();
  }, [router]);

  // Only show a filter pill for a platform that actually has events, so
  // this doesn't clutter the dashboard with empty categories before any
  // third-party integrations are connected.
  const availableSources = useMemo(() => {
    const set = new Set(events.map((e) => e.source || 'standalone'));
    return Array.from(set);
  }, [events]);

  const visibleEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => {
        const matchesSource = activeFilter === 'all' || (e.source || 'standalone') === activeFilter;
        const isPast = new Date(e.event_date) < now;
        const matchesTime =
          timeFilter === 'all' ||
          (timeFilter === 'active' && !isPast) ||
          (timeFilter === 'past' && isPast);
        return matchesSource && matchesTime;
      })
      .map((e) => ({ ...e, isPast: new Date(e.event_date) < now }))
      .sort((a, b) => {
        // Upcoming events always sort before past ones, regardless of
        // date math, so "what's coming up" stays at the top rather than
        // getting buried under an old event that happens to sort earlier
        // in a pure chronological order.
        if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
        // Within upcoming: soonest first. Within past: most recent first,
        // so a still-relevant last-week event isn't pushed below one from
        // months ago.
        return a.isPast
          ? new Date(b.event_date) - new Date(a.event_date)
          : new Date(a.event_date) - new Date(b.event_date);
      });
  }, [events, activeFilter, timeFilter]);

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="eyebrow mb-1">Organizer dashboard</p>
          <h1 className="font-display text-3xl">Your events</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/guide"
            className="text-sm px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
          >
            How to guide
          </a>
          <a
            href="/dashboard/profile"
            className="text-sm px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
          >
            Profile
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <a href="/dashboard/events/new" className="btn-marigold inline-block px-5 py-2.5">
          + Create event
        </a>
        <a
          href="/dashboard/connect"
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold border border-line text-ink hover:border-ink"
        >
          + Connect a platform
        </a>
      </div>

      {events.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Show</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'past', label: 'Past' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTimeFilter(opt.key)}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                  timeFilter === opt.key ? 'bg-ink text-paper' : 'bg-paper-dim text-ink-soft hover:bg-paper-dim/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {availableSources.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Platform</span>
              <button
                onClick={() => setActiveFilter('all')}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                  activeFilter === 'all' ? 'bg-ink text-paper' : 'bg-paper-dim text-ink-soft hover:bg-paper-dim/70'
                }`}
              >
                All
              </button>
              {availableSources.map((source) => (
                <button
                  key={source}
                  onClick={() => setActiveFilter(source)}
                  className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                    activeFilter === source ? 'bg-ink text-paper' : 'bg-paper-dim text-ink-soft hover:bg-paper-dim/70'
                  }`}
                >
                  {sourceLabel(source)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {events.length === 0 && (
        <div className="panel p-8 text-center text-ink-soft">
          No events yet. Create your first one, or connect a platform you already use.
        </div>
      )}

      {events.length > 0 && visibleEvents.length === 0 && (
        <div className="panel p-8 text-center text-ink-soft">
          No events match the selected filters.
        </div>
      )}

      <ul className="space-y-3">
        {visibleEvents.map((event) => (
          <li key={event.id}>
            <Link
              href={`/dashboard/events/${event.id}`}
              className="panel p-5 flex items-center justify-between hover:border-ink transition-colors duration-150"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{event.name}</span>
                  <span className="eyebrow" style={{ fontSize: '0.65rem' }}>
                    {sourceLabel(event.source)}
                  </span>
                </div>
                <p className="text-sm text-ink-soft mt-1">
                  {new Date(event.event_date).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm mb-1.5">${(event.deposit_amount_cents / 100).toFixed(2)}</p>
                <div
                  className="flex items-center justify-end gap-1.5"
                  style={event.isPast ? { opacity: 0.45 } : undefined}
                >
                  {event.deposit_enabled ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                  <span
                    className="text-xs font-medium"
                    style={{ color: event.deposit_enabled ? '#16a34a' : 'var(--ink-soft)' }}
                  >
                    Deposits {event.deposit_enabled ? 'on' : 'off'}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}