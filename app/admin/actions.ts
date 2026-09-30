"use server";

import { revalidatePath, updateTag } from "next/cache";

import { setShopVerified } from "@/lib/admin";
import { CATALOG_TAG } from "@/lib/cache-tags";
import { requireRole } from "@/lib/dal";

/** Publishes or hides a shop. Admin-only, checked here and not just in the UI. */
export async function setShopVerifiedAction(shopId: string, verified: boolean) {
  await requireRole("admin");
  await setShopVerified(shopId, verified);

  // Verification changes city pages, the home page counts and the shop page
  // — all cached catalogue reads.
  updateTag(CATALOG_TAG);
  revalidatePath("/admin");
}
