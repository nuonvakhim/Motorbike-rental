/**
 * A bike's photo, or the drawn placeholder when the owner has not uploaded
 * one yet.
 *
 * `next/image` with `fill` covers the box and serves a resized copy for the
 * `sizes` given, so a card downloads a ~400px image rather than the 1600px
 * original. The box keeps its aspect ratio from `className`, so the layout
 * does not jump when the image arrives.
 */

import Image from "next/image";

import { BikeArt } from "@/components/bike-art";

export function BikeImage({
  photoId,
  type,
  alt,
  className = "",
  sizes,
  priority = false,
}: {
  photoId: string | null | undefined;
  type: string;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  if (!photoId) return <BikeArt type={type} className={className} />;

  return (
    <div className={`relative overflow-hidden bg-black/5 dark:bg-white/5 ${className}`}>
      <Image
        src={`/photos/${photoId}`}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
