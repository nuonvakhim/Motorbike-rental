/**
 * Lesson: "Authentication" — the Data Access Layer.
 *
 * Every read of the current user goes through here, so the auth check can
 * never be forgotten at a call site. `cache()` memoizes the result for the
 * duration of one render pass: call `verifySession()` in five components and
 * the cookie is only decrypted once.
 *
 * This is the real line of defence. `proxy.ts` only does an optimistic check.
 */

import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { homeFor, toUserRole, type UserRole } from "@/lib/definitions";
import { getSessionCookie, decrypt } from "@/lib/session";
import { getUserById, type PublicUser } from "@/lib/users";

/** Redirects to /login when there is no valid session. Never returns null. */
export const verifySession = cache(async () => {
  const cookie = await getSessionCookie();
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect("/login");
  }

  return {
    isAuth: true as const,
    userId: session.userId,
    role: toUserRole(session.role ?? "user"),
  };
});

/**
 * The same check, but returning null instead of redirecting — for UI that
 * renders either way, like a nav bar that shows "Log in" or the user's name.
 */
export const getOptionalSession = cache(async () => {
  const cookie = await getSessionCookie();
  const session = await decrypt(cookie);

  if (!session?.userId) return null;

  return {
    userId: session.userId,
    role: toUserRole(session.role ?? "user"),
  };
});

export const getUser = cache(async (): Promise<PublicUser | null> => {
  const session = await verifySession();
  if (!session) return null;

  try {
    // getUserById selects only the public columns, so the hash stays in the
    // database instead of being fetched and then stripped.
    return await getUserById(session.userId);
  } catch {
    console.log("Failed to fetch user");
    return null;
  }
});

/** The signed-in user, or null — never redirects. For the site header. */
export const getOptionalUser = cache(async (): Promise<PublicUser | null> => {
  const session = await getOptionalSession();
  if (!session) return null;

  try {
    return await getUserById(session.userId);
  } catch {
    return null;
  }
});

/**
 * A page guard for role-specific areas: `/owner` for shop owners, `/admin`
 * for administrators. Admins pass every check so they can see what an owner
 * sees.
 *
 * Signed-in users with the wrong role go to their own home page rather than
 * to /login: they *are* signed in, they simply may not be here.
 */
export const requireRole = cache(async (role: Exclude<UserRole, "user">) => {
  const session = await verifySession();

  if (session.role !== role && session.role !== "admin") {
    redirect(homeFor(session.role));
  }

  return session;
});
