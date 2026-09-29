"use client";

/**
 * The booking request form.
 *
 * A Client Component because it reacts while the tourist types: the total
 * price updates as dates change, and a debounced call to the availability
 * Route Handler says whether the bike is free. Submitting still goes through
 * a Server Action via `useActionState`, so the form also works before
 * JavaScript has loaded.
 *
 * The availability check runs from the date inputs' change handlers, not
 * from an effect: the request is caused by a user action, so that is where
 * it belongs.
 */

import { useActionState, useRef, useState } from "react";

import { TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { MAX_RENTAL_DAYS, addDays, formatUsd, rentalDays } from "@/lib/catalog";
import { idleState, type ActionState } from "@/lib/definitions";

type Availability =
  | { state: "idle" | "checking" }
  | { state: "done"; available: boolean; remaining: number }
  | { state: "error"; message: string };

const CHECK_TIMEOUT_MS = 5_000;

export function BookingForm({
  action,
  bikeId,
  pricePerDay,
  today,
  defaultStart,
  defaultEnd,
  defaultName,
  initialRemaining,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  bikeId: string;
  pricePerDay: number;
  today: string;
  defaultStart: string;
  defaultEnd: string;
  defaultName: string;
  /** Computed on the server for the default dates, so no request on load. */
  initialRemaining: number | null;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [availability, setAvailability] = useState<Availability>(
    initialRemaining === null
      ? { state: "idle" }
      : { state: "done", available: initialRemaining > 0, remaining: initialRemaining },
  );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef<AbortController | null>(null);

  const days = rentalDays(start, end);
  const validRange = days >= 1 && days <= MAX_RENTAL_DAYS;

  function scheduleCheck(nextStart: string, nextEnd: string) {
    clearTimeout(timer.current);
    inflight.current?.abort();

    const nextDays = rentalDays(nextStart, nextEnd);
    if (nextDays < 1 || nextDays > MAX_RENTAL_DAYS) {
      setAvailability({ state: "idle" });
      return;
    }

    setAvailability({ state: "checking" });
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      inflight.current = controller;
      // A hung request should not leave the form saying "Checking…" forever.
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

      try {
        const response = await fetch(
          `/api/bikes/${bikeId}/availability?start=${nextStart}&end=${nextEnd}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) {
          setAvailability({ state: "error", message: body.error ?? "Could not check dates." });
        } else {
          setAvailability({ state: "done", available: body.available, remaining: body.remaining });
        }
      } catch (error) {
        // A newer check replaced this one; it will report instead.
        if (controller !== inflight.current) return;
        setAvailability({
          state: "error",
          message:
            (error as Error).name === "AbortError"
              ? "Checking took too long — you can still send the request."
              : "Could not check dates — you can still send the request.",
        });
      } finally {
        clearTimeout(timeout);
      }
    }, 350);
  }

  function onStartChange(value: string) {
    setStart(value);
    // Keep the return day on or after pickup.
    const nextEnd = end < value ? addDays(value, 1) : end;
    setEnd(nextEnd);
    scheduleCheck(value, nextEnd);
  }

  function onEndChange(value: string) {
    setEnd(value);
    scheduleCheck(start, value);
  }

  const soldOut = availability.state === "done" && !availability.available;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Pickup day"
          name="startDate"
          type="date"
          min={today}
          value={start}
          onChange={(event) => onStartChange(event.target.value)}
          error={state.errors?.startDate}
          required
        />
        <TextField
          label="Return day"
          name="endDate"
          type="date"
          min={start || today}
          max={start ? addDays(start, MAX_RENTAL_DAYS - 1) : undefined}
          value={end}
          onChange={(event) => onEndChange(event.target.value)}
          error={state.errors?.endDate}
          required
        />
      </div>

      <div className="rounded-xl bg-black/[0.03] p-3 text-sm dark:bg-white/[0.04]" aria-live="polite">
        {validRange ? (
          <div className="flex items-baseline justify-between">
            <span>
              {formatUsd(pricePerDay)} × {days} {days === 1 ? "day" : "days"}
            </span>
            <span className="text-lg font-semibold">{formatUsd(pricePerDay * days)}</span>
          </div>
        ) : (
          <span className="text-black/60 dark:text-white/60">
            Choose dates (1 to {MAX_RENTAL_DAYS} days) to see the total.
          </span>
        )}
        <p className="mt-1 text-xs">
          {availability.state === "checking" ? (
            <span className="text-black/50 dark:text-white/50">Checking availability…</span>
          ) : availability.state === "done" ? (
            availability.available ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Available — {availability.remaining} left for these dates
              </span>
            ) : (
              <span className="font-medium text-red-700 dark:text-red-300">
                Fully booked for these dates
              </span>
            )
          ) : availability.state === "error" ? (
            <span className="text-amber-700 dark:text-amber-300">{availability.message}</span>
          ) : null}
        </p>
      </div>

      <TextField
        label="Your name"
        name="contactName"
        defaultValue={defaultName}
        autoComplete="name"
        error={state.errors?.contactName}
        required
      />
      <TextField
        label="Phone or WhatsApp"
        name="contactPhone"
        type="tel"
        placeholder="+855 12 345 678"
        autoComplete="tel"
        hint="The shop uses this to confirm your pickup."
        error={state.errors?.contactPhone}
        required
      />
      <TextArea
        label="Note for the shop (optional)"
        name="note"
        rows={3}
        placeholder="Pickup time, hotel delivery, a second helmet…"
        error={state.errors?.note}
      />

      {state.message ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Sending request…" disabled={soldOut}>
        Send booking request
      </SubmitButton>
      <p className="text-xs text-black/50 dark:text-white/50">
        No payment now. You pay the shop at pickup, once they confirm.
      </p>
    </form>
  );
}
