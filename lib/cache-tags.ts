/**
 * Lesson: "Caching" — the tags on cached catalogue reads.
 *
 * The public queries in `lib/listings.ts` are cached with `use cache` and
 * tagged with these names. A Server Action that changes the data calls
 * `updateTag(...)` with the same name, and the next visitor gets fresh
 * results.
 *
 * Two broad tags rather than one per shop or bike: owners and admins edit
 * rarely compared with how often tourists browse, so throwing away the whole
 * catalogue on each edit costs little and can never miss a page.
 */

/** Cities, shops, bikes, photos and reviews — everything a tourist browses. */
export const CATALOG_TAG = "catalog";

/** Search results that count bookings for chosen dates. */
export const AVAILABILITY_TAG = "availability";
