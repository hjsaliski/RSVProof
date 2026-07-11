import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Returns the organizer's business name for a given organizer id, or null
// if they haven't set one. Centralized here since organizer_profiles and
// events have no foreign key between them (both reference auth.users
// independently), so every email-sending path needs this same lookup,
// this avoids five near-identical copies of the same query drifting out
// of sync with each other over time.
export async function getOrganizerBusinessName(organizerId) {
  if (!organizerId) return null;

  const { data } = await supabaseAdmin
    .from('organizer_profiles')
    .select('business_name')
    .eq('id', organizerId)
    .single();

  return data?.business_name || null;
}