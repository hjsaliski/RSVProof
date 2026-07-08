import "./globals.css";

export const metadata = {
  title: "Event Deposits",
  description: "No-show deposits for free pop-up events",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
