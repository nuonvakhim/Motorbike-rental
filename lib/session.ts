/**
 * Lesson: "Authentication" — stateless sessions.
 *
 * The session is a JWT signed with SESSION_SECRET and stored in an HttpOnly
 * cookie. Nothing is kept server-side, which is why it is called stateless:
 * the cookie *is* the session, and the signature is what makes it trustworthy.
 *
 * `server-only` makes the build fail if a Client Component ever imports this
 * file — that would ship the secret to the browser.
 */

import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import type { SessionPayload, UserRole } from "@/lib/definitions";

const secretKey = process.env.SESSION_SECRET;

if (!secretKey) {
  // Fail at startup rather than silently signing every session with `undefined`.
  throw new Error(
    "SESSION_SECRET is not set. Add it to .env — generate one with: openssl rand -base64 32",
  );
}

const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload, expiresAt: payload.expiresAt.toISOString() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

/**
 * Returns the payload, or `undefined` when the cookie is missing, expired or
 * has been tampered with. `jwtVerify` throws on a bad signature — that throw
 * is the whole point, so it is caught and treated as "no session".
 */
export async function decrypt(session: string | undefined = "") {
  // No cookie is the normal state for a visitor who has not logged in —
  // not worth a log line on every page view.
  if (!session) return undefined;

  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });

    return payload as { userId?: string; role?: UserRole; expiresAt?: string };
  } catch {
    console.log("Failed to verify session");
    return undefined;
  }
}

export async function createSession(userId: string, role: UserRole) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ userId, role, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, session, {
    // Client-side JavaScript cannot read it, so an XSS bug cannot steal it.
    httpOnly: true,
    // Sent over HTTPS only. `localhost` counts as secure, so dev still works.
    secure: true,
    expires: expiresAt,
    // Not sent on cross-site POSTs — a basic CSRF defence.
    sameSite: "lax",
    path: "/",
  });
}

/** Slides the expiry forward so an active user is not logged out mid-session. */
export async function updateSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    return null;
  }

  const expires = new Date(Date.now() + SESSION_DURATION_MS);

  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    expires,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSessionCookie() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
