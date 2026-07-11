'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function GuidePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setLoading(false);
    }
    check();
  }, [router]);

  if (loading) return <main className="flex-1 px-6 py-10 text-ink-soft">Loading...</main>;

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
      <a href="/dashboard" className="text-sm underline text-ink-soft">&larr; Back to events</a>
      <p className="eyebrow mt-4 mb-1"></p>
      <h1 className="font-display text-3xl mb-2">How to use RSVproof</h1>
      <p className="text-sm text-ink-soft mb-10">
        Everything below lives on this one page so it&apos;s easy to search or
        bookmark a section. Jump to what you need:
      </p>

      <nav className="panel p-5 mb-10">
        <ul className="space-y-2 text-sm">
          <li><a href="#setup" className="underline text-ink-soft">1. Setting up an event</a></li>
          <li><a href="#connect" className="underline text-ink-soft">2. Connecting a third-party platform</a></li>
          <li><a href="#deposits" className="underline text-ink-soft">3. Deposits and your signup links</a></li>
          <li><a href="#reminders" className="underline text-ink-soft">4. Reminders and no-show charges</a></li>
        </ul>
      </nav>

      <section id="setup" className="mb-12 scroll-mt-6">
        <p className="eyebrow mb-2">1</p>
        <h2 className="font-display text-2xl mb-4">Setting up an event</h2>
        <div className="space-y-4 text-ink-soft">
          <p>
            From your dashboard, click <strong className="text-ink">+ Create event</strong> to
            build one from scratch, name, date, location, and a check-in cutoff.
            New events start with deposits off, so nothing charges anyone
            until you turn them on.
          </p>
          <p>
            Once created, open the event and set a <strong className="text-ink">deposit
            amount</strong> before switching deposits on, RSVproof won&apos;t let you
            enable deposits at $0.00, since that would invite people without
            actually protecting your spots.
          </p>
          <p>
            If you&apos;d rather not build a listing here at all, see the next
            section, connecting a platform you already use skips this step
            entirely.
          </p>
        </div>
      </section>

      <section id="connect" className="mb-12 scroll-mt-6">
        <p className="eyebrow mb-2">2</p>
        <h2 className="font-display text-2xl mb-4">Connecting a third-party platform</h2>
        <div className="space-y-4 text-ink-soft">
          <p>
            RSVproof currently connects with <strong className="text-ink">Eventbrite</strong>.
            From your dashboard, click <strong className="text-ink">+ Connect a
            platform</strong> and authorize your Eventbrite account.
          </p>
          <p>
            Once connected, any event you <em>publish</em> on Eventbrite gets
            mirrored into RSVproof automatically, drafts don&apos;t trigger this,
            only published events do. The mirrored event starts with
            deposits off and no amount set, since Eventbrite has nothing
            equivalent to pull a number from, so you&apos;ll still set that
            yourself.
          </p>
          <p>
            Already had an Eventbrite event before connecting? Open that
            event in RSVproof and use the <strong className="text-ink">Link</strong> button
            under the Eventbrite panel to connect it manually instead of
            waiting for a new one to auto-create.
          </p>
          <p>
            Once linked, new RSVPs on Eventbrite automatically get invited by
            email to secure a deposit here, no manual re-entry on your end.
          </p>
        </div>
      </section>

      <section id="deposits" className="mb-12 scroll-mt-6">
        <p className="eyebrow mb-2">3</p>
        <h2 className="font-display text-2xl mb-4">Deposits and your signup links</h2>
        <div className="space-y-4 text-ink-soft">
          <p>
            A deposit is a <strong className="text-ink">hold</strong>, not a charge.
            Attendees save a card with nothing taken upfront. If they check
            in, the hold releases and nothing is ever charged. If they miss
            the check-in cutoff, that&apos;s when the deposit actually gets
            charged.
          </p>
          <p>
            The deposit amount can be changed any time from the event page,
            click the number to edit it, it saves automatically when you
            click away or press Enter. Changing it only affects deposits
            secured after that point, it doesn&apos;t retroactively change
            holds already in place.
          </p>
          <p>
            Every standalone event gets its own <strong className="text-ink">signup
            link</strong>, share it wherever you&apos;d normally promote, Instagram,
            a group chat, a QR code on a flyer. Events linked to Eventbrite
            don&apos;t need this, attendees RSVP on Eventbrite itself and get
            invited to secure a deposit automatically from there.
          </p>
          <p>
            Every event also gets a <strong className="text-ink">door scanner
            link</strong>, open this on your phone at the event to check people
            in by scanning their ticket QR code. This one&apos;s used regardless
            of where the signup happened.
          </p>
        </div>
      </section>

      <section id="reminders" className="mb-4 scroll-mt-6">
        <p className="eyebrow mb-2">4</p>
        <h2 className="font-display text-2xl mb-4">Reminders and no-show charges</h2>
        <div className="space-y-5 text-ink-soft">
          <div>
            <h3 className="text-ink font-semibold mb-1">Reminders (automatic)</h3>
            <p>
              Once an event is coming up soon, anyone who&apos;s secured a
              deposit but hasn&apos;t checked in yet gets an automatic email
              reminding them the event is close and that checking in at
              arrival is what releases their hold. This runs on its own
              once a day, you don&apos;t need to do anything. Each attendee
              only ever gets this reminder once.
            </p>
          </div>
          <div>
            <h3 className="text-ink font-semibold mb-1">Send reminders now (manual)</h3>
            <p>
              On the event page, this button fires the same reminder
              immediately instead of waiting for the next scheduled run.
              Safe to click any time, attendees who&apos;ve already been
              reminded or already checked in are automatically skipped.
            </p>
          </div>
          <div>
            <h3 className="text-ink font-semibold mb-1">Remind all invited (manual only)</h3>
            <p>
              For events linked to a platform like Eventbrite, this
              re-sends the original invite email to anyone who RSVP&apos;d
              there but hasn&apos;t secured a deposit yet. There&apos;s no automatic
              version of this one, it only sends when you click it.
            </p>
          </div>
          <div>
            <h3 className="text-ink font-semibold mb-1">No-show charges (automatic)</h3>
            <p>
              After an event&apos;s check-in cutoff passes, everyone who wasn&apos;t
              checked in gets charged their deposit automatically, and
              everyone who was checked in is marked as not charged. This
              also runs on its own once a day, so there can be a delay of
              several hours between your cutoff passing and the automatic
              charge catching up to it.
            </p>
          </div>
          <div>
            <h3 className="text-ink font-semibold mb-1">Run no-show charges now (manual)</h3>
            <p>
              This runs the same charge process immediately instead of
              waiting for the next scheduled run, useful right after your
              cutoff passes if you don&apos;t want to wait. It only needs to be
              run once per event, either automatically or manually,
              whichever happens first.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}