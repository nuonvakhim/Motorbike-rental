/**
 * The top bar on every page. An async Server Component: it reads the session
 * through the DAL, so the links match the viewer's role without shipping any
 * JavaScript. `getOptionalUser` never redirects — an anonymous visitor just
 * sees "Log in".
 */

import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { getOptionalUser } from "@/lib/dal";

const linkClass =
  "rounded-lg px-3 py-1.5 text-sm text-black/70 transition-colors hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white";

export async function SiteHeader() {
  const user = await getOptionalUser();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-background/90 backdrop-blur dark:border-white/10">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="16.5" r="3" />
              <circle cx="18.5" cy="16.5" r="3" />
              <path d="M8.5 16.5h5l3-6h-4l-2-3H8M16.5 10.5l2 6" />
            </svg>
          </span>
          <span>
            MotoTrip <span className="hidden text-black/50 sm:inline dark:text-white/50">Cambodia</span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {user ? (
            <>
              {user.role === "user" ? (
                <Link href="/bookings" className={linkClass}>
                  My bookings
                </Link>
              ) : null}
              {user.role === "owner" || user.role === "admin" ? (
                <Link href="/owner" className={linkClass}>
                  My shops
                </Link>
              ) : null}
              {user.role === "admin" ? (
                <Link href="/admin" className={linkClass}>
                  Admin
                </Link>
              ) : null}
              <span className="hidden px-2 text-sm text-black/50 md:inline dark:text-white/50">
                {user.name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass}>
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
