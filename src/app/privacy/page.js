export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <a href="/" className="text-sm text-ink-soft underline mb-6 inline-block">← Back to RSVproof</a>
      <p className="eyebrow mb-1">Legal</p>
      <h1 className="font-display text-3xl mb-8">Privacy Policy</h1>

      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p>Last updated: July 19, 2026</p>

        <section>
          <h2 className="font-medium text-ink mb-2">1. Information we collect</h2>
          <p>
            <strong className="text-ink">From attendees:</strong> when you sign
            up for an event through RSVproof, we collect your name and email
            address. If you provide a payment method, that information is
            collected and stored directly by Stripe, our payment processor,
            not by RSVproof, we never see or store your full card number. If
            you sign up through a connected platform like Eventbrite, we
            receive your name and email from that platform to create your
            RSVproof deposit invitation.
          </p>
          <p>
            <strong className="text-ink">From organizers:</strong> when you
            create an account, we collect your email, business or display
            name, and, if you connect Stripe, the identifiers Stripe gives us
            to route payments to your account. We don&apos;t collect or store
            your bank account or card details directly.
          </p>
          <p>
            <strong className="text-ink">Automatically:</strong> we use
            Vercel Analytics to understand overall site usage (like page
            views), and Sentry to capture technical error details if
            something breaks, so we can fix it. Neither is used to build an
            advertising profile of you, and we don&apos;t serve ads.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">2. How we use your information</h2>
          <p>
            We use your information to manage your event signup, send you
            confirmation and reminder emails, process your deposit hold and
            any resulting no-show charge, communicate changes to the event
            such as cancellation, and keep the service secure and working
            correctly (including detecting abuse, like automated signups).
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">3. Who can see your information</h2>
          <p>
            The organizer of the event you signed up for can see your name,
            email, and your check-in and deposit status. RSVproof does not
            sell your information or share it with third parties other than
            the service providers needed to operate the platform: Stripe
            (payments), Resend (email delivery), Supabase and Vercel
            (hosting and infrastructure), Sentry (error monitoring), and
            Eventbrite, only if the organizer of your event has connected
            it.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">4. Data retention</h2>
          <p>
            We retain attendee and event records, including cancelled and
            past events, to maintain accurate history and reporting for
            organizers, and because payment records generally need to be
            kept for a period to handle disputes and comply with financial
            recordkeeping obligations. You may request deletion of your
            personal information by contacting us, subject to any records
            we&apos;re required to keep for payment and dispute purposes.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">5. Your choices</h2>
          <p>
            You can ask us what personal information we have about you,
            correct it, or request deletion, by emailing{' '}
            <a href="mailto:info@rsvproof.com" className="underline">info@rsvproof.com</a>.
            We&apos;ll respond as quickly as we reasonably can. Some
            information tied to a completed payment may need to be retained
            even after a deletion request, for the reasons described above.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">6. Security</h2>
          <p>
            Payment information is handled entirely by Stripe and never
            stored on RSVproof&apos;s servers. Access to attendee data within
            RSVproof is restricted to the organizer of the relevant event.
            No method of transmission or storage is 100% secure, but we take
            reasonable steps to protect your information.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">7. Children&apos;s privacy</h2>
          <p>
            RSVproof is not directed at children, and we don&apos;t knowingly
            collect information from anyone under 13. If you believe a child
            has provided us information, contact us and we&apos;ll remove it.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">8. Where we operate</h2>
          <p>
            RSVproof currently serves organizers and attendees in the United
            States, and your information is processed and stored in the
            United States.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">9. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. We&apos;ll update the
            date at the top of this page when we do. Continued use of
            RSVproof after changes are posted constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-ink mb-2">Contact</h2>
          <p>
            Questions about this policy can be directed to{' '}
            <a href="mailto:info@rsvproof.com" className="underline">info@rsvproof.com</a>.
          </p>
        </section>
      </div>

      <p className="text-sm mt-10">
        <a href="/terms" className="underline">Terms of Service</a>
        {' '}&middot;{' '}
        <a href="/refund-policy" className="underline">Refund Policy</a>
      </p>
    </main>
  );
}