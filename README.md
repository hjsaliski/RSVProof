# Event Deposits (Phase 1)

A no-show deposit tool for free pop-up events. Organizers create an event
and get a shareable link. Attendees save a card (no charge yet), get a QR
code, and check in at the door. Anyone not checked in by the cutoff time
gets charged the deposit amount afterward.

This is Phase 1 as scoped: standalone links only, no Eventbrite or other
platform integration yet, and payouts to organizers are manual (you send
them their share directly) since Stripe Connect isn't wired up.

## What's built

- Organizer signup and login (Supabase Auth)
- Event creation and a per-event settings page (deposit on/off, amount, cutoff)
- A shareable public link per event
- Attendee signup page: name/email/phone, card saved via Stripe (no charge)
- QR code generated and shown to the attendee after signup
- A phone-camera scanner page for checking attendees in at the door
- Manual check-in override in the dashboard, for when a scan fails
- A "run no-show charges" button that charges everyone not checked in
- A cron-compatible version of that same charge job, for automating it later

## One-time setup

### 1. Supabase project

1. Create a project at supabase.com.
2. Go to the SQL Editor and run everything in `supabase/schema.sql`.
3. Go to Project Settings > API and copy the Project URL, the `anon` public
   key, and the `service_role` secret key.

### 2. Stripe account

1. Create a Stripe account at stripe.com if you don't have one.
2. Stay in **test mode** while you're building and testing.
3. Go to Developers > API keys and copy the publishable key and secret key.
4. Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC,
   works for saving a test card without a real charge.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in the values from steps 1 and 2.

### 4. Install and run locally

```
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Testing the full loop yourself before the real event

1. Sign up as an organizer at `/signup`.
2. Create an event with a check-in cutoff a few minutes in the future, so
   you don't have to wait to test the charge step.
3. Copy the signup link from the event page and open it in a new
   incognito window, playing the role of an attendee. Use Stripe's test
   card number above.
4. Copy the scanner link and open it on your phone (or another browser
   tab), and scan the QR code you get as the attendee. Confirm the
   attendee list shows them checked in.
5. Wait until the cutoff time passes, or create a second test attendee
   and don't check them in.
6. On the event dashboard, click "Run no-show charges" and confirm the
   checked-in attendee shows not_charged and the no-show shows charged.
7. In your Stripe dashboard (test mode), confirm the charge appears under
   Payments.

## Before using this with real money

- Switch your Stripe keys from test mode to live mode once you're
  confident in the flow.
- Review the terms language shown on the attendee signup page with your
  test organizer, since this is what protects you if someone disputes a
  charge later.
- Decide how you're getting the organizer their share of no-show charges
  in this phase (Venmo, bank transfer, etc.), since Stripe Connect isn't
  built yet.

## Deploying

This is a standard Next.js app, so it deploys cleanly to Vercel:

1. Push this project to a GitHub repo.
2. Import it into Vercel.
3. Add the same environment variables from .env.local in the Vercel
   project settings.
4. Deploy.

Once deployed, your signup links will look like
https://your-app.vercel.app/e/[event-id]

## Automating the no-show charge job (optional, later)

Right now, the organizer has to click "Run no-show charges" manually after
the cutoff. To automate it, set up a scheduled job (Vercel Cron, or any
external scheduler) to POST to /api/charge-no-shows with a header
x-cron-secret matching your CRON_SECRET env variable, and no eventId
in the body. It will find and process every event whose cutoff has passed.

## Automating no-show charges and reminders (optional)

Two routes support automatic scheduling: /api/charge-no-shows and
/api/send-reminders. A vercel.json file is already included with both
wired up to run once a day (13:00 and 14:00 UTC), which is the only
frequency Vercel's free Hobby plan allows for its built-in cron scheduler.
As long as CRON_SECRET is set in your Vercel project's environment
variables, this works automatically once deployed, no extra setup needed.
Reminders go out once a check-in cutoff is within 24 hours, wide enough
that the once-daily schedule reliably catches every event before its
cutoff.

If you're on Vercel's paid Pro plan and want tighter timing (say, checking
every hour instead of once a day), edit the schedule field in vercel.json.

## What's intentionally not built yet (Phase 2 remainder, and Phase 3/4)

- Eventbrite or other platform connections (OAuth, webhooks)
- Stripe Connect for automated payouts directly to organizers
- Attendee perks (credit, priority access, etc.)
- Email/SMS delivery of the QR code (currently shown on-screen only,
  attendees should screenshot it)
