"use server";

/**
 * The booking request, as a Server Action.
 *
 * A Server Action is a public POST endpoint, so this trusts nothing from the
 * form: the session decides who is booking, the dates are re-validated, and
 * the price comes from the database inside `createBooking`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { MAX_RENTAL_DAYS, parseIsoDate, rentalDays, todayInCambodia } from "@/lib/catalog";
import { createBooking } from "@/lib/bookings";
import { getOptionalSession } from "@/lib/dal";
import { BookingSchema, type ActionState } from "@/lib/definitions";

export async function createBookingAction(
  bikeId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getOptionalSession();
  if (!session) {
    return { status: "error", message: "Log in to send a booking request." };
  }

  const parsed = BookingSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    contactName: formData.get("contactName"),
    contactPhone: formData.get("contactPhone"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { startDate, endDate, contactName, contactPhone, note } = parsed.data;
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const days = rentalDays(startDate, endDate);

  if (!start || !end || startDate < todayInCambodia()) {
    return { status: "error", errors: { startDate: ["The pickup day has already passed"] } };
  }
  if (days > MAX_RENTAL_DAYS) {
    return {
      status: "error",
      errors: { endDate: [`Rentals are limited to ${MAX_RENTAL_DAYS} days`] },
    };
  }

  const result = await createBooking({
    bikeId,
    userId: session.userId,
    start,
    end,
    days,
    contactName,
    contactPhone,
    note,
  });

  if (!result.ok) {
    const messages = {
      unavailable: "This bike is no longer offered.",
      "sold-out": "Sorry — this bike was just booked for those dates. Try other dates.",
      busy: "Several people are booking right now. Please press Send again.",
    };
    return { status: "error", message: messages[result.reason] };
  }

  revalidatePath("/bookings");
  revalidatePath("/owner");
  redirect(`/bookings?new=${result.id}`);
}
