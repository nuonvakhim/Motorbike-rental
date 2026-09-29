"use client";

/**
 * A submit button that knows the form around it is pending.
 *
 * `useFormStatus` reads the state of the nearest parent `<form>`, which is
 * why this has to be its own Client Component: the hook returns `pending`
 * only for a form *above* it in the tree, never the one it renders itself.
 */

import { useFormStatus } from "react-dom";

const tones = {
  accent: "bg-accent text-accent-foreground",
  default: "bg-foreground text-background",
};

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "",
  tone = "accent",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  tone?: keyof typeof tones;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`h-10 rounded-lg px-4 text-sm font-semibold transition-opacity disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
