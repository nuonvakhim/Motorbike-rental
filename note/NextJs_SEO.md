# SEO and Metadata

Everything a search engine or a social platform knows about a page comes from its `<head>` — or, for structured data and crawler files, from a handful of special routes. The App Router gives you three ways to produce all of it, and Next.js generates the actual tags for you.

1. The static [`metadata` object](#static-metadata)
2. The dynamic [`generateMetadata` function](#generated-metadata)
3. [File conventions](#file-based-metadata) — icons, OG images, `robots.txt`, `sitemap.xml`

Both `metadata` and `generateMetadata` are **Server Component only**. Metadata has to be resolved on the server before the page renders, so it can be part of the initial HTML response. If a route needs client-side interactivity, keep `page.tsx` a Server Component and move the interactive part into its own `'use client'` file.

## Default fields

Two tags are always emitted, even for a route that defines no metadata at all:

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

## Static metadata

Export a `Metadata` object from a `layout.js` or `page.js`:

```tsx filename="app/blog/layout.tsx"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Blog',
  description: '...',
}

export default function Layout() {}
```

## Generated metadata

When the metadata depends on data, export an async `generateMetadata` function instead:

```tsx filename="app/blog/[slug]/page.tsx"
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = (await params).slug
  const post = await fetch(`https://api.vercel.app/blog/${slug}`).then((res) => res.json())

  return {
    title: post.title,
    description: post.description,
  }
}
```

The parameters are:

* `params` — the dynamic route params from the root segment down to this one.
* `searchParams` — the URL search params. **Only available in `page.js`**, not in layouts.
* `parent` — a promise of the already-resolved metadata from parent segments.

`redirect()` and `notFound()` can both be called from inside `generateMetadata`.

> If the metadata does not depend on request data, use the static `metadata` object. `generateMetadata` exists for the cases that do.

### Do not fetch the same data twice

A page usually needs the same record for its metadata and its body. Wrap the loader in React's [`cache`](https://react.dev/reference/react/cache) so the query runs once:

```ts filename="app/lib/data.ts"
import { cache } from 'react'
import { db } from '@/app/lib/db'

// getPost is used twice, but executes only once
export const getPost = cache(async (slug: string) => {
  return db.query.posts.findFirst({ where: eq(posts.slug, slug) })
})
```

```tsx filename="app/blog/[slug]/page.tsx"
import { getPost } from '@/app/lib/data'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  return { title: post.title, description: post.description }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  return <div>{post.title}</div>
}
```

`fetch` requests are memoized automatically across `generateMetadata`, `generateStaticParams`, layouts, pages and Server Components. `cache` is for everything that is not `fetch` — a database call, for example.

## Ordering and merging

Metadata is evaluated from the root segment down to the page:

1. `app/layout.tsx`
2. `app/blog/layout.tsx`
3. `app/blog/[slug]/page.tsx`

Objects from every segment in the route are **shallowly merged**, and duplicate keys are replaced by the later segment. The word *shallowly* is the whole trap: a nested object like `openGraph` or `robots` is replaced **wholesale**, not merged field by field.

```jsx filename="app/layout.js"
export const metadata = {
  title: 'Acme',
  openGraph: { title: 'Acme', description: 'Acme is a...' },
}
```

```jsx filename="app/blog/page.js"
export const metadata = {
  title: 'Blog',
  openGraph: { title: 'Blog' },
}

// Output:
// <title>Blog</title>
// <meta property="og:title" content="Blog" />
// ...and og:description is gone.
```

A segment that does not define `openGraph` at all **inherits** the parent's version intact. So the choice is all or nothing per nested key.

To share part of a nested object while overriding the rest, pull it into a variable and spread it:

```jsx filename="app/shared-metadata.js"
export const openGraphImage = { images: ['http://...'] }
```

```jsx filename="app/about/page.js"
import { openGraphImage } from '../shared-metadata'

export const metadata = {
  openGraph: { ...openGraphImage, title: 'About' },
}
```

## `title`

`title` is either a string or an object with three distinct behaviours:

```tsx filename="app/layout.tsx"
export const metadata: Metadata = {
  title: {
    default: 'Acme',        // fallback for children that set no title
    template: '%s | Acme',  // pattern children's titles are placed into
  },
}
```

```tsx filename="app/about/page.tsx"
export const metadata: Metadata = {
  title: 'About',            // -> <title>About | Acme</title>
}

// or, to escape the parent template entirely:
export const metadata: Metadata = {
  title: { absolute: 'About' }, // -> <title>About</title>
}
```

| Key | In `layout.js` | In `page.js` |
| --- | --- | --- |
| `title` (string) | The default title for children that set none; itself filled into the nearest parent `template`. | The route's title, filled into the nearest parent `template`. |
| `title.default` | Fallback for child segments with no title. | — |
| `title.template` | Defines a new template for **child** segments. | **No effect** — a page is always the last segment. |
| `title.absolute` | Default title for children, ignoring any parent template. | The route's title, ignoring any parent template. |

This project's root layout already uses the pattern:

```tsx filename="app/layout.tsx"
export const metadata: Metadata = {
  title: {
    default: 'Todos — Next.js App Router practice',
    template: '%s — Next.js practice',
  },
  description: 'A Todo app built while working through the App Router notes in note/.',
}
```

## `metadataBase` and URL composition

Several metadata fields require **fully qualified** URLs. `metadataBase` lets you write relative paths instead, in the current segment and everything below it:

```jsx filename="app/layout.js"
export const metadata = {
  metadataBase: new URL('https://acme.com'),
  alternates: {
    canonical: '/',
    languages: { 'en-US': '/en-US', 'de-DE': '/de-DE' },
  },
  openGraph: { images: '/og-image.png' },
}
```

```html
<link rel="canonical" href="https://acme.com" />
<link rel="alternate" hreflang="en-US" href="https://acme.com/en-US" />
<meta property="og:image" content="https://acme.com/og-image.png" />
```

Set it once in the root layout. Composition favours intent over strict URL semantics — an "absolute" path in a metadata field is treated as relative to the base rather than replacing its path:

| Field value | Resolved URL |
| --- | --- |
| `/` or `./` | `https://acme.com` |
| `payments`, `/payments`, `./payments`, `../payments` | `https://acme.com/payments` |
| `https://beta.acme.com/payments` | `https://beta.acme.com/payments` (base ignored) |

> **Gotchas.** A relative URL with no `metadataBase` configured is a **build error**. And when `generateMetadata` uses `'use cache'`, the return value must be serializable — `URL` instances are not, so return `url.toString()` instead.

## The fields that matter

### `description`

```jsx
export const metadata = { description: 'The React Framework for the Web' }
```

### `alternates` — canonical and hreflang

The canonical URL is the single most important field for avoiding duplicate-content problems.

```jsx
export const metadata = {
  alternates: {
    canonical: 'https://nextjs.org',
    languages: {
      'en-US': 'https://nextjs.org/en-US',
      'de-DE': 'https://nextjs.org/de-DE',
    },
    media: { 'only screen and (max-width: 600px)': 'https://nextjs.org/mobile' },
    types: { 'application/rss+xml': 'https://nextjs.org/rss' },
  },
}
```

### `robots`

Per-page crawl directives, with an optional Googlebot-specific block:

```tsx
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
```

```html
<meta name="robots" content="index, follow" />
<meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1" />
```

This is per page. Site-wide crawl rules belong in [`robots.txt`](#robotstxt).

### `openGraph`

```jsx
export const metadata = {
  openGraph: {
    title: 'Next.js',
    description: 'The React Framework for the Web',
    url: 'https://nextjs.org',
    siteName: 'Next.js',
    images: [
      { url: 'https://nextjs.org/og.png', width: 800, height: 600 },
      { url: 'https://nextjs.org/og-alt.png', width: 1800, height: 1600, alt: 'My custom alt' },
    ],
    locale: 'en_US',
    type: 'website',
  },
}
```

`type: 'article'` unlocks article-specific tags:

```jsx
openGraph: {
  type: 'article',
  publishedTime: '2023-01-01T00:00:00.000Z',
  authors: ['Seb', 'Josh'],
}
```

```html
<meta property="article:published_time" content="2023-01-01T00:00:00.000Z" />
<meta property="article:author" content="Seb" />
```

> For OG **images**, the [file convention](#open-graph-images) is usually better than this config: there is nothing to keep in sync.

### Others

`twitter` mirrors `openGraph` for X cards. `verification` holds search-console ownership tokens. `icons`, `manifest`, `themeColor`, `appleWebApp`, `category`, `facebook`, `pinterest` and a free-form `other` are all available — but where a file convention exists, prefer it.

## File-based metadata

| File | Location | Produces |
| --- | --- | --- |
| `favicon.ico` | `app/` only | `<link rel="icon">` |
| `icon.(ico\|jpg\|jpeg\|png\|svg)` | any segment | `<link rel="icon">` |
| `apple-icon.(jpg\|jpeg\|png)` | any segment | `<link rel="apple-touch-icon">` |
| `opengraph-image.(jpg\|jpeg\|png\|gif)` | any segment | `og:image` + type/width/height |
| `twitter-image.(jpg\|jpeg\|png\|gif)` | any segment | `twitter:image` + type/width/height |
| `*.alt.txt` | beside the image | `og:image:alt` / `twitter:image:alt` |
| `robots.(txt\|js\|ts)` | `app/` | `/robots.txt` |
| `sitemap.(xml\|js\|ts)` | `app/` | `/sitemap.xml` |
| `manifest.(json\|js\|ts)` | `app/` | `/manifest.json` |

Each of these can be a literal file **or** a `.js`/`.ts` route that generates the thing with code.

### Icons

Drop `favicon.ico` in `app/` and Next.js works out `rel`, `type` and `sizes` from the file itself — a 32×32 PNG gets `type="image/png" sizes="32x32"`; an SVG gets `sizes="any"`. Multiple icons come from numbered names (`icon1.png`, `icon2.png`), sorted lexically. `favicon` only works at the root of `app/`; use `icon` if you need per-segment control.

### Open Graph images

Put `opengraph-image.jpg` in `app/` for a site-wide image, or deeper in the tree for a route-specific one — **the more specific file wins**. An `opengraph-image.alt.txt` beside it supplies the alt text.

> Size limits are enforced at build time: `twitter-image` must be ≤ 5 MB and `opengraph-image` ≤ 8 MB, or the build fails.

### Generated OG images with `ImageResponse`

For an image that depends on data, use `opengraph-image.tsx` and the `ImageResponse` constructor from `next/og`:

```tsx filename="app/blog/[slug]/opengraph-image.tsx"
import { ImageResponse } from 'next/og'
import { getPost } from '@/app/lib/data'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {post.title}
      </div>
    )
  )
}
```

`ImageResponse` converts HTML and CSS to PNG via satori and resvg. **Only flexbox and a subset of CSS are supported** — `display: grid` will not work. Custom fonts, text wrapping, absolute positioning and nested images do.

### `robots.txt`

Static:

```txt filename="app/robots.txt"
User-Agent: *
Allow: /
Disallow: /private/

Sitemap: https://acme.com/sitemap.xml
```

Or generated, with per-agent rules:

```ts filename="app/robots.ts"
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Googlebot', allow: ['/'], disallow: '/private/' },
      { userAgent: ['Applebot', 'Bingbot'], disallow: ['/'] },
    ],
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

Non-standard directives (Yandex's `Clean-param`, Seznam's `Request-Rate`) go through the `other` field, added in **v16.3**. Values are passed through verbatim and are not validated:

```ts
{ userAgent: 'SeznamBot', allow: '/', other: { 'Request-Rate': '10/1m' } }
```

> `robots.js` is a Route Handler and is **cached by default** unless it uses a request-time API or dynamic config.

### `sitemap.xml`

Small sites can ship a literal `app/sitemap.xml`. Otherwise generate it:

```ts filename="app/sitemap.ts"
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://acme.com', lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
    { url: 'https://acme.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://acme.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ]
}
```

Entries also accept `images` and `videos` arrays, which emit image and video sitemap namespaces, and `alternates.languages` for localized sitemaps. Like `robots.js`, it is cached by default.

### Splitting large sitemaps

Google's limit is **50,000 URLs per sitemap**. `generateSitemaps` produces a set of them, served at `/.../sitemap/[id].xml`:

```ts filename="app/product/sitemap.ts"
import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/app/lib/constants'

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id
  const start = Number(id) * 50000
  const products = await getProducts(
    `SELECT id, date FROM products WHERE id BETWEEN ${start} AND ${start + 50000}`
  )
  return products.map((product) => ({
    url: `${BASE_URL}/product/${product.id}`,
    lastModified: product.date,
  }))
}
```

> **Changed in v16:** `id` is now passed as a **promise** that resolves to a string, so it must be awaited.

## Structured data (JSON-LD)

[JSON-LD](https://json-ld.org/) describes what a page *is* — a product, a recipe, an event, a person — in a form search engines and AI systems can act on. The current recommendation is a plain `<script>` tag rendered from `layout.js` or `page.js`:

```tsx filename="app/products/[id]/page.tsx"
export default async function Page({ params }) {
  const product = await getProduct((await params).id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: product.description,
  }

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {/* ... */}
    </section>
  )
}
```

Two things to note:

* **`JSON.stringify` does not sanitize.** A `<` inside your data can close the script tag and open an XSS hole, which is why it is replaced with its unicode escape `<`. Use your organisation's sanitizer, or a library such as [`serialize-javascript`](https://www.npmjs.com/package/serialize-javascript).
* **Use a native `<script>`, not `next/script`.** `next/script` optimizes the loading and execution of JavaScript; JSON-LD is data, not code.

Type it with [`schema-dts`](https://www.npmjs.com/package/schema-dts) if you want compile-time checking, and validate the output with Google's [Rich Results Test](https://search.google.com/test/rich-results) or the [Schema Markup Validator](https://validator.schema.org/).

## What the Metadata API does not cover

| Tag | Instead |
| --- | --- |
| `<meta http-equiv>` | HTTP headers — `redirect()`, proxy, or `headers` config |
| `<base>`, `<noscript>` | Render the tag in the layout or page |
| `<style>`, `<link rel="stylesheet">` | Import the stylesheet directly |
| `<script>` | `next/script` |
| `<link rel="preload" / "preconnect" / "dns-prefetch">` | ReactDOM methods, below |

Resource hints go through `ReactDOM` from a Client Component:

```tsx filename="app/preload-resources.tsx"
'use client'

import ReactDOM from 'react-dom'

export function PreloadResources() {
  ReactDOM.preload('...', { as: '...' })
  ReactDOM.preconnect('...', { crossOrigin: '...' })
  ReactDOM.prefetchDNS('...')

  return null
}
```

`next/font`, `next/image` and `next/script` already emit their own hints, so this is only for resources you load yourself.

## Rendering behaviour that affects SEO

### Streaming metadata

For dynamically rendered pages, Next.js does **not** block the response on `generateMetadata`. The UI streams first and the metadata tags are appended to `<body>` once they resolve. This lowers TTFB and can improve LCP.

That is safe for crawlers that execute JavaScript and read the full DOM, such as Googlebot. For **HTML-limited bots** that do not — `facebookexternalhit`, `Twitterbot`, `Slackbot`, `Bingbot` — Next.js detects the User-Agent and falls back to blocking, so the metadata lands in `<head>` where those bots expect it.

You can override the detection list, or disable streaming metadata altogether:

```ts filename="next.config.ts"
const config: NextConfig = {
  htmlLimitedBots: /.*/,
}
```

The default is right for almost everyone; overriding it costs response time. Prerendered pages do not stream metadata at all — it is resolved at build time.

### With Cache Components

When Cache Components are enabled, `generateMetadata` follows the same rules as any other component. If it reads runtime data (`cookies()`, `headers()`, `params`, `searchParams`) or does uncached fetching, it defers to request time.

* If the rest of the page also defers, metadata simply streams in with everything else.
* If the page is **otherwise fully prerenderable**, Next.js raises an error rather than silently making the page dynamic, and names the page or layout to fix.

Two ways out. If the metadata depends on external data but not on the request, cache it:

```tsx filename="app/page.tsx"
export async function generateMetadata() {
  'use cache'
  const { title, description } = await db.query('site-metadata')
  return { title, description }
}
```

If it genuinely needs runtime data, declare that intent with a marker component so the static content still prerenders:

```tsx filename="app/page.tsx"
import { Suspense } from 'react'
import { connection } from 'next/server'

const Connection = async () => {
  await connection()
  return null
}

function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  )
}

export default function Page() {
  // Do NOT put `await connection()` here — it would keep the
  // article out of the static shell.
  return (
    <>
      <article>Static content</article>
      <DynamicMarker />
    </>
  )
}
```

See [NextJs_Caching.md](NextJs_Caching.md) and [NextJs_Rendering.md](NextJs_Rendering.md) for the surrounding model.

## Summary

Metadata resolves on the server, from the root layout down to the page, and merges shallowly — which means nested objects like `openGraph` are replaced whole, not patched. Put the site-wide defaults (`metadataBase`, `title.template`, `openGraph`) in the root layout and override per route from there.

Reach for `generateMetadata` only when the values depend on data, and wrap the loader in React's `cache` so the page does not fetch the same record twice. For anything that has a file convention — icons, OG images, `robots.txt`, `sitemap.xml` — use the file: there is no config to drift out of sync with reality.

The rest is discipline: a canonical URL on every page, `alt` text on every image, JSON-LD escaped before it reaches the DOM, and a sitemap that stays under 50,000 URLs per file.

## Further reading

* [Metadata and OG images](/docs/app/getting-started/metadata-and-og-images) — the guide this note condenses
* [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata) — the complete field reference
* [Metadata file conventions](/docs/app/api-reference/file-conventions/metadata)
* [`ImageResponse`](/docs/app/api-reference/functions/image-response) — supported CSS and fonts
* [JSON-LD](/docs/app/guides/json-ld)
* [`generateSitemaps`](/docs/app/api-reference/functions/generate-sitemaps)
* [Vercel OG Playground](https://og-playground.vercel.app/) — preview `ImageResponse` output
* [Rich Results Test](https://search.google.com/test/rich-results) — validate structured data
