'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const STATUS_MESSAGES = {
  connected: { text: 'Eventbrite connected.', tone: 'success' },
  denied: { text: 'Connection cancelled, nothing was changed.', tone: 'neutral' },
  expired: { text: 'That connection attempt expired, try again.', tone: 'error' },
  error: { text: 'Something went wrong connecting Eventbrite, try again.', tone: 'error' },
};

const OTHER_PLATFORMS = [
  { name: 'Partiful', status: 'Planned' },
  { name: 'RSVPify', status: 'Planned' },
];

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>}>
      <ConnectPageInner />
    </Suspense>
  );
}

function ConnectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const statusParam = searchParams.get('eventbrite');
  const statusMessage = statusParam ? STATUS_MESSAGES[statusParam] : null;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('eventbrite_connections')
      .select('*')
      .eq('organizer_id', user.id)
      .single();

    setConnection(data || null);
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch('/api/eventbrite/authorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();

    if (json.authorizeUrl) {
      window.location.href = json.authorizeUrl;
    } else {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Eventbrite? Events already connected will stop receiving new signups automatically.')) return;
    setDisconnecting(true);

    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/eventbrite/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    setConnection(null);
    setDisconnecting(false);
  }

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;

  return (
    <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1">Connections</p>
      <h1 className="font-display text-3xl mb-2">Connect a platform.</h1>
      <p className="text-sm text-ink-soft mb-6">
        Already posting events somewhere else? Connect it here so a deposit
        gets added automatically after someone RSVPs there, no need to build
        a second event by hand.
      </p>

      {statusMessage && (
        <div
          className="rounded-lg px-4 py-3 mb-6 text-sm font-medium"
          style={{
            background: statusMessage.tone === 'success' ? '#fbeecb' : '#f0ebdf',
            color: statusMessage.tone === 'error' ? 'var(--clay)' : 'var(--ink)',
          }}
        >
          {statusMessage.text}
        </div>
      )}

      <ul className="space-y-3">
        <li className="panel p-5 flex items-center justify-between">
          <div>
            <p className="font-medium">Eventbrite</p>
            {connection ? (
              <p className="text-xs text-marigold-dark mt-1">
                Connected as {connection.eventbrite_email || connection.eventbrite_user_id}
              </p>
            ) : (
              <p className="text-xs text-ink-soft mt-1">Not connected</p>
            )}
          </div>
          {connection ? (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm px-4 py-2 rounded-lg border border-line text-ink-soft disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-marigold text-sm px-4 py-2 disabled:opacity-50"
            >
              {connecting ? 'Redirecting...' : 'Connect'}
            </button>
          )}
        </li>

        {OTHER_PLATFORMS.map((platform) => (
          <li key={platform.name} className="panel p-5 flex items-center justify-between">
            <span className="font-medium">{platform.name}</span>
            <span className="text-xs px-3 py-1 rounded-full bg-paper-dim text-ink-soft font-medium">
              {platform.status}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-ink-soft mt-8">
        In the meantime, creating an event directly here works exactly the
        same way, you&apos;ll get a link to share wherever you already post.
      </p>
    </main>
  );
}
