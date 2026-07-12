'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import QRCode from 'qrcode';
import CardForm from './CardForm';

// Darkens a hex color for hover states, since organizers only pick one
// brand color, not a full hover shade to go with it.
function darken(hex, amount = 0.2) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 255) * (1 - amount)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default function AttendeeSignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center px-6">
          <p className="text-ink-soft">Loading event...</p>
        </main>
      }
    >
      <AttendeeSignupPageInner />
    </Suspense>
  );
}

function AttendeeSignupPageInner() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [event, setEvent] = useState(null);
  const [step, setStep] = useState('form'); // form | payment | done
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((res) => res.json())
      .then((data) => setEvent(data))
      .catch(() => setError('Could not load this event.'));
  }, [id]);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invited-attendee?token=${inviteToken}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.name) {
          setName(data.name);
          setEmail(data.email || '');
          setInvited(true);
        }
      })
      .catch(() => {});
  }, [inviteToken]);

  async function handleContinue(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/create-setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id, name, email, phone }),
    });
    const json = await res.json();
    setLoading(false);

    if (json.error) {
      setError(json.error);
      return;
    }

    // Stripe.js has to know which connected account a SetupIntent lives
    // in before it can confirm it, the same account-context requirement
    // as the server-side calls, just enforced on the browser side this
    // time. Without this, confirming the card fails with "No such
    // setupintent," since the platform-account context can't see an
    // object that was actually created under a connected account.
    setStripePromise(
      loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        json.stripeAccountId ? { stripeAccount: json.stripeAccountId } : undefined
      )
    );
    setClientSecret(json.clientSecret);
    setStep('payment');
  }

  async function handleCardSaved(setupIntentId) {
    setLoading(true);
    const res = await fetch('/api/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id, setupIntentId, name, email, phone, inviteToken }),
    });
    const json = await res.json();
    setLoading(false);

    if (json.error) {
      setError(json.error);
      return;
    }

    const qrPayload = JSON.stringify({ eventId: id, token: json.qrToken });
    const dataUrl = await QRCode.toDataURL(qrPayload, {
      width: 280,
      color: { dark: '#1c1b17', light: '#ffffff' },
    });
    setQrDataUrl(dataUrl);
    setStep('done');
  }

  if (error && !event) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <p className="text-clay text-center max-w-sm">{error}</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <p className="text-ink-soft">Loading event...</p>
      </main>
    );
  }

  if (!event.deposit_enabled || event.status !== 'active') {
    return (
      <main className="flex-1 flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl mb-2">{event.name}</h1>
          <p className="text-ink-soft">Signups for this event are currently closed.</p>
        </div>
      </main>
    );
  }

  const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
  const brandStyle = event.brand_color
    ? { '--marigold': event.brand_color, '--marigold-dark': darken(event.brand_color) }
    : undefined;

  return (
    <main
      className="flex-1 flex items-start md:items-center justify-center px-4 py-12 md:py-0"
      style={brandStyle}
    >
      <div className="w-full max-w-sm">
        {event.logo_url && (
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.logo_url}
              alt={event.organizer_business_name || 'Organizer logo'}
              className="h-12 w-12 rounded-full object-cover border border-line"
            />
          </div>
        )}
        <div className="ticket">
        {/* Top half: what the event actually is */}
        <div className="p-6">
          <p className="eyebrow mb-2">Reservation</p>
          <h1 className="font-display text-2xl mb-1">{event.name}</h1>
          <p className="text-sm text-ink-soft">
            {new Date(event.event_date).toLocaleString()}
          </p>
          <p className="text-sm text-ink-soft mb-3">{event.location}</p>
          {event.description && <p className="text-sm">{event.description}</p>}
        </div>

        <div className="ticket-divider" />

        {/* Bottom half: the deposit and either the form or the QR ticket */}
        <div className="p-6">
          {step === 'done' ? (
            <div className="text-center">
              <p className="eyebrow mb-2">You&apos;re confirmed</p>
              <p className="text-sm text-ink-soft mb-5">
                Show this code when you check in. Your {depositDisplay} hold is
                released once you&apos;re scanned in.
              </p>
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Your check-in QR code" className="mx-auto rounded-lg" />
              )}
              <p className="text-xs text-ink-soft mt-4">
                {email
                  ? "Screenshot this page, or check your email, we sent a copy of your ticket there too."
                  : 'Screenshot this page so you have your check-in code at the event.'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg px-4 py-3 mb-5 text-sm" style={{ background: '#fbeecb' }}>
                <p className="font-semibold mb-1">
                  {invited ? 'One step left to secure your spot' : `A ${depositDisplay} hold reserves your spot`}
                </p>
                <p className="text-ink-soft">
                  {invited && `You RSVP'd on Eventbrite. `}
                  {event.stripe_terms_note ||
                    `We'll save your card but won't charge it. Check in at the event and nothing is charged. Miss it without checking in by the cutoff, and your card is charged ${depositDisplay}.`}
                </p>
              </div>

              {step === 'form' && (
                <form onSubmit={handleContinue} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="field w-full px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field w-full px-3 py-2"
                      disabled={invited}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="field w-full px-3 py-2"
                    />
                  </div>
                  {error && <p className="text-clay text-sm">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-2.5"
                  >
                    {loading ? 'Loading...' : 'Continue to card details'}
                  </button>
                </form>
              )}

              {step === 'payment' && clientSecret && stripePromise && (
                <Elements stripe={stripePromise}>
                  <CardForm
                    clientSecret={clientSecret}
                    depositDisplay={depositDisplay}
                    onSaved={handleCardSaved}
                  />
                </Elements>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </main>
  );
}