/**
 * Editing one bike: its photos first (they sell the bike), then its details.
 *
 * "Make cover" and "Delete" are plain <form>s bound to Server Actions — no
 * client JavaScript needed. Only the uploader is a Client Component, because
 * it previews and shrinks photos before sending them.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteBikePhotoAction,
  makeCoverPhotoAction,
  updateBikeAction,
  uploadBikePhotosAction,
} from "@/app/owner/actions";
import { BikeForm } from "@/components/owner/bike-form";
import { PhotoUploader } from "@/components/owner/photo-uploader";
import { requireRole } from "@/lib/dal";
import { MAX_PHOTOS_PER_BIKE } from "@/lib/images";
import { getOwnerBike } from "@/lib/owner";

export const metadata: Metadata = { title: "Edit bike" };

const photoButton =
  "rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur hover:bg-black/85";

export default async function EditBikePage({ params, searchParams }: PageProps<"/owner/bikes/[id]">) {
  const session = await requireRole("owner");
  const { id } = await params;
  const [bike, query] = await Promise.all([getOwnerBike(session, id), searchParams]);

  if (!bike) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href={`/owner/shops/${bike.shop.id}`} className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← {bike.shop.name}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{bike.name}</h1>

      {query.created ? (
        <p role="status" className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">
          Bike added. Now add a few photos — listings with photos get far more bookings.
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Photos{" "}
          <span className="text-sm font-normal text-black/50 dark:text-white/50">
            {bike.photos.length} / {MAX_PHOTOS_PER_BIKE}
          </span>
        </h2>

        {bike.photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {bike.photos.map((photo, index) => (
              <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
                <Image
                  src={`/photos/${photo.id}`}
                  alt={`${bike.name}, photo ${index + 1}`}
                  fill
                  sizes="(min-width: 640px) 240px, 50vw"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    Cover
                  </span>
                ) : null}
                <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
                  {index > 0 ? (
                    <form action={makeCoverPhotoAction.bind(null, photo.id)}>
                      <button type="submit" className={photoButton}>
                        Make cover
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteBikePhotoAction.bind(null, photo.id)}>
                    <button type="submit" className={photoButton} aria-label={`Delete photo ${index + 1}`}>
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            No photos yet — tourists see a drawing of the bike type instead.
          </p>
        )}

        <div className="mt-4">
          <PhotoUploader
            action={uploadBikePhotosAction.bind(null, bike.id)}
            remaining={MAX_PHOTOS_PER_BIKE - bike.photos.length}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Details</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          A new price applies to new bookings only — existing ones keep the price they were made at.
        </p>
        <div className="mt-4">
          <BikeForm
            action={updateBikeAction.bind(null, bike.id)}
            submitLabel="Save bike"
            defaults={{
              name: bike.name,
              type: bike.type,
              engineCc: bike.engineCc,
              pricePerDay: bike.pricePerDay,
              quantity: bike.quantity,
              helmetIncluded: bike.helmetIncluded,
              description: bike.description,
            }}
          />
        </div>
      </section>
    </main>
  );
}
