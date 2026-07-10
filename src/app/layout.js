import "./globals.css";

export const metadata = {
  title: "Event Deposits",
  description: "No-show deposits for free pop-up events",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <footer className="py-6 px-6 text-center text-xs text-ink-soft border-t border-line">
          <a href="/terms" className="underline mr-4">Terms of Service</a>
          <a href="/privacy" className="underline">Privacy Policy</a>
        </footer>
      </body>
    </html>
  );
}