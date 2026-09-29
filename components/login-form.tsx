"use client";

/**
 * Lesson: "Authentication" — logging an existing user in.
 *
 * Same shape as the signup form. The difference is in the action: a failed
 * login returns one generic `message` rather than per-field errors, so the
 * form cannot be used to discover which emails have accounts.
 */

import { useActionState } from "react";

import { login } from "@/lib/auth-actions";

const fieldClass =
  "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:focus:border-white/50";
const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.03]"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          className={`mt-1 ${fieldClass}`}
        />
        {state?.errors?.email && (
          <p className={errorClass}>{state.errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={`mt-1 ${fieldClass}`}
        />
        {state?.errors?.password && (
          <p className={errorClass}>{state.errors.password}</p>
        )}
      </div>

      {state?.message ? (
        <p role="status" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <button
        disabled={pending}
        type="submit"
        className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity disabled:opacity-50"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
