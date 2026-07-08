import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const inviteToken = searchParams.get('token');

  if (!inviteToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('attendees')
    .select('name, email, charge_status')
    .eq('invite_token', inviteToken)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
