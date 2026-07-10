export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <p className="eyebrow mb-1">Legal</p>
      <h1 className="font-display text-3xl mb-8">Privacy Policy</h1>

      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p>Last updated: [DATE]</p>

        <section>
          <h2 className="font-medium text-ink mb-2">Information we collect</h2>
          <p>
            When you sign up for an event through RSVproof, we collect your
            name, email address, and optionally your phone number. If you
            provide a payment method, that information is collected and
            stored directly by Stripe, our payment processor, not by
            RSVproof. If you sign up through a connected platform like
            Eventbrite, we receive your name and email from that platform to
            create your RSVproof deposit invitation.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">How we use your information</h2>
          <p>
            We use your information to manage your event signup, send you
            confirmation and reminder emails, process your deposit hold and
            any resulting no-show charge, and communicate changes to the
            event such as cancellation or postponement.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Who can see your information</h2>
          <p>
            The organizer of the event you signed up for can see your name,
            email, phone number (if provided), and your check-in and deposit
            status. RSVproof does not sell your information or share it with
            third parties other than the service providers needed to operate
            the platform, currently Stripe (payments) and Resend (email
            delivery).
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Data retention</h2>
          <p>
            We retain attendee records, including cancelled and past events,
            to maintain accurate event history and reporting for organizers.
            You may request deletion of your personal information by
            contacting us, subject to any records we&apos;re required to keep
            for payment and dispute purposes.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Security</h2>
          <p>
            Payment information is handled entirely by Stripe and never
            stored on RSVproof&apos;s servers. Access to attendee data within
            RSVproof is restricted to the organizer of the relevant event.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Continued use of
            RSVproof after changes are posted constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Contact</h2>
          <p>Questions about this policy can be directed to [CONTACT EMAIL].</p>
        </section>
      </div>
    </main>
  );
}