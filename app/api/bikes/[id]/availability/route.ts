/**
 * Lesson: "Route Handlers" — a small JSON endpoint for a Client Component.
 *
 * The booking form calls this as the tourist changes dates, so they learn a
 * bike is taken *before* filling in their phone number. It is public (no
 * session needed) and read-only; the booking action re-checks everything
 * inside its own transaction, so a stale answer here can never over-book.
 *
 * GET /api/bikes/:id/availability?start=2026-10-01&end=2026-10-03
 */

import type { NextRequest } from "next/server";

import { MAX_RENTAL_DAYS, parseIsoDate, rentalDays, todayInCambodia } from "@/lib/catalog";
import { getBike, remainingUnits } from "@/lib/listings";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/bikes/[id]/availability">,
) {
  const { id } = await params;
  const start = request.nextUrl.searchParams.get("start") ?? "";
  const end = request.nextUrl.searchParams.get("end") ?? "";

  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  const days = rentalDays(start, end);

  if (!from || !to || days < 1) {
    return Response.json({ error: "Choose a pickup and a return date." }, { status: 400 });
  }
  if (start < todayInCambodia()) {
    return Response.json({ error: "The pickup day has already passed." }, { status: 400 });
  }
  if (days > MAX_RENTAL_DAYS) {
    return Response.json(
      { error: `Rentals are limited to ${MAX_RENTAL_DAYS} days.` },
      { status: 400 },
    );
  }

  const bike = await getBike(id);
  if (!bike || !bike.active || !bike.shop.verified) {
    return Response.json({ error: "Bike not found." }, { status: 404 });
  }

  const remaining = (await remainingUnits(id, from, to)) ?? 0;

  return Response.json(
    {
      available: remaining > 0,
      remaining: Math.max(0, remaining),
      days,
      total: bike.pricePerDay * days,
    },
    // Availability changes with every booking; never let a cache keep it.
    { headers: { "Cache-Control": "no-store" } },
  );
}
