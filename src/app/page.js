export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero: the ticket is the thesis. A real claim check for a real spot. */}
      <section className="bg-dusk text-paper">
        <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="eyebrow mb-4" style={{ color: "#e8c374" }}>
              For pop-ups &amp; free events
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-tight mb-5">
              A real hold on a free spot.
            </h1>
            <p className="text-lg text-white/75 mb-8 max-w-md">
              Attendees put a small deposit on hold. Show up, it&apos;s released.
              Don&apos;t, and it covers what you prepped for them.
            </p>
            <div className="flex gap-4">
              <a
                href="/signup"
                className="btn-marigold px-6 py-3 inline-block"
              >
                Create your first event
              </a>
              <a
                href="/login"
                className="px-6 py-3 inline-block text-paper/85 underline decoration-white/30 underline-offset-4"
              >
                Log in
              </a>
            </div>
          </div>

          {/* Signature ticket, shown as a live sample */}
          <div className="ticket max-w-sm mx-auto w-full text-ink shadow-2xl">
            <div className="p-6">
              <p className="eyebrow mb-1">Sample reservation</p>
              <h2 className="font-display text-2xl mb-1">Night Market Pop-Up</h2>
              <p className="text-sm text-ink-soft">Sat, July 26 &middot; 6:00 PM &middot; East Austin</p>
            </div>
            <div className="ticket-divider" />
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="eyebrow mb-1">Hold amount</p>
                <p className="font-mono text-2xl">$5.00</p>
              </div>
              <div className="text-right">
                <p className="eyebrow mb-1">Status</p>
                <p className="font-mono text-sm text-marigold-dark">Released on check-in</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: two lanes, organizer and attendee, since they read
          this page for different reasons */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10">
        <div>
          <p className="eyebrow mb-2">For organizers</p>
          <h2 className="font-display text-2xl mb-4">Plan for who actually shows.</h2>
          <ul className="space-y-3 text-ink-soft">
            <li>Set a deposit and a check-in cutoff for any free event.</li>
            <li>Share one link wherever you already promote.</li>
            <li>Scan guests in at the door with your phone.</li>
            <li>No-shows are charged automatically after the cutoff.</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-2">For attendees</p>
          <h2 className="font-display text-2xl mb-4">Nothing charged if you show up.</h2>
          <ul className="space-y-3 text-ink-soft">
            <li>Reserve your spot with a card, nothing is charged yet.</li>
            <li>Get a ticket with a QR code, ready when you arrive.</li>
            <li>Scanned in, your hold is released the same day.</li>
            <li>Miss it without notice, the hold covers your no-show.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
