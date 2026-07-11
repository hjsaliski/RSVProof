/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig(nextConfig, {
  // Suppresses the Sentry CLI's build-time source map upload logs, keeps
  // your build output clean. Flip to true if you're debugging why source
  // maps aren't showing up correctly in the Sentry dashboard.
  silent: true,

  // These aren't required to make error tracking itself work, they only
  // matter if you want Sentry to auto-upload source maps at build time
  // via its CLI (so stack traces show your real code, not minified
  // output) and set up automatic release tracking tied to commits.
  // Leave unset for now, everything above still works without them.
  // org: 'your-sentry-org-slug',
  // project: 'rsvproof',

  // Silences a known noisy warning from Sentry's SDK about a config file
  // location choice, cosmetic only, no functional effect either way.
  hideSourceMaps: true,
});