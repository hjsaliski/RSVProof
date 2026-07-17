'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>}
    >
      <ProfilePageInner />
    </Suspense>
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [currentEmail, setCurrentEmail] = useState('');
  const [email, setEmail] = useState('');
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [userId, setUserId] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [stripeAccountId, setStripeAccountId] = useState('');
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [manualPayoutMethod, setManualPayoutMethod] = useState('');
  const [manualPayoutHandle, setManualPayoutHandle] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handles the two ways Stripe sends the organizer's browser back here
  // after visiting the hosted onboarding flow: "complete" means they
  // finished (though that doesn't guarantee charges are enabled yet,
  // Stripe may still be verifying something, hence re-checking rather
  // than assuming success), "refresh" means their onboarding link expired
  // before they finished, so a fresh one needs to be generated right away.
  useEffect(() => {
    const status = searchParams.get('stripe_onboarding');
    if (status === 'complete') {
      syncStripeStatus();
      router.replace('/dashboard/profile');
    } else if (status === 'refresh') {
      startStripeConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    setUserId(user.id);
    setCurrentEmail(user.email || '');
    setEmail(user.email || '');

    const { data } = await supabase
      .from('organizer_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setBusinessName(data.business_name || '');
      setProfilePictureUrl(data.profile_picture_url || '');
      setStripeAccountId(data.stripe_account_id || '');
      setStripeChargesEnabled(data.stripe_charges_enabled || false);
      setManualPayoutMethod(data.manual_payout_method || '');
      setManualPayoutHandle(data.manual_payout_handle || '');
    }
    setLoading(false);
  }

  async function startStripeConnect() {
    setConnectingStripe(true);
    setStripeError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();

      if (json.error) {
        setStripeError(json.error);
        setConnectingStripe(false);
        return;
      }

      // Full page navigation to Stripe's own hosted onboarding, not a
      // fetch, this leaves the app entirely until Stripe redirects back.
      window.location.href = json.url;
    } catch (err) {
      setStripeError(`Request failed: ${err.message}`);
      setConnectingStripe(false);
    }
  }

  async function syncStripeStatus() {
    setSyncingStripe(true);
    setStripeError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/connect/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();

      if (json.error) {
        setStripeError(json.error);
      } else {
        setStripeChargesEnabled(json.chargesEnabled);
      }
    } catch (err) {
      setStripeError(`Request failed: ${err.message}`);
    }

    setSyncingStripe(false);
  }

  async function handlePictureUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    // Generous but not unlimited, avoids someone accidentally uploading a
    // multi-hundred-MB photo straight from a phone camera.
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB.');
      return;
    }

    setUploadError('');
    setUploadingPicture(true);

    // Fixed filename per user (no extension needed, Supabase serves the
    // correct content-type from what's stored), so re-uploading a new
    // photo replaces the old one instead of accumulating orphaned files
    // in the bucket.
    const path = `${userId}/avatar`;

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      setUploadError(uploadErr.message);
      setUploadingPicture(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    // Cache-busting query param, otherwise the browser (and some CDNs)
    // keep showing the old cached image at that same URL after a
    // re-upload, since the path itself didn't change.
    setProfilePictureUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
    setUploadingPicture(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    setEmailChangePending(false);

    const { data: { user } } = await supabase.auth.getUser();

    // upsert, not update: if this organizer has never saved a profile
    // before, there's no existing row for .update() to match, and it
    // would silently affect zero rows with no error, exactly the "looks
    // saved, reverts on refresh" bug this replaces. upsert creates the
    // row on first save and updates it on every save after that.
    const { error: profileError } = await supabase
      .from('organizer_profiles')
      .upsert(
        {
          id: user.id,
          business_name: businessName,
          profile_picture_url: profilePictureUrl || null,
          manual_payout_method: manualPayoutMethod || null,
          manual_payout_handle: manualPayoutHandle || null,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    // Supabase requires confirming an email change via a link sent to the
    // new address, so this doesn't take effect immediately. currentEmail
    // stays as the address actually in use until that's confirmed.
    if (email && email !== currentEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        setError(emailError.message);
        setSaving(false);
        return;
      }
      setEmailChangePending(true);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;

  return (
    <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1">Profile</p>
      <h1 className="font-display text-3xl mb-2">Your account.</h1>
      <p className="text-sm text-ink-soft mb-8">
        Your identity and branding, separate from any individual event.
      </p>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="space-y-4">
          <h2 className="font-medium">Account</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Name / business name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
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
            />
            {emailChangePending && (
              <p className="text-xs text-marigold-dark mt-1">
                Check {email} for a confirmation link. Your email won&apos;t change until you click it.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Profile picture</label>
            <div className="flex items-center gap-3">
              {profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePictureUrl}
                  alt="Profile preview"
                  className="h-14 w-14 rounded-full object-cover border border-line shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-paper-dim border border-line shrink-0" />
              )}
              <div>
                <label
                  htmlFor="profile-picture-upload"
                  className="inline-block text-sm px-4 py-2 rounded-lg border border-line text-ink cursor-pointer hover:border-ink transition-colors"
                >
                  {uploadingPicture
                    ? 'Uploading...'
                    : profilePictureUrl
                    ? 'Change photo'
                    : 'Upload photo'}
                </label>
                <input
                  id="profile-picture-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePictureUpload}
                  disabled={uploadingPicture}
                  className="hidden"
                />
              </div>
            </div>
            {uploadError && (
              <p className="text-clay text-xs mt-1.5">{uploadError}</p>
            )}
            <p className="text-xs text-ink-soft mt-1.5">
              Optional, just for your own account view. JPG or PNG, up to 5MB.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-line">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Payments</h2>
            {stripeAccountId && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: stripeChargesEnabled ? '#dcfce7' : '#f3f4f6',
                  color: stripeChargesEnabled ? '#16a34a' : 'var(--ink-soft)',
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: stripeChargesEnabled ? '#22c55e' : '#9ca3af' }}
                />
                {stripeChargesEnabled ? 'Connected' : 'Setup incomplete'}
              </span>
            )}
          </div>

          {!stripeAccountId && (
            <>
              <p className="text-sm text-ink-soft mb-3">
                Connect a Stripe account and no-show charges get paid out to
                you directly and automatically, no more manual payouts.
                This is optional, you can keep using RSVproof without it,
                deposits just get collected on your behalf instead until
                you connect.
              </p>
              <button
                type="button"
                onClick={startStripeConnect}
                disabled={connectingStripe}
                className="text-sm px-4 py-2 rounded-lg border border-line text-ink hover:border-ink disabled:opacity-50"
              >
                {connectingStripe ? 'Redirecting...' : 'Connect with Stripe'}
              </button>
            </>
          )}

          {stripeAccountId && !stripeChargesEnabled && (
            <>
              <p className="text-sm text-ink-soft mb-3">
                You started connecting a Stripe account, but setup isn&apos;t
                finished yet, Stripe may still need a few more details from
                you before charges can go through it.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startStripeConnect}
                  disabled={connectingStripe}
                  className="text-sm px-4 py-2 rounded-lg border border-line text-ink hover:border-ink disabled:opacity-50"
                >
                  {connectingStripe ? 'Redirecting...' : 'Finish setup'}
                </button>
                <button
                  type="button"
                  onClick={syncStripeStatus}
                  disabled={syncingStripe}
                  className="text-sm px-4 py-2 rounded-lg text-ink-soft underline disabled:opacity-50"
                >
                  {syncingStripe ? 'Checking...' : 'Check status'}
                </button>
              </div>
            </>
          )}

          {stripeAccountId && stripeChargesEnabled && (
            <p className="text-sm text-ink-soft">
              Deposits and no-show charges on connected events go straight
              to your own Stripe account, and payouts happen automatically
              on Stripe&apos;s side.
            </p>
          )}

          {stripeError && <p className="text-clay text-sm mt-2">{stripeError}</p>}

          {!stripeChargesEnabled && (
            <div className="pt-4 mt-4 border-t border-line">
              <p className="text-sm text-ink-soft mb-3">
                Or, skip Stripe for now and just give us your Venmo or
                PayPal, we&apos;ll send your share manually after each event.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={manualPayoutMethod}
                  onChange={(e) => setManualPayoutMethod(e.target.value)}
                  className="field px-3 py-2 text-sm"
                >
                  <option value="">Choose a method</option>
                  <option value="venmo">Venmo</option>
                  <option value="paypal">PayPal</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="@yourhandle"
                  value={manualPayoutHandle}
                  onChange={(e) => setManualPayoutHandle(e.target.value)}
                  className="field px-3 py-2 text-sm flex-1 min-w-[160px]"
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-clay text-sm">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save profile'}
        </button>
      </form>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full mt-3 text-sm px-4 py-2.5 rounded-lg border border-line text-ink-soft hover:border-ink hover:text-ink transition-colors"
      >
        Log out
      </button>

      <p className="text-xs text-ink-soft text-center mt-4">
        Want to delete your account? Email{' '}
        <a href="mailto:info@rsvproof.com" className="underline hover:text-ink">
          info@rsvproof.com
        </a>{' '}
        and we&apos;ll take care of it.
      </p>
    </main>
  );
}