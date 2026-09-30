/**
 * A rental shop's public page: its rules, its bikes and its reviews.
 *
 * Unverified shops are visible only to their owner and to admins, as a
 * preview; to everyone else they 404 exactly like a shop that never existed.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveReviewAction } from "@/app/shops/[slug]/actions";
import { BikeCard } from "@/components/bike-card";
import { ReviewForm } from "@/components/review-form";
import { DepositBadge, Stars } from "@/components/ui/badges";
import { formatDate, whatsappLink } from "@/lib/catalog";
import { getOptionalSession } from "@/lib/dal";
import { getShop } from "@/lib/listings";
import { getUserReview } from "@/lib/reviews";

export async function generateMetadata({
  params,
}: PageProps<"/shops/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShop(slug);

  return shop
    ? {
        title: `${shop.name} — motorbike rental in ${shop.city.name}`,
        description: shop.description.slice(0, 160),
      }
    : { title: "Shop not found" };
}

export default async function ShopPage({ params }: PageProps<"/shops/[slug]">) {
  const { slug } = await params;
  const [shop, session] = await Promise.all([getShop(slug), getOptionalSession()]);

  if (!shop) notFound();

  const isOwner = session?.userId === shop.ownerId;
  if (!shop.verified && !isOwner && session?.role !== "admin") notFound();

  const myReview = session && !isOwner ? await getUserReview(shop.id, session.userId) : null;
  const rating = shop.rating;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <nav className="text-sm text-black/60 dark:text-white/60">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/cities/${shop.city.slug}`} className="hover:underline">
          {shop.city.name}
        </Link>{" "}
        / {shop.name}
      </nav>

      {!shop.verified ? (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Waiting for verification — only you and the site admins can see this page.
        </p>
      ) : null}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
          <div className="mt-2">
            <Stars rating={rating} />
          </div>
          <p className="mt-4 whitespace-pre-line text-black/80 dark:text-white/80">{shop.description}</p>
        </div>
        {isOwner ? (
          <Link href={`/owner/shops/${shop.id}`} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20">
            Edit shop
          </Link>
        ) : null}
      </header>

      <dl className="mt-6 grid gap-4 rounded-2xl border border-black/10 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
        <div>
          <dt className="text-black/50 dark:text-white/50">Address</dt>
          <dd className="mt-1">{shop.address}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Opening hours</dt>
          <dd className="mt-1">{shop.openHours}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Deposit</dt>
          <dd className="mt-1">
            <DepositBadge policy={shop.depositPolicy} amount={shop.depositAmount} />
          </dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Contact</dt>
          <dd className="mt-1">
            {shop.phone}
            {shop.whatsapp ? (
              <>
                {" "}·{" "}
                <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  WhatsApp
                </a>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Bikes for rent</h2>
        {shop.bikes.length === 0 ? (
          <p className="mt-3 text-sm text-black/60 dark:text-white/60">No bikes listed yet.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shop.bikes.map((bike) => (
              <li key={bike.id}>
                <BikeCard
                  bike={{ ...bike, remaining: bike.quantity, shop, rating, coverPhotoId: bike.photos[0]?.id }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="text-lg font-semibold">Reviews</h2>
          {rating && rating.count > shop.reviews.length ? (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              The latest {shop.reviews.length} of {rating.count} reviews.
            </p>
          ) : null}
          {shop.reviews.length === 0 ? (
            <p className="mt-3 text-sm text-black/60 dark:text-white/60">No reviews yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {shop.reviews.map((review) => (
                <li key={review.id} className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{review.user.name}</p>
                    <p className="text-xs text-black/50 dark:text-white/50">{formatDate(review.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-amber-500" aria-label={`${review.rating} out of 5`}>
                    {"★".repeat(review.rating)}
                    <span className="text-black/15 dark:text-white/15">{"★".repeat(5 - review.rating)}</span>
                  </p>
                  <p className="mt-2 text-sm text-black/80 dark:text-white/80">{review.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {!shop.verified ? null : session && !isOwner ? (
            <ReviewForm action={saveReviewAction.bind(null, shop.id)} existing={myReview} />
          ) : !session ? (
            <p className="rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10">
              <Link href={`/login?next=/shops/${shop.slug}`} className="font-medium text-accent hover:underline">
                Log in
              </Link>{" "}
              to review this shop.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
