/** Small presentational pills and ratings. No state, usable anywhere. */

import {
  BOOKING_STATUS_LABELS,
  depositLabel,
  passportFree,
  type BookingStatus,
} from "@/lib/catalog";

const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs";

export function Stars({
  rating,
  count,
}: {
  rating: { average: number; count: number } | null;
  count?: boolean;
}) {
  if (!rating) {
    return <span className="text-xs text-black/50 dark:text-white/50">No reviews yet</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden className="text-amber-500">★</span>
      <span className="font-medium">{rating.average.toFixed(1)}</span>
      {count !== false ? (
        <span className="text-black/50 dark:text-white/50">
          ({rating.count} {rating.count === 1 ? "review" : "reviews"})
        </span>
      ) : null}
      <span className="sr-only">out of 5</span>
    </span>
  );
}

export function DepositBadge({
  policy,
  amount,
}: {
  policy: string;
  amount?: number | null;
}) {
  const friendly = passportFree(policy);

  return (
    <span
      className={`${pill} ${
        friendly
          ? "border-emerald-600/30 text-emerald-700 dark:text-emerald-300"
          : "border-amber-600/40 text-amber-800 dark:text-amber-300"
      }`}
    >
      {depositLabel(policy, amount)}
    </span>
  );
}

const statusStyles: Record<BookingStatus, string> = {
  pending: "border-amber-600/40 text-amber-800 dark:text-amber-300",
  confirmed: "border-emerald-600/40 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-600/30 text-red-700 dark:text-red-300",
  cancelled: "border-black/15 text-black/50 dark:border-white/20 dark:text-white/50",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const known = (status in statusStyles ? status : "pending") as BookingStatus;
  return (
    <span className={`${pill} ${statusStyles[known]}`}>{BOOKING_STATUS_LABELS[known]}</span>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className={`${pill} border-black/15 text-black/60 dark:border-white/20 dark:text-white/60`}>
      {children}
    </span>
  );
}
