
# Routing

Beyond plain folders and `page` files, the App Router has four folder conventions that change *how* a segment maps to a URL: dynamic segments, route groups, parallel routes, and intercepting routes. This page covers each one.

| Convention | Folder | Effect on the URL |
| ---------- | ------ | ----------------- |
| Dynamic segment | `[slug]` | Captures one segment as a param |
| Catch-all segment | `[...slug]` | Captures one *or more* segments |
| Optional catch-all | `[[...slug]]` | Captures zero or more segments |
| Route group | `(group)` | None — organizational only |
| Parallel route slot | `@slot` | None — renders as a layout prop |
| Intercepting route | `(.)segment` | Masks the intercepted URL |

## Dynamic Route Segments

A URL path is a sequence of path segments. A segment may be **static** (a literal value matched exactly) or **dynamic** (a placeholder that captures a value from the URL). When you don't know a segment's value ahead of time, define a Dynamic Segment to create routes from dynamic data. Next.js passes the captured values to your page via the path `params` prop, either filled in at request time or prerendered at build time.

> **Good to know**: Dynamic Segments are often referred to as path params, route params, or URL params.

### Convention

A Dynamic Segment can be created by wrapping a folder's name in square brackets: `[folderName]`.

```tsx
app/
└── blog/
    └── [slug]/
        └── page.tsx      // Route: /blog/:slug
```

```tsx filename="app/blog/[slug]/page.tsx" switcher
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <div>My Post: {slug}</div>
}
```

Dynamic Segments are passed as the `params` prop to [`layout`](/docs/app/api-reference/file-conventions/layout), [`page`](/docs/app/api-reference/file-conventions/page), and [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata#generatemetadata-function) functions.

| Route | Example URL | `params` |
| ----- | ----------- | -------- |
| `app/blog/[slug]/page.js` | `/blog/a` | `{ slug: 'a' }` |
| `app/blog/[slug]/page.js` | `/blog/b` | `{ slug: 'b' }` |
| `app/blog/[slug]/page.js` | `/blog/c` | `{ slug: 'c' }` |

Dynamic segments that appear before the [root layout](/docs/app/api-reference/file-conventions/layout#root-layout) are **root parameters**, which can additionally be read from any Server Component with [`next/root-params`](/docs/app/api-reference/functions/next-root-params).

### In Client Components

In a Client Component **page**, dynamic segments from props can be accessed using the [`use`](https://react.dev/reference/react/use) API.

```tsx filename="app/blog/[slug]/page.tsx" switcher
'use client'
import { use } from 'react'

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div>
      <p>{slug}</p>
    </div>
  )
}
```

Alternatively Client Components can use the [`useParams`](/docs/app/api-reference/functions/use-params) hook to access the `params` anywhere in the Client Component tree.

### Catch-all Segments

Dynamic Segments can be extended to **catch-all** subsequent segments by adding an ellipsis inside the brackets `[...folderName]`.

```tsx
app/
└── shop/
    └── [...slug]/
        └── page.tsx      // Matches /shop/a, /shop/a/b, /shop/a/b/c ...
```

| Route | Example URL | `params` |
| ----- | ----------- | -------- |
| `app/shop/[...slug]/page.js` | `/shop/a` | `{ slug: ['a'] }` |
| `app/shop/[...slug]/page.js` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |
| `app/shop/[...slug]/page.js` | `/shop/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |

### Optional Catch-all Segments

Catch-all Segments can be made **optional** by including the parameter in double square brackets: `[[...folderName]]`.

The difference between **catch-all** and **optional catch-all** segments is that with optional, the route without the parameter is also matched (`/shop` in the example below).

| Route | Example URL | `params` |
| ----- | ----------- | -------- |
| `app/shop/[[...slug]]/page.js` | `/shop` | `{ slug: undefined }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a` | `{ slug: ['a'] }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |

### TypeScript

When using TypeScript, you can add types for `params` depending on your configured route segment — use [`PageProps<'/route'>`](/docs/app/api-reference/file-conventions/page#page-props-helper) and [`LayoutProps<'/route'>`](/docs/app/api-reference/file-conventions/layout#layout-props-helper) to type `params` in `page` and `layout` respectively.

Route `params` values are typed as `string`, `string[]`, or `undefined` (for optional catch-all segments), because their values aren't known until runtime. Users can enter any URL into the address bar, and these broad types help ensure that your application code handles all these possible cases.

| Route | `params` Type Definition |
| ----- | ------------------------ |
| `app/blog/[slug]/page.js` | `{ slug: string }` |
| `app/shop/[...slug]/page.js` | `{ slug: string[] }` |
| `app/shop/[[...slug]]/page.js` | `{ slug?: string[] }` |
| `app/[categoryId]/[itemId]/page.js` | `{ categoryId: string, itemId: string }` |

If you're working on a route where `params` can only have a fixed number of valid values, such as a `[locale]` param with a known set of language codes, you can use runtime validation to handle any invalid params a user may enter, and let the rest of your application work with the narrower type from your known set.

```tsx filename="app/[locale]/page.tsx"
import { notFound } from 'next/navigation'
import type { Locale } from '@i18n/types'
import { isValidLocale } from '@i18n/utils'

function assertValidLocale(value: string): asserts value is Locale {
  if (!isValidLocale(value)) notFound()
}

export default async function Page(props: PageProps<'/[locale]'>) {
  const { locale } = await props.params // locale is typed as string
  assertValidLocale(locale)
  // locale is now typed as Locale
}
```

### Behavior

* The `params` prop is a promise, so you must use `async`/`await` or React's `use` function to access the values.
  * In version 14 and earlier, `params` was a synchronous prop. To help with backwards compatibility, you can still access it synchronously in Next.js 15, but this behavior will be deprecated in the future.

### Prerendering with `generateStaticParams`

The [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params) function can be used to [statically generate](/docs/app/glossary#prerendering) routes at build time instead of on-demand at request time.

```tsx filename="app/blog/[slug]/page.tsx" switcher
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())

  return posts.map((post) => ({
    slug: post.slug,
  }))
}
```

When using `fetch` inside the `generateStaticParams` function, the requests are [automatically deduplicated](/docs/app/glossary#memoization). This avoids multiple network calls for the same data across Layouts, Pages, and other `generateStaticParams` functions, speeding up build time.

With [Cache Components](/docs/app/getting-started/caching) enabled, the two cases differ:

* **Without `generateStaticParams`** — param values are unknown during prerendering, so params are runtime data. Wrap param access in a `<Suspense>` boundary to provide fallback UI. In layouts, avoid awaiting `params` at the top level; pass the promise down and await it in the component that needs it, or the layout can't be prerendered.
* **With `generateStaticParams`** — the sample params are executed at build time to generate static HTML. Build-time validation only covers the code paths those samples reach, so a conditional branch that calls a runtime API (e.g. `cookies()`) for other param values still needs its own `<Suspense>` boundary.

## Route Groups

Route Groups are a folder convention that let you organize routes by category or team.

### Convention

A route group can be created by wrapping a folder's name in parentheses: `(folderName)`. This convention indicates the folder is for organizational purposes and should **not be included** in the route's URL path.

```tsx
app/
├── (marketing)/
│   ├── layout.tsx        // Layout for the marketing section only
│   ├── about/
│   │   └── page.tsx      // Route: /about     ("(marketing)" is not in the URL)
│   └── blog/
│       └── page.tsx      // Route: /blog
└── (shop)/
    ├── layout.tsx        // Layout for the shop section only
    ├── account/
    │   └── page.tsx      // Route: /account
    └── cart/
        └── page.tsx      // Route: /cart
```

### Use cases

* Organizing routes by team, concern, or feature.
* Defining multiple [root layouts](/docs/app/api-reference/file-conventions/layout#root-layout).
* Opting specific route segments into sharing a layout, while keeping others out.

### Caveats

* **Full page load**: If you navigate between routes that use different root layouts, it'll trigger a full page reload. For example, navigating from `/cart` that uses `app/(shop)/layout.js` to `/blog` that uses `app/(marketing)/layout.js`. This **only** applies to multiple root layouts.
* **Conflicting paths**: Routes in different groups should not resolve to the same URL path. For example, `(marketing)/about/page.js` and `(shop)/about/page.js` would both resolve to `/about` and cause an error.
* **Top-level root layout**: If you use multiple root layouts without a top-level `layout.js` file, make sure your home route (`/`) is defined within one of the route groups, e.g. `app/(marketing)/page.js`.

## Parallel Routes

Parallel Routes render more than one page inside the same layout at once, each navigated independently — used for dashboards and feeds. You are unlikely to need this yet; the goal here is to recognise the `@folder` convention when you meet it.

Slots are folders named `@folder`. They are **not** route segments, so they never appear in the URL:

```tsx
app/
├── layout.tsx            // Receives `children`, `team` and `analytics` props
├── page.tsx              // The implicit `children` slot
├── @analytics/
│   └── page.tsx          // Slot — not a route segment
└── @team/
    └── page.tsx          // Slot — not a route segment
```

Each slot arrives at the shared layout as its own prop, alongside `children`:

```tsx filename="app/layout.tsx"
export default function Layout({ children, team, analytics }) {
  return (
    <>
      {children}
      {team}
      {analytics}
    </>
  )
}
```

Three things worth remembering:

* `children` is itself an implicit slot — `app/page.js` is equivalent to `app/@children/page.js`.
* On a client-side navigation, unmatched slots keep their current subpage. On a refresh, Next.js renders `default.js` for them, or a `404` if there isn't one.
* Slots at the same segment level are all prerendered or all dynamic — you cannot mix the two.

See [Parallel Routes](/docs/app/api-reference/file-conventions/parallel-routes) when you need tab groups, role-based conditional slots, or per-slot loading and error UI.

## Intercepting Routes

Intercepting routes load a route from elsewhere in the app *inside the current layout*, masking the URL. The classic case: clicking a photo in a feed opens it in a modal over the feed, while that same URL opened directly renders the full photo page.

```
Soft navigation (click from within /feed)
  /feed  ──click──▶  URL shows /photo/123  →  modal over the feed

Hard navigation (shared link, refresh, address bar)
  /photo/123  ──────▶  photo/[id]/page.tsx  →  full page, no modal
```

The convention is `(..)`, which reads like `../` but counts **route segments**, not folders:

* `(.)` — same level
* `(..)` — one level above
* `(..)(..)` — two levels above
* `(...)` — from the root `app` directory

```tsx
app/
├── feed/
│   ├── page.tsx                  // Route: /feed
│   └── (..)photo/
│       └── [id]/
│           └── page.tsx          // Intercepts /photo/:id when navigating from /feed
└── photo/
    └── [id]/
        └── page.tsx              // Route: /photo/:id — direct visit or refresh
```

Intercepting routes are most often paired with Parallel Routes to build modals that survive a refresh and close on back-navigation. See [Intercepting Routes](/docs/app/api-reference/file-conventions/intercepting-routes) when you reach for that.


---
