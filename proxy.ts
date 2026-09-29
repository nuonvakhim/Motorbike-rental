/**
 * Lesson: "Authentication" — optimistic auth checks.
 *
 * Note the filename: as of Next.js 16 the `middleware` convention is
 * deprecated and renamed to `proxy`. It sits at the project root, next to
 * `app/`, and runs before a route renders.
 *
 * This runs on *every* matched request, including prefetches, so it only
 * reads the cookie — no database calls. It is a redirect convenience, not a
 * security boundary; the real checks are `verifySession()` and
 * `requireRole()` in `lib/dal.ts`.
 *
 * **The lists below are an allowlist.** Tourists browse cities, shops and
 * bikes without an account, so those are public; everything not named here
 * (bookings, the owner dashboard, admin) needs a session. An allowlist is the
 * safer shape: forgetting to add a new route to it makes that route too
 * strict rather than wide open.
 */

import { NextResponse, type NextRequest } from "next/server";

import { decrypt } from "@/lib/session";

// 1. Pages reachable without a session.
const publicRoutes = ["/", "/login", "/signup", "/search"];
const publicPrefixes = ["/cities/", "/shops/", "/bikes/", "/photos/"];
const authRoutes = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  // 2. Anything else is protected by default.
  const path = req.nextUrl.pathname;
  const isPublicRoute =
    publicRoutes.includes(path) ||
    publicPrefixes.some((prefix) => path.startsWith(prefix));

  // 3. Decrypt the session from the cookie
  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  // 4. No session and not a public page? Off to the login screen, remembering
  //    where the visitor was heading.
  if (!isPublicRoute && !session?.userId) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // 5. Already signed in? The login and signup forms have nothing to offer.
  if (authRoutes.includes(path) && session?.userId) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

// Routes Proxy should not run on. `/api` is excluded here, so each Route
// Handler does its own check — see `app/api/me/route.ts`.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|favicon.ico).*)"],
};
