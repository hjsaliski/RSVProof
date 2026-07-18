import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { getOrganizerBusinessName } from '@/lib/getOrganizerBusinessName';
import { getOrganizerStripeContext } from '@/lib/getOrganizerStripeContext';

export async function POST(request) {
  const body = await request.json();
  const { eventId, setupIntentId, name, email, phone, inviteToken } = body;

  if (!eventId || !setupIntentId || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Event and organizer context has to be looked up before retrieving the
  // SetupIntent, not after. A SetupIntent created under a connected
  // account's context is invisible from the platform account, retrieving
  // it requires passing that exact same { stripeAccount } option, so we
  // need to know which account context to use before we can even fetch
  // it, not the other way around.
  const { data: event, error: eventFetchError } = await supabaseAdmin
    .from('events')
    .select('name, event_date, location, deposit_amount_cents, organizer_id, notify_on_signup')
    .eq('id', eventId)
    .single();

  if (eventFetchError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const { connected, stripeAccountId } = await getOrganizerStripeContext(event.organizer_id);
  const requestOptions = connected ? { stripeAccount: stripeAccountId } : undefined;

  // retrieve() takes three arguments (id, params, options), unlike
  // create() which only takes two (params, options). The connected
  // account context has to go in that third options slot, passing it as
  // the second argument gets misread as a query param, hence the
  // "unknown parameter: stripeAccount" error this replaces.
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {}, requestOptions);

  if (setupIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'Card was not successfully saved' }, { status: 400 });
  }

  const qrToken = randomBytes(16).toString('hex');
  const cancelToken = randomBytes(16).toString('hex');
  let data, error;

  // stripe_account_id is snapshotted onto the attendee row itself here,
  // rather than looked up fresh from the organizer at charge time. If an
  // organizer connects Stripe mid-event, older signups still need to be
  // charged the same way their card was actually saved, not however the
  // organizer happens to be configured by the time the cutoff passes.
  const attendeeStripeAccountId = connected ? stripeAccountId : null;

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
        stripe_account_id: attendeeStripeAccountId,
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
        stripe_account_id: attendeeStripeAccountId,
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
      const businessName = await getOrganizerBusinessName(event.organizer_id);
      const qrPayload = JSON.stringify({ eventId, token: qrToken });
      const qrBuffer = await QRCode.toBuffer(qrPayload, {
        width: 400,
        color: { dark: '#1c1b17', light: '#ffffff' },
      });

      // Uploaded to a public bucket so it can be embedded as a real
      // <img src="..."> in the email body. CID-embedded attachments
      // don't render in Gmail's web client, it doesn't resolve cid:
      // references at all, so a hosted URL is the only reliable way
      // to show the QR code directly inside the email itself.
      const qrStoragePath = `${qrToken}.png`;
      await supabaseAdmin.storage
        .from('qr-codes')
        .upload(qrStoragePath, qrBuffer, { contentType: 'image/png', upsert: true });
      const { data: qrPublicUrlData } = supabaseAdmin.storage
        .from('qr-codes')
        .getPublicUrl(qrStoragePath);
      const qrImageUrl = qrPublicUrlData.publicUrl;

      const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
      // Same fix as send-reminders: pin the display timezone explicitly
      // rather than letting Vercel's server default (UTC) render it,
      // since the stored value is now a correct UTC instant and needs
      // converting back to the time a person actually reads as right.
      const eventDateDisplay = new Date(event.event_date).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const siteUrl = process.env.SITE_URL || '';
      const cancelLink = `${siteUrl}/cancel/${cancelToken}`;

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: attendeeEmail,
        subject: `You're confirmed: ${event.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
            <div style="border: 1px solid #e5decf; border-radius: 16px; overflow: hidden; background: #ffffff;">
              <div style="padding: 24px;">
                <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f; margin: 0 0 8px;">Reservation</p>
                <h1 style="font-size: 22px; margin: 0 0 4px; color: #1c1b17;">${event.name}</h1>
                ${businessName ? `<p style="font-size: 13px; color: #a39d8c; margin: 0 0 8px;">Hosted by ${businessName}</p>` : ''}
                <p style="color: #5b574c; margin: 0 0 2px; font-size: 14px;">${eventDateDisplay}</p>
                <p style="color: #5b574c; margin: 0; font-size: 14px;">${event.location}</p>
              </div>
              <div style="border-top: 1px dashed #d8cfb8;"></div>
              <div style="padding: 24px; text-align: center;">
                <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f; margin: 0 0 8px;">You're confirmed</p>
                <p style="font-size: 14px; color: #5b574c; margin: 0 0 16px;">
                  Show this code when you check in. Your ${depositDisplay}
                  hold is released once you're scanned in.
                </p>
                <img src="${qrImageUrl}" alt="Your check-in QR code" width="220" height="220" style="display: block; margin: 0 auto 16px; border-radius: 8px;" />
                <p style="font-size: 12px; color: #a39d8c; margin: 0;">
                  Can't make it? <a href="${cancelLink}" style="color: #a39d8c;">Cancel your deposit</a>
                </p>
              </div>
            </div>
          </div>
        `,
        // Attachment disabled, the QR is already visible directly in the
        // email body above, and a screenshot covers the offline case.
        // Left here, commented, in case that tradeoff ever needs to flip
        // back, just uncomment to restore the attached copy.
        // attachments: [
        //   {
        //     filename: 'check-in-code.png',
        //     content: qrBuffer.toString('base64'),
        //   },
        // ],
      });

      // Notify the organizer too, but only if they've opted in for this
      // specific event, since a popular event could otherwise mean
      // hundreds of emails to the organizer for something they can
      // just check on their dashboard.
      if (event.notify_on_signup) {
        try {
          const { data: organizerData } = await supabaseAdmin.auth.admin.getUserById(event.organizer_id);
          const organizerEmail = organizerData?.user?.email;

          if (organizerEmail) {
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
              to: organizerEmail,
              subject: `New signup: ${event.name}`,
              html: `
                <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
                  <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f; margin: 0 0 8px;">New signup</p>
                  <h1 style="font-size: 20px; margin: 0 0 8px;">${event.name}</h1>
                  <p style="font-size: 14px; margin: 0 0 4px;"><strong>${name}</strong></p>
                  <p style="font-size: 14px; color: #5b574c; margin: 0 0 16px;">${attendeeEmail}${phone ? ` &middot; ${phone}` : ''}</p>
                  <p style="font-size: 13px; color: #5b574c;">They've saved a card for the ${depositDisplay} hold. Nothing's charged unless they don't check in.</p>
                  <p style="font-size: 11px; color: #c4bfae; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
                    Sent via RSVproof
                  </p>
                </div>
              `,
            });
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