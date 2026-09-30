/**
 * Lesson: "Authentication" — the Prisma client singleton.
 *
 * `next dev` re-evaluates modules on every hot reload. Without the
 * `globalThis` cache each reload would open a brand-new connection pool and
 * the database would run out of connections — the same trick `lib/todos.ts`
 * uses to keep its in-memory array alive, for a different reason.
 *
 * Prisma 7 talks to Postgres through a driver adapter (`@prisma/adapter-pg`)
 * rather than a bundled engine binary.
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env — see prisma7.config.ts.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 20, // connections per app instance
      // Give up instead of waiting forever. The database is remote over TLS,
      // and a cold connection can take several seconds — 5 s failed a build.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    }),
  });
}

export const prisma: PrismaClient =
  globalForPrisma.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
