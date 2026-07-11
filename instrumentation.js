import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config.js');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config.js');
  }
}

// This is the actual hook Next.js calls when a route handler, server
// component, or middleware throws. Without exporting this, Sentry's
// config loads fine but nothing is actually wired up to catch errors
// thrown inside things like route.js files, which is why the test route
// threw locally but never showed up in the dashboard.
export const onRequestError = Sentry.captureRequestError;