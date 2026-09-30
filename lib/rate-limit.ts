/**
 * A small fixed-window rate limiter for the Server Actions a bot would
 * hammer: login (guessing passwords, and every guess costs ~70 ms of bcrypt
 * CPU), signup, and booking requests.
 *
 * Counters live in this process's memory. That is enough for one server; if
 * the site ever runs several instances, each would count separately and the
 * limits would multiply — move the counters to Redis or Postgres then.
 */

import "server-only";

import { headers } from "next/headers";

type Window = { count: number; resetAt: number };

// Kept on globalThis for the same reason as the Prisma client: `next dev`
// re-evaluates modules on hot reload and would otherwise reset every count.
const globalForLimits = globalThis as unknown as { __rateLimits?: Map<string, Window> };
const windows = (globalForLimits.__rateLimits ??= new Map());

/** Drop finished windows now and then, so the map cannot grow forever. */
function prune(now: number) {
  if (windows.size < 10_000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type LimitResult = { ok: true } | { ok: false; retryAfterMinutes: number };

/**
 * Counts one attempt against `key` and says whether it is allowed:
 * at most `limit` attempts per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  prune(now);

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  window.count += 1;
  if (window.count > limit) {
    return { ok: false, retryAfterMinutes: Math.ceil((window.resetAt - now) / 60_000) };
  }
  return { ok: true };
}

/**
 * The visitor's IP address, for per-client limits.
 *
 * `next start` fills in `x-forwarded-for` with the socket address only when
 * the header is missing, and a reverse proxy (nginx, a load balancer)
 * appends the address it saw. The rightmost entry is therefore the one our
 * own infrastructure wrote; entries to its left are whatever the client
 * claimed. Without a proxy in front, a client can still send its own header
 * — which is why login is also limited per email address.
 */
export async function clientIp() {
  const list = (await headers()).get("x-forwarded-for") ?? "";
  const hops = list.split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops.at(-1) ?? "unknown";
}

export function tooManyMessage(result: Extract<LimitResult, { ok: false }>) {
  const minutes = result.retryAfterMinutes;
  return `Too many attempts. Please wait ${minutes} ${minutes === 1 ? "minute" : "minutes"} and try again.`;
}
