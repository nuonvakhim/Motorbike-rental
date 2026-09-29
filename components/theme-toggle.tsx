"use client";

/**
 * Lesson: "Preventing flash before hydration" — the light/dark switch.
 *
 * Deliberately **stateless**. A `useState` holding "light" or "dark" would
 * have to guess on the server, where `localStorage` does not exist, and then
 * disagree with the browser during hydration. Instead the source of truth is
 * the `data-theme` attribute on <html>: the inline script in the root layout
 * sets it before the first paint, this button flips it, and the two icons are
 * shown and hidden by CSS through the redefined `dark:` variant.
 *
 * Nothing about this component renders differently on the server and the
 * client, so there is nothing to mismatch.
 */

import { useLayoutEffect } from "react";

const STORAGE_KEY = "theme";

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    // Private mode, or storage blocked entirely. Fall back to the system.
    return null;
  }
}

export function ThemeToggle() {
  /**
   * In development React's Strict Mode remounts once and resets <html> to
   * the attributes it manages from JSX, wiping the one the inline script set.
   * Re-applying it here restores the choice before the browser paints. A
   * no-op in production, where the remount never happens.
   */
  useLayoutEffect(() => {
    const theme = storedTheme();
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, []);

  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") ?? systemTheme();
    const next = current === "dark" ? "light" : "dark";

    // Paint first, persist second: the attribute is what the CSS reads.
    root.setAttribute("data-theme", next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is no reason to refuse it.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // The label cannot name the current theme — that would be state again.
      aria-label="Switch between light and dark theme"
      title="Switch between light and dark theme"
      className="fixed bottom-4 right-4 z-50 flex size-10 items-center justify-center rounded-full border border-black/15 bg-white/90 text-black/70 shadow-sm backdrop-blur transition-colors hover:text-black dark:border-white/20 dark:bg-black/80 dark:text-white/70 dark:hover:text-white"
    >
      {/* Moon while the page is light — the button offers the other theme. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 dark:hidden"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>

      {/* Sun while the page is dark. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden size-5 dark:block"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
