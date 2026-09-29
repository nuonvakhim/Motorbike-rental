"use client";

/**
 * Lesson: "Authentication" — capturing credentials.
 *
 * A Client Component, because `useActionState` needs to track the pending
 * state of the submission. The action itself still runs on the server: what
 * crosses the bundle boundary is a reference to it, not its body — so bcrypt
 * and the signing secret never reach the browser.
 */

import { useActionState } from "react";

import { signup } from "@/lib/auth-actions";

const fieldClass =
  "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:focus:border-white/50";
const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

export function SignupForm({
  next,
  defaultAccountType = "user",
}: {
  next?: string;
  defaultAccountType?: "user" | "owner";
}) {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.03]"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <fieldset>
        <legend className="text-sm font-medium">I am…</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {[
            { value: "user", label: "A traveller", hint: "Rent bikes" },
            { value: "owner", label: "A shop owner", hint: "List my bikes" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer flex-col rounded-lg border border-black/15 p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft dark:border-white/20"
            >
              <input
                type="radio"
                name="accountType"
                value={option.value}
                defaultChecked={defaultAccountType === option.value}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-black/60 dark:text-white/60">{option.hint}</span>
            </label>
          ))}
        </div>
        {state?.errors?.accountType && (
          <p className={errorClass}>{state.errors.accountType}</p>
        )}
      </fieldset>

      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          placeholder="Name"
          autoComplete="name"
          className={`mt-1 ${fieldClass}`}
        />
        {state?.errors?.name && <p className={errorClass}>{state.errors.name}</p>}
      </div>

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
          autoComplete="new-password"
          className={`mt-1 ${fieldClass}`}
        />
        {state?.errors?.password && (
          <div className={errorClass}>
            <p>Password must:</p>
            <ul>
              {state.errors.password.map((error) => (
                <li key={error}>- {error}</li>
              ))}
            </ul>
          </div>
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
        {pending ? "Signing up…" : "Sign Up"}
      </button>
    </form>
  );
}
