"use server";

import { revalidatePath } from "next/cache";

import { setShopVerified } from "@/lib/admin";
import { requireRole } from "@/lib/dal";

/** Publishes or hides a shop. Admin-only, checked here and not just in the UI. */
export async function setShopVerifiedAction(shopId: string, verified: boolean) {
  await requireRole("admin");
  await setShopVerified(shopId, verified);

  // Verification changes city pages, the home page counts and the shop page.
  revalidatePath("/", "layout");
}
