export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Dashboard/API: nothing behind login has any reason to be
      // indexed, and the dashboard's own auth check is client-side only,
      // so a crawler executing JS could catch a flash of real content
      // before the redirect to /login fires. This is what likely caused
      // the guide page to show up in search results.
      // Cancel/ticket/scan: these carry a per-attendee secret token
      // directly in the URL, the same trust model as a password reset
      // link. A search engine indexing one would mean that link, and
      // whatever it can do (cancel someone's deposit), becomes
      // discoverable by anyone searching, not just the person it was
      // emailed to.
      disallow: [
        '/dashboard',
        '/api',
        '/cancel',
        '/ticket',
        '/scan',
        '/login',
        '/signup',
        '/reset-password',
        '/forgot-password',
      ],
    },
  };
}