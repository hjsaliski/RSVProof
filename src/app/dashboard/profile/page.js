'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const router = useRouter();
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
    }
    setLoading(false);
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
          <h2 className="font-medium mb-2">Payment methods</h2>
          <p className="text-sm text-ink-soft">
            Coming in Phase 3. Once organizer payouts move to automatic transfers,
            you&apos;ll manage your payout account here instead of receiving
            deposits manually.
          </p>
        </div>

        {error && <p className="text-clay text-sm">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save profile'}
        </button>
      </form>
    </main>
  );
}