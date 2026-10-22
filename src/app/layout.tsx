import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://ieltshack.vercel.app"),
  title: {
    default: "IELTShack — Read the system. Ace the IELTS.",
    template: "%s — IELTShack",
  },
  description:
    "IELTShack is an adaptive IELTS preparation platform that starts with your real band, maps the skills costing you marks, and rebuilds your plan every time your accuracy changes.",
  applicationName: "IELTShack",
  openGraph: {
    title: "IELTShack",
    description: "IELTS practice, study plans, and band tracking.",
    siteName: "IELTShack",
    type: "website",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "IELTShack — The IELTS is a system." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IELTShack",
    description: "IELTS practice, study plans, and band tracking.",
    images: ["/og.png"],
  },
  icons: { icon: "/assets/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#060705",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="jetbrains_mono_f1118db7-module__kZN-9W__variable">
      <head>
        <link rel="icon" href="/assets/icon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/css/fonts.css" />
        <link rel="stylesheet" href="/assets/css/main.css" />
        <link rel="stylesheet" href="/assets/css/app.css" />
        <link rel="stylesheet" href="/assets/css/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
