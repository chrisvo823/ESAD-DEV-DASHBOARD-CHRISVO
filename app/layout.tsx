import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "MACH ESAD Development Dashboard",
    description: "Engineering project health, progress, and work tracking at a glance.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "MACH ESAD Development Dashboard",
      description: "Engineering project health, progress, and work tracking at a glance.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1680, height: 943, alt: "MACH ESAD engineering project dashboard" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "MACH ESAD Development Dashboard",
      description: "Engineering project health, progress, and work tracking at a glance.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="default" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const allowed = new Set(["default","light","dark","futuristic","lucky-brass","lucky-ember","lucky-slate","lucky-forest","lucky-sand"]); let s = localStorage.getItem("esad-dashboard-theme-resolved") || localStorage.getItem("esad-dashboard-theme") || "default"; if (s === "lucky") s = "lucky-brass"; const theme = allowed.has(s) ? s : "default"; const apply = () => { document.documentElement.dataset.theme = theme; if (document.body) document.body.dataset.theme = theme; }; apply(); document.addEventListener("DOMContentLoaded", apply); } catch (_) {} })();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        data-theme="default"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
