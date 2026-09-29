/**
 * Turning the city page's query string into a `BikeSearch`.
 *
 * Filters live in the URL rather than in `useState`, so a search can be
 * bookmarked, shared in a group chat, and restored by the back button.
 * Anything malformed is dropped rather than rejected — a hand-edited URL
 * should still show bikes.
 */

import {
  BIKE_TYPE_VALUES,
  MAX_RENTAL_DAYS,
  parseIsoDate,
  rentalDays,
  todayInCambodia,
  type BikeType,
} from "@/lib/catalog";
import type { BikeSearch } from "@/lib/listings";

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBikeSearch(raw: RawParams): BikeSearch {
  const type = first(raw.type);
  const max = Number(first(raw.max));
  const sort = first(raw.sort);
  let start = first(raw.start);
  let end = first(raw.end);

  // Dates only count as a pair, in order, not in the past, and within the
  // longest rental a shop will take.
  const days = start && end ? rentalDays(start, end) : 0;
  if (
    !start ||
    !end ||
    !parseIsoDate(start) ||
    days < 1 ||
    days > MAX_RENTAL_DAYS ||
    start < todayInCambodia()
  ) {
    start = undefined;
    end = undefined;
  }

  return {
    type: BIKE_TYPE_VALUES.includes(type as BikeType) ? (type as BikeType) : undefined,
    maxPrice: Number.isInteger(max) && max > 0 ? max : undefined,
    helmet: first(raw.helmet) === "1",
    noPassport: first(raw.nopassport) === "1",
    start,
    end,
    sort: sort === "price-desc" || sort === "rating" ? sort : "price-asc",
  };
}
