import { createClient } from '@supabase/supabase-js';

// Server-only client. Bypasses RLS with the service role key, so this must
// NEVER be imported into a client component or exposed to the browser.
// Only use this inside src/app/api/** route handlers.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);
