import { Resend } from 'resend';

// Server-only. Do not import this into a client component.
// Constructing Resend with an empty key throws immediately, and since
// this file loads on every complete-signup request, an unset key would
// break the whole signup flow rather than just skipping the email.
// Exporting null when unset lets callers check for it and skip gracefully.
export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
