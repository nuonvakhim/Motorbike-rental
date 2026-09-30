/**
 * Lesson: "Caching" — a loading boundary for the whole app.
 *
 * `loading.tsx` wraps each page below it in <Suspense> with this as the
 * fallback. With Cache Components on, a page that reads the session, the
 * URL's params or anything else only known at request time must sit inside
 * such a boundary: the header and this skeleton are prerendered, and the page
 * streams in when its data is ready. Pages whose data is all cached (the home
 * page) never show it.
 *
 * `app/cities/[city]/loading.tsx` overrides it with a skeleton shaped like
 * the search results.
 */

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10" aria-busy>
      <div className="h-4 w-32 rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-4 h-8 w-2/3 max-w-md rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-3 h-4 w-full max-w-2xl rounded bg-black/5 dark:bg-white/5" />
      <div className="mt-8 h-64 rounded-2xl bg-black/5 dark:bg-white/5" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
