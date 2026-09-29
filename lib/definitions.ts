/**
 * Lesson: "Authentication" — schemas and shared types.
 *
 * Validation lives here rather than in the action files because a file with
 * the `"use server"` directive may only export async functions. Schemas and
 * types belong outside it.
 */

import * as z from "zod";

import { BIKE_TYPE_VALUES, DEPOSIT_POLICY_VALUES } from "@/lib/catalog";

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

/** "user" is a tourist; "owner" runs a rental shop. */
export type UserRole = "admin" | "owner" | "user";

export function toUserRole(value: string): UserRole {
  return value === "admin" || value === "owner" ? value : "user";
}

/** Where each kind of account lands after signing in. */
export function homeFor(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "owner") return "/owner";
  return "/bookings";
}

/**
 * Only same-site paths are accepted as a post-login destination. `//evil.com`
 * starts with a slash too, which is why the second check exists — without it
 * this is an open redirect.
 */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

export const passwordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters long" })
  .regex(/[a-zA-Z]/, { error: "Password must contain at least one letter" })
  .regex(/[0-9]/, { error: "Password must contain at least one number" })
  .regex(/[^a-zA-Z0-9]/, {
    error: "Password must contain at least one special character",
  })
  .trim();

export const SignupFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long" })
    .trim(),
  email: z.email({ error: "Please enter a valid email address" }).trim(),
  password: passwordSchema,
  // Nobody can sign themselves up as an admin: the enum leaves it out.
  accountType: z.enum(["user", "owner"], {
    error: "Choose tourist or shop owner",
  }),
});

/**
 * Login deliberately does NOT reuse the signup rules. Re-checking password
 * strength on login would leak which passwords could possibly exist, and it
 * would lock out users whose password predates a rule change.
 */
export const LoginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email address" }).trim(),
  password: z.string().min(1, { error: "Password is required" }),
});

export type FormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        accountType?: string[];
      };
      message?: string;
    }
  | undefined;

/**
 * What goes inside the signed session cookie.
 *
 * Keep this to the minimum needed on later requests — an id and a role. Never
 * an email, phone number or anything else personally identifiable: a JWT is
 * signed, not encrypted, so anyone holding the cookie can read the payload.
 */
export type SessionPayload = {
  userId: string;
  role: UserRole;
  expiresAt: Date;
};

/* ------------------------------------------------------------------ */
/* Rental forms                                                        */
/* ------------------------------------------------------------------ */

/**
 * The state every rental form action returns. `errors` is keyed by input
 * name, so one type serves the shop, bike, booking and review forms.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export const idleState: ActionState = { status: "idle" };

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date" });

export const BookingSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    contactName: z
      .string()
      .trim()
      .min(2, { error: "Tell the shop who is picking the bike up" })
      .max(80),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,20}$/, {
        error: "Enter a phone or WhatsApp number",
      }),
    note: z.string().trim().max(500).default(""),
  })
  .refine((value) => value.endDate >= value.startDate, {
    error: "The return day cannot be before the pickup day",
    path: ["endDate"],
  });

export const ShopSchema = z.object({
  name: z.string().trim().min(3, { error: "Shop name is too short" }).max(80),
  cityId: z.string().min(1, { error: "Choose a city" }),
  description: z
    .string()
    .trim()
    .min(20, { error: "Describe the shop in at least 20 characters" })
    .max(1000),
  address: z.string().trim().min(5, { error: "Enter the street address" }).max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, { error: "Enter a phone number" }),
  whatsapp: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ()-]{6,20})?$/, { error: "Enter a number or leave blank" }),
  openHours: z.string().trim().min(3, { error: "e.g. 7:00 – 20:00 daily" }).max(80),
  depositPolicy: z.enum(DEPOSIT_POLICY_VALUES, {
    error: "Choose a deposit policy",
  }),
  depositAmount: z.coerce
    .number({ error: "Enter a number" })
    .int()
    .min(0)
    .max(5000)
    .optional(),
});

export const BikeSchema = z.object({
  name: z.string().trim().min(3, { error: "e.g. Honda Click 125" }).max(80),
  type: z.enum(BIKE_TYPE_VALUES, {
    error: "Choose a bike type",
  }),
  engineCc: z.coerce
    .number({ error: "Enter the engine size" })
    .int()
    .min(0, { error: "Use 0 for electric bikes" })
    .max(1500),
  pricePerDay: z.coerce
    .number({ error: "Enter a price" })
    .int({ error: "Whole dollars only" })
    .min(1, { error: "At least $1" })
    .max(500),
  quantity: z.coerce.number().int().min(1, { error: "At least one bike" }).max(100),
  helmetIncluded: z.boolean(),
  description: z.string().trim().max(1000).default(""),
});

export const ReviewSchema = z.object({
  rating: z.coerce
    .number({ error: "Choose a rating" })
    .int()
    .min(1, { error: "Choose a rating" })
    .max(5),
  comment: z
    .string()
    .trim()
    .min(10, { error: "Write at least 10 characters" })
    .max(1000),
});
