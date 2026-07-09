import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';

export async function POST(request) {
  const body = await request.json();
  const { eventId, setupIntentId, name, email, phone, inviteToken } = body;

  if (!eventId || !setupIntentId || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

  if (setupIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'Card was not successfully saved' }, { status: 400 });
  }

  const qrToken = randomBytes(16).toString('hex');
  const cancelToken = randomBytes(16).toString('hex');
  let data, error;

  if (inviteToken) {
    // This attendee already exists as an 'invited' row, created by the
    // Eventbrite webhook. Complete that row instead of creating a second
    // one for the same person.
    ({ data, error } = await supabaseAdmin
      .from('attendees')
      .update({
        name,
        phone: phone || null,
        stripe_customer_id: setupIntent.customer,
        stripe_payment_method_id: setupIntent.payment_method,
        qr_token: qrToken,
        cancel_token: cancelToken,
        charge_status: 'pending',
      })
      .eq('invite_token', inviteToken)
      .eq('event_id', eventId)
      .select()
      .single());
  } else {
    ({ data, error } = await supabaseAdmin
      .from('attendees')
      .insert({
        event_id: eventId,
        name,
        email: email || null,
        phone: phone || null,
        stripe_customer_id: setupIntent.customer,
        stripe_payment_method_id: setupIntent.payment_method,
        qr_token: qrToken,
        cancel_token: cancelToken,
        charge_status: 'pending',
      })
      .select()
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const attendeeEmail = email || data.email;

  // Email the QR code as a backup to the on-screen version, so the attendee
  // still has it even if they close the tab or lose signal at the door.
  // This is best-effort: a failed email should never block the signup
  // itself, since the on-screen QR code already works on its own.
  if (attendeeEmail && resend) {
    try {
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('name, event_date, location, deposit_amount_cents, organizer_id')
        .eq('id', eventId)
        .single();

      if (event) {
        const qrPayload = JSON.stringify({ eventId, token: qrToken });
        const qrBuffer = await QRCode.toBuffer(qrPayload, {
          width: 400,
          color: { dark: '#1c1b17', light: '#ffffff' },
        });
        const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
        const eventDateDisplay = new Date(event.event_date).toLocaleString();
        const siteUrl = process.env.EVENTBRITE_REDIRECT_URI
          ? new URL(process.env.EVENTBRITE_REDIRECT_URI).origin
          : '';
        const cancelLink = `${siteUrl}/cancel/${cancelToken}`;

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: attendeeEmail,
          subject: `You're confirmed: ${event.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
              <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f;">Reservation</p>
              <h1 style="font-size: 22px; margin: 0 0 4px;">${event.name}</h1>
              <p style="color: #5b574c; margin: 0 0 2px;">${eventDateDisplay}</p>
              <p style="color: #5b574c; margin: 0 0 16px;">${event.location}</p>
              <div style="background: #fbeecb; border-radius: 10px; padding: 14px; font-size: 14px; margin-bottom: 20px;">
                A ${depositDisplay} hold reserves your spot. Show the attached QR
                code when you check in and nothing is charged. Miss it without
                checking in by the cutoff, and your card is charged ${depositDisplay}.
              </div>
              <p style="font-size: 13px; color: #5b574c;">Your check-in code is attached to this email.</p>
              <p style="font-size: 12px; color: #a39d8c; margin-top: 20px;">
                Can't make it? <a href="${cancelLink}" style="color: #a39d8c;">Cancel your deposit</a>
              </p>
            </div>
          `,
          attachments: [
            {
              filename: 'check-in-code.png',
              content: qrBuffer.toString('base64'),
            },
          ],
        });

        // Notify the organizer too, but only if they've opted in, since a
        // popular event could otherwise mean hundreds of emails to the
        // organizer for something they can just check on their dashboard.
        try {
          const { data: profile } = await supabaseAdmin
            .from('organizer_profiles')
            .select('notify_on_signup')
            .eq('id', event.organizer_id)
            .single();

          if (profile?.notify_on_signup) {
            const { data: organizerData } = await supabaseAdmin.auth.admin.getUserById(event.organizer_id);
            const organizerEmail = organizerData?.user?.email;

            if (organizerEmail) {
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
                to: organizerEmail,
                subject: `New signup: ${event.name}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
                    <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f;">New signup</p>
                    <h1 style="font-size: 20px; margin: 0 0 8px;">${event.name}</h1>
                    <p style="font-size: 14px; margin: 0 0 4px;"><strong>${name}</strong></p>
                    <p style="font-size: 14px; color: #5b574c; margin: 0 0 16px;">${attendeeEmail}${phone ? ` &middot; ${phone}` : ''}</p>
                    <p style="font-size: 13px; color: #5b574c;">They've saved a card for the ${depositDisplay} hold. Nothing's charged unless they don't check in.</p>
                  </div>
                `,
              });
            }
          }
        } catch (organizerEmailError) {
          console.error('Organizer notification email failed to send:', organizerEmailError);
        }
      }
    } catch (emailError) {
      // Swallow the error, the attendee's signup already succeeded and
      // they still have the on-screen QR code as their primary copy.
      console.error('QR email failed to send:', emailError);
    }
  }

  return NextResponse.json({ attendeeId: data.id, qrToken });
}