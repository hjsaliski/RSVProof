import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { getOrganizerBusinessName } from '@/lib/getOrganizerBusinessName';

// Reminder window: an attendee is eligible once their event is starting
// within this many hours, and stays eligible until reminded or the event
// is processed. 24 hours is intentionally wide, not narrow, so a single
// once-a-day scheduled run (the only frequency Vercel's free tier allows)
// is guaranteed to catch it, rather than needing hourly precision.
const REMINDER_WINDOW_HOURS = 24;

async function sendReminder(attendee, event, businessName) {
  if (!attendee.email || !resend) return { attendeeId: attendee.id, status: 'skipped_no_email' };

  const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
  const eventDateDisplay = new Date(event.event_date).toLocaleString();

  // Re-attaches a fresh copy of the same check-in code rather than
  // linking out to a separate page, this is meant to work as "another
  // copy of your ticket, in case you lost the first one," same offline
  // reliability as the original confirmation email's attachment.
  const qrPayload = JSON.stringify({ eventId: event.id, token: attendee.qr_token });
  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    width: 400,
    color: { dark: '#1c1b17', light: '#ffffff' },
  });

  // Same file path as the confirmation email, upsert overwrites it, this
  // is just re-ensuring the hosted copy still exists rather than creating
  // a second file, the QR content is identical either way.
  const qrStoragePath = `${attendee.qr_token}.png`;
  await supabaseAdmin.storage
    .from('qr-codes')
    .upload(qrStoragePath, qrBuffer, { contentType: 'image/png', upsert: true });
  const { data: qrPublicUrlData } = supabaseAdmin.storage
    .from('qr-codes')
    .getPublicUrl(qrStoragePath);
  const qrImageUrl = qrPublicUrlData.publicUrl;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: attendee.email,
      subject: `${event.name} is coming up`,
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <div style="border: 1px solid #e5decf; border-radius: 16px; overflow: hidden; background: #ffffff;">
            <div style="padding: 24px;">
              <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f; margin: 0 0 8px;">Reminder</p>
              <h1 style="font-size: 22px; margin: 0 0 4px; color: #1c1b17;">${event.name}</h1>
              ${businessName ? `<p style="font-size: 13px; color: #a39d8c; margin: 0 0 8px;">Hosted by ${businessName}</p>` : ''}
              <p style="color: #5b574c; margin: 0; font-size: 14px;">${eventDateDisplay} &middot; ${event.location}</p>
            </div>
            <div style="border-top: 1px dashed #d8cfb8;"></div>
            <div style="padding: 24px; text-align: center;">
              <p style="font-size: 14px; color: #5b574c; margin: 0 0 16px;">
                Your event is coming up. Check in when you arrive using this
                code, and your ${depositDisplay} hold is released. Miss
                check-in, and it's charged.
              </p>
              <img src="${qrImageUrl}" alt="Your check-in QR code" width="220" height="220" style="display: block; margin: 0 auto;" />
            </div>
          </div>
        </div>
      `,
      // Attachment disabled, same reasoning as the confirmation email,
      // the QR is already visible in the body above. Uncomment to
      // restore the attached copy if that tradeoff ever needs to flip.
      // attachments: [
      //   {
      //     filename: 'check-in-code.png',
      //     content: qrBuffer.toString('base64'),
      //   },
      // ],
    });

    await supabaseAdmin
      .from('attendees')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', attendee.id);

    return { attendeeId: attendee.id, status: 'sent' };
  } catch (err) {
    return { attendeeId: attendee.id, status: 'failed', error: err.message };
  }
}

async function processEvent(event) {
  const { data: eligible } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('event_id', event.id)
    .is('checked_in_at', null)
    .is('reminder_sent_at', null)
    .eq('charge_status', 'pending');

  const businessName = await getOrganizerBusinessName(event.organizer_id);

  const results = [];
  for (const attendee of eligible || []) {
    results.push(await sendReminder(attendee, event, businessName));
  }
  return results;
}

async function runCronSweep() {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: dueEvents, error: dueError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('status', 'active')
    .lte('event_date', windowEnd)
    .gte('event_date', new Date().toISOString());

  if (dueError) {
    return { error: dueError.message };
  }

  const allResults = [];
  for (const event of dueEvents || []) {
    allResults.push({ eventId: event.id, results: await processEvent(event) });
  }

  return { processed: (dueEvents || []).length, allResults };
}

// Vercel's built-in cron scheduler makes a GET request and automatically
// attaches CRON_SECRET as "Authorization: Bearer <CRON_SECRET>". This
// handler matches that format specifically.
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runCronSweep();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { eventId } = body;
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!eventId) {
      return NextResponse.json({ error: 'eventId required for manual trigger' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('organizer_id', userData.user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const results = await processEvent(event);
    return NextResponse.json({ processed: 1, results });
  }

  // Cron path (external scheduler using the custom header).
  const result = await runCronSweep();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}