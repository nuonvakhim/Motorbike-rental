/**
 * The rental site's fixed vocabulary — bike types, deposit policies, booking
 * statuses — plus the date and money helpers every page needs.
 *
 * No `server-only` here: labels and price formatting are used by Client
 * Components (the booking form) as well as Server Components.
 */

export const BIKE_TYPE_VALUES = [
  "scooter",
  "semi-auto",
  "manual",
  "dirt",
  "electric",
] as const;

export type BikeType = (typeof BIKE_TYPE_VALUES)[number];

export const BIKE_TYPES: { value: BikeType; label: string; hint: string }[] = [
  { value: "scooter", label: "Automatic scooter", hint: "Easiest to ride in city traffic" },
  { value: "semi-auto", label: "Semi-automatic", hint: "Gears without a clutch — the Honda Dream" },
  { value: "manual", label: "Manual", hint: "Clutch and gears, for experienced riders" },
  { value: "dirt", label: "Dirt bike", hint: "For countryside roads and trails" },
  { value: "electric", label: "Electric", hint: "Quiet, short range, no fuel stops" },
];

export function bikeTypeLabel(type: string) {
  return BIKE_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export const DEPOSIT_POLICY_VALUES = [
  "cash",
  "passport",
  "cash-or-passport",
  "none",
] as const;

export type DepositPolicy = (typeof DEPOSIT_POLICY_VALUES)[number];

export const DEPOSIT_POLICIES: { value: DepositPolicy; label: string }[] = [
  { value: "cash", label: "Cash deposit" },
  { value: "passport", label: "Passport kept as deposit" },
  { value: "cash-or-passport", label: "Cash or passport" },
  { value: "none", label: "No deposit" },
];

export function depositLabel(policy: string, amount?: number | null) {
  const label = DEPOSIT_POLICIES.find((entry) => entry.value === policy)?.label ?? policy;
  const takesCash = policy === "cash" || policy === "cash-or-passport";
  return takesCash && amount ? `${label} ($${amount})` : label;
}

/** A shop that can be rented from without handing over a passport. */
export function passportFree(policy: string) {
  return policy !== "passport";
}

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

/** Bookings in these states hold a bike; the others free it again. */
export const HOLDING_STATUSES: BookingStatus[] = ["pending", "confirmed"];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Waiting for the shop",
  confirmed: "Confirmed",
  rejected: "Declined by the shop",
  cancelled: "Cancelled",
};

/**
 * Cambodia does not observe daylight saving, so "today" is simply the date in
 * Asia/Phnom_Penh (UTC+7). Using the server's clock would let a tourist in
 * Siem Reap book "yesterday" for seven hours every evening.
 */
export function todayInCambodia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date());
}

/** "2026-10-01" → a Date at UTC midnight, the form Postgres `date` expects. */
export function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  const date = parseIsoDate(value) ?? new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

/** Pickup and return day both count: 1 Oct → 3 Oct is three days. */
export function rentalDays(start: string, end: string) {
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  if (!from || !to || to < from) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export const MAX_RENTAL_DAYS = 30;

export function formatUsd(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? parseIsoDate(value) : value;
  if (!date) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** A slug from a display name: "Angkor Moto Rental" → "angkor-moto-rental". */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Digits only, for a wa.me link. */
export function whatsappLink(number: string) {
  return `https://wa.me/${number.replace(/[^0-9]/g, "")}`;
}
