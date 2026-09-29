import type { Metadata } from "next";
import Link from "next/link";

import { createShopAction } from "@/app/owner/actions";
import { ShopForm } from "@/components/owner/shop-form";
import { requireRole } from "@/lib/dal";
import { listCityOptions } from "@/lib/listings";

export const metadata: Metadata = { title: "Add a shop" };

export default async function NewShopPage() {
  await requireRole("owner");
  const cities = await listCityOptions();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/owner" className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← My shops
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Add your rental shop</h1>
      <p className="mt-2 text-black/60 dark:text-white/60">
        After you save, add your bikes. An admin checks new shops before they appear in search.
      </p>
      <div className="mt-8">
        <ShopForm action={createShopAction} cities={cities} submitLabel="Create shop" />
      </div>
    </main>
  );
}
