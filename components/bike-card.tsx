/**
 * One search result. The whole card is a link to the bike page; the chosen
 * dates travel along in the query string so the booking form opens with
 * them already filled in.
 */

import Link from "next/link";

import { BikeImage } from "@/components/bike-image";
import { DepositBadge, Pill, Stars } from "@/components/ui/badges";
import { bikeTypeLabel, formatUsd } from "@/lib/catalog";

export type BikeCardData = {
  id: string;
  name: string;
  type: string;
  engineCc: number;
  pricePerDay: number;
  helmetIncluded: boolean;
  remaining: number;
  coverPhotoId?: string | null;
  shop: { name: string; depositPolicy: string; depositAmount: number | null };
  rating: { average: number; count: number } | null;
};

export function BikeCard({
  bike,
  dates,
}: {
  bike: BikeCardData;
  dates?: { start: string; end: string } | null;
}) {
  const href = dates
    ? `/bikes/${bike.id}?start=${dates.start}&end=${dates.end}`
    : `/bikes/${bike.id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-background transition-shadow hover:shadow-lg dark:border-white/10 dark:hover:shadow-black"
    >
      <BikeImage
        photoId={bike.coverPhotoId}
        type={bike.type}
        // The bike's name is the card's heading, so the photo adds no text.
        alt=""
        className="aspect-[16/9]"
        sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold group-hover:underline">{bike.name}</h3>
            <p className="text-sm text-black/60 dark:text-white/60">{bike.shop.name}</p>
          </div>
          <p className="text-right">
            <span className="text-lg font-semibold">{formatUsd(bike.pricePerDay)}</span>
            <span className="block text-xs text-black/50 dark:text-white/50">per day</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Pill>{bikeTypeLabel(bike.type)}</Pill>
          <Pill>{bike.engineCc > 0 ? `${bike.engineCc}cc` : "Electric"}</Pill>
          {bike.helmetIncluded ? <Pill>Helmet included</Pill> : null}
          <DepositBadge policy={bike.shop.depositPolicy} amount={bike.shop.depositAmount} />
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <Stars rating={bike.rating} />
          {dates ? (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {bike.remaining} available
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
