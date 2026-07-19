export default function TermsPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <a href="/" className="text-sm text-ink-soft underline mb-6 inline-block">← Back to RSVproof</a>
      <p className="eyebrow mb-1">Legal</p>
      <h1 className="font-display text-3xl mb-8">Terms of Service</h1>

      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p>Last updated: July 19, 2026</p>

        <section>
          <h2 className="font-medium text-ink mb-2">1. Agreement to these terms</h2>
          <p>
            RSVproof is operated by Revail Solutions (&quot;RSVproof,&quot;
            &quot;we,&quot; &quot;us&quot;). By creating an account, connecting a
            platform like Eventbrite, or signing up for an event through
            RSVproof, you agree to these Terms of Service. If you don&apos;t
            agree, don&apos;t use RSVproof.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">2. What RSVproof does</h2>
          <p>
            RSVproof lets event organizers collect a refundable deposit hold
            from attendees at signup, to reduce no-shows at free events. If
            you check in at the event, your deposit is released and never
            charged. If you don&apos;t check in by the event&apos;s check-in
            cutoff, your card is charged the deposit amount shown to you at
            signup.
          </p>
          <p>
            RSVproof is a payment and no-show tool. We are not the organizer
            or host of any event listed through the service, and we have no
            control over an event&apos;s content, safety, quality, or whether
            it actually takes place as described.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">3. Eligibility</h2>
          <p>
            You must be at least 18 years old and able to enter a binding
            contract to use RSVproof, including to sign up for an event or
            create an organizer account. By using RSVproof you represent
            that you meet this requirement.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">4. Organizer accounts</h2>
          <p>
            If you create an organizer account, you&apos;re responsible for the
            accuracy of the events you list, including the date, location,
            deposit amount, and check-in cutoff. You&apos;re responsible for
            actually holding the event as described, or clearly cancelling it
            through RSVproof so attendee deposits are released and attendees
            are notified.
          </p>
          <p>
            Organizers connecting a third-party platform (such as Eventbrite)
            are responsible for the accuracy of the data that platform sends
            us, RSVproof relays it but doesn&apos;t independently verify it.
          </p>
          <p>
            Where a platform fee applies to deposits processed through a
            connected payment account, that fee is disclosed to the organizer
            as part of connecting the account and is deducted automatically
            from each processed charge.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">5. How the deposit works</h2>
          <p>
            When you sign up for an event through RSVproof, you authorize us
            to save a payment method on file via our payment processor,
            Stripe. No charge is made at signup. A charge is only made if you
            fail to check in at the event by the stated cutoff time, or don&apos;t
            cancel ahead of time. The deposit amount, event date, and cutoff
            time are shown to you before you provide payment details.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">6. Cancellations and no-shows</h2>
          <p>
            You may cancel your deposit before the event using the
            cancellation link included in your confirmation or reminder
            email. Cancelling releases your saved payment method and you
            will not be charged. If an event is cancelled by the organizer,
            your deposit is automatically released and you&apos;ll be notified
            by email. Full details, including what to do if you believe a
            no-show charge was made in error, are in our{' '}
            <a href="/refund-policy" className="underline">Refund Policy</a>.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">7. Payment processing and other service providers</h2>
          <p>
            Payments are processed by Stripe. RSVproof does not store your
            full card details. By providing payment information, you also
            agree to{' '}
            <a href="https://stripe.com/legal/consumer" className="underline" target="_blank" rel="noopener noreferrer">
              Stripe&apos;s Services Agreement
            </a>. We also use Resend to deliver email, and Supabase and
            Vercel to host and run the service. If an organizer connects
            Eventbrite, we exchange event and attendee data with Eventbrite
            as part of that integration.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">8. Prohibited conduct</h2>
          <p>
            You agree not to use RSVproof to list fraudulent or fake events,
            provide false payment information, attempt to circumvent the
            deposit or check-in mechanism, or interfere with the service&apos;s
            normal operation. We may suspend or terminate accounts involved
            in this kind of conduct.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">9. Disclaimers</h2>
          <p>
            RSVproof is provided &quot;as is&quot; without warranties of any kind,
            whether express or implied. We don&apos;t guarantee the service will
            be uninterrupted, error-free, or available at all times. We are
            not responsible for the conduct of any organizer or attendee, or
            for what happens at an event itself, our role is limited to the
            deposit and check-in mechanism.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">10. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, RSVproof and Revail
            Solutions won&apos;t be liable for any indirect, incidental, or
            consequential damages arising from your use of the service. Our
            total liability for any claim relating to RSVproof is limited to
            the amount of the deposit at issue, or $100, whichever is
            greater.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">11. Disputes and governing law</h2>
          <p>
            If you believe you were charged in error, contact the event
            organizer first, they have visibility into your check-in status.
            You can also reach us at{' '}
            <a href="mailto:info@rsvproof.com" className="underline">info@rsvproof.com</a>,
            or dispute the charge directly with your card issuer at any
            time. These terms are governed by the laws of the State of
            Texas, without regard to conflict of law principles.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">12. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. We&apos;ll update the
            date at the top of this page when we do. Continued use of
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