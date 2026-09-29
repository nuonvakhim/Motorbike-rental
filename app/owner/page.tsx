/**
 * The shop owner's dashboard: incoming booking requests to answer, and the
 * shops they run.
 *
 * The Confirm / Decline buttons are plain <form>s bound to a Server Action —
 * no Client Component needed, and they work with JavaScript disabled.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { answerBookingAction } from "@/app/owner/actions";
import { BookingStatusBadge } from "@/components/ui/badges";
import { formatDate, formatUsd } from "@/lib/catalog";
import { requireRole } from "@/lib/dal";
import { listOwnerBookings, listOwnerShops } from "@/lib/owner";

export const metadata: Metadata = { title: "My shops" };

const smallButton =
  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors";

export default async function OwnerDashboard() {
  const session = await requireRole("owner");
  const [shops, bookings] = await Promise.all([
    listOwnerShops(session),
    listOwnerBookings(session),
  ]);
  const pending = bookings.filter((booking) => booking.status === "pending").length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">My shops</h1>
        <Link href="/owner/shops/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
          + Add a shop
        </Link>
      </div>

      {shops.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/15 p-10 text-center dark:border-white/20">
          <p className="font-medium">You have not listed a shop yet.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Add your shop and bikes. Once an admin verifies it, tourists can find and book you.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {shops.map((shop) => (
            <li key={shop.id}>
              <Link
                href={`/owner/shops/${shop.id}`}
                className="flex h-full flex-col gap-1 rounded-2xl border border-black/10 p-4 transition-colors hover:border-accent dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{shop.name}</h2>
                  {shop.verified ? (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Live</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Awaiting verification</span>
                  )}
                </div>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {shop.city.name} · {shop._count.bikes} {shop._count.bikes === 1 ? "bike model" : "bike models"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold">
          Booking requests{" "}
          {pending > 0 ? (
            <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{pending} new</span>
          ) : null}
        </h2>

        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-black/60 dark:text-white/60">No bookings yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-black/50 dark:bg-white/[0.04] dark:text-white/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Bike</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{booking.bike.name}</p>
                      <p className="text-xs text-black/50 dark:text-white/50">{booking.bike.shop.name}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(booking.startDate)}
                      <br />→ {formatDate(booking.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <p>{booking.contactName}</p>
                      <p className="text-xs text-black/60 dark:text-white/60">{booking.contactPhone}</p>
                      {booking.note ? (
                        <p className="mt-1 max-w-56 text-xs italic text-black/60 dark:text-white/60">“{booking.note}”</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatUsd(booking.totalPrice)}
                      <p className="text-xs text-black/50 dark:text-white/50">{booking.days} days</p>
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {booking.status === "pending" ? (
                          <form action={answerBookingAction.bind(null, booking.id, "confirmed")}>
                            <button type="submit" className={`${smallButton} border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-300`}>
                              Confirm
                            </button>
                          </form>
                        ) : null}
                        {booking.status === "pending" || booking.status === "confirmed" ? (
                          <form action={answerBookingAction.bind(null, booking.id, "rejected")}>
                            <button type="submit" className={`${smallButton} border-black/15 hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]`}>
                              Decline
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
