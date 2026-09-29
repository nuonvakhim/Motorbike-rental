/**
 * The admin console: site numbers, and the queue of shops to verify.
 * `requireRole("admin")` sends anyone else back to their own home page.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { setShopVerifiedAction } from "@/app/admin/actions";
import { DepositBadge } from "@/components/ui/badges";
import { formatDate } from "@/lib/catalog";
import { listAllShops, siteStats } from "@/lib/admin";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireRole("admin");
  const [stats, shops] = await Promise.all([siteStats(), listAllShops()]);

  const tiles = [
    { label: "Live shops", value: stats.shops },
    { label: "Awaiting verification", value: stats.pendingShops },
    { label: "Active bikes", value: stats.bikes },
    { label: "Bookings", value: stats.bookings },
    { label: "Pending requests", value: stats.pendingBookings },
    { label: "Accounts", value: stats.users },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <dt className="text-xs text-black/50 dark:text-white/50">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-12 text-lg font-semibold">Shops</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-black/50 dark:bg-white/[0.04] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Shop</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Deposit</th>
              <th className="px-4 py-3 font-medium">Bikes</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td className="px-4 py-3">
                  <Link href={`/shops/${shop.slug}`} className="font-medium hover:underline">
                    {shop.name}
                  </Link>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {shop.city.name} · added {formatDate(shop.createdAt)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{shop.owner.name}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">{shop.owner.email}</p>
                </td>
                <td className="px-4 py-3">
                  <DepositBadge policy={shop.depositPolicy} amount={shop.depositAmount} />
                </td>
                <td className="px-4 py-3 tabular-nums">{shop._count.bikes}</td>
                <td className="px-4 py-3">
                  {shop.verified ? (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Live</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Awaiting verification</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={setShopVerifiedAction.bind(null, shop.id, !shop.verified)}>
                    <button
                      type="submit"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        shop.verified
                          ? "border-black/15 hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
                          : "border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-300"
                      }`}
                    >
                      {shop.verified ? "Unpublish" : "Verify"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
