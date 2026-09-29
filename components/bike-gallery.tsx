"use client";

/**
 * The bike page's photos: one large image and a row of thumbnails.
 *
 * A Client Component only because clicking a thumbnail changes which photo
 * is large. The images themselves are still `next/image`, resized on the
 * server.
 */

import Image from "next/image";
import { useState } from "react";

import { BikeArt } from "@/components/bike-art";

export function BikeGallery({
  photos,
  type,
  name,
}: {
  photos: { id: string }[];
  type: string;
  name: string;
}) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return <BikeArt type={type} className="aspect-[16/9] rounded-2xl" />;
  }

  const current = photos[Math.min(active, photos.length - 1)];

  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
        <Image
          key={current.id}
          src={`/photos/${current.id}`}
          alt={`${name}, photo ${active + 1} of ${photos.length}`}
          fill
          priority
          sizes="(min-width: 1024px) 700px, 100vw"
          className="object-cover"
        />
      </div>

      {photos.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="More photos">
          {photos.map((photo, index) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
                className={`relative block h-16 w-24 overflow-hidden rounded-lg border-2 transition-opacity ${
                  index === active ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={`/photos/${photo.id}`} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
