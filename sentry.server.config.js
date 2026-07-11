import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // This is the side that matters most for RSVproof: your webhook
  // handlers and the no-show charge cron run unattended on the server,
  // this is what catches them silently failing.
  tracesSampleRate: 1.0,
});