/**
 * Lesson: "Authentication" — logging out.
 *
 * No `"use client"` here: a plain <form> whose action is a Server Function
 * needs no client state, so this ships zero JavaScript and still works with
 * JavaScript disabled.
 */

import { logout } from "@/lib/auth-actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="h-8 rounded-lg border border-black/15 px-3 text-sm font-medium transition-colors hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
      >
        Log out
      </button>
    </form>
  );
}
