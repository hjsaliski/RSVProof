import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Percentage of transactions to trace for performance monitoring.
  // 1.0 = 100%. Fine at RSVproof's current traffic, worth dialing down
  // (e.g. 0.1) once there's real volume, to stay on the free tier.
  tracesSampleRate: 1.0,

  // Captures replay sessions (a video-like reconstruction of what the
  // user did) only when an error actually happens, so this doesn't burn
  // through replay quota on sessions with nothing wrong.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],
});