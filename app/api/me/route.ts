/**
 * Lesson: "Authentication" — protecting a Route Handler.
 *
 * Treat a Route Handler like any public API endpoint. Note that `proxy.ts`
 * excludes `/api` in its matcher, so nothing has checked this request before
 * it arrives here.
 *
 * The guide calls `verifySession()` here, but ours redirects — the right
 * answer for a page, the wrong one for JSON. So this uses the non-redirecting
 * variant and returns status codes instead: 401 for "not logged in", 403 for
 * "logged in but not allowed".
 */

import { getOptionalSession } from "@/lib/dal";
import { getUserById } from "@/lib/users";

export async function GET() {
  const session = await getOptionalSession();

  if (!session) {
    return new Response(null, { status: 401 });
  }

  const user = await getUserById(session.userId);

  if (!user) {
    return new Response(null, { status: 401 });
  }

  return Response.json(user);
}

export async function DELETE() {
  const session = await getOptionalSession();

  if (!session) {
    return new Response(null, { status: 401 });
  }

  // Authenticated, but not permitted.
  if (session.role !== "admin") {
    return new Response(null, { status: 403 });
  }

  return new Response(null, { status: 204 });
}
