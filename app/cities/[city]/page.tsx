/**
 * A city's bikes, filtered by the query string.
 *
 * `params` and `searchParams` are both Promises in this version of Next.js
 * and are awaited before use. Reading `searchParams` makes the page render
 * per request, which is what a search page needs anyway.
 *
 * The filter bar is a `next/form` <Form> whose action is this same path, so
 * "Apply" is a client-side navigation to a new URL — and the page re-renders
 * on the server with the new filters.
 */

import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BikeCard } from "@/components/bike-card";
import { DepositBadge, Stars } from "@/components/ui/badges";
import {
  BIKE_TYPES,
  MAX_RENTAL_DAYS,
  formatDate,
  formatUsd,
  rentalDays,
  todayInCambodia,
} from "@/lib/catalog";
import { getCity, listCityShops, searchBikes } from "@/lib/listings";
import { parseBikeSearch } from "@/lib/search-params";

export async function generateMetadata({
  params,
}: PageProps<"/cities/[city]">): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await getCity(slug);

  return city
    ? {
        title: `Motorbike rental in ${city.name}`,
        description: `Compare scooter and motorbike rental shops in ${city.name}. ${city.tagline}`,
      }
    : { title: "City not found" };
}

const fieldClass =
  "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:focus:border-white/50";

export default async function CityPage({
  params,
  searchParams,
}: PageProps<"/cities/[city]">) {
  const { city: slug } = await params;
  const city = await getCity(slug);

  if (!city) notFound();

  const search = parseBikeSearch(await searchParams);
  const [{ bikes, hasDates }, shops] = await Promise.all([
    searchBikes(city.slug, search),
    listCityShops(city.id),
  ]);

  const today = todayInCambodia();
  const dates = hasDates && search.start && search.end ? { start: search.start, end: search.end } : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <nav className="text-sm text-black/60 dark:text-white/60">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        / {city.name}
      </nav>

      <header className="mt-3 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Motorbike rental in {city.name}</h1>
        <p className="mt-3 text-black/70 dark:text-white/70">{city.description}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <Form
            action={`/cities/${city.slug}`}
            className="flex flex-col gap-4 rounded-2xl border border-black/10 p-4 lg:sticky lg:top-20 dark:border-white/10"
          >
            <h2 className="font-semibold">Filters</h2>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Pickup
                <input type="date" name="start" min={today} defaultValue={search.start} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Return
                <input type="date" name="end" min={today} defaultValue={search.end} className={fieldClass} />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Bike type
              <select name="type" defaultValue={search.type ?? ""} className={fieldClass}>
                <option value="">Any type</option>
                {BIKE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Max price per day
              <select name="max" defaultValue={search.maxPrice?.toString() ?? ""} className={fieldClass}>
                <option value="">No limit</option>
                {[6, 8, 10, 15, 25, 40].map((price) => (
                  <option key={price} value={price}>
                    Up to {formatUsd(price)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Sort by
              <select name="sort" defaultValue={search.sort} className={fieldClass}>
                <option value="price-asc">Lowest price</option>
                <option value="price-desc">Highest price</option>
                <option value="rating">Best rated shop</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="helmet" value="1" defaultChecked={search.helmet} className="size-4 accent-[var(--accent)]" />
              Helmet included
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="nopassport" value="1" defaultChecked={search.noPassport} className="size-4 accent-[var(--accent)]" />
              No passport needed
            </label>

            <div className="flex gap-2">
              <button type="submit" className="h-10 flex-1 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground">
                Apply
              </button>
              <Link
                href={`/cities/${city.slug}`}
                className="flex h-10 items-center rounded-lg border border-black/15 px-3 text-sm dark:border-white/20"
              >
                Reset
              </Link>
            </div>
          </Form>
        </aside>

        <section aria-labelledby="results-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-heading" className="text-lg font-semibold">
              {bikes.length} {bikes.length === 1 ? "bike" : "bikes"}
              {dates ? " available" : ""}
            </h2>
            {dates ? (
              <p className="text-sm text-black/60 dark:text-white/60">
                {formatDate(dates.start)} → {formatDate(dates.end)} · {rentalDays(dates.start, dates.end)} days
              </p>
            ) : (
              <p className="text-sm text-black/60 dark:text-white/60">
                Add dates to see what is free (up to {MAX_RENTAL_DAYS} days).
              </p>
            )}
          </div>

          {bikes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-black/15 p-10 text-center dark:border-white/20">
              <p className="font-medium">No bikes match these filters.</p>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Try other dates, a higher price or another bike type.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {bikes.map((bike) => (
                <li key={bike.id}>
                  <BikeCard bike={bike} dates={dates} />
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-14 text-lg font-semibold">Rental shops in {city.name}</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/shops/${shop.slug}`}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-black/10 p-4 transition-colors hover:border-accent dark:border-white/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{shop.name}</h3>
                    <Stars rating={shop.rating} count={false} />
                  </div>
                  <p className="text-sm text-black/60 dark:text-white/60">{shop.address}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-sm">
                    <DepositBadge policy={shop.depositPolicy} amount={shop.depositAmount} />
                    <span className="text-black/60 dark:text-white/60">
                      {shop.bikeModels} models
                      {shop.fromPrice !== null ? ` · from ${formatUsd(shop.fromPrice)}/day` : ""}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
