"use server";

/**
 * Everything a shop owner can change, as Server Actions.
 *
 * Each action does the same three things, in order:
 *
 *  1. **Authorize** with `requireRole("owner")`. Hiding a button from
 *     tourists hides nothing from `curl`.
 *  2. **Validate** with the Zod schema from `lib/definitions.ts`.
 *  3. **Write** through `lib/owner.ts`, whose queries all filter by owner id —
 *     so a valid shop id that belongs to someone else simply matches nothing.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { slugify } from "@/lib/catalog";
import { requireRole } from "@/lib/dal";
import { BikeSchema, ShopSchema, type ActionState } from "@/lib/definitions";
import { MAX_PHOTOS_PER_BIKE, processPhoto, type ProcessedPhoto } from "@/lib/images";
import {
  addBikePhotos,
  answerBooking,
  countBikePhotos,
  deleteBikePhoto,
  makeCoverPhoto,
  createBike,
  createShop,
  getOwnerBike,
  updateBike,
  updateShop,
} from "@/lib/owner";
import { prisma } from "@/lib/prisma";

function readShop(formData: FormData) {
  const deposit = String(formData.get("depositAmount") ?? "").trim();
  return {
    name: formData.get("name"),
    cityId: formData.get("cityId"),
    description: formData.get("description"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp") ?? "",
    openHours: formData.get("openHours"),
    depositPolicy: formData.get("depositPolicy"),
    depositAmount: deposit === "" ? undefined : deposit,
  };
}

function readBike(formData: FormData) {
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    engineCc: formData.get("engineCc"),
    pricePerDay: formData.get("pricePerDay"),
    quantity: formData.get("quantity"),
    helmetIncluded: formData.get("helmetIncluded") === "1",
    description: formData.get("description") ?? "",
  };
}

async function cityExists(cityId: string) {
  return Boolean(await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } }));
}

export async function createShopAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("owner");
  const parsed = ShopSchema.safeParse(readShop(formData));

  if (!parsed.success) {
    return { status: "error", errors: z.flattenError(parsed.error).fieldErrors };
  }
  if (!(await cityExists(parsed.data.cityId))) {
    return { status: "error", errors: { cityId: ["Choose a city from the list"] } };
  }

  const { whatsapp, depositAmount, ...rest } = parsed.data;
  const shop = await createShop(session.userId, slugify(rest.name), {
    ...rest,
    whatsapp: whatsapp || null,
    depositAmount: depositAmount ?? null,
  });

  revalidatePath("/owner");
  redirect(`/owner/shops/${shop.id}?created=1`);
}

export async function updateShopAction(
  shopId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("owner");
  const parsed = ShopSchema.safeParse(readShop(formData));

  if (!parsed.success) {
    return { status: "error", errors: z.flattenError(parsed.error).fieldErrors };
  }
  if (!(await cityExists(parsed.data.cityId))) {
    return { status: "error", errors: { cityId: ["Choose a city from the list"] } };
  }

  const { whatsapp, depositAmount, ...rest } = parsed.data;
  const ok = await updateShop(session, shopId, {
    ...rest,
    whatsapp: whatsapp || null,
    depositAmount: depositAmount ?? null,
  });

  if (!ok) return { status: "error", message: "Shop not found." };

  revalidatePath("/", "layout");
  return {
    status: "success",
    message:
      session.role === "admin"
        ? "Saved."
        : "Saved. The changes go live again once an admin re-verifies the shop.",
  };
}

export async function createBikeAction(
  shopId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("owner");
  const parsed = BikeSchema.safeParse(readBike(formData));

  if (!parsed.success) {
    return { status: "error", errors: z.flattenError(parsed.error).fieldErrors };
  }

  const bike = await createBike(session, shopId, parsed.data);
  if (!bike) return { status: "error", message: "Shop not found." };

  revalidatePath("/", "layout");
  // Straight on to the photos — a listing without one gets far fewer bookings.
  redirect(`/owner/bikes/${bike.id}?created=1`);
}

export async function updateBikeAction(
  bikeId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("owner");
  const parsed = BikeSchema.safeParse(readBike(formData));

  if (!parsed.success) {
    return { status: "error", errors: z.flattenError(parsed.error).fieldErrors };
  }

  const bike = await getOwnerBike(session, bikeId);
  if (!bike || !(await updateBike(session, bikeId, parsed.data))) {
    return { status: "error", message: "Bike not found." };
  }

  revalidatePath("/", "layout");
  redirect(`/owner/shops/${bike.shopId}`);
}

/** Pausing keeps the bike and its booking history; it just leaves search. */
export async function setBikeActiveAction(bikeId: string, active: boolean) {
  const session = await requireRole("owner");
  await updateBike(session, bikeId, { active });
  revalidatePath("/", "layout");
}

export async function answerBookingAction(
  bookingId: string,
  status: "confirmed" | "rejected",
) {
  const session = await requireRole("owner");
  await answerBooking(session, bookingId, status);
  revalidatePath("/owner");
  revalidatePath("/bookings");
}

/**
 * Adds photos to a bike. Each file is decoded and re-encoded by
 * `processPhoto`; if any one of them is not a usable image, none are saved,
 * so the owner is never left guessing which ones made it.
 */
export async function uploadBikePhotosAction(
  bikeId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("owner");

  const bike = await getOwnerBike(session, bikeId);
  if (!bike) return { status: "error", message: "Bike not found." };

  const files = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return { status: "error", errors: { photos: ["Choose at least one photo"] } };
  }

  const room = MAX_PHOTOS_PER_BIKE - (await countBikePhotos(bikeId));
  if (files.length > room) {
    return {
      status: "error",
      errors: {
        photos: [
          room === 0
            ? `This bike already has ${MAX_PHOTOS_PER_BIKE} photos. Delete one first.`
            : `You can add ${room} more ${room === 1 ? "photo" : "photos"} (max ${MAX_PHOTOS_PER_BIKE}).`,
        ],
      },
    };
  }

  const processed: ProcessedPhoto[] = [];
  const problems: string[] = [];
  // One at a time: decoding several large images at once is what would
  // make the server run out of memory.
  for (const file of files) {
    const result = await processPhoto(file);
    if (result.ok) processed.push(result.photo);
    else problems.push(result.error);
  }

  if (problems.length > 0) {
    return { status: "error", errors: { photos: problems } };
  }

  await addBikePhotos(session, bikeId, processed);

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: `${processed.length} ${processed.length === 1 ? "photo" : "photos"} added.`,
  };
}

export async function deleteBikePhotoAction(photoId: string) {
  const session = await requireRole("owner");
  await deleteBikePhoto(session, photoId);
  revalidatePath("/", "layout");
}

export async function makeCoverPhotoAction(photoId: string) {
  const session = await requireRole("owner");
  await makeCoverPhoto(session, photoId);
  revalidatePath("/", "layout");
}
