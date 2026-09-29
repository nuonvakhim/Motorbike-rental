import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-black/60 sm:flex-row sm:justify-between dark:text-white/60">
        <p>MotoTrip Cambodia — ride safe, wear a helmet.</p>
        <p className="flex gap-4">
          <Link href="/signup?as=owner" className="hover:underline">
            List your rental shop
          </Link>
          <Link href="/#riding-tips" className="hover:underline">
            Riding tips
          </Link>
        </p>
      </div>
    </footer>
  );
}
