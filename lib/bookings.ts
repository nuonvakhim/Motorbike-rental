/**
 * Booking requests: created by tourists, answered by shop owners.
 *
 * A booking is a *request* — the shop confirms or declines it and the
 * tourist pays at pickup. Online payment (KHQR / ABA PayWay) can come later
 * without changing this shape.
 */

import "server-only";

import { HOLDING_STATUSES, type BookingStatus } from "@/lib/catalog";
import { overlapping } from "@/lib/listings";
import { prisma } from "@/lib/prisma";

export type NewBooking = {
  bikeId: string;
  userId: string;
  start: Date;
  end: Date;
  days: number;
  contactName: string;
  contactPhone: string;
  note: string;
};

export type BookingResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unavailable" | "sold-out" | "busy" };

/**
 * Check-then-insert inside one Serializable transaction. Two tourists asking
 * for the last Honda Click on the same weekend would otherwise both see
 * "1 left" and both be accepted; with Serializable, Postgres aborts one of
 * them and that attempt is retried.
 *
 * Retries are bounded: after MAX_ATTEMPTS the tourist is asked to press Send
 * again rather than the server looping under contention.
 */
const MAX_ATTEMPTS = 3;

export async function createBooking(input: NewBooking): Promise<BookingResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await tryCreateBooking(input);
    if (result.ok || result.reason !== "busy") return result;
    // A short random pause so the conflicting requests do not collide again.
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 120));
  }
  return { ok: false, reason: "busy" };
}

async function tryCreateBooking(input: NewBooking): Promise<BookingResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const bike = await tx.bike.findUnique({
          where: { id: input.bikeId },
          select: {
            active: true,
            pricePerDay: true,
            quantity: true,
            shop: { select: { verified: true } },
            _count: {
              select: { bookings: { where: overlapping(input.start, input.end) } },
            },
          },
        });

        if (!bike || !bike.active || !bike.shop.verified) {
          return { ok: false, reason: "unavailable" } as const;
        }

        if (bike._count.bookings >= bike.quantity) {
          return { ok: false, reason: "sold-out" } as const;
        }

        const booking = await tx.booking.create({
          data: {
            bikeId: input.bikeId,
            userId: input.userId,
            startDate: input.start,
            endDate: input.end,
            days: input.days,
            // Priced from the database, never from the form.
            totalPrice: bike.pricePerDay * input.days,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            note: input.note,
          },
          select: { id: true },
        });

        return { ok: true, id: booking.id } as const;
      },
      { isolationLevel: "Serializable", timeout: 10_000 },
    );
  } catch (error) {
    if (isWriteConflict(error)) return { ok: false, reason: "busy" };
    throw error;
  }
}

/**
 * A serialization failure surfaces in more than one shape: Prisma's P2034,
 * or — when the pg driver adapter reports it first — an error whose code or
 * message names `TransactionWriteConflict` (Postgres SQLSTATE 40001).
 */
function isWriteConflict(error: unknown) {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return (
    code === "P2034" ||
    code === "40001" ||
    code === "TransactionWriteConflict" ||
    Boolean(message?.includes("TransactionWriteConflict"))
  );
}

export async function listUserBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: [{ startDate: "desc" }],
    include: {
      bike: {
        select: {
          id: true,
          name: true,
          type: true,
          shop: {
            select: {
              slug: true,
              name: true,
              phone: true,
              whatsapp: true,
              address: true,
              city: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * A tourist may cancel their own booking while it still holds a bike.
 * `updateMany` with the owner and status in the `where` makes the check and
 * the write one statement — there is no window between them.
 */
export async function cancelUserBooking(bookingId: string, userId: string) {
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, userId, status: { in: HOLDING_STATUSES } },
    data: { status: "cancelled" satisfies BookingStatus },
  });
  return count === 1;
}
