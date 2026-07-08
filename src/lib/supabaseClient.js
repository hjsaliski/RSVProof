import { createClient } from '@supabase/supabase-js';

// Used in the browser (dashboard pages, login). Relies on RLS to keep
// organizers scoped to their own data. Never put the service role key here.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
