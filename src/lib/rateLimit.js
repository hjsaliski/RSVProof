import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Lightweight rate limiting backed by Supabase rather than an in-memory
// counter, since Vercel serverless functions don't share memory across
// invocations or instances, an in-memory Map would silently do nothing
// under real traffic. This adds one read+write per call, which is a
// fine tradeoff at this scale versus standing up a separate service.
//
// Usage: const { limited } = await checkRateLimit(`create-setup-intent:${ip}`, 5, 10);
// limits to 5 calls per 10-minute window for that key.
export async function checkRateLimit(key, maxAttempts, windowMinutes) {
  const now = new Date();
  const { data: existing } = await supabaseAdmin
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('rate_limits').insert({ key, count: 1, window_start: now.toISOString() });
    return { limited: false };
  }

  const windowStart = new Date(existing.window_start);
  const windowExpired = now - windowStart > windowMinutes * 60 * 1000;

  if (windowExpired) {
    await supabaseAdmin
      .from('rate_limits')
      .update({ count: 1, window_start: now.toISOString() })
      .eq('key', key);
    return { limited: false };
  }

  if (existing.count >= maxAttempts) {
    return { limited: true };
  }

  await supabaseAdmin
    .from('rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', key);
  return { limited: false };
}

// Vercel sets x-forwarded-for on every request, first entry is the real
// client IP. Falls back to a constant so a missing header degrades to
// "everyone shares one bucket" rather than throwing.
export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}