/**
 * Reusable form controls.
 *
 * The shop, bike, booking and review forms must look and behave the same,
 * so the label/error/`aria-*` wiring is written once here. No
 * `"use client"`: these render markup and hold no state, which lets both
 * Server and Client Components use them.
 */

import type { ComponentProps, ReactNode } from "react";

export const controlClassName =
  "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40 disabled:opacity-50 aria-invalid:border-red-500/60 dark:border-white/20 dark:bg-black dark:focus:border-white/50";

type FieldShellProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  /** Zod hands back an array — the first message is the one worth showing. */
  error?: string[];
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>

      {children}

      {error?.length ? (
        // Tied to the input by `aria-describedby`, so a screen reader reads
        // the error out instead of the user hearing only "invalid".
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error[0]}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-black/50 dark:text-white/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string[];
};

export function TextField({ label, name, hint, error, className, ...props }: TextFieldProps) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={error}>
      <input
        {...props}
        id={name}
        name={name}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={error?.length ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClassName} ${className ?? ""}`}
      />
    </Field>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string[];
};

export function SelectField({ label, name, hint, error, className, children, ...props }: SelectFieldProps) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={error}>
      <select
        {...props}
        id={name}
        name={name}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={error?.length ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClassName} ${className ?? ""}`}
      >
        {children}
      </select>
    </Field>
  );
}

type TextAreaProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string[];
};

export function TextArea({ label, name, hint, error, className, ...props }: TextAreaProps) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={error}>
      <textarea
        {...props}
        id={name}
        name={name}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={error?.length ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClassName} h-auto py-2 ${className ?? ""}`}
      />
    </Field>
  );
}

/** A checkbox with its label beside it rather than above. */
export function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
