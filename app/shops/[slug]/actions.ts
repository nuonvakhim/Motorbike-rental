"use server";

import { updateTag } from "next/cache";
import * as z from "zod";

import { CATALOG_TAG } from "@/lib/cache-tags";
import { getOptionalSession } from "@/lib/dal";
import { ReviewSchema, type ActionState } from "@/lib/definitions";
import { prisma } from "@/lib/prisma";
import { saveReview } from "@/lib/reviews";

/**
 * Saves the signed-in tourist's review of a shop. Owners cannot review their
 * own shop — the check is here, not only in the page that hides the form.
 */
export async function saveReviewAction(
  shopId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getOptionalSession();
  if (!session) return { status: "error", message: "Log in to leave a review." };

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { ownerId: true, slug: true, verified: true },
  });
  if (!shop || !shop.verified) return { status: "error", message: "Shop not found." };
  if (shop.ownerId === session.userId) {
    return { status: "error", message: "You cannot review your own shop." };
  }

  const parsed = ReviewSchema.safeParse({
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { status: "error", errors: z.flattenError(parsed.error).fieldErrors };
  }

  await saveReview({ shopId, userId: session.userId, ...parsed.data });

  // Ratings show on the shop page and on every city page's cards.
  updateTag(CATALOG_TAG);
  return { status: "success", message: "Thanks — your review is live." };
}
