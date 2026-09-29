/**
 * One bike: details, the shop's rules, and the booking form.
 *
 * Dates chosen on the city page arrive as `?start=&end=`, so the form opens
 * pre-filled, and their availability is computed here on the server — the
 * form shows "3 left" immediately instead of fetching on mount.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createBookingAction } from "@/app/bikes/[id]/actions";
import { BikeGallery } from "@/components/bike-gallery";
import { BookingForm } from "@/components/booking-form";
import { DepositBadge, Pill } from "@/components/ui/badges";
import {
  BIKE_TYPES,
  MAX_RENTAL_DAYS,
  addDays,
  formatUsd,
  parseIsoDate,
  rentalDays,
  todayInCambodia,
  whatsappLink,
} from "@/lib/catalog";
import { getOptionalSession, getOptionalUser } from "@/lib/dal";
import { getBike, remainingUnits } from "@/lib/listings";

export async function generateMetadata({
  params,
}: PageProps<"/bikes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const bike = await getBike(id);

  return bike
    ? {
        title: `${bike.name} in ${bike.shop.city.name} — ${formatUsd(bike.pricePerDay)}/day`,
        description: `Rent a ${bike.name} from ${bike.shop.name}, ${bike.shop.city.name}.`,
      }
    : { title: "Bike not found" };
}

function pickDates(raw: Record<string, string | string[] | undefined>, today: string) {
  const start = typeof raw.start === "string" ? raw.start : "";
  const end = typeof raw.end === "string" ? raw.end : "";
  const days = rentalDays(start, end);

  if (start >= today && days >= 1 && days <= MAX_RENTAL_DAYS) {
    return { start, end, fromUrl: true };
  }
  return { start: addDays(today, 1), end: addDays(today, 3), fromUrl: false };
}

export default async function BikePage({ params, searchParams }: PageProps<"/bikes/[id]">) {
  const { id } = await params;
  const [bike, session] = await Promise.all([getBike(id), getOptionalSession()]);

  if (!bike) notFound();

  // Hidden bikes and unverified shops stay private to their owner and admins.
  const isOwnerView = session?.role === "admin" || session?.userId === bike.shop.ownerId;
  const listed = bike.active && bike.shop.verified;
  if (!listed && !isOwnerView) notFound();

  const today = todayInCambodia();
  const dates = pickDates(await searchParams, today);
  const remaining = listed
    ? await remainingUnits(bike.id, parseIsoDate(dates.start)!, parseIsoDate(dates.end)!)
    : null;
  const user = session ? await getOptionalUser() : null;

  const typeInfo = BIKE_TYPES.find((type) => type.value === bike.type);
  const needsLicence = bike.engineCc > 125;
  const loginHref = `/login?next=${encodeURIComponent(`/bikes/${bike.id}?start=${dates.start}&end=${dates.end}`)}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <nav className="text-sm text-black/60 dark:text-white/60">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/cities/${bike.shop.city.slug}`} className="hover:underline">
          {bike.shop.city.name}
        </Link>{" "}
        /{" "}
        <Link href={`/shops/${bike.shop.slug}`} className="hover:underline">
          {bike.shop.name}
        </Link>
      </nav>

      {!listed ? (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Preview only — tourists cannot see this bike until{" "}
          {bike.active ? "an admin verifies the shop" : "you make it active again"}.
        </p>
      ) : null}

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <BikeGallery photos={bike.photos} type={bike.type} name={bike.name} />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{bike.name}</h1>
              <p className="mt-1 text-black/60 dark:text-white/60">
                {typeInfo?.label ?? bike.type} · {bike.engineCc > 0 ? `${bike.engineCc}cc` : "Electric"}
              </p>
            </div>
            <p className="text-right">
              <span className="text-3xl font-semibold">{formatUsd(bike.pricePerDay)}</span>
              <span className="block text-sm text-black/50 dark:text-white/50">per day</span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {bike.helmetIncluded ? <Pill>Helmet included</Pill> : <Pill>Bring your own helmet</Pill>}
            <Pill>
              {bike.quantity} {bike.quantity === 1 ? "bike" : "bikes"} in the fleet
            </Pill>
            <DepositBadge policy={bike.shop.depositPolicy} amount={bike.shop.depositAmount} />
          </div>

          {bike.description ? (
            <p className="mt-6 max-w-2xl whitespace-pre-line text-black/80 dark:text-white/80">{bike.description}</p>
          ) : null}
          {typeInfo ? <p className="mt-3 text-sm text-black/60 dark:text-white/60">{typeInfo.hint}.</p> : null}

          {needsLicence ? (
            <p className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <strong className="font-semibold">Licence required.</strong> This bike is over 125cc, which needs a
              full motorbike licence (for example an International Driving Permit with the motorcycle category).
              Travel insurance usually requires one too — check the current rules before you ride.
            </p>
          ) : null}

          <section className="mt-8 rounded-2xl border border-black/10 p-5 dark:border-white/10">
            <h2 className="font-semibold">
              Rented by{" "}
              <Link href={`/shops/${bike.shop.slug}`} className="text-accent hover:underline">
                {bike.shop.name}
              </Link>
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-black/50 dark:text-white/50">Address</dt>
              <dd>{bike.shop.address}</dd>
              <dt className="text-black/50 dark:text-white/50">Open</dt>
              <dd>{bike.shop.openHours}</dd>
              <dt className="text-black/50 dark:text-white/50">Deposit</dt>
              <dd>
                <DepositBadge policy={bike.shop.depositPolicy} amount={bike.shop.depositAmount} />
              </dd>
              <dt className="text-black/50 dark:text-white/50">Contact</dt>
              <dd>
                {bike.shop.phone}
                {bike.shop.whatsapp ? (
                  <>
                    {" "}·{" "}
                    <a href={whatsappLink(bike.shop.whatsapp)} className="text-accent hover:underline" rel="noopener noreferrer" target="_blank">
                      WhatsApp
                    </a>
                  </>
                ) : null}
              </dd>
            </dl>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-black/10 p-5 shadow-sm dark:border-white/10">
            <h2 className="text-lg font-semibold">Request this bike</h2>
            <div className="mt-4">
              {!listed ? (
                <p className="text-sm text-black/60 dark:text-white/60">Booking opens once the bike is listed.</p>
              ) : session ? (
                <BookingForm
                  action={createBookingAction.bind(null, bike.id)}
                  bikeId={bike.id}
                  pricePerDay={bike.pricePerDay}
                  today={today}
                  defaultStart={dates.start}
                  defaultEnd={dates.end}
                  defaultName={user?.name ?? ""}
                  initialRemaining={remaining}
                />
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-black/70 dark:text-white/70">
                    {remaining !== null && dates.fromUrl
                      ? remaining > 0
                        ? `${remaining} available for your dates.`
                        : "Fully booked for your dates."
                      : "Create a free account to send a booking request."}
                  </p>
                  <Link href={loginHref} className="flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
                    Log in to book
                  </Link>
                  <Link
                    href={`/signup?next=${encodeURIComponent(`/bikes/${bike.id}?start=${dates.start}&end=${dates.end}`)}`}
                    className="flex h-10 items-center justify-center rounded-lg border border-black/15 dark:border-white/20"
                  >
                    Create an account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
