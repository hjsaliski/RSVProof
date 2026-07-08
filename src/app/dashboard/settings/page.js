'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const PRESET_COLORS = ['#d99a1b', '#b04632', '#1f2a33', '#2f6b4f', '#5a4fcf'];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [brandColor, setBrandColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [notifyOnSignup, setNotifyOnSignup] = useState(false);
  const [saved, setSaved] = useState(false);

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
      .from('organizer_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setBusinessName(data.business_name || '');
      setBrandColor(data.brand_color || '');
      setLogoUrl(data.logo_url || '');
      setNotifyOnSignup(data.notify_on_signup || false);
    }
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('organizer_profiles')
      .update({
        business_name: businessName,
        brand_color: brandColor || null,
        logo_url: logoUrl || null,
        notify_on_signup: notifyOnSignup,
      })
      .eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;

  return (
    <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1">Settings</p>
      <h1 className="font-display text-3xl mb-2">Your branding.</h1>
      <p className="text-sm text-ink-soft mb-8">
        Shown on every event page attendees see, instead of the default look.
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Business or event name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="field w-full px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input
            type="url"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="field w-full px-3 py-2"
          />
          <p className="text-xs text-ink-soft mt-1">
            Paste a link to an image you already have hosted somewhere (Instagram
            profile picture, your website, etc.). Direct file upload is on the list
            for later.
          </p>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo preview"
              className="mt-2 h-12 w-12 rounded-full object-cover border border-line"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Brand color</label>
          <div className="flex items-center gap-2 mb-2">
            {PRESET_COLORS.map((color) => (
              <button
                type="button"
                key={color}
                onClick={() => setBrandColor(color)}
                className="w-8 h-8 rounded-full border-2"
                style={{
                  background: color,
                  borderColor: brandColor === color ? 'var(--ink)' : 'transparent',
                }}
                aria-label={`Use ${color}`}
              />
            ))}
            <input
              type="text"
              placeholder="#d99a1b"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="field px-3 py-1.5 text-sm font-mono w-28"
            />
          </div>
          <p className="text-xs text-ink-soft">
            Used for the deposit button and confirmation on your event pages.
            Leave blank to use the default marigold.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 pt-2 border-t border-line">
          <div>
            <label className="block text-sm font-medium mb-1">Email me on every signup</label>
            <p className="text-xs text-ink-soft">
              Off by default. For a popular event this can mean a lot of email,
              turn it on only if you want a heads-up per signup instead of
              checking your dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotifyOnSignup((v) => !v)}
            className={`shrink-0 text-sm px-3 py-1 rounded-full font-medium ${
              notifyOnSignup ? 'bg-marigold text-ink' : 'bg-paper-dim text-ink-soft'
            }`}
          >
            {notifyOnSignup ? 'On' : 'Off'}
          </button>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save branding'}
        </button>
      </form>
    </main>
  );
}
