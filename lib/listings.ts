/**
 * The public side of the catalogue: what a tourist can browse without an
 * account. Only verified shops and active bikes are ever returned from here —
 * the owner and admin views live in `lib/owner.ts` and `lib/admin.ts`.
 *
 * `server-only` keeps these queries (and the database connection) out of any
 * client bundle.
 *
 * Lesson: "Caching". The reads every tourist shares — cities, shops, bikes,
 * reviews — are `use cache` functions, so a thousand visitors to the same
 * city page cost one set of queries, not a thousand. The arguments are the
 * cache key. Server Actions call `updateTag` with the tags from
 * `lib/cache-tags.ts` after a change. Anything that must be exact at the
 * moment of booking (`remainingUnits`, the booking transaction) is not
 * cached.
 */

import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { AVAILABILITY_TAG, CATALOG_TAG } from "@/lib/cache-tags";
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
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  // Summaries for the city cards: how many shops and bikes, and the
  // cheapest daily price — the number a tourist compares first. Postgres
  // does the sums per shop, so this reads one row per shop rather than one
  // per bike, however large the catalogue grows.
  const [cities, shops, bikeTotals] = await Promise.all([
    prisma.city.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.shop.findMany({
      where: { verified: true },
      select: { id: true, cityId: true },
    }),
    prisma.bike.groupBy({
      by: ["shopId"],
      where: { active: true, shop: { verified: true } },
      _sum: { quantity: true },
      _min: { pricePerDay: true },
    }),
  ]);

  const totalsByShop = new Map(bikeTotals.map((row) => [row.shopId, row]));

  return cities.map((city) => {
    const cityShops = shops.filter((shop) => shop.cityId === city.id);
    const totals = cityShops.flatMap((shop) => totalsByShop.get(shop.id) ?? []);
    const prices = totals.flatMap((row) => row._min.pricePerDay ?? []);
    return {
      ...city,
      shopCount: cityShops.length,
      bikeCount: totals.reduce((sum, row) => sum + (row._sum.quantity ?? 0), 0),
      fromPrice: prices.length ? Math.min(...prices) : null,
    };
  });
}

export async function getCity(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

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

/** Bike cards per page on a city page. */
export const SEARCH_PAGE_SIZE = 24;
/** The most bikes one search reads from the database. */
const MAX_SEARCH_ROWS = 500;

export async function searchBikes(citySlug: string, search: BikeSearch) {
  "use cache";
  const start = search.start ? parseIsoDate(search.start) : null;
  const end = search.end ? parseIsoDate(search.end) : null;
  const range = start && end && end >= start ? { start, end } : null;

  // With dates, the result counts bookings, so it also expires whenever a
  // booking is made or cancelled — and after a few minutes regardless. A
  // slightly stale list is harmless: the booking transaction re-checks.
  cacheTag(CATALOG_TAG);
  if (range) {
    cacheTag(AVAILABILITY_TAG);
    cacheLife("minutes");
  } else {
    cacheLife("hours");
  }

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
    // A ceiling, not paging: the city page shows SEARCH_PAGE_SIZE at a time
    // from this cached list. Filtering booked-out bikes and sorting by rating
    // happen after the query, so paging in SQL would give wrong pages.
    take: MAX_SEARCH_ROWS,
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
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

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

/** Reviews listed on a shop page, newest first. */
export const REVIEWS_SHOWN = 20;

/**
 * A shop page. Unverified shops are returned too, because the owner and the
 * admin need to preview them — the page decides who may see one.
 */
export async function getShop(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: {
      city: true,
      bikes: {
        where: { active: true },
        orderBy: { pricePerDay: "asc" },
        include: { photos: coverPhoto },
      },
      // The newest few only: a popular shop's page should not grow with
      // every review ever written. The rating below still counts them all.
      reviews: {
        orderBy: { createdAt: "desc" },
        take: REVIEWS_SHOWN,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!shop) return null;

  const { _avg, _count } = await prisma.review.aggregate({
    where: { shopId: shop.id },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = _count._all;

  return { ...shop, rating: count ? { average: _avg.rating ?? 0, count } : null };
}

export async function getBike(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

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
