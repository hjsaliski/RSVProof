import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// A plain page load succeeding doesn't guarantee the app actually works,
// the database could be unreachable and most pages would still render an
// error state rather than a hard 500. This gives an external uptime
// monitor something more meaningful to check than just "did HTML come
// back," a lightweight real query against Supabase.
export async function GET() {
  try {
    const { error } = await supabaseAdmin.from('events').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'error', database: 'unreachable', detail: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: 'ok', database: 'reachable' });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', detail: err.message },
      { status: 503 }
    );
  }
}