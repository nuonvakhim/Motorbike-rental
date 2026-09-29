# Next.JS
# The App Router

The App Router is Next.js's file-system based router that lives in the app/ directory. Folders define URL segments; special files inside them define the UI for that segment. It's built on React Server Components, so pages and layouts render on the server by default.

It's one of two routers Next.js ships (the older pages/ router is still supported). The dividing line: app/ = Server Components + React canary features; pages/ = the classic client-centric model.

## How App Router Works
The App Router uses an app directory where folders define routes, and special files define UI components:
```tsx
app/
├── layout.tsx        // Root layout (required, must render <html> and <body>)
├── page.tsx          // Route: /
├── about/
│   └── page.tsx      // Route: /about
├── blog/
│   ├── layout.tsx    // Blog layout
│   ├── loading.tsx   // Loading UI for /blog
│   ├── page.tsx      // Route: /blog
│   └── [slug]/
│       └── page.tsx  // Route: /blog/[slug]
└── api/
    └── users/
        └── route.ts  // API Route: /api/users
```

The rule in one line: **folders make the URL, files make the UI.** A folder becomes a public route only once it contains a `page.tsx` (or a `route.ts`). Anything else you put in a route folder — components, helpers, tests — never becomes a URL.

### The special files

| File | Purpose |
| ---- | ------- |
| `layout.tsx` | Shared UI that **persists** across navigation — keeps state, stays interactive, does not re-render |
| `template.tsx` | Like a layout, but a **fresh instance** on every navigation (state resets, effects re-run) |
| `page.tsx` | The UI unique to a route — this is what makes a route publicly reachable |
| `loading.tsx` | Instant loading UI; wraps the segment in a `<Suspense>` boundary automatically |
| `error.tsx` | Error boundary for the segment and its children — must be a Client Component |
| `global-error.tsx` | Error boundary for the root layout; must render its own `<html>`/`<body>` |
| `not-found.tsx` | UI for `notFound()` and unmatched URLs |
| `forbidden.tsx` / `unauthorized.tsx` | UI for `forbidden()` / `unauthorized()` |
| `route.ts` | API endpoint — cannot sit at the same segment level as `page.tsx` |
| `default.tsx` | Fallback for a parallel-route slot |
| `proxy.ts` | Runs before a request completes — lives at the project root, beside `app/` |

Nesting order: `layout` → `template` → `error` → `loading` → `not-found` → `page`.

## Key Features of App Router

### 1. Server Components by Default

Every file in `app/` is a Server Component unless you opt out. Their code never ships to the browser, so you can query a database or use secrets directly inside them.

```tsx
// app/page.tsx (Server Component)
async function getData() {
  // Always bound an external call with a timeout; never retry forever.
  const res = await fetch('https://api.example.com/data', {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error('Failed to fetch data')
  return res.json()
}

export default async function HomePage() {
  const data = await getData()

  return <h1>Welcome! {data.message}</h1>
}
```

Reach for `'use client'` only when you need state, event handlers, effects, browser APIs or custom hooks — and keep it at the **leaves** of the tree. The pattern that works: fetch on the server, pass down as props, let a small client island handle the interaction.

```tsx
// app/ui/like-button.tsx
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [count, setCount] = useState(likes)
  return <button onClick={() => setCount(count + 1)}>{count} ♥</button>
}
```

`'use client'` marks a **boundary**, not a single file: everything imported into that module graph becomes client code too.

### 2. Layouts and Templates
```tsx
// app/layout.tsx (Root Layout — required, and the only place <html>/<body> live)
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav>Navigation</nav>
        {children}
        <footer>Footer</footer>
      </body>
    </html>
  )
}

// app/blog/layout.js (Nested Layout)
export default function BlogLayout({ children }) {
  return (
    <div className="blog-layout">
      <aside>Blog Sidebar</aside>
      <main>{children}</main>
    </div>
  )
}
```

The key property: a layout **survives navigation**. Sidebar scroll position, open menus and form state inside it are all preserved when you move between its child pages. Layouts nest automatically, following the folder hierarchy.

A `template.tsx` is the opposite — it re-mounts on every navigation, so state resets and `useEffect` re-runs. **Layout by default, template only when you need the reset** (enter animations, deliberately-cleared state).

### 3. Route Groups and Organization

```tsx
app/
├── (marketing)/
│   ├── about/
│   │   └── page.tsx    // Route: /about
│   └── contact/
│       └── page.tsx    // Route: /contact
└── (shop)/
    ├── products/
    │   └── page.tsx      // Route: /products
    └── cart/
        └── page.tsx      // Route: /cart
```

Parentheses keep a folder out of the URL. Use it to group routes by team or feature, or to give sections their own root layout. Two caveats:

- **Conflicting paths error out** — `(marketing)/about/` and `(shop)/about/` both resolve to `/about` and the build fails.
- **Multiple root layouts trigger a full page reload** when navigating between them, because the document itself is replaced.

A related convention: a folder prefixed with `_` (e.g. `_components/`, `_lib/`) is never routable, which makes it the natural place to colocate helpers next to the route that uses them.

### 4. Loading and Error UI
```tsx
// app/blog/loading.tsx
export default function Loading() {
  return <div>Loading blog posts...</div>
}

// app/blog/error.tsx
'use client'
export default function Error({ error, retry }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

Dropping in a `loading.tsx` wraps the segment in a `<Suspense>` boundary for free.

> ⚠️ **v16:** the error prop is **`retry`**, not `reset`. `retry()` re-fetches and re-renders the segment; `reset()` only clears the error state without re-fetching. Older tutorials show `reset`.

An `error.tsx` catches errors from its segment and below, but **not** from the layout in the same segment — that needs `global-error.tsx` at the root. And *expected* errors (form validation, a failed login) shouldn't throw at all: return them as values and render them with `useActionState`.

### 5. Streaming and Suspense
```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

async function UserData() {
  const data = await fetchUserData() // This can stream
  return <div>{data.name}</div>
}

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<div>Loading user...</div>}>
        <UserData />
      </Suspense>
    </div>
  )
}
```

`loading.tsx` streams a whole segment; `<Suspense>` gives you per-component control, so one slow query doesn't hold up the rest of the page. The fallback is part of the static shell, so it can be prerendered and sent before any data exists.

Note that `<Suspense>` doesn't by itself make a component dynamic — a component doing only synchronous work still completes during prerendering.

### 6. Dynamic Routes

Wrap a folder name in square brackets to turn it into a variable:

| Convention | Route | `/shop/a/b` gives |
| ---------- | ----- | ----------------- |
| `[slug]` | `app/blog/[slug]/page.tsx` | `{ slug: 'a' }` — one segment |
| `[...slug]` | `app/shop/[...slug]/page.tsx` | `{ slug: ['a', 'b'] }` — catch-all |
| `[[...slug]]` | `app/shop/[[...slug]]/page.tsx` | same, but also matches bare `/shop` |

> ⚠️ **v16: `params` is a Promise.** This is the single biggest change from older tutorials. `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are async-only — the synchronous fallback that existed in Next 15 was removed.

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params   // ← must await
  return <div>My Post: {slug}</div>
}
```

In a Client Component, unwrap it with React's `use()`, or read it anywhere in the client tree with `useParams()`.

Next.js also generates **global route types** from your real folder structure, so `params` doesn't need typing by hand — `PageProps<'/route'>`, `LayoutProps<'/route'>` and `RouteContext<'/route'>` are available without an import after `next dev`, `next build` or `next typegen`:

```tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>Blog Post: {slug}</h1>
}
```

To prerender dynamic pages at build time, export `generateStaticParams`.

### 7. Route Handlers (API endpoints)

`route.ts` replaces `pages/api/`. Export one function per HTTP method — `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`; anything else returns `405`.

```ts
// app/api/users/route.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  const users = await db.user.findMany({ where: { name: { contains: query } } })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const user = await db.user.create({ data: body })
  return NextResponse.json(user, { status: 201 })
}
```

Route Handlers are **not cached by default**; `GET` can opt in with `export const dynamic = 'force-static'`. A `route.ts` cannot share a folder with a `page.tsx`.

Worth asking whether you need one at all — if a Server Component can fetch the data directly, you don't. Route Handlers earn their place for webhooks, third-party callbacks, and clients outside your app.

### 8. Server Functions and Server Actions

The `'use server'` directive marks an async function as server-only. Calling it from the client issues a `POST` behind the scenes, and Next.js returns the updated UI and the new data in a single roundtrip. Used for form submission and mutations, it's called a **Server Action**.

```ts
// app/lib/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { updateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const title = formData.get('title')
  await db.post.create({ data: { title, authorId: session.user.id } })

  updateTag('posts')   // invalidate the cache so the new post shows immediately
}
```

Wire it straight to a form — no `onSubmit`, no `fetch`, no API route:

```tsx
import { createPost } from '@/app/lib/actions'

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button type="submit">Create</button>
    </form>
  )
}
```

> **Security note:** a Server Function is reachable by a direct `POST` from anywhere, not only through your form. Check authentication *and* authorization inside every one — never assume only your UI can call it.

### 9. Caching

> ⚠️ **v16:** `fetch` is **no longer cached by default**, and the experimental Partial Prerendering flag has been replaced by **Cache Components**.

Caching is opt-in. Enable the model in config:

```ts
// next.config.ts
const nextConfig: NextConfig = { cacheComponents: true }
```

Then `'use cache'` caches the return value of an async function (data-level) or an entire component or page (UI-level). Pair it with `cacheLife` — omit it and you get the implicit `default` profile, which is rarely what you meant.

```tsx
import { cacheLife, cacheTag } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')   // seconds | minutes | hours | days | weeks | max
  cacheTag('users')
  return db.query('SELECT * FROM users')
}
```

Arguments and captured scope values become part of the cache key. Data that must be fresh on every request should **not** be cached — wrap it in `<Suspense>` so the shell prerenders and the fresh part streams in.

To clear a cache after a mutation:

| API | Behaviour | Use when |
| --- | --------- | -------- |
| `revalidateTag(tag)` | Stale-while-revalidate — serves the old value, refreshes behind it | Background refresh; a short delay is fine |
| `updateTag(tag)` | Expires immediately (Server Actions only) | The user must see their own change right away |
| `revalidatePath(path)` | Invalidates a whole route | Last resort — tags are more precise |

### 10. Parallel and Intercepting Routes

**Parallel routes** (`@folder`) render several pages into one layout simultaneously, each with independent loading and error states. The slots arrive as props on the shared parent layout:

```tsx
app/
├── layout.tsx        // receives `children`, `team`, `analytics`
├── @team/
│   ├── page.tsx
│   └── default.tsx   // ⚠️ v16: required, or the build fails
└── @analytics/
    ├── page.tsx
    └── default.tsx
```

A slot with no matching sub-route falls back to `default.tsx`. To keep the pre-v16 behaviour, have it `return null` or call `notFound()`.

**Intercepting routes** load a route from elsewhere inside the current layout — the classic case being a photo that opens as a modal over the feed when clicked, but renders as a full page when the URL is shared or refreshed.

| Pattern | Intercepts |
| ------- | ---------- |
| `(.)folder` | the same level |
| `(..)folder` | one level above |
| `(..)(..)folder` | two levels above |
| `(...)folder` | from the `app` root |

### 11. Metadata and SEO

Export a static `metadata` object, or a `generateMetadata` function when the tags depend on data. Both are Server-Component-only.

```tsx
// Static
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Blog',
  description: 'Notes about web development',
}

// Dynamic
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post.title, description: post.excerpt }
}
```

The `charset` and `viewport` tags are always emitted automatically. File conventions cover the rest: `favicon.ico`, `icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `robots.ts` and `sitemap.ts`.

### 12. Navigation

Use `<Link>` for essentially all navigation — it gives client-side transitions (no full reload, layouts preserved) and automatic prefetching when the link enters the viewport.

```tsx
import Link from 'next/link'

<Link href={`/blog/${post.slug}`}>{post.title}</Link>
```

> **Prefetching only runs in production.** In `next dev` nothing is prefetched, so navigation feels slower than it really is — don't judge performance from the dev server.

For navigating from code, `useRouter` comes from **`next/navigation`** (not `next/router`) and works only in Client Components. The companion hooks — `usePathname()`, `useSearchParams()`, `useParams()` — come from the same module.

### 13. Proxy

> ⚠️ **v16:** `middleware.ts` has been renamed to **`proxy.ts`**. The functionality is unchanged; the name clarifies that it's a network-boundary concern.

```ts
// proxy.ts (project root, beside app/)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: '/about/:path*',
}
```

One proxy file per project. It's for redirects, rewrites and header/cookie changes — not for slow data fetching, and not as your full authorization layer (use it for optimistic checks and enforce properly in the Server Component or Server Function).

## Advantages of App Router

- React Server Components: Better performance and smaller bundle sizes
- Streaming: Progressive page rendering for better user experience
- Flexible Layouts: Nested layouts that persist across route changes
- Built-in Loading States: Automatic loading and error boundaries
- Better SEO: Improved server-side rendering capabilities
- Modern React Patterns: Leverages the latest React features
- Colocated data mutations: Server Actions remove most hand-written API routes
- Granular caching: `use cache` with tags replaces the older all-or-nothing fetch cache

### Key Differences Comparison

| Feature        | Page Router                         | App Router               |
| -------------- | ----------------------------------- | ------------------------ |
| Directory      | `pages/`                            | `app/`                   |
| Routing method | File-based                          | Folder-based             |
| Components     | Client by default                   | Server by default        |
| Data fetching  | `getServerSideProps`, `getStaticProps` | `fetch()` / `await` in components |
| Mutations      | API route + client `fetch`          | Server Actions (`'use server'`) |
| Layouts        | `_app.js`, `_document.js`           | `layout.js` (nestable)   |
| Loading state  | Custom implementation               | Built-in `loading.js`    |
| Error handling | `_error.js`                         | `error.js` / `global-error.js` |
| API endpoints  | `pages/api/*.ts`                    | `route.ts` Route Handlers |
| Metadata       | `next/head`                         | `metadata` / `generateMetadata` |
| Routing hooks  | `next/router`                       | `next/navigation`        |
| Bundle size    | Larger client bundles               | Smaller client bundles   |

### What changed in Next.js 16

Most online tutorials target Next.js 13/14. These are the App Router differences that will break copied code:

| Older tutorials say | Next.js 16 |
| --- | --- |
| `const { slug } = params` | `params` is a **Promise** → `await params` |
| `const { q } = searchParams` | also a Promise → `await searchParams` |
| `error.tsx` gets a `reset` prop | it gets **`retry`** |
| `middleware.ts` | renamed to **`proxy.ts`** |
| `fetch` is cached by default | **not cached** — opt in with `use cache` |
| Parallel slots work without `default.tsx` | `default.tsx` is **required** |
| `experimental.ppr` for Partial Prerendering | replaced by `cacheComponents: true` |
| Type `params` by hand | use the generated `PageProps<'/route'>` |

### Conclusion
Both Page Router and App Router have their place in the Next.js ecosystem. The Page Router remains a solid choice for many applications, offering stability and simplicity. The App Router, while more complex, provides powerful features that can significantly improve performance and developer experience.
