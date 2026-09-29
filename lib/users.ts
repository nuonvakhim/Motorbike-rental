/**
 * Lesson: "Authentication" — the user store, backed by Prisma.
 *
 * This is the module the guide's examples gesture at when they write
 * `db.insert(users)...`. Everything above it — the Server Actions, the DAL,
 * the DTO — only knows these function signatures, which is why swapping the
 * in-memory array for a real database touched no other file.
 *
 * `server-only` keeps it out of any client bundle: a Client Component
 * importing this would otherwise ship the database credentials.
 */

import "server-only";

import bcrypt from "bcryptjs";

import { toUserRole, type UserRole } from "@/lib/definitions";
import { prisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

export type { User };

/** What a Client Component is allowed to see. Never the password hash. */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

/**
 * Selecting explicit columns rather than the whole row is the database-level
 * half of the DTO idea: the hash never even leaves Postgres.
 */
const publicColumns = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function asPublicUser(row: {
  id: string;
  name: string;
  email: string;
  role: string;
}): PublicUser {
  return { ...row, role: toUserRole(row.role) };
}

/** Full row, hash included — only for verifying a password. */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const row = await prisma.user.findUnique({
    where: { id },
    select: publicColumns,
  });

  return row ? asPublicUser(row) : null;
}

export type NewUser = {
  name: string;
  email: string;
  /** Plain text. Hashed here so no caller can forget to. */
  password: string;
  /** Signup offers tourist or shop owner; admins are only ever seeded. */
  role: "user" | "owner";
};

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; reason: "email-taken" | "unknown" };

export async function createUser({
  name,
  email,
  password,
  role,
}: NewUser): Promise<CreateUserResult> {
  try {
    const row = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizeEmail(email),
        password: await bcrypt.hash(password, 10),
        role,
      },
      select: publicColumns,
    });

    return { ok: true, user: asPublicUser(row) };
  } catch (error) {
    // The `@unique` index on email rejects duplicates (Prisma P2002). That
    // is the user's to fix, so it goes back to the form. Anything else is
    // ours: log it, rather than dressing it up as a duplicate email.
    if ((error as { code?: string })?.code === "P2002") {
      return { ok: false, reason: "email-taken" };
    }
    console.error("createUser failed:", error);
    return { ok: false, reason: "unknown" };
  }
}

export function toPublicUser(user: User): PublicUser {
  return asPublicUser(user);
}

export async function verifyPassword(user: User, password: string) {
  return bcrypt.compare(password, user.password);
}
