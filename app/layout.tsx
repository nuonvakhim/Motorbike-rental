import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MotoTrip Cambodia — motorbike rental for travellers",
    template: "%s · MotoTrip Cambodia",
  },
  description:
    "Compare and book motorbike and scooter rentals in Phnom Penh, Siem Reap, Battambang, Kampot and more.",
};

/**
 * Lesson: "Preventing flash before hydration".
 *
 * This runs synchronously while the browser parses the HTML — before the
 * first paint, and long before React has loaded. It resolves the theme the
 * same way `components/theme-toggle.tsx` does (a stored choice, else the
 * system preference) and puts the answer on <html>, so the page is never
 * painted in the wrong theme and then corrected.
 *
 * `useEffect` cannot do this: it runs after paint, which is exactly the
 * flash. `useLayoutEffect` runs before paint but after hydration, so on a
 * slow connection the server HTML is already on screen.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The script above changes an attribute React also renders, so React
      // is told to accept whatever it finds in the DOM instead of treating
      // the difference as a hydration error.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <ThemeToggle />
      </body>
    </html>
  );
}
