/**
 * The shop owner's side: their shops, their bikes, and the booking requests
 * for them.
 *
 * Every query takes the owner's id and puts it in the `where` clause. That is
 * the authorization: an owner asking for someone else's shop gets `null`
 * back, exactly as if the shop did not exist. Admins are passed through with
 * `ownerId: undefined`, which Prisma reads as "no filter".
 */

import "server-only";

import type { BookingStatus } from "@/lib/catalog";
import type { ProcessedPhoto } from "@/lib/images";
import type { UserRole } from "@/lib/definitions";
import type { Prisma } from "@/lib/generated/prisma/client";
import { coverPhoto } from "@/lib/listings";
import { prisma } from "@/lib/prisma";

export type Viewer = { userId: string; role: UserRole };

function ownedBy(viewer: Viewer) {
  return viewer.role === "admin" ? undefined : viewer.userId;
}

export async function listOwnerShops(viewer: Viewer) {
  return prisma.shop.findMany({
    where: { ownerId: viewer.userId },
    orderBy: { createdAt: "asc" },
    include: {
      city: { select: { name: true } },
      _count: { select: { bikes: true } },
    },
  });
}

export async function getOwnerShop(viewer: Viewer, shopId: string) {
  return prisma.shop.findFirst({
    where: { id: shopId, ownerId: ownedBy(viewer) },
    include: {
      city: true,
      bikes: {
        orderBy: [{ active: "desc" }, { pricePerDay: "asc" }],
        include: { photos: coverPhoto },
      },
    },
  });
}

export async function getOwnerBike(viewer: Viewer, bikeId: string) {
  return prisma.bike.findFirst({
    where: { id: bikeId, shop: { ownerId: ownedBy(viewer) } },
    include: {
      shop: { select: { id: true, name: true } },
      // Never `data` here: the bytes are only read by the /photos route.
      photos: {
        select: { id: true, width: true, height: true, size: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

const statusOrder: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  rejected: 2,
  cancelled: 3,
};

export async function listOwnerBookings(viewer: Viewer) {
  const bookings = await prisma.booking.findMany({
    where: { bike: { shop: { ownerId: viewer.userId } } },
    orderBy: { startDate: "asc" },
    take: 100,
    include: {
      bike: { select: { name: true, shop: { select: { name: true } } } },
      user: { select: { name: true, email: true } },
    },
  });

  // Requests still waiting for an answer first, then the soonest pickups.
  // Sorted here because the statuses are strings, and alphabetical order
  // would put "cancelled" on top.
  return bookings.sort(
    (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9),
  );
}

type ShopInput = Omit<Prisma.ShopUncheckedCreateInput, "id" | "ownerId" | "slug" | "verified">;

/** Slugs are public URLs, so a clash gets a numeric suffix, not an error. */
async function uniqueShopSlug(base: string) {
  const root = base || "shop";
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const taken = await prisma.shop.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${root}-${Date.now()}`;
}

export async function createShop(ownerId: string, slugBase: string, data: ShopInput) {
  return prisma.shop.create({
    data: { ...data, ownerId, slug: await uniqueShopSlug(slugBase) },
    select: { id: true },
  });
}

/**
 * Editing a shop sends it back for review: an admin verified the old
 * details, not the new ones.
 */
export async function updateShop(viewer: Viewer, shopId: string, data: ShopInput) {
  const { count } = await prisma.shop.updateMany({
    where: { id: shopId, ownerId: ownedBy(viewer) },
    data: { ...data, ...(viewer.role === "admin" ? {} : { verified: false }) },
  });
  return count === 1;
}

type BikeInput = Omit<Prisma.BikeUncheckedCreateInput, "id" | "shopId">;

export async function createBike(viewer: Viewer, shopId: string, data: BikeInput) {
  const shop = await getOwnerShop(viewer, shopId);
  if (!shop) return null;
  return prisma.bike.create({ data: { ...data, shopId }, select: { id: true } });
}

export async function updateBike(viewer: Viewer, bikeId: string, data: Partial<BikeInput>) {
  const { count } = await prisma.bike.updateMany({
    where: { id: bikeId, shop: { ownerId: ownedBy(viewer) } },
    data,
  });
  return count === 1;
}

/**
 * The owner's answer to a request. Only a pending booking can be confirmed
 * or declined; a confirmed one can still be declined (say, the bike broke
 * down). A cancelled one is final.
 */
export async function answerBooking(
  viewer: Viewer,
  bookingId: string,
  status: Extract<BookingStatus, "confirmed" | "rejected">,
) {
  const from: BookingStatus[] = status === "confirmed" ? ["pending"] : ["pending", "confirmed"];

  const { count } = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: { in: from },
      bike: { shop: { ownerId: ownedBy(viewer) } },
    },
    data: { status },
  });
  return count === 1;
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

export async function countBikePhotos(bikeId: string) {
  return prisma.bikePhoto.count({ where: { bikeId } });
}

/** Appends photos after the existing ones, keeping the current cover. */
export async function addBikePhotos(viewer: Viewer, bikeId: string, photos: ProcessedPhoto[]) {
  const bike = await getOwnerBike(viewer, bikeId);
  if (!bike) return false;

  const last = bike.photos.length
    ? await prisma.bikePhoto.aggregate({ where: { bikeId }, _max: { sortOrder: true } })
    : null;
  const start = (last?._max.sortOrder ?? -1) + 1;

  await prisma.bikePhoto.createMany({
    data: photos.map((photo, index) => ({ ...photo, bikeId, sortOrder: start + index })),
  });
  return true;
}

export async function deleteBikePhoto(viewer: Viewer, photoId: string) {
  const { count } = await prisma.bikePhoto.deleteMany({
    where: { id: photoId, bike: { shop: { ownerId: ownedBy(viewer) } } },
  });
  return count === 1;
}

/** Moves a photo in front of all the others, making it the cover. */
export async function makeCoverPhoto(viewer: Viewer, photoId: string) {
  const photo = await prisma.bikePhoto.findFirst({
    where: { id: photoId, bike: { shop: { ownerId: ownedBy(viewer) } } },
    select: { bikeId: true },
  });
  if (!photo) return false;

  const first = await prisma.bikePhoto.aggregate({
    where: { bikeId: photo.bikeId },
    _min: { sortOrder: true },
  });
  await prisma.bikePhoto.update({
    where: { id: photoId },
    data: { sortOrder: (first._min.sortOrder ?? 0) - 1 },
  });
  return true;
}
