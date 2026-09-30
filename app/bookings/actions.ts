"use server";

import { revalidatePath, updateTag } from "next/cache";

import { cancelUserBooking } from "@/lib/bookings";
import { AVAILABILITY_TAG } from "@/lib/cache-tags";
import { verifySession } from "@/lib/dal";

/**
 * Cancels one of the signed-in tourist's bookings. The id comes from a bound
 * argument, but the user id comes from the session — so a tourist who edits
 * the id can only ever cancel a booking of their own.
 */
export async function cancelBookingAction(bookingId: string) {
  const session = await verifySession();
  await cancelUserBooking(bookingId, session.userId);

  // The cancelled dates are free again in date searches.
  updateTag(AVAILABILITY_TAG);
  revalidatePath("/bookings");
  revalidatePath("/owner");
}
