'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Friendly labels for each event source. Falls back to a capitalized
// version of the raw value for any future platform not listed here yet,
// so a new integration never shows up as a blank or broken label.
const SOURCE_LABELS = {
  standalone: 'Standalone',
  eventbrite: 'Eventbrite',
};

function sourceLabel(source) {
  return SOURCE_LABELS[source] || (source ? source[0].toUpperCase() + source.slice(1) : 'Standalone');
}

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Only show a filter pill for a platform that actually has events, so
  // this doesn't clutter the dashboard with empty categories before any
  // third-party integrations are connected.
  const availableSources = useMemo(() => {
    const set = new Set(events.map((e) => e.source || 'standalone'));
    return Array.from(set);
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    return events.filter((e) => (e.source || 'standalone') === activeFilter);
  }, [events, activeFilter]);

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="eyebrow mb-1">Organizer dashboard</p>
          <h1 className="font-display text-3xl">Your events</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="/dashboard/settings" className="text-sm underline text-ink-soft">
            Branding
          </a>
          <button onClick={handleLogout} className="text-sm underline text-ink-soft">
            Log out
          </button>
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

      {events.length > 0 && availableSources.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`text-sm px-3 py-1.5 rounded-full font-medium ${
              activeFilter === 'all' ? 'bg-ink text-paper' : 'bg-paper-dim text-ink-soft'
            }`}
          >
            All
          </button>
          {availableSources.map((source) => (
            <button
              key={source}
              onClick={() => setActiveFilter(source)}
              className={`text-sm px-3 py-1.5 rounded-full font-medium ${
                activeFilter === source ? 'bg-ink text-paper' : 'bg-paper-dim text-ink-soft'
              }`}
            >
              {sourceLabel(source)}
            </button>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <div className="panel p-8 text-center text-ink-soft">
          No events yet. Create your first one, or connect a platform you already use.
        </div>
      )}

      {events.length > 0 && visibleEvents.length === 0 && (
        <div className="panel p-8 text-center text-ink-soft">
          No events from this source yet.
        </div>
      )}

      <ul className="space-y-3">
        {visibleEvents.map((event) => (
          <li key={event.id} className="panel p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <a href={`/dashboard/events/${event.id}`} className="font-medium hover:underline">
                  {event.name}
                </a>
                <span className="eyebrow" style={{ fontSize: '0.65rem' }}>
                  {sourceLabel(event.source)}
                </span>
              </div>
              <p className="text-sm text-ink-soft mt-1">
                {new Date(event.event_date).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm">${(event.deposit_amount_cents / 100).toFixed(2)}</p>
              <p className={`text-xs mt-1 ${event.deposit_enabled ? 'text-marigold-dark' : 'text-ink-soft'}`}>
                {event.deposit_enabled ? 'Deposits on' : 'Deposits off'}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
