/**
 * The tourist's bookings. `proxy.ts` already sent anonymous visitors to
 * /login, but the page checks again through the DAL — the proxy check is
 * only optimistic.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { cancelBookingAction } from "@/app/bookings/actions";
import { BookingStatusBadge } from "@/components/ui/badges";
import { formatDate, formatUsd, isoDate, todayInCambodia, whatsappLink } from "@/lib/catalog";
import { listUserBookings } from "@/lib/bookings";
import { verifySession } from "@/lib/dal";

export const metadata: Metadata = { title: "My bookings" };

export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const session = await verifySession();
  const [bookings, query] = await Promise.all([listUserBookings(session.userId), searchParams]);
  const today = todayInCambodia();
  const justBooked = typeof query.new === "string" ? query.new : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">My bookings</h1>

      {justBooked ? (
        <p role="status" className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-4 text-sm">
          <strong className="font-semibold">Request sent!</strong> The shop will confirm it — usually within a few
          hours. You can contact them directly using the details below.
        </p>
      ) : null}

      {bookings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">No bookings yet.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
            Find a bike →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {bookings.map((booking) => {
            const shop = booking.bike.shop;
            const canCancel =
              (booking.status === "pending" || booking.status === "confirmed") &&
              isoDate(booking.startDate) >= today;

            return (
              <li
                key={booking.id}
                className={`rounded-2xl border p-5 ${
                  booking.id === justBooked ? "border-accent" : "border-black/10 dark:border-white/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/bikes/${booking.bike.id}`} className="text-lg font-semibold hover:underline">
                      {booking.bike.name}
                    </Link>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      <Link href={`/shops/${shop.slug}`} className="hover:underline">
                        {shop.name}
                      </Link>{" "}
                      · {shop.city.name}
                    </p>
                  </div>
                  <BookingStatusBadge status={booking.status} />
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-black/50 dark:text-white/50">Dates</dt>
                    <dd>
                      {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-black/50 dark:text-white/50">Total (pay at pickup)</dt>
                    <dd>
                      {formatUsd(booking.totalPrice)} · {booking.days} {booking.days === 1 ? "day" : "days"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-black/50 dark:text-white/50">Shop contact</dt>
                    <dd>
                      {shop.phone}
                      {shop.whatsapp ? (
                        <>
                          {" "}·{" "}
                          <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            WhatsApp
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-sm text-black/60 dark:text-white/60">Pickup at {shop.address}</p>

                {canCancel ? (
                  <form action={cancelBookingAction.bind(null, booking.id)} className="mt-4">
                    <button
                      type="submit"
                      className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
                    >
                      Cancel booking
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
