import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">We could not find that page</h1>
      <p className="text-black/60 dark:text-white/60">
        The city, shop or bike may have been removed, or the link is mistyped.
      </p>
      <Link href="/" className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
        Back to all cities
      </Link>
    </main>
  );
}
