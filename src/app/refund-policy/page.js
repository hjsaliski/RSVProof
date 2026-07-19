export default function RefundPolicyPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <a href="/" className="text-sm text-ink-soft underline mb-6 inline-block">← Back to RSVproof</a>
      <p className="eyebrow mb-1">For attendees</p>
      <h1 className="font-display text-3xl mb-8">Refund policy.</h1>

      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p>Last updated: July 19, 2026</p>

        <section>
          <h2 className="font-medium text-ink mb-2">The short version</h2>
          <p>
            Your deposit is a hold, not a charge. Check in at the event and
            it&apos;s released, nothing is ever taken from your card. Miss
            check-in without cancelling ahead of time, and the deposit
            amount shown at signup is charged.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">If you can&apos;t make it</h2>
          <p>
            Cancel ahead of time using the link in your confirmation or
            reminder email, and your card is never charged. This works
            right up until the event&apos;s check-in cutoff.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">If the event is cancelled</h2>
          <p>
            If the organizer cancels the event, your deposit is released
            automatically and you&apos;ll get an email confirming it. You
            don&apos;t need to do anything.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">If you were charged and think it&apos;s a mistake</h2>
          <p>
            Reach out to the event organizer first, they&apos;re shown in your
            confirmation email and can see your check-in status directly.
            Most issues (a scan that didn&apos;t register, a late arrival) are
            fastest to sort out with them.
          </p>
          <p>
            If you&apos;re not able to reach the organizer or the issue isn&apos;t
            resolved, email{' '}
            <a href="mailto:info@rsvproof.com" className="underline">info@rsvproof.com</a>{' '}
            and we&apos;ll look into it. You can also dispute the charge
            directly with your card issuer at any time.
          </p>
        </section>
      </div>

      <p className="text-sm mt-10">
        <a href="/terms" className="underline">Terms of Service</a>
        {' '}&middot;{' '}
        <a href="/privacy" className="underline">Privacy Policy</a>
      </p>
    </main>
  );
}