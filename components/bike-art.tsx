/**
 * A drawn stand-in for a bike photo, one silhouette per type. Real photos
 * would come from owner uploads; until then this keeps every card the same
 * size and needs no image hosting.
 */

import type { BikeType } from "@/lib/catalog";

const tints: Record<string, string> = {
  scooter: "from-orange-100 to-amber-50 text-orange-700 dark:from-orange-950 dark:to-stone-900 dark:text-orange-300",
  "semi-auto": "from-sky-100 to-cyan-50 text-sky-700 dark:from-sky-950 dark:to-stone-900 dark:text-sky-300",
  manual: "from-violet-100 to-fuchsia-50 text-violet-700 dark:from-violet-950 dark:to-stone-900 dark:text-violet-300",
  dirt: "from-lime-100 to-emerald-50 text-emerald-700 dark:from-emerald-950 dark:to-stone-900 dark:text-emerald-300",
  electric: "from-teal-100 to-sky-50 text-teal-700 dark:from-teal-950 dark:to-stone-900 dark:text-teal-300",
};

function Silhouette({ type }: { type: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "dirt") {
    return (
      <g {...common}>
        <circle cx="22" cy="44" r="11" />
        <circle cx="78" cy="44" r="11" />
        <path d="M22 44l14-18h22l8 8h-18l-6 10M58 26l6-10h8M66 34l12 10M40 26l-4-6h10" />
      </g>
    );
  }

  if (type === "manual") {
    return (
      <g {...common}>
        <circle cx="22" cy="46" r="10" />
        <circle cx="78" cy="46" r="10" />
        <path d="M22 46l12-16h20l10 6H40l-6 10M54 30l10-12h8M64 36l14 10M36 30h-6" />
        <rect x="40" y="26" width="16" height="10" rx="3" />
      </g>
    );
  }

  if (type === "semi-auto") {
    return (
      <g {...common}>
        <circle cx="22" cy="46" r="10" />
        <circle cx="78" cy="46" r="10" />
        <path d="M22 46h24l6-14h14l6 14M52 32l-6-10H34M66 32l6-14h8M34 22h-6" />
      </g>
    );
  }

  // Scooters and electric scooters share a body; electric gets a bolt.
  return (
    <g {...common}>
      <circle cx="22" cy="46" r="9" />
      <circle cx="78" cy="46" r="9" />
      <path d="M22 46h18c2-8 8-12 16-12h12l10 12M64 34l6-18h8M40 34h16M26 36h14" />
      {type === "electric" ? <path d="M46 14l-6 9h6l-4 8" strokeWidth={2} /> : null}
    </g>
  );
}

export function BikeArt({
  type,
  className = "",
}: {
  type: BikeType | string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-gradient-to-br ${tints[type] ?? tints.scooter} ${className}`}
    >
      <svg viewBox="0 0 100 60" className="h-3/5 w-3/5">
        <Silhouette type={type} />
      </svg>
    </div>
  );
}
