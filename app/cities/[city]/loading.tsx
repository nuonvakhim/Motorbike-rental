/**
 * Shown while the city page queries the database — for the first load and
 * for every filter change, since each one is a navigation to a new URL.
 */

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10" aria-busy>
      <div className="h-4 w-32 rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-4 h-8 w-2/3 max-w-md rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-3 h-4 w-full max-w-2xl rounded bg-black/5 dark:bg-white/5" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="h-96 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-72 rounded-2xl bg-black/5 dark:bg-white/5" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading bikes…</span>
    </main>
  );
}
