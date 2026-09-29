import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createBikeAction } from "@/app/owner/actions";
import { BikeForm } from "@/components/owner/bike-form";
import { requireRole } from "@/lib/dal";
import { getOwnerShop } from "@/lib/owner";

export const metadata: Metadata = { title: "Add a bike" };

export default async function NewBikePage({ params }: PageProps<"/owner/shops/[id]/bikes/new">) {
  const session = await requireRole("owner");
  const { id } = await params;
  const shop = await getOwnerShop(session, id);

  if (!shop) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href={`/owner/shops/${shop.id}`} className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← {shop.name}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Add a bike</h1>
      <p className="mt-2 text-black/60 dark:text-white/60">
        List each model once and set how many of it you have — bookings are counted against that number.
      </p>
      <div className="mt-8">
        <BikeForm action={createBikeAction.bind(null, shop.id)} submitLabel="Add bike" />
      </div>
    </main>
  );
}
