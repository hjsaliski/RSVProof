export default function TermsPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <a href="/" className="text-sm text-ink-soft underline mb-6 inline-block">← Back to RSVproof</a>
      <p className="eyebrow mb-1">Legal</p>
      <h1 className="font-display text-3xl mb-8">Terms of Service</h1>

      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p>Last updated: July 17, 2026</p>

        <section>
          <h2 className="font-medium text-ink mb-2">What RSVproof does</h2>
          <p>
            RSVproof lets event organizers collect a refundable deposit hold
            from attendees at signup. If you check in at the event, your
            deposit is never charged. If you do not check in by the event&apos;s
            check-in cutoff, your card will be charged the deposit amount
            shown at signup.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">How the deposit works</h2>
          <p>
            When you sign up for an event through RSVproof, you authorize
            RSVproof to save a payment method on file via our payment
            processor, Stripe. No charge is made at signup. A charge is only
            made if you fail to check in at the event by the stated cutoff
            time. The deposit amount, event date, and cutoff time are shown
            to you before you provide payment details.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Cancellations</h2>
          <p>
            You may cancel your deposit before the event using the
            cancellation link included in your confirmation email. Cancelling
            releases your saved payment method and you will not be charged.
            If an event is cancelled by the organizer, your deposit is
            automatically released and you will be notified by email.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Payment processing</h2>
          <p>
            Payments are processed by Stripe. RSVproof does not store your
            full card details. By providing payment information, you also
            agree to{' '}
            <a href="https://stripe.com/legal/consumer" className="underline" target="_blank" rel="noopener noreferrer">
              Stripe&apos;s Services Agreement
            </a>.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Disputes</h2>
          <p>
            If you believe you were charged in error, contact the event
            organizer first, they have visibility into your check-in status.
            You may also dispute a charge directly with your card issuer.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Continued use of
            RSVproof after changes are posted constitutes acceptance of the
            updated terms.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Contact</h2>
          <p>
            Questions about these terms can be directed to{' '}
            <a href="mailto:info@rsvproof.com" className="underline">info@rsvproof.com</a>.
          </p>
        </section>
      </div>

      <p className="text-sm mt-10">
        <a href="/privacy" className="underline">Privacy Policy</a>
        {' '}&middot;{' '}
        <a href="/refund-policy" className="underline">Refund Policy</a>
      </p>
    </main>
  );
}