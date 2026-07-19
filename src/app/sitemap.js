import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "RSVproof",
  description: "Refundable deposit holds that cut no-shows at free events",
  metadataBase: new URL('https://www.rsvproof.com'),
  openGraph: {
    title: "RSVproof",
    description: "Refundable deposit holds that cut no-shows at free events",
    url: 'https://www.rsvproof.com',
    siteName: 'RSVproof',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: "RSVproof",
    description: "Refundable deposit holds that cut no-shows at free events",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <footer className="py-6 px-6 text-center text-xs text-ink-soft border-t border-line">
          <a href="/terms" className="underline mr-4">Terms of Service</a>
          <a href="/privacy" className="underline mr-4">Privacy Policy</a>
          <a href="/refund-policy" className="underline mr-4">Refund Policy</a>
          <a href="mailto:info@rsvproof.com" className="underline">Contact us</a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}