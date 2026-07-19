// page.js in this folder is a client component ('use client'), which
// can't export metadata directly, Next.js only reads metadata from
// server components. This layout is a server component sitting
// alongside it purely to carry the noindex signal, robots.txt already
// tells well-behaved crawlers not to fetch this route at all, this is
// the second layer: if one somehow does anyway, this tells it directly
// not to index or follow links from whatever it finds.
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function CancelTokenLayout({ children }) {
  return children;
}