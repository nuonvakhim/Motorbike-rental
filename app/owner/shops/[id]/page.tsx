/**
 * Managing one shop: its details and its fleet.
 *
 * `getOwnerShop` filters by owner id, so another owner's shop id lands on
 * the 404 page rather than on a form they could submit.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setBikeActiveAction, updateShopAction } from "@/app/owner/actions";
import { BikeImage } from "@/components/bike-image";
import { ShopForm } from "@/components/owner/shop-form";
import { bikeTypeLabel, formatUsd } from "@/lib/catalog";
import { requireRole } from "@/lib/dal";
import { listCityOptions } from "@/lib/listings";
import { getOwnerShop } from "@/lib/owner";

export const metadata: Metadata = { title: "Manage shop" };

export default async function ManageShopPage({
  params,
  searchParams,
}: PageProps<"/owner/shops/[id]">) {
  const session = await requireRole("owner");
  const { id } = await params;
  const [shop, cities, query] = await Promise.all([
    getOwnerShop(session, id),
    listCityOptions(),
    searchParams,
  ]);

  if (!shop) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/owner" className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← My shops
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
        <Link href={`/shops/${shop.slug}`} className="text-sm font-medium text-accent hover:underline">
          View public page →
        </Link>
      </div>

      {query.created ? (
        <p role="status" className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">
          Shop created. Add your bikes below — an admin will verify the shop shortly.
        </p>
      ) : null}
      {!shop.verified ? (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Awaiting verification — tourists cannot see this shop yet.
        </p>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Bikes</h2>
          <Link
            href={`/owner/shops/${shop.id}/bikes/new`}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground"
          >
            + Add a bike
          </Link>
        </div>

        {shop.bikes.length === 0 ? (
          <p className="mt-3 text-sm text-black/60 dark:text-white/60">No bikes yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/10 dark:border-white/10">
            {shop.bikes.map((bike) => (
              <li key={bike.id} className={`flex flex-wrap items-center gap-4 p-3 ${bike.active ? "" : "opacity-60"}`}>
                <BikeImage
                  photoId={bike.photos[0]?.id}
                  type={bike.type}
                  alt=""
                  sizes="80px"
                  className="h-12 w-20 shrink-0 rounded-lg"
                />
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {bike.name} {bike.active ? null : <span className="text-xs text-black/50 dark:text-white/50">(paused)</span>}
                  </p>
                  <p className="text-sm text-black/60 dark:text-white/60">
                    {bikeTypeLabel(bike.type)} · {bike.engineCc > 0 ? `${bike.engineCc}cc` : "Electric"} · ×{bike.quantity}
                  </p>
                </div>
                <p className="font-semibold">{formatUsd(bike.pricePerDay)}/day</p>
                <div className="flex gap-2">
                  <Link href={`/owner/bikes/${bike.id}`} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20">
                    Edit
                  </Link>
                  <form action={setBikeActiveAction.bind(null, bike.id, !bike.active)}>
                    <button type="submit" className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20">
                      {bike.active ? "Pause" : "Activate"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Shop details</h2>
        <div className="mt-4">
          <ShopForm
            action={updateShopAction.bind(null, shop.id)}
            cities={cities}
            submitLabel="Save changes"
            defaults={{
              name: shop.name,
              cityId: shop.cityId,
              description: shop.description,
              address: shop.address,
              phone: shop.phone,
              whatsapp: shop.whatsapp ?? "",
              openHours: shop.openHours,
              depositPolicy: shop.depositPolicy,
              depositAmount: shop.depositAmount,
            }}
          />
        </div>
      </section>
    </main>
  );
}
