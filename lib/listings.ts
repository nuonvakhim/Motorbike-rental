/**
 * The public side of the catalogue: what a tourist can browse without an
 * account. Only verified shops and active bikes are ever returned from here —
 * the owner and admin views live in `lib/owner.ts` and `lib/admin.ts`.
 *
 * `server-only` keeps these queries (and the database connection) out of any
 * client bundle.
 */

import "server-only";

import { HOLDING_STATUSES, parseIsoDate, type BikeType } from "@/lib/catalog";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The cover photo for a bike card: just the id of the first photo. Selecting
 * the whole row would drag every image's bytes out of Postgres for a list
 * that only needs a URL.
 */
export const coverPhoto = {
  select: { id: true },
  orderBy: { sortOrder: "asc" },
  take: 1,
} satisfies Prisma.Bike$photosArgs;

export async function listCities() {
  const cities = await prisma.city.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      shops: {
        where: { verified: true },
        select: {
          bikes: {
            where: { active: true },
            select: { pricePerDay: true, quantity: true },
          },
        },
      },
    },
  });

  // Summaries for the city cards: how many shops and bikes, and the
  // cheapest daily price — the number a tourist compares first.
  return cities.map(({ shops, ...city }) => {
    const bikes = shops.flatMap((shop) => shop.bikes);
    return {
      ...city,
      shopCount: shops.length,
      bikeCount: bikes.reduce((sum, bike) => sum + bike.quantity, 0),
      fromPrice: bikes.length
        ? Math.min(...bikes.map((bike) => bike.pricePerDay))
        : null,
    };
  });
}

export async function getCity(slug: string) {
  return prisma.city.findUnique({ where: { slug } });
}

/** Average rating and count per shop, in one query rather than one per card. */
async function ratingsFor(shopIds: string[]) {
  if (shopIds.length === 0) return new Map<string, { average: number; count: number }>();

  const rows = await prisma.review.groupBy({
    by: ["shopId"],
    where: { shopId: { in: shopIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return new Map(
    rows.map((row) => [
      row.shopId,
      { average: row._avg.rating ?? 0, count: row._count._all },
    ]),
  );
}

export type BikeSearch = {
  type?: BikeType;
  maxPrice?: number;
  helmet?: boolean;
  noPassport?: boolean;
  /** Both or neither — a one-sided range is ignored. */
  start?: string;
  end?: string;
  sort: "price-asc" | "price-desc" | "rating";
};

/**
 * The overlap test for two inclusive date ranges: a booking clashes with
 * [start, end] when it starts on or before `end` and ends on or after
 * `start`. Shared by the search and the booking transaction so the list and
 * the "Book" button can never disagree.
 */
export function overlapping(start: Date, end: Date): Prisma.BookingWhereInput {
  return {
    status: { in: HOLDING_STATUSES },
    startDate: { lte: end },
    endDate: { gte: start },
  };
}

export async function searchBikes(citySlug: string, search: BikeSearch) {
  const start = search.start ? parseIsoDate(search.start) : null;
  const end = search.end ? parseIsoDate(search.end) : null;
  const range = start && end && end >= start ? { start, end } : null;

  const where: Prisma.BikeWhereInput = {
    active: true,
    shop: {
      verified: true,
      city: { slug: citySlug },
      ...(search.noPassport ? { depositPolicy: { not: "passport" } } : {}),
    },
    ...(search.type ? { type: search.type } : {}),
    ...(search.maxPrice ? { pricePerDay: { lte: search.maxPrice } } : {}),
    ...(search.helmet ? { helmetIncluded: true } : {}),
  };

  const bikes = await prisma.bike.findMany({
    where,
    orderBy: { pricePerDay: search.sort === "price-desc" ? "desc" : "asc" },
    include: {
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          depositPolicy: true,
          depositAmount: true,
        },
      },
      photos: coverPhoto,
      // Filtered relation count: how many of this bike's units are already
      // held for the chosen dates. Without dates there is nothing to count.
      _count: range
        ? { select: { bookings: { where: overlapping(range.start, range.end) } } }
        : undefined,
    },
  });

  const ratings = await ratingsFor([...new Set(bikes.map((bike) => bike.shopId))]);

  const results = bikes
    .map(({ _count, photos, ...bike }) => ({
      ...bike,
      coverPhotoId: photos[0]?.id ?? null,
      remaining: range ? bike.quantity - (_count?.bookings ?? 0) : bike.quantity,
      rating: ratings.get(bike.shopId) ?? null,
    }))
    // With dates chosen, a fully booked bike is not a search result.
    .filter((bike) => bike.remaining > 0);

  if (search.sort === "rating") {
    results.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
  }

  return { bikes: results, hasDates: Boolean(range) };
}

export async function listCityShops(cityId: string) {
  const shops = await prisma.shop.findMany({
    where: { cityId, verified: true },
    orderBy: { name: "asc" },
    include: {
      bikes: { where: { active: true }, select: { pricePerDay: true } },
    },
  });

  const ratings = await ratingsFor(shops.map((shop) => shop.id));

  return shops.map(({ bikes, ...shop }) => ({
    ...shop,
    bikeModels: bikes.length,
    fromPrice: bikes.length ? Math.min(...bikes.map((bike) => bike.pricePerDay)) : null,
    rating: ratings.get(shop.id) ?? null,
  }));
}

/**
 * A shop page. Unverified shops are returned too, because the owner and the
 * admin need to preview them — the page decides who may see one.
 */
export async function getShop(slug: string) {
  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: {
      city: true,
      bikes: {
        where: { active: true },
        orderBy: { pricePerDay: "asc" },
        include: { photos: coverPhoto },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!shop) return null;

  const count = shop.reviews.length;
  const average = count
    ? shop.reviews.reduce((sum, review) => sum + review.rating, 0) / count
    : 0;

  return { ...shop, rating: count ? { average, count } : null };
}

export async function getBike(id: string) {
  return prisma.bike.findUnique({
    where: { id },
    include: {
      shop: { include: { city: true } },
      photos: {
        select: { id: true, width: true, height: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/** The image bytes, for the /photos Route Handler only. */
export async function getPhotoData(id: string) {
  return prisma.bikePhoto.findUnique({
    where: { id },
    select: { data: true },
  });
}

/** How many units of a bike are free across an inclusive date range. */
export async function remainingUnits(bikeId: string, start: Date, end: Date) {
  const bike = await prisma.bike.findUnique({
    where: { id: bikeId },
    select: {
      quantity: true,
      active: true,
      _count: { select: { bookings: { where: overlapping(start, end) } } },
    },
  });

  if (!bike || !bike.active) return null;
  return bike.quantity - bike._count.bookings;
}

/** Just id and name, for the city picker in the owner's shop form. */
export async function listCityOptions() {
  return prisma.city.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}
