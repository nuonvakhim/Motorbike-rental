/**
 * The home page: pick a city and dates, or browse a city card.
 *
 * The search box is a `next/form` <Form> with a string action, so submitting
 * it is a client-side GET navigation to `/search?city=…&start=…&end=…` —
 * no Server Action, no JavaScript state. `/search` is a Route Handler that
 * turns the chosen city into a path segment (see `app/search/route.ts`).
 */

import Form from "next/form";
import Link from "next/link";

import { addDays, formatUsd, todayInCambodia } from "@/lib/catalog";
import { listCities } from "@/lib/listings";

const fieldClass =
  "h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:text-white dark:focus:border-white/50";

const tips = [
  {
    title: "Licence rules",
    body: "Bikes over 125cc need a full motorbike licence, and rules for smaller bikes change — check the current rules and that your travel insurance covers riding.",
  },
  {
    title: "Keep your passport",
    body: "Some shops hold your passport as a deposit. Filter for “No passport needed” to find shops that take a cash deposit instead.",
  },
  {
    title: "Helmet, always",
    body: "Helmets are mandatory for driver and passenger. Most listings include one — look for the “Helmet included” tag.",
  },
  {
    title: "Check before you ride",
    body: "Take photos of any scratches at pickup, test the brakes and lights, and ask how much fuel the tank has.",
  },
];

export default async function HomePage() {
  const cities = await listCities();
  const today = todayInCambodia();

  return (
    <main>
      <section className="border-b border-black/10 bg-accent-soft dark:border-white/10">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:py-24">
          <div>
            <p className="text-sm font-medium text-accent">Scooters · Semi-autos · Dirt bikes</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Rent a motorbike and explore Cambodia your way
            </h1>
            <p className="mt-4 max-w-xl text-lg text-black/70 dark:text-white/70">
              Compare local rental shops in Phnom Penh, Siem Reap, Battambang, Kampot and more.
              See prices, deposit rules and reviews, then book the bike you want before you arrive.
            </p>
          </div>

          <Form
            action="/search"
            className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-background p-5 shadow-sm dark:border-white/10"
          >
            <h2 className="font-semibold">Find a bike</h2>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              City
              <select name="city" required className={fieldClass} defaultValue="">
                <option value="" disabled>
                  Where are you riding?
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Pickup
                <input type="date" name="start" min={today} defaultValue={addDays(today, 1)} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Return
                <input type="date" name="end" min={today} defaultValue={addDays(today, 3)} className={fieldClass} />
              </label>
            </div>
            <button
              type="submit"
              className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground"
            >
              Search bikes
            </button>
          </Form>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Choose a city</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <li key={city.id}>
              <Link
                href={`/cities/${city.slug}`}
                className="flex h-full flex-col gap-2 rounded-2xl border border-black/10 p-5 transition-colors hover:border-accent dark:border-white/10"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">{city.name}</h3>
                  <span className="text-xs text-black/50 dark:text-white/50">{city.province}</span>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70">{city.tagline}</p>
                <p className="mt-auto pt-2 text-sm">
                  {city.shopCount > 0 ? (
                    <>
                      <span className="font-medium">{city.shopCount}</span> shops ·{" "}
                      <span className="font-medium">{city.bikeCount}</span> bikes
                      {city.fromPrice !== null ? (
                        <>
                          {" "}· from <span className="font-semibold text-accent">{formatUsd(city.fromPrice)}</span>/day
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-black/50 dark:text-white/50">Shops coming soon</span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            ["1. Search", "Pick a city and your dates. Only bikes that are free for those days are shown."],
            ["2. Request", "Send a booking request with your phone or WhatsApp number. The shop confirms it."],
            ["3. Ride", "Pick the bike up at the shop, pay there, and hand it back on your return day."],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-black/70 dark:text-white/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="riding-tips" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Before you ride</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tips.map((tip) => (
            <div key={tip.title} className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
              <h3 className="font-semibold">{tip.title}</h3>
              <p className="mt-2 text-sm text-black/70 dark:text-white/70">{tip.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-black/60 dark:text-white/60">
          Own a rental shop?{" "}
          <Link href="/signup?as=owner" className="font-medium text-accent underline-offset-4 hover:underline">
            List your bikes for free
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
